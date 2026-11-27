const fs = require("fs");
const path = require("path");
const prisma = require("../utils/prisma");
const queueService = require("./queue.service");
const pickingProgressService = require("./pickingProgress.service");
const scheduleService = require("./schedule.service");
const reportService = require("./report.service");
const {
  buildQueueWorkbook,
  buildPickingProgressWorkbook,
  buildScheduleWorkbook,
  buildReportWorkbook,
} = require("./exportBuilders");

/** Export dengan jumlah baris di atas ini dijalankan sebagai job background. */
const SYNC_ROW_LIMIT = 5000;
/** File hasil export dihapus setelah 24 jam. */
const FILE_TTL_MS = 24 * 60 * 60 * 1000;

const EXPORT_DIR = path.join(__dirname, "..", "..", "exports");

const EXPORT_TYPES = {
  QUEUE: {
    key: "QUEUE",
    label: "Antrian Truk",
    fileNamePrefix: "antrian_truk",
    async count(scope) {
      return prisma.queueEntry.count({
        where: { registerTime: { gte: scope.from, lte: scope.to } },
      });
    },
    async load(scope) {
      return queueService.listQueueEntriesForExport({
        dateFrom: scope.dateFrom,
        dateTo: scope.dateTo,
      });
    },
    build: buildQueueWorkbook,
    countRows: (data) => data.length,
  },
  PICKING_PROGRESS: {
    key: "PICKING_PROGRESS",
    label: "Picking Progress",
    fileNamePrefix: "picking_progress",
    async count(scope) {
      return prisma.pickingProgress.count({
        where: { date: { gte: scope.from, lte: scope.to } },
      });
    },
    async load(scope) {
      return pickingProgressService.listPickingProgressForExport({
        dateFrom: scope.dateFrom,
        dateTo: scope.dateTo,
      });
    },
    build: buildPickingProgressWorkbook,
    countRows: (data) => data.length,
  },
  SCHEDULE: {
    key: "SCHEDULE",
    label: "Schedule Pengiriman",
    fileNamePrefix: "schedule_pengiriman",
    async count(scope) {
      return prisma.shipmentScheduleItem.count({
        where: { schedule: { scheduleDate: { gte: scope.from, lte: scope.to } } },
      });
    },
    async load(scope) {
      return scheduleService.listSchedulesForExport({
        dateFrom: scope.dateFrom,
        dateTo: scope.dateTo,
      });
    },
    build: buildScheduleWorkbook,
    countRows: (data) =>
      data.reduce((total, schedule) => total + Math.max(1, schedule.items?.length || 0), 0),
  },
  REPORT_SCHEDULE_VS_ACTUAL: {
    key: "REPORT_SCHEDULE_VS_ACTUAL",
    label: "Report Schedule vs Aktual",
    fileNamePrefix: "report_schedule_vs_aktual",
    // Laporan berisi dua tabel sekaligus (Plan + Aktual), jadi ambangnya lebih tinggi.
    syncRowLimit: 10000,
    async count(scope) {
      return reportService.countReportRows({
        dateFrom: scope.dateFrom,
        dateTo: scope.dateTo,
      });
    },
    async load(scope) {
      return reportService.buildReport({
        dateFrom: scope.dateFrom,
        dateTo: scope.dateTo,
      });
    },
    build: buildReportWorkbook,
    countRows: (report) =>
      (report?.summary?.totalPlan || 0) + (report?.actualRows?.length || 0),
  },
};

function getExportType(type) {
  const normalized = typeof type === "string" ? type.toUpperCase() : "";
  const definition = EXPORT_TYPES[normalized];
  if (!definition) {
    const error = new Error("Jenis export tidak dikenal");
    error.status = 400;
    throw error;
  }
  return definition;
}

function buildFileName(definition, scope) {
  return `${definition.fileNamePrefix}_${scope.fileToken}.xlsx`;
}

async function estimateExport(type, scope) {
  const definition = getExportType(type);
  const count = await definition.count(scope);
  const syncRowLimit = definition.syncRowLimit || SYNC_ROW_LIMIT;
  return {
    type: definition.key,
    label: definition.label,
    scopeLabel: scope.label,
    dateFrom: scope.dateFrom,
    dateTo: scope.dateTo,
    count,
    mode: count > syncRowLimit ? "async" : "sync",
    syncRowLimit,
  };
}

async function buildWorkbookFor(type, scope) {
  const definition = getExportType(type);
  const data = await definition.load(scope);
  const workbook = definition.build(data);
  return {
    workbook,
    rowCount: definition.countRows(data),
    fileName: buildFileName(definition, scope),
  };
}

/* ------------------------------------------------------------------ */
/* Job background                                                      */
/* ------------------------------------------------------------------ */

let workerRunning = false;

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

async function createExportJob({ type, scope, user }) {
  const definition = getExportType(type);
  ensureExportDir();

  const job = await prisma.exportJob.create({
    data: {
      type: definition.key,
      status: "MENUNGGU",
      scopeLabel: scope.label,
      params: {
        mode: scope.mode,
        year: scope.year,
        month: scope.month,
        dateFrom: scope.dateFrom,
        dateTo: scope.dateTo,
      },
      createdById: user?.id || null,
      createdByRole: user?.role || null,
    },
  });

  void kickExportWorker();
  return job;
}

async function processExportJob(job) {
  const params = job.params || {};

  const scope = {
    mode: params.mode || "year",
    year: params.year ?? null,
    month: params.month ?? null,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    from: startOfDayFromIso(params.dateFrom),
    to: endOfDayFromIso(params.dateTo),
    label: job.scopeLabel,
    fileToken: buildFileToken(params),
  };

  const { workbook, rowCount, fileName } = await buildWorkbookFor(job.type, scope);

  ensureExportDir();
  const safeName = `${job.id}_${fileName}`;
  const filePath = path.join(EXPORT_DIR, safeName);

  await workbook.xlsx.writeFile(filePath);
  const stats = fs.statSync(filePath);

  return prisma.exportJob.update({
    where: { id: job.id },
    data: {
      status: "SELESAI",
      rowCount,
      fileName,
      filePath,
      fileSize: stats.size,
      finishedAt: new Date(),
      expiresAt: new Date(Date.now() + FILE_TTL_MS),
      error: null,
    },
  });
}

function startOfDayFromIso(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function endOfDayFromIso(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

function buildFileToken(params) {
  if (params.mode === "month") {
    return `${params.year}-${String(params.month).padStart(2, "0")}`;
  }
  if (params.mode === "range") {
    return `${params.dateFrom}_sampai_${params.dateTo}`;
  }
  return String(params.year);
}

async function kickExportWorker() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    for (;;) {
      const job = await prisma.exportJob.findFirst({
        where: { status: "MENUNGGU" },
        orderBy: { createdAt: "asc" },
      });
      if (!job) break;

      await prisma.exportJob.update({
        where: { id: job.id },
        data: { status: "PROSES", startedAt: new Date(), error: null },
      });

      try {
        await processExportJob(job);
      } catch (error) {
        console.error(`[export-job] gagal memproses ${job.id}`, error);
        await prisma.exportJob.update({
          where: { id: job.id },
          data: {
            status: "GAGAL",
            error: error?.message?.slice(0, 500) || "Gagal membuat file export",
            finishedAt: new Date(),
          },
        });
      }
    }
  } finally {
    workerRunning = false;
  }
}

/**
 * Job yang masih berstatus PROSES saat proses mati tidak akan pernah selesai.
 * Saat startup semuanya ditandai GAGAL supaya user bisa mengulang.
 * Job yang masih MENUNGGU tidak disentuh: worker akan mengambilnya.
 */
async function markStaleExportJobsFailed() {
  const result = await prisma.exportJob.updateMany({
    where: { status: "PROSES" },
    data: {
      status: "GAGAL",
      error: "Server restart saat export diproses. Silakan ulangi.",
      finishedAt: new Date(),
    },
  });
  return result.count;
}

async function cleanupExpiredExportFiles(now = new Date()) {
  const expired = await prisma.exportJob.findMany({
    where: { expiresAt: { lt: now }, filePath: { not: null } },
    select: { id: true, filePath: true },
  });

  let removed = 0;
  for (const job of expired) {
    try {
      if (job.filePath && fs.existsSync(job.filePath)) {
        fs.unlinkSync(job.filePath);
      }
      removed += 1;
    } catch (error) {
      console.error(`[export-cleanup] gagal menghapus file ${job.filePath}`, error);
    }
  }

  if (expired.length > 0) {
    await prisma.exportJob.updateMany({
      where: { id: { in: expired.map((job) => job.id) } },
      data: { filePath: null, fileName: null },
    });
  }

  return removed;
}

async function getExportJobById(id) {
  const job = await prisma.exportJob.findUnique({ where: { id } });
  if (!job) {
    const error = new Error("Job export tidak ditemukan");
    error.status = 404;
    throw error;
  }
  return job;
}

async function listUserExportJobs(user, limit = 5) {
  return prisma.exportJob.findMany({
    where: user?.id ? { createdById: user.id } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

module.exports = {
  SYNC_ROW_LIMIT,
  FILE_TTL_MS,
  EXPORT_DIR,
  EXPORT_TYPES,
  getExportType,
  estimateExport,
  buildWorkbookFor,
  buildFileName,
  createExportJob,
  kickExportWorker,
  markStaleExportJobsFailed,
  cleanupExpiredExportFiles,
  getExportJobById,
  listUserExportJobs,
};
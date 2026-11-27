const fs = require("fs");
const prisma = require("../utils/prisma");
const adminUserService = require("../services/adminUser.service");
const exportService = require("../services/export.service");
const { resolveExportScope } = require("../utils/exportScope");
const { sendSuccess } = require("../utils/response");

const YEAR_QUERIES = {
  QUEUE: `SELECT DISTINCT EXTRACT(YEAR FROM "registerTime")::int AS year FROM "QueueEntry" ORDER BY 1 DESC`,
  PICKING_PROGRESS: `SELECT DISTINCT EXTRACT(YEAR FROM "date")::int AS year FROM "PickingProgress" ORDER BY 1 DESC`,
  SCHEDULE: `SELECT DISTINCT EXTRACT(YEAR FROM "scheduleDate")::int AS year FROM "ShipmentSchedule" ORDER BY 1 DESC`,
  // Report memuat dua sisi: tanggal rencana dan jam tiba aktual.
  REPORT_SCHEDULE_VS_ACTUAL: `SELECT DISTINCT EXTRACT(YEAR FROM "scheduleDate")::int AS year FROM "ShipmentSchedule" UNION SELECT DISTINCT EXTRACT(YEAR FROM "registerTime")::int AS year FROM "QueueEntry" ORDER BY 1 DESC`,
};

async function resolveActor(req) {
  if (!req.user?.sub) return null;
  return adminUserService.getAdminUserById(req.user.sub);
}

async function listYears(type) {
  const query = YEAR_QUERIES[type];
  if (!query) return [new Date().getFullYear()];
  const rows = await prisma.$queryRawUnsafe(query);
  return rows.map((row) => Number(row.year)).filter((year) => Number.isFinite(year));
}

async function getExportOptions(req, res, next) {
  try {
    const currentYear = new Date().getFullYear();
    const options = {};

    for (const type of Object.keys(exportService.EXPORT_TYPES)) {
      const years = await listYears(type);
      const merged = Array.from(new Set([currentYear, ...years])).sort((a, b) => b - a);
      options[type] = {
        label: exportService.EXPORT_TYPES[type].label,
        years: merged,
        defaultYear: currentYear,
        syncRowLimit:
          exportService.EXPORT_TYPES[type].syncRowLimit || exportService.SYNC_ROW_LIMIT,
      };
    }

    return sendSuccess(res, {
      syncRowLimit: exportService.SYNC_ROW_LIMIT,
      fileTtlHours: exportService.FILE_TTL_MS / (60 * 60 * 1000),
      options,
    });
  } catch (err) {
    return next(err);
  }
}

async function estimateExport(req, res, next) {
  try {
    const scope = resolveExportScope(req.query);
    const estimate = await exportService.estimateExport(req.query.type, scope);
    return sendSuccess(res, estimate);
  } catch (err) {
    return next(err);
  }
}

async function createExportJob(req, res, next) {
  try {
    const scope = resolveExportScope(req.body || {});
    const actor = await resolveActor(req);
    const job = await exportService.createExportJob({
      type: req.body?.type,
      scope,
      user: actor ? { id: actor.id, role: actor.role } : { id: null, role: req.user?.role || null },
    });
    return sendSuccess(res, job, "Export sedang diproses");
  } catch (err) {
    return next(err);
  }
}

async function getExportJob(req, res, next) {
  try {
    const job = await exportService.getExportJobById(req.params.id);
    return sendSuccess(res, {
      id: job.id,
      type: job.type,
      status: job.status,
      scopeLabel: job.scopeLabel,
      rowCount: job.rowCount,
      fileName: job.fileName,
      fileSize: job.fileSize,
      error: job.error,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
      expiresAt: job.expiresAt,
      downloadable: job.status === "SELESAI" && Boolean(job.filePath),
    });
  } catch (err) {
    return next(err);
  }
}

async function listExportJobs(req, res, next) {
  try {
    const actor = await resolveActor(req);
    const jobs = await exportService.listUserExportJobs(
      actor ? { id: actor.id } : null,
      Number(req.query.limit) || 5
    );
    return sendSuccess(
      res,
      jobs.map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        scopeLabel: job.scopeLabel,
        rowCount: job.rowCount,
        fileName: job.fileName,
        error: job.error,
        createdAt: job.createdAt,
        finishedAt: job.finishedAt,
        downloadable: job.status === "SELESAI" && Boolean(job.filePath),
      }))
    );
  } catch (err) {
    return next(err);
  }
}

async function downloadExportJob(req, res, next) {
  try {
    const job = await exportService.getExportJobById(req.params.id);

    if (job.status !== "SELESAI" || !job.filePath) {
      const error = new Error(
        job.status === "GAGAL"
          ? job.error || "Export gagal diproses"
          : "File export belum siap"
      );
      error.status = 409;
      throw error;
    }

    if (job.expiresAt && job.expiresAt.getTime() < Date.now()) {
      const error = new Error("File export sudah kedaluwarsa, silakan export ulang");
      error.status = 410;
      throw error;
    }

    if (!fs.existsSync(job.filePath)) {
      const error = new Error("File export tidak ditemukan di server");
      error.status = 410;
      throw error;
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${job.fileName}"`);
    return res.download(job.filePath, job.fileName);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getExportOptions,
  estimateExport,
  createExportJob,
  getExportJob,
  listExportJobs,
  downloadExportJob,
};
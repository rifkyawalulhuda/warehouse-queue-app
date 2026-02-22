const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const ALLOWED_LIMITS = new Set([15, 30, 50, 100]);
const ALLOWED_SORT_FIELDS = new Set(["createdAt", "startTime", "finishTime"]);
const ALLOWED_PICKING_STATUSES = new Set(["MENUNGGU", "ON_PROCESS", "SELESAI", "BATAL"]);
const DEFAULT_SLA_PER_BARCODE_MINUTES = 2.5;
const NEAR_SLA_SECONDS = 15 * 60;

function createHttpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

function parseDateOnly(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function getEndOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function resolveDateRange(rawDate) {
  const dateObj = parseDateOnly(rawDate) || new Date();
  return { from: getStartOfDay(dateObj), to: getEndOfDay(dateObj) };
}

function resolveTransactionDate(rawDate) {
  if (!rawDate) return getStartOfDay(new Date());
  const parsedDateOnly = parseDateOnly(rawDate);
  if (parsedDateOnly) return getStartOfDay(parsedDateOnly);

  const dateTime = new Date(rawDate);
  if (Number.isNaN(dateTime.getTime())) {
    throw createHttpError(400, "Format date tidak valid");
  }
  return getStartOfDay(dateTime);
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeStatus(value) {
  if (!value || value === "ALL") return null;
  if (!ALLOWED_PICKING_STATUSES.has(value)) {
    throw createHttpError(400, "Status filter tidak valid");
  }
  return value;
}

function normalizeSort(query) {
  const rawSort = typeof query.sort === "string" ? query.sort : "";
  const rawSortDir = typeof query.sortDir === "string" ? query.sortDir.toLowerCase() : "";
  const sort = ALLOWED_SORT_FIELDS.has(rawSort) ? rawSort : "createdAt";
  const sortDir = rawSortDir === "asc" ? "asc" : "desc";
  return { sort, sortDir };
}

function normalizePagination(query) {
  const rawPage = typeof query.page === "string" ? Number(query.page) : Number(query.page);
  const rawLimit = typeof query.limit === "string" ? Number(query.limit) : Number(query.limit);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const limit = ALLOWED_LIMITS.has(rawLimit) ? rawLimit : 15;
  return { page, limit };
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function computeSlaFields(entry, nowMs = Date.now()) {
  const doNumber = normalizeText(entry.doNumber) || normalizeText(entry.noContainer);
  const destination = normalizeText(entry.destination) || normalizeText(entry.noDock);
  const plTimeRelease = entry.plTimeRelease || entry.startTime || null;
  const slaPerBarcodeMinutes = toNumber(entry.slaPerBarcodeMinutes) ?? DEFAULT_SLA_PER_BARCODE_MINUTES;
  const slaTotalMinutes = Number(entry.pickingQty || 0) * slaPerBarcodeMinutes;

  let deadlineTime = null;
  let timeRemainingSeconds = null;
  const slaBaseTime = entry.startTime || plTimeRelease;
  if (slaBaseTime) {
    const startMs = new Date(slaBaseTime).getTime();
    if (!Number.isNaN(startMs)) {
      const deadlineMs = startMs + slaTotalMinutes * 60 * 1000;
      deadlineTime = new Date(deadlineMs);
      timeRemainingSeconds = Math.floor((deadlineMs - nowMs) / 1000);
    }
  }

  const safePickingQty = Math.max(0, Number(entry.pickingQty || 0));
  const safePickedQty = clampNumber(Number(entry.pickedQty || 0), 0, safePickingQty);
  const remainQty = Math.max(0, safePickingQty - safePickedQty);
  const pickingProgressPercent =
    safePickingQty > 0 ? Number(((safePickedQty / safePickingQty) * 100).toFixed(2)) : 0;

  const isOnProcess = entry.status === "ON_PROCESS";
  const isOverSla = isOnProcess && timeRemainingSeconds !== null && timeRemainingSeconds < 0;
  const isNearSla =
    isOnProcess &&
    timeRemainingSeconds !== null &&
    timeRemainingSeconds >= 0 &&
    timeRemainingSeconds < NEAR_SLA_SECONDS;

  return {
    ...entry,
    doNumber,
    destination,
    plTimeRelease,
    slaPerBarcodeMinutes,
    slaTotalMinutes,
    remainQty,
    pickingProgressPercent,
    deadlineTime,
    timeRemainingSeconds,
    isOverSla,
    isNearSla,
  };
}

async function ensureCustomerExists(customerId) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    throw createHttpError(400, "Customer tidak ditemukan");
  }
}

async function ensureEmployeeExists(employeeId) {
  if (!employeeId) {
    throw createHttpError(400, "Karyawan picker wajib dipilih");
  }
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    throw createHttpError(400, "Karyawan picker tidak ditemukan");
  }
  return employee;
}

async function createPickingProgress(data, actorUserId) {
  await ensureCustomerExists(data.customerId);
  const transactionDate = resolveTransactionDate(data.date);
  const doNumber = normalizeText(data.doNumber);
  const destination = normalizeText(data.destination);
  const plTimeRelease = data.plTimeRelease ? new Date(data.plTimeRelease) : new Date();
  const volumeCbm = Number(data.volumeCbm);

  const created = await prisma.pickingProgress.create({
    data: {
      date: transactionDate,
      customerId: data.customerId,
      doNumber,
      destination,
      volumeCbm,
      plTimeRelease,
      // Keep legacy columns populated for backward compatibility.
      noContainer: doNumber,
      noDock: destination,
      pickingQty: data.pickingQty,
      pickedQty: 0,
      status: "MENUNGGU",
      createdById: actorUserId || null,
      updatedById: actorUserId || null,
      logs: {
        create: {
          action: "CREATE",
          toStatus: "MENUNGGU",
          userId: actorUserId || null,
        },
      },
    },
    include: {
      customer: true,
      pickerEmployee: true,
      createdBy: { select: { id: true, name: true, username: true, role: true } },
      updatedBy: { select: { id: true, name: true, username: true, role: true } },
    },
  });

  return computeSlaFields(created);
}

async function listPickingProgress(query) {
  const status = normalizeStatus(query.status);
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const { from, to } = resolveDateRange(typeof query.date === "string" ? query.date : "");
  const { sort, sortDir } = normalizeSort(query);
  const { page, limit } = normalizePagination(query);

  const where = {
    date: {
      gte: from,
      lte: to,
    },
  };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { doNumber: { contains: search, mode: "insensitive" } },
      { destination: { contains: search, mode: "insensitive" } },
      { noContainer: { contains: search, mode: "insensitive" } },
      { noDock: { contains: search, mode: "insensitive" } },
    ];
  }

  const total = await prisma.pickingProgress.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = page > totalPages ? totalPages : page;
  const skip = (currentPage - 1) * limit;

  const itemsRaw = await prisma.pickingProgress.findMany({
    where,
    orderBy: [{ [sort]: sortDir }, { createdAt: "desc" }],
    skip,
    take: limit,
    include: {
      customer: true,
      pickerEmployee: true,
    },
  });

  const nowMs = Date.now();
  const items = itemsRaw.map((item) => computeSlaFields(item, nowMs));

  return {
    items,
    meta: {
      total,
      page: currentPage,
      limit,
      totalPages,
    },
  };
}

async function getPickingProgressById(id) {
  const entry = await prisma.pickingProgress.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { id: true, name: true, username: true, role: true } },
      updatedBy: { select: { id: true, name: true, username: true, role: true } },
      pickerEmployee: true,
      logs: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, username: true, role: true } },
        },
      },
    },
  });
  if (!entry) {
    throw createHttpError(404, "Data picking progress tidak ditemukan");
  }

  return computeSlaFields(entry);
}

async function startPickingProgress(id, actorUserId, pickerEmployeeId) {
  const pickerEmployee = await ensureEmployeeExists(pickerEmployeeId);
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const entry = await tx.pickingProgress.findUnique({ where: { id } });
    if (!entry) {
      throw createHttpError(404, "Data picking progress tidak ditemukan");
    }
    if (entry.status !== "MENUNGGU") {
      throw createHttpError(400, "Start hanya bisa dilakukan dari status MENUNGGU");
    }

    return tx.pickingProgress.update({
      where: { id },
      data: {
        status: "ON_PROCESS",
        startTime: now,
        plTimeRelease: entry.plTimeRelease || now,
        pickerEmployeeId: pickerEmployee.id,
        updatedById: actorUserId || null,
        logs: {
          create: {
            action: "START",
            note: `picker=${pickerEmployee.name} (${pickerEmployee.nik})`,
            fromStatus: "MENUNGGU",
            toStatus: "ON_PROCESS",
            userId: actorUserId || null,
          },
        },
      },
      include: {
        customer: true,
        pickerEmployee: true,
      },
    });
  });

  return computeSlaFields(result);
}

async function updatePickedQty(id, delta, actorUserId) {
  const result = await prisma.$transaction(async (tx) => {
    const entry = await tx.pickingProgress.findUnique({ where: { id } });
    if (!entry) {
      throw createHttpError(404, "Data picking progress tidak ditemukan");
    }
    if (entry.status !== "ON_PROCESS") {
      throw createHttpError(400, "Update picked qty hanya bisa saat status ON_PROCESS");
    }

    const before = entry.pickedQty;
    const next = clampNumber(before + delta, 0, entry.pickingQty);
    const appliedDelta = next - before;
    const note = `delta=${delta}, applied=${appliedDelta}, pickedQty=${next}/${entry.pickingQty}`;

    return tx.pickingProgress.update({
      where: { id },
      data: {
        pickedQty: next,
        updatedById: actorUserId || null,
        logs: {
          create: {
            action: "UPDATE_PICKED_QTY",
            note,
            fromStatus: "ON_PROCESS",
            toStatus: "ON_PROCESS",
            userId: actorUserId || null,
          },
        },
      },
      include: {
        customer: true,
        pickerEmployee: true,
      },
    });
  });

  return computeSlaFields(result);
}

async function finishPickingProgress(id, actorUserId) {
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const entry = await tx.pickingProgress.findUnique({ where: { id } });
    if (!entry) {
      throw createHttpError(404, "Data picking progress tidak ditemukan");
    }
    if (entry.status !== "ON_PROCESS") {
      throw createHttpError(400, "Finish hanya bisa dilakukan dari status ON_PROCESS");
    }
    if (entry.pickedQty !== entry.pickingQty) {
      throw createHttpError(400, "Finish hanya bisa jika Picked Qty sudah sama dengan Picking Qty");
    }

    return tx.pickingProgress.update({
      where: { id },
      data: {
        status: "SELESAI",
        finishTime: now,
        updatedById: actorUserId || null,
        logs: {
          create: {
            action: "FINISH",
            fromStatus: "ON_PROCESS",
            toStatus: "SELESAI",
            userId: actorUserId || null,
          },
        },
      },
      include: {
        customer: true,
        pickerEmployee: true,
      },
    });
  });

  return computeSlaFields(result);
}

async function cancelPickingProgress(id, actorUserId) {
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const entry = await tx.pickingProgress.findUnique({ where: { id } });
    if (!entry) {
      throw createHttpError(404, "Data picking progress tidak ditemukan");
    }
    if (entry.status === "SELESAI" || entry.status === "BATAL") {
      throw createHttpError(400, "Status sudah final dan tidak bisa dibatalkan");
    }

    return tx.pickingProgress.update({
      where: { id },
      data: {
        status: "BATAL",
        finishTime: entry.finishTime || now,
        updatedById: actorUserId || null,
        logs: {
          create: {
            action: "CANCEL",
            fromStatus: entry.status,
            toStatus: "BATAL",
            userId: actorUserId || null,
          },
        },
      },
      include: {
        customer: true,
        pickerEmployee: true,
      },
    });
  });

  return computeSlaFields(result);
}

module.exports = {
  createPickingProgress,
  listPickingProgress,
  getPickingProgressById,
  startPickingProgress,
  updatePickedQty,
  finishPickingProgress,
  cancelPickingProgress,
};

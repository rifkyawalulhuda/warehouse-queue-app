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

function parseExcelDateSerial(serial) {
  const numericValue = Number(serial);
  if (!Number.isFinite(numericValue)) return null;

  // Excel serial date base (with Excel 1900 leap-year behavior compensation).
  const excelBaseUtcMs = Date.UTC(1899, 11, 30);
  const wholeDays = Math.floor(numericValue);
  const utcDate = new Date(excelBaseUtcMs + wholeDays * 24 * 60 * 60 * 1000);
  if (Number.isNaN(utcDate.getTime())) return null;

  return new Date(
    Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate(), 0, 0, 0, 0)
  );
}

function parseImportDateString(value) {
  const text = normalizeText(value);
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return date;
    }
    return null;
  }

  const dmyMatch = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return date;
    }
    return null;
  }

  return null;
}

function getStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function getEndOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function resolveDateRange(query) {
  const rawDate = typeof query?.date === "string" ? query.date : "";
  const rawDateFrom = typeof query?.dateFrom === "string" ? query.dateFrom : "";
  const rawDateTo = typeof query?.dateTo === "string" ? query.dateTo : "";

  // Backward compatibility: single date filter.
  if (rawDate) {
    const dateObj = parseDateOnly(rawDate);
    if (!dateObj) {
      throw createHttpError(400, "Format date tidak valid");
    }
    return { from: getStartOfDay(dateObj), to: getEndOfDay(dateObj) };
  }

  // Range mode (if one side empty, use the other side).
  if (rawDateFrom || rawDateTo) {
    const effectiveFrom = rawDateFrom || rawDateTo;
    const effectiveTo = rawDateTo || rawDateFrom;
    const fromDate = parseDateOnly(effectiveFrom);
    const toDate = parseDateOnly(effectiveTo);
    if (!fromDate || !toDate) {
      throw createHttpError(400, "Format rentang tanggal tidak valid");
    }
    if (fromDate.getTime() > toDate.getTime()) {
      throw createHttpError(400, "Tanggal mulai tidak boleh lebih besar dari tanggal akhir");
    }
    return { from: getStartOfDay(fromDate), to: getEndOfDay(toDate) };
  }

  // Default: centered 7 days (today -3 .. today +3).
  const today = new Date();
  const fromSeed = new Date(today);
  fromSeed.setDate(fromSeed.getDate() - 3);
  const toSeed = new Date(today);
  toSeed.setDate(toSeed.getDate() + 3);
  const fromDate = getStartOfDay(fromSeed);
  const toDate = getEndOfDay(toSeed);
  return { from: fromDate, to: toDate };
}

function toUtcMidnightByLocalDateParts(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
}

function parseDateOnlyToUtcMidnight(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function resolveTransactionDate(rawDate) {
  if (!rawDate) return toUtcMidnightByLocalDateParts(new Date());
  const parsedDateOnlyUtc = parseDateOnlyToUtcMidnight(rawDate);
  if (parsedDateOnlyUtc) return parsedDateOnlyUtc;

  const dateTime = new Date(rawDate);
  if (Number.isNaN(dateTime.getTime())) {
    throw createHttpError(400, "Format date tidak valid");
  }
  return toUtcMidnightByLocalDateParts(dateTime);
}

function buildExportDateRange(query) {
  const { dateFrom, dateTo } = query || {};
  if (!dateFrom || !dateTo) return null;
  const fromDate = parseDateOnly(dateFrom);
  const toDate = parseDateOnly(dateTo);
  if (!fromDate || !toDate) return null;
  const from = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate(),
    0,
    0,
    0,
    0
  );
  const to = new Date(
    toDate.getFullYear(),
    toDate.getMonth(),
    toDate.getDate(),
    23,
    59,
    59,
    999
  );
  return { from, to };
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

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDateToYmd(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
}

function formatDateForSearch(value) {
  if (!value) return [];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return [];
  const dd = pad2(date.getDate());
  const mm = pad2(date.getMonth() + 1);
  const yyyy = date.getFullYear();
  const hh = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return [
    date.toISOString(),
    `${dd}/${mm}/${yyyy}`,
    `${yyyy}-${mm}-${dd}`,
    `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`,
    `${dd}/${mm}/${yyyy}, ${hh}:${mi}:${ss}`,
  ];
}

function formatTimeRemainingForSearch(seconds) {
  if (seconds === null || seconds === undefined) return ["-"];
  const abs = Math.abs(seconds);
  const mins = Math.floor(abs / 60);
  const secs = abs % 60;
  const base = `${mins}m ${pad2(secs)}s`;
  if (seconds < 0) {
    return [`over sla ${base}`, `-${base}`, String(seconds)];
  }
  return [base, String(seconds)];
}

function formatPercentageForSearch(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0%";
  return `${num.toFixed(2).replace(/\.?0+$/, "")}%`;
}

function extractLegacyCustomerIdsFromUpdateNote(note) {
  if (typeof note !== "string") return null;
  const match = note.match(/customerId=([^,\s]+)->([^,\s]+)/i);
  if (!match) return null;
  return { oldId: match[1], newId: match[2] };
}

function replaceLegacyCustomerIdsWithNames(note, customerNameMap) {
  if (typeof note !== "string") return note;
  return note.replace(/customerId=([^,\s]+)->([^,\s]+)/i, (_, oldId, newId) => {
    const oldName = customerNameMap.get(oldId) || oldId;
    const newName = customerNameMap.get(newId) || newId;
    return `customerName=${oldName}->${newName}`;
  });
}

function buildSearchTokens(entry) {
  const progress =
    entry.pickingProgressPercent !== undefined && entry.pickingProgressPercent !== null
      ? Number(entry.pickingProgressPercent)
      : 0;
  const remain = entry.remainQty !== undefined && entry.remainQty !== null ? entry.remainQty : 0;

  return [
    entry.customer?.name,
    entry.doNumber,
    entry.destination,
    entry.pickerEmployee?.name,
    entry.pickerEmployee?.nik,
    entry.status,
    entry.volumeCbm !== null && entry.volumeCbm !== undefined ? String(entry.volumeCbm) : "",
    String(entry.pickingQty ?? ""),
    String(entry.pickedQty ?? ""),
    String(remain),
    progress.toFixed(2),
    `${progress.toFixed(2)}%`,
    formatPercentageForSearch(progress),
    ...formatDateForSearch(entry.plTimeRelease || entry.startTime),
    ...formatTimeRemainingForSearch(entry.timeRemainingSeconds),
  ]
    .map((value) => String(value || "").trim())
    .filter((value) => value.length > 0);
}

function computeSlaFields(entry, nowMs = Date.now()) {
  const doNumber = normalizeText(entry.doNumber);
  const destination = normalizeText(entry.destination);
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
  return customer;
}

async function resolveCustomersByNameMap() {
  const customers = await prisma.customer.findMany({
    select: { id: true, name: true },
  });
  const map = new Map();
  customers.forEach((customer) => {
    const key = normalizeText(customer.name).toLowerCase();
    if (!key) return;
    if (!map.has(key)) map.set(key, customer);
  });
  return map;
}

async function listCustomerNamesForTemplate() {
  const customers = await prisma.customer.findMany({
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return customers.map((customer) => customer.name).filter((name) => Boolean(name));
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

async function updatePickingProgress(id, data, actorUserId) {
  const existing = await prisma.pickingProgress.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          name: true,
        },
      },
    },
  });
  if (!existing) {
    throw createHttpError(404, "Data picking progress tidak ditemukan");
  }
  if (existing.status !== "MENUNGGU") {
    throw createHttpError(400, "Edit hanya bisa dilakukan saat status MENUNGGU");
  }

  const nextCustomer = await ensureCustomerExists(data.customerId);

  const transactionDate = resolveTransactionDate(data.date);
  const doNumber = normalizeText(data.doNumber);
  const destination = normalizeText(data.destination);
  const volumeCbm = Number(data.volumeCbm);
  const nextPickingQty = Number(data.pickingQty);
  const plTimeRelease = data.plTimeRelease
    ? new Date(data.plTimeRelease)
    : existing.plTimeRelease || new Date();

  if (Number.isNaN(plTimeRelease.getTime())) {
    throw createHttpError(400, "Format plTimeRelease tidak valid");
  }
  if (existing.pickedQty > nextPickingQty) {
    throw createHttpError(400, "Picking Qty tidak boleh lebih kecil dari Picked Qty saat ini");
  }

  const note = [
    `customerName=${existing.customer?.name || "-"}->${nextCustomer.name}`,
    `doNumber=${existing.doNumber}->${doNumber}`,
    `destination=${existing.destination}->${destination}`,
    `volumeCbm=${existing.volumeCbm ?? 0}->${volumeCbm}`,
    `pickingQty=${existing.pickingQty}->${nextPickingQty}`,
  ].join(", ");

  const updated = await prisma.pickingProgress.update({
    where: { id },
    data: {
      date: transactionDate,
      customerId: data.customerId,
      doNumber,
      destination,
      volumeCbm,
      plTimeRelease,
      pickingQty: nextPickingQty,
      updatedById: actorUserId || null,
      logs: {
        create: {
          action: "UPDATE",
          note,
          fromStatus: existing.status,
          toStatus: existing.status,
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

  return computeSlaFields(updated);
}

async function listPickingProgress(query) {
  const status = normalizeStatus(query.status);
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const { from, to } = resolveDateRange(query || {});
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
    const itemsRaw = await prisma.pickingProgress.findMany({
      where,
      orderBy: [{ [sort]: sortDir }, { createdAt: "desc" }],
      include: {
        customer: true,
        pickerEmployee: true,
      },
    });
    const nowMs = Date.now();
    const loweredSearch = search.toLowerCase();
    const filteredItems = itemsRaw
      .map((item) => computeSlaFields(item, nowMs))
      .filter((entry) =>
        buildSearchTokens(entry).some((token) => token.toLowerCase().includes(loweredSearch))
      );

    const total = filteredItems.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = page > totalPages ? totalPages : page;
    const skip = (currentPage - 1) * limit;
    const items = filteredItems.slice(skip, skip + limit);

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

  const legacyCustomerIds = new Set();
  entry.logs.forEach((log) => {
    if (log.action !== "UPDATE") return;
    const parsed = extractLegacyCustomerIdsFromUpdateNote(log.note);
    if (!parsed) return;
    legacyCustomerIds.add(parsed.oldId);
    legacyCustomerIds.add(parsed.newId);
  });

  let customerNameMap = new Map();
  if (legacyCustomerIds.size > 0) {
    const customers = await prisma.customer.findMany({
      where: { id: { in: Array.from(legacyCustomerIds) } },
      select: { id: true, name: true },
    });
    customerNameMap = new Map(customers.map((customer) => [customer.id, customer.name]));
  }

  const normalizedEntry = {
    ...entry,
    logs: entry.logs.map((log) => {
      if (log.action !== "UPDATE") return log;
      if (!extractLegacyCustomerIdsFromUpdateNote(log.note)) return log;
      return {
        ...log,
        note: replaceLegacyCustomerIdsWithNames(log.note, customerNameMap),
      };
    }),
  };

  return computeSlaFields(normalizedEntry);
}

async function listPickingProgressForExport(query) {
  const range = buildExportDateRange(query || {});
  const where = {};
  if (range) {
    where.date = {
      gte: range.from,
      lte: range.to,
    };
  }

  const itemsRaw = await prisma.pickingProgress.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      customer: true,
      pickerEmployee: true,
      logs: {
        where: { action: "CANCEL" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          note: true,
          createdAt: true,
        },
      },
    },
  });

  const nowMs = Date.now();
  return itemsRaw.map((item) => computeSlaFields(item, nowMs));
}

async function listPickingProgressForPrint(query) {
  const status = normalizeStatus(query?.status);
  const search = typeof query?.search === "string" ? query.search.trim() : "";
  const { from, to } = resolveDateRange(query || {});
  const { sort, sortDir } = normalizeSort(query || {});

  const where = {
    date: {
      gte: from,
      lte: to,
    },
  };
  if (status) where.status = status;

  const itemsRaw = await prisma.pickingProgress.findMany({
    where,
    orderBy: [{ [sort]: sortDir }, { createdAt: "desc" }],
    include: {
      customer: true,
      pickerEmployee: true,
      logs: {
        where: { action: "CANCEL" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          note: true,
          createdAt: true,
        },
      },
    },
  });

  const nowMs = Date.now();
  let items = itemsRaw.map((item) => computeSlaFields(item, nowMs));
  if (search) {
    const loweredSearch = search.toLowerCase();
    items = items.filter((entry) =>
      buildSearchTokens(entry).some((token) => token.toLowerCase().includes(loweredSearch))
    );
  }

  const activeItems = items.filter((item) => item.status !== "BATAL");

  const summary = activeItems.reduce(
    (acc, item) => {
      acc.totalDo += 1;
      acc.targetPickingQty += Number(item.pickingQty || 0);
      acc.pickedQty += Number(item.pickedQty || 0);
      acc.remainQty += Number(item.remainQty || 0);
      if (item.status === "MENUNGGU") acc.statusCounts.menunggu += 1;
      if (item.status === "ON_PROCESS") acc.statusCounts.onProcess += 1;
      if (item.status === "SELESAI") acc.statusCounts.selesai += 1;
      return acc;
    },
    {
      totalDo: 0,
      targetPickingQty: 0,
      pickedQty: 0,
      remainQty: 0,
      progressPercent: 0,
      statusCounts: {
        menunggu: 0,
        onProcess: 0,
        selesai: 0,
        batal: 0,
      },
    }
  );
  summary.statusCounts.batal = items.filter((item) => item.status === "BATAL").length;
  summary.progressPercent =
    summary.targetPickingQty > 0
      ? Number(((summary.pickedQty / summary.targetPickingQty) * 100).toFixed(2))
      : 0;

  return { summary, items };
}

async function importPickingProgressFromExcel(rows, actorUserId) {
  if (!Array.isArray(rows)) {
    throw createHttpError(400, "Data Excel tidak valid");
  }

  const uploadNow = new Date();
  const customerMap = await resolveCustomersByNameMap();

  const errors = [];
  const payloadRows = [];
  let totalRows = 0;

  rows.forEach((row) => {
    const rowNumber = row?.rowNumber || 0;
    const rawDateValue = row?.date;
    const customerName = normalizeText(row?.customerName);
    const doNumber = normalizeText(row?.doNumber);
    const destination = normalizeText(row?.destination);
    const volumeRaw = row?.volumeCbm;
    const pickingQtyRaw = row?.pickingQty;

    if (
      (rawDateValue === null || rawDateValue === undefined || rawDateValue === "") &&
      !customerName &&
      !doNumber &&
      !destination &&
      volumeRaw === "" &&
      pickingQtyRaw === ""
    ) {
      return;
    }
    totalRows += 1;

    const rowErrors = [];
    if (!customerName) rowErrors.push("Customer Name wajib diisi");
    if (!doNumber) rowErrors.push("DO Number wajib diisi");
    if (!destination) rowErrors.push("Destination wajib diisi");

    const volumeCbm = Number(volumeRaw);
    if (!Number.isFinite(volumeCbm) || volumeCbm < 0) {
      rowErrors.push("Volume (CBM) harus angka dan minimal 0");
    }

    const pickingQty = Number(pickingQtyRaw);
    if (!Number.isInteger(pickingQty) || pickingQty < 1) {
      rowErrors.push("Picking Qty (Barcode) harus angka bulat minimal 1");
    }

    let date = new Date(
      Date.UTC(uploadNow.getUTCFullYear(), uploadNow.getUTCMonth(), uploadNow.getUTCDate(), 0, 0, 0, 0)
    );
    if (rawDateValue !== null && rawDateValue !== undefined && rawDateValue !== "") {
      if (rawDateValue instanceof Date && !Number.isNaN(rawDateValue.getTime())) {
        date = new Date(
          Date.UTC(
            rawDateValue.getUTCFullYear(),
            rawDateValue.getUTCMonth(),
            rawDateValue.getUTCDate(),
            0,
            0,
            0,
            0
          )
        );
      } else if (typeof rawDateValue === "number") {
        const parsedDate = parseExcelDateSerial(rawDateValue);
        if (!parsedDate) {
          rowErrors.push("Tanggal tidak valid");
        } else {
          date = parsedDate;
        }
      } else {
        const parsedStringDate = parseImportDateString(rawDateValue);
        if (!parsedStringDate) {
          rowErrors.push("Tanggal tidak valid (pakai format YYYY-MM-DD atau DD/MM/YYYY)");
        } else {
          date = parsedStringDate;
        }
      }
    }

    const customerKey = customerName.toLowerCase();
    const customer = customerMap.get(customerKey);
    if (!customer) {
      rowErrors.push("Customer Name tidak ditemukan di Master Customer");
    }

    if (rowErrors.length > 0) {
      errors.push({ rowNumber, message: rowErrors.join(", ") });
      return;
    }

    payloadRows.push({
      date,
      customerId: customer.id,
      doNumber,
      destination,
      volumeCbm,
      pickingQty,
    });
  });

  if (payloadRows.length === 0 && totalRows === 0) {
    throw createHttpError(400, "Tidak ada data import yang valid");
  }

  if (payloadRows.length === 0) {
    return {
      totalRows,
      successRows: 0,
      failedRows: totalRows,
      errors,
      importedDates: [],
    };
  }

  let successRows = 0;
  const importedDateSet = new Set();
  await prisma.$transaction(async (tx) => {
    for (const row of payloadRows) {
      await tx.pickingProgress.create({
        data: {
          date: row.date,
          customerId: row.customerId,
          doNumber: row.doNumber,
          destination: row.destination,
          volumeCbm: row.volumeCbm,
          plTimeRelease: uploadNow,
          pickingQty: row.pickingQty,
          pickedQty: 0,
          status: "MENUNGGU",
          createdById: actorUserId || null,
          updatedById: actorUserId || null,
          logs: {
            create: {
              action: "CREATE",
              note: "CREATE via import excel",
              toStatus: "MENUNGGU",
              userId: actorUserId || null,
            },
          },
        },
      });
      successRows += 1;
      importedDateSet.add(formatDateToYmd(row.date));
    }
  });

  return {
    totalRows,
    successRows,
    failedRows: totalRows - successRows,
    errors,
    importedDates: Array.from(importedDateSet).filter((value) => Boolean(value)).sort(),
  };
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

async function cancelPickingProgress(id, actorUserId, cancelReason) {
  const reason = typeof cancelReason === "string" ? cancelReason.trim() : "";
  if (!reason) {
    throw createHttpError(400, "Alasan cancel wajib diisi");
  }

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
            note: reason,
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
  updatePickingProgress,
  listPickingProgress,
  listPickingProgressForExport,
  listPickingProgressForPrint,
  listCustomerNamesForTemplate,
  importPickingProgressFromExcel,
  getPickingProgressById,
  startPickingProgress,
  updatePickedQty,
  finishPickingProgress,
  cancelPickingProgress,
};

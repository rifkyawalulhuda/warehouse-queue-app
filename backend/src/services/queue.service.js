const prisma = require("../utils/prisma");
const {
  SYSTEM_LOADING_TYPE,
  isAllowedLoadingType,
} = require("../utils/loadingType");
const { getScheduleSettings } = require("./schedule.service");

const STATUS_FLOW = ["MENUNGGU", "IN_WH", "PROSES", "SELESAI"];
const SORTABLE_FIELDS = new Set([
  "registerTime",
  "inWhTime",
  "startTime",
  "finishTime",
  "customerName",
  "driverName",
  "truckNumber",
  "gateNo",
  "status",
]);
const SLA_STEP_MINUTES = 15;
const MAX_SLA_MINUTES = 24 * 60;
const LEGACY_WAITING_SLA_MINUTES = 30;
const AUTO_COMPLETE_AFTER_DAYS = 3;
const AUTO_COMPLETE_NOTE =
  "Otomatis diselesaikan sistem karena data antrian truk lebih dari 3 hari belum mencapai status SELESAI.";

function createHttpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

// Phase 1: container disimpan sebagai array. Form lama masih mengirim
// `containerNumber` (tunggal), jadi keduanya diterima.
// Container number ISO selalu huruf besar; normalisasi supaya pencarian
// `has` (exact match) tidak gagal karena beda kapitalisasi.
function normalizeContainerNumbers(data) {
  const normalize = (value) =>
    typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : "";
  if (Array.isArray(data.containerNumbers)) {
    return data.containerNumbers.map(normalize).filter(Boolean);
  }
  if (typeof data.containerNumber === "string" && data.containerNumber.trim()) {
    return [normalize(data.containerNumber)];
  }
  return [];
}

// Phase 1: frontend masih membaca `containerNumber` (tunggal). Shim ini
// dihapus pada Phase 4 saat form antrian memakai array.
function withLegacyContainerNumber(entry) {
  if (!entry) return entry;
  const containerNumbers = entry.containerNumbers || [];
  return {
    ...entry,
    containerNumber: containerNumbers.length > 0 ? containerNumbers[0] : null,
  };
}

const SCHEDULE_CATEGORY_BY_STORE_TYPE = {
  STORE_IN: "RECEIVING",
  STORE_OUT: "DELIVERY",
};

/**
 * Batas backdate registerTime.
 * Semua role: maksimal N hari (AppSetting schedule.backdateMaxDays).
 * ADMIN: boleh melebihi, tetapi dicatat di log antrian (keputusan T3).
 */
function assertBackdateAllowed(registerTime, actorUser, settings) {
  if (!registerTime) return { overridden: false };

  const when = new Date(registerTime);
  if (Number.isNaN(when.getTime())) {
    throw createHttpError(400, "registerTime tidak valid");
  }

  const maxDays = settings?.backdateMaxDays ?? 7;
  const limit = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000);
  if (when >= limit) return { overridden: false };

  if (actorUser?.role !== "ADMIN") {
    throw createHttpError(
      400,
      `Waktu registrasi tidak boleh lebih dari ${maxDays} hari ke belakang. Hubungi Admin untuk data lebih lama.`
    );
  }

  return { overridden: true, maxDays };
}

/**
 * Memuat schedule item yang akan ditautkan, lalu memvalidasi semua aturan
 * yang disepakati di dokumen desain.
 */
async function resolveScheduleItemForCreate(scheduleItemId, data, settings) {
  const item = await prisma.shipmentScheduleItem.findUnique({
    where: { id: scheduleItemId },
    include: {
      transporter: { select: { id: true, name: true } },
      schedule: {
        select: {
          id: true,
          storeType: true,
          scheduleDate: true,
          customer: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!item) {
    throw createHttpError(400, "Data Schedule Pengiriman tidak ditemukan");
  }

  if (item.status === "LINKED" || item.status === "NO_SHOW_CLOSED") {
    throw createHttpError(
      409,
      item.status === "LINKED"
        ? "Truk ini sudah memiliki antrian aktif"
        : "Jadwal truk ini sudah ditutup sebagai no-show"
    );
  }

  const expectedCategory = SCHEDULE_CATEGORY_BY_STORE_TYPE[item.schedule.storeType];
  if (data.category && data.category !== expectedCategory) {
    throw createHttpError(
      400,
      `Jadwal ini kategori ${expectedCategory}, tidak bisa dipakai untuk antrian ${data.category}`
    );
  }

  // Jendela overdue. Truk yang telat datang beberapa hari tetap bisa dipilih.
  if (item.plannedStart) {
    const overdueDays = settings?.overdueWindowDays ?? 7;
    const windowStart = new Date(Date.now() - overdueDays * 24 * 60 * 60 * 1000);
    if (item.plannedStart < windowStart) {
      throw createHttpError(
        400,
        `Jadwal ini lebih lama dari ${overdueDays} hari ke belakang sehingga tidak bisa dipakai`
      );
    }
  }

  const activeEntry = await prisma.queueEntry.findFirst({
    where: { scheduleItemId: item.id, status: { not: "BATAL" } },
    select: { id: true, status: true },
  });
  if (activeEntry) {
    throw createHttpError(409, "Truk ini sudah memiliki antrian aktif");
  }

  return { item, category: expectedCategory };
}

/**
 * Nilai aktual: payload menang atas nilai plan, kecuali plat nomor yang
 * dikunci selama terhubung (keputusan S8).
 */
function buildLinkedEntryData(data, resolved, actorUser) {
  const { item, category } = resolved;
  const plan = item.schedule;

  const driverName =
    (typeof data.driverName === "string" && data.driverName.trim()) || item.driverName || "";
  if (!driverName) {
    throw createHttpError(400, "Driver Name wajib diisi (tidak ada di Schedule Pengiriman)");
  }

  const containerNumbers =
    data.containerNumbers !== undefined || data.containerNumber !== undefined
      ? normalizeContainerNumbers(data)
      : item.containerNumbers;

  const transporterId = data.transporterId || item.transporterId || null;
  const transporterName =
    (typeof data.transporter === "string" && data.transporter.trim()) ||
    item.transporter?.name ||
    null;

  return {
    category,
    customerId: data.customerId || plan.customer?.id || null,
    driverName,
    driverPhone: data.driverPhone || null,
    // Plat dikunci: mengikuti plan, payload diabaikan.
    truckNumber: item.plateNumber || data.truckNumber,
    truckType: data.truckType || item.truckType || null,
    containerNumbers,
    transporter: transporterName,
    transporterId,
    scheduleItemId: item.id,
    plannedStart: item.plannedStart,
    plannedFinish: item.plannedFinish,
    plannedPlateNumber: item.plateNumber,
    plannedTruckType: item.truckType,
    plannedCustomerId: plan.customer?.id || null,
    plannedCustomerName: plan.customer?.name || null,
    plannedTransporterName: item.transporter?.name || null,
    plannedDriverName: item.driverName,
    plannedContainerNumbers: item.containerNumbers,
  };
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

function buildDateRange(query) {
  const rawDate = typeof query?.date === "string" ? query.date : "";
  const rawDateFrom = typeof query?.dateFrom === "string" ? query.dateFrom : "";
  const rawDateTo = typeof query?.dateTo === "string" ? query.dateTo : "";

  // Backward compatibility: old single-date filter.
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

  // Default: today only.
  const today = new Date();
  return { from: getStartOfDay(today), to: getEndOfDay(today) };
}

function buildExportDateRange(query) {
  const { dateFrom, dateTo } = query;
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

function getUserName(req) {
  return req.headers["x-user-name"] || "system";
}

function normalizeSort(query) {
  const rawSortBy = typeof query.sortBy === "string" ? query.sortBy : "";
  const rawSortDir = typeof query.sortDir === "string" ? query.sortDir.toLowerCase() : "";
  const sortBy = SORTABLE_FIELDS.has(rawSortBy) ? rawSortBy : "registerTime";
  const sortDir = rawSortDir === "asc" ? "asc" : "desc";
  return { sortBy, sortDir };
}

function buildOrderBy(sortBy, sortDir) {
  const orderBy = [];
  switch (sortBy) {
    case "customerName":
      orderBy.push({ customer: { name: sortDir } });
      break;
    case "driverName":
      orderBy.push({ driverName: sortDir });
      break;
    case "truckNumber":
      orderBy.push({ truckNumber: sortDir });
      break;
    case "gateNo":
      orderBy.push({ gate: { gateNo: sortDir } });
      break;
    case "status":
      orderBy.push({ status: sortDir });
      break;
    case "inWhTime":
      orderBy.push({ inWhTime: sortDir });
      break;
    case "startTime":
      orderBy.push({ startTime: sortDir });
      break;
    case "finishTime":
      orderBy.push({ finishTime: sortDir });
      break;
    case "registerTime":
    default:
      orderBy.push({ registerTime: sortDir });
      break;
  }

  if (sortBy !== "registerTime") {
    orderBy.push({ registerTime: "desc" });
  } else {
    orderBy.push({ createdAt: "desc" });
  }
  return orderBy;
}

function normalizeSlaMinutes(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < SLA_STEP_MINUTES || parsed > MAX_SLA_MINUTES) return null;
  if (parsed % SLA_STEP_MINUTES !== 0) return null;
  return parsed;
}

function getLegacyInWhProcessSlaMinutes(entry) {
  return entry.category === "RECEIVING" ? 120 : 90;
}

function getWaitingSlaMinutes(entry) {
  return normalizeSlaMinutes(entry?.slaWaitingMinutes) ?? LEGACY_WAITING_SLA_MINUTES;
}

function getInWhProcessSlaMinutes(entry) {
  return normalizeSlaMinutes(entry?.slaInWhProcessMinutes) ?? getLegacyInWhProcessSlaMinutes(entry);
}

function getRemainingSlaMinutes(entry) {
  if (entry.status === "MENUNGGU") return getWaitingSlaMinutes(entry);
  if (entry.status === "IN_WH" || entry.status === "PROSES") return getInWhProcessSlaMinutes(entry);
  return null;
}

function getRemainingStartTime(entry) {
  if (entry.status === "MENUNGGU") return entry.registerTime;
  if (entry.status === "IN_WH" || entry.status === "PROSES") {
    return entry.inWhTime || entry.startTime || null;
  }
  return null;
}

function getEntryRemainingMinutes(entry, nowMs = Date.now()) {
  const slaMinutes = getRemainingSlaMinutes(entry);
  const startTime = getRemainingStartTime(entry);
  if (slaMinutes === null || !startTime) return null;

  const startMs = new Date(startTime).getTime();
  if (Number.isNaN(startMs)) return null;
  const elapsedMinutes = Math.floor((nowMs - startMs) / 60000);
  return slaMinutes - elapsedMinutes;
}

function getEntryRemainingPriority(entry, nowMs) {
  const remainingMinutes = getEntryRemainingMinutes(entry, nowMs);
  if (remainingMinutes === null) return 2;

  if (remainingMinutes <= 0) return 0;
  if (remainingMinutes <= 15) return 1;
  return 2;
}

async function createQueueEntry(data, actorUser) {
  const resolvedName = actorUser?.name || "system";
  const actorUserId = actorUser?.id || null;
  const waitingSlaMinutes =
    normalizeSlaMinutes(data.slaWaitingMinutes) ?? LEGACY_WAITING_SLA_MINUTES;
  const inWhProcessSlaMinutes =
    normalizeSlaMinutes(data.slaInWhProcessMinutes) ?? getLegacyInWhProcessSlaMinutes(data);
  const settings = await getScheduleSettings();
  const scheduleItemId =
    typeof data.scheduleItemId === "string" && data.scheduleItemId.trim()
      ? data.scheduleItemId.trim()
      : null;

  const resolved = scheduleItemId
    ? await resolveScheduleItemForCreate(scheduleItemId, data, settings)
    : null;

  const backdate = assertBackdateAllowed(data.registerTime, actorUser, settings);

  const baseData = resolved
    ? buildLinkedEntryData(data, resolved)
    : {
        category: data.category,
        customerId: data.customerId,
        driverName: data.driverName,
        driverPhone: data.driverPhone || null,
        truckNumber: data.truckNumber,
        truckType: data.truckType || null,
        containerNumbers: normalizeContainerNumbers(data),
        transporter: data.transporter || null,
        // Walk-in tetap menyimpan relasi ke master bila transporter dipilih.
        transporterId: data.transporterId || null,
        scheduleItemId: null,
      };

  const logNote = backdate.overridden
    ? `Backdate melebihi batas ${backdate.maxDays} hari oleh Admin`
    : null;

  const created = await prisma.queueEntry.create({
    data: {
      ...baseData,
      registerTime: data.registerTime ? new Date(data.registerTime) : undefined,
      slaWaitingMinutes: waitingSlaMinutes,
      slaInWhProcessMinutes: inWhProcessSlaMinutes,
      notes: data.notes || null,
      notesFromWh: null,
      logs: {
        create: {
          type: "CREATE",
          userName: resolvedName,
          actorUserId,
          toStatus: "MENUNGGU",
          note: logNote,
        },
      },
    },
    include: {
      customer: true,
    },
  });

  if (resolved) {
    await prisma.shipmentScheduleItem.update({
      where: { id: resolved.item.id },
      data: { status: "LINKED" },
    });
  }

  return withLegacyContainerNumber(created);
}

async function listQueueEntries(query) {
  const { status, category, search } = query;
  const { from, to } = buildDateRange(query);
  const { sortBy, sortDir } = normalizeSort(query);
  const rawPage = typeof query.page === "string" ? Number(query.page) : Number(query.page);
  const rawLimit = typeof query.limit === "string" ? Number(query.limit) : Number(query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 15;
  let page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const baseWhere = {};
  if (from || to) {
    baseWhere.registerTime = {};
    if (from) baseWhere.registerTime.gte = from;
    if (to) baseWhere.registerTime.lte = to;
  }
  if (search) {
    // Container disimpan uppercase; sertakan varian uppercase supaya
    // pencarian `has` (exact) tetap cocok walau user mengetik huruf kecil.
    const containerCandidates = Array.from(
      new Set([search, search.trim().toUpperCase(), search.trim().toUpperCase().replace(/\s+/g, "")])
    ).filter(Boolean);
    baseWhere.OR = [
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { driverName: { contains: search, mode: "insensitive" } },
      { driverPhone: { contains: search, mode: "insensitive" } },
      { truckNumber: { contains: search, mode: "insensitive" } },
      ...containerCandidates.map((value) => ({ containerNumbers: { has: value } })),
    ];
  }
  if (category) baseWhere.category = category;

  const where = {
    ...baseWhere,
  };
  if (status) where.status = status;

  const rows = await prisma.queueEntry.findMany({
    where,
    orderBy: buildOrderBy(sortBy, sortDir),
    include: {
      customer: true,
      gate: true,
      pickerEmployee: true,
    },
  });

  const nowMs = Date.now();
  const prioritizedRows = rows
    .map((entry, index) => ({
      entry,
      index,
      rank: getEntryRemainingPriority(entry, nowMs),
    }))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.index - b.index;
    });

  const totalItems = prioritizedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  if (page > totalPages) page = totalPages;
  const skip = (page - 1) * limit;
  const data = prioritizedRows
    .slice(skip, skip + limit)
    .map((item) => withLegacyContainerNumber(item.entry));

  const groupedStatusRows = await prisma.queueEntry.groupBy({
    by: ["status"],
    where: baseWhere,
    _count: {
      _all: true,
    },
  });
  const statusCounts = {
    MENUNGGU: 0,
    IN_WH: 0,
    PROSES: 0,
    SELESAI: 0,
    BATAL: 0,
  };
  groupedStatusRows.forEach((row) => {
    if (Object.prototype.hasOwnProperty.call(statusCounts, row.status)) {
      statusCounts[row.status] = row._count._all || 0;
    }
  });

  return {
    data,
    meta: {
      page,
      limit,
      totalItems,
      totalPages,
      statusCounts,
    },
  };
}

async function listQueueEntriesForExport(query) {
  const range = buildExportDateRange(query);
  const where = {};
  if (range) {
    where.registerTime = {
      gte: range.from,
      lte: range.to,
    };
  }

  const rows = await prisma.queueEntry.findMany({
    where,
    orderBy: [{ registerTime: "desc" }],
    include: {
      customer: true,
      gate: true,
      pickerEmployee: true,
      // Nilai plan diambil dari snapshot pada antrian, dengan cadangan ke item
      // schedule bila snapshot kosong. Item bisa sudah terhapus (antrian BATAL),
      // sehingga relasinya opsional.
      scheduleItem: {
        select: {
          id: true,
          plateNumber: true,
          truckType: true,
          truckTypeOther: true,
          driverName: true,
          containerNumbers: true,
          plannedStart: true,
          plannedFinish: true,
          status: true,
          transporter: { select: { name: true } },
        },
      },
      logs: {
        where: {
          type: "STATUS_CHANGE",
          toStatus: "BATAL",
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          note: true,
          createdAt: true,
        },
      },
    },
  });
  return rows.map(withLegacyContainerNumber);
}

function getTodayRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from, to };
}

function getAutoCompleteCutoff(now = new Date()) {
  return new Date(now.getTime() - AUTO_COMPLETE_AFTER_DAYS * 24 * 60 * 60 * 1000);
}

async function listQueueEntriesForDisplay() {
  const { from, to } = getTodayRange();
  const rows = await prisma.queueEntry.findMany({
    where: {
      registerTime: {
        gte: from,
        lte: to,
      },
    },
    orderBy: [{ registerTime: "asc" }],
    include: {
      customer: true,
      gate: true,
      pickerEmployee: true,
    },
  });
  const nowMs = Date.now();
  const entries = rows.map((entry) =>
    withLegacyContainerNumber({
      ...entry,
      remainingMinutes: getEntryRemainingMinutes(entry, nowMs),
    })
  );

  const statusOrder = {
    MENUNGGU: 0,
    IN_WH: 1,
    PROSES: 2,
    SELESAI: 3,
    BATAL: 4,
  };

  entries.sort((a, b) => {
    const aOrder = statusOrder[a.status] ?? 99;
    const bOrder = statusOrder[b.status] ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const aTime = new Date(a.registerTime).getTime();
    const bTime = new Date(b.registerTime).getTime();
    if (a.status === "SELESAI" && b.status === "SELESAI") {
      return bTime - aTime;
    }
    return aTime - bTime;
  });

  const summary = entries.reduce(
    (acc, entry) => {
      acc.total += 1;
      if (entry.category === "DELIVERY") acc.delivery += 1;
      if (entry.category === "RECEIVING") acc.receiving += 1;
      if (entry.status === "MENUNGGU") acc.menunggu += 1;
      if (entry.status === "IN_WH" || entry.status === "PROSES") acc.proses += 1;
      return acc;
    },
    { total: 0, delivery: 0, receiving: 0, menunggu: 0, proses: 0 }
  );

  return { entries, summary };
}

async function autoCompleteExpiredQueueEntries(now = new Date()) {
  const finishTime = new Date(now);
  const cutoff = getAutoCompleteCutoff(finishTime);

  const staleEntries = await prisma.queueEntry.findMany({
    where: {
      status: {
        in: ["MENUNGGU", "IN_WH", "PROSES"],
      },
      // Memakai createdAt, bukan registerTime: registerTime boleh diisi mundur
      // (backdate maks 7 hari), sehingga entri yang baru diinput tidak boleh
      // langsung ditutup sistem dengan finishTime palsu.
      createdAt: {
        lt: cutoff,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!staleEntries.length) {
    return { updatedCount: 0 };
  }

  await prisma.$transaction(
    staleEntries.map((entry) =>
      prisma.queueEntry.update({
        where: { id: entry.id },
        data: {
          status: "SELESAI",
          finishTime,
          loadingType: SYSTEM_LOADING_TYPE,
          autoCompleted: true,
          autoCompletedAt: finishTime,
          logs: {
            create: {
              type: "STATUS_CHANGE",
              fromStatus: entry.status,
              toStatus: "SELESAI",
              note: AUTO_COMPLETE_NOTE,
              userName: "system",
              actorUserId: null,
            },
          },
        },
      })
    )
  );

  return { updatedCount: staleEntries.length };
}

async function getQueueEntryById(id) {
  const entry = await prisma.queueEntry.findUnique({
    where: { id },
    include: {
      logs: {
        orderBy: { createdAt: "asc" },
        include: {
          actorUser: {
            select: { id: true, name: true, username: true, role: true },
          },
        },
      },
      customer: true,
      gate: true,
      pickerEmployee: true,
      scheduleItem: {
        select: {
          id: true,
          plateNumber: true,
          plannedStart: true,
          plannedFinish: true,
          status: true,
          schedule: { select: { id: true, scheduleDate: true, storeType: true } },
        },
      },
    },
  });
  if (!entry) {
    throw createHttpError(404, "Data tidak ditemukan");
  }
  return withPlanComparison(withLegacyContainerNumber(entry));
}

/**
 * Menambahkan variance plan vs aktual ke satu antrian. Dipakai halaman detail
 * supaya operator bisa melihat selisih tanpa membuka report.
 * Membandingkan dengan snapshot plan pada antrian, bukan plan terkini.
 */
async function withPlanComparison(entry) {
  if (!entry) return entry;
  const minutesBetween = (later, earlier) => {
    if (!later || !earlier) return null;
    return Math.round((new Date(later).getTime() - new Date(earlier).getTime()) / 60000);
  };

  const varianceArrivalMinutes = minutesBetween(entry.registerTime, entry.plannedStart);
  const varianceFinishMinutes = minutesBetween(entry.finishTime, entry.plannedFinish);

  let toleranceArrival = null;
  let toleranceFinish = null;
  if (varianceArrivalMinutes !== null || varianceFinishMinutes !== null) {
    const settings = await getScheduleSettings();
    toleranceArrival = settings.onTimeToleranceArrivalMinutes;
    toleranceFinish = settings.onTimeToleranceFinishMinutes;
  }

  // Antrian yang ditutup sistem tidak dipakai untuk statistik on-time.
  const measurable = !entry.autoCompleted;
  const judge = (variance, tolerance) =>
    variance === null || !measurable ? null : variance <= tolerance;

  return {
    ...entry,
    varianceArrivalMinutes,
    varianceFinishMinutes,
    isOnTimeArrival: judge(varianceArrivalMinutes, toleranceArrival),
    isOnTimeFinish: judge(varianceFinishMinutes, toleranceFinish),
    onTimeToleranceArrivalMinutes: toleranceArrival,
    onTimeToleranceFinishMinutes: toleranceFinish,
  };
}

async function updateQueueEntry(id, data, actorUser) {
  const entry = await prisma.queueEntry.findUnique({ where: { id } });
  if (!entry) throw createHttpError(404, "Data tidak ditemukan");
  if (
    (entry.status === "SELESAI" || entry.status === "BATAL") &&
    actorUser?.role !== "ADMIN"
  ) {
    throw createHttpError(400, "Data tidak bisa diubah karena status sudah final");
  }

  const resolvedName = actorUser?.name || "system";
  const actorUserId = actorUser?.id || null;
  const waitingSlaMinutes =
    entry.status === "MENUNGGU" && data.slaWaitingMinutes !== undefined
      ? normalizeSlaMinutes(data.slaWaitingMinutes) ?? LEGACY_WAITING_SLA_MINUTES
      : undefined;
  const inWhProcessSlaMinutes =
    data.slaInWhProcessMinutes !== undefined
      ? normalizeSlaMinutes(data.slaInWhProcessMinutes) ??
        getLegacyInWhProcessSlaMinutes({ category: data.category ?? entry.category })
      : undefined;

  // Loading Type hanya boleh diubah oleh ADMIN.
  let loadingTypeUpdate;
  if (data.loadingType !== undefined) {
    if (actorUser?.role !== "ADMIN") {
      throw createHttpError(400, "Hanya Admin yang bisa mengubah Loading Type");
    }
    const nextLoadingType =
      typeof data.loadingType === "string" ? data.loadingType.trim() : "";
    const finalStatus = entry.status;
    if (!nextLoadingType && (finalStatus === "SELESAI" || finalStatus === "BATAL")) {
      throw createHttpError(400, "Loading Type wajib diisi");
    }
    if (nextLoadingType && !isAllowedLoadingType(nextLoadingType)) {
      throw createHttpError(400, "Loading Type tidak valid");
    }
    loadingTypeUpdate = nextLoadingType || null;
  }

  // Plat nomor dikunci selama antrian terhubung ke Schedule Pengiriman (S8).
  if (
    entry.scheduleItemId &&
    data.truckNumber !== undefined &&
    String(data.truckNumber).trim() !== entry.truckNumber
  ) {
    throw createHttpError(
      400,
      "Plat Nomor tidak bisa diubah karena antrian ini terhubung ke Schedule Pengiriman"
    );
  }

  // Transporter hanya berupa teks di form edit. Sinkronkan FK-nya supaya
  // relasi ke master tidak menunjuk transporter lama setelah teks diubah.
  let transporterIdUpdate;
  if (data.transporterId !== undefined) {
    transporterIdUpdate = data.transporterId || null;
  } else if (data.transporter !== undefined) {
    const name = typeof data.transporter === "string" ? data.transporter.trim() : "";
    if (!name) {
      transporterIdUpdate = null;
    } else {
      const matched = await prisma.transporter.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      transporterIdUpdate = matched?.id ?? null;
    }
  }

  // registerTime hanya boleh diubah ADMIN (R1), dan tetap dibatasi backdate.
  let registerTimeUpdate;
  if (entry.status === "MENUNGGU" && data.registerTime) {
    if (actorUser?.role !== "ADMIN") {
      throw createHttpError(400, "Hanya Admin yang bisa mengubah Waktu Registrasi");
    }
    const settings = await getScheduleSettings();
    assertBackdateAllowed(data.registerTime, actorUser, settings);
    registerTimeUpdate = new Date(data.registerTime);
  }

  const updated = await prisma.queueEntry.update({
    where: { id },
    data: {
      category: data.category ?? undefined,
      customerId: data.customerId ?? undefined,
      driverName: data.driverName ?? undefined,
      driverPhone: data.driverPhone !== undefined ? (data.driverPhone || null) : undefined,
      truckNumber: data.truckNumber ?? undefined,
      truckType: data.truckType !== undefined ? (data.truckType || null) : undefined,
      containerNumbers:
        data.containerNumbers !== undefined || data.containerNumber !== undefined
          ? normalizeContainerNumbers(data)
          : undefined,
      transporter: data.transporter ?? undefined,
      transporterId: transporterIdUpdate,
      registerTime: registerTimeUpdate,
      slaWaitingMinutes: waitingSlaMinutes,
      slaInWhProcessMinutes: inWhProcessSlaMinutes,
      loadingType: loadingTypeUpdate,
      notes: data.notes ?? undefined,
      logs: {
        create: {
          type: "UPDATE",
          userName: resolvedName,
          actorUserId,
        },
      },
    },
    include: {
      customer: true,
      gate: true,
    },
  });
  return withLegacyContainerNumber(updated);
}

async function updateQueueWhNotes(id, notesFromWh, actorUser) {
  const entry = await prisma.queueEntry.findUnique({ where: { id } });
  if (!entry) throw createHttpError(404, "Data tidak ditemukan");
  if (
    (entry.status === "SELESAI" || entry.status === "BATAL") &&
    actorUser?.role !== "ADMIN"
  ) {
    throw createHttpError(400, "Notes from WH tidak bisa diubah saat status SELESAI atau BATAL");
  }

  const resolvedName = actorUser?.name || "system";
  const actorUserId = actorUser?.id || null;
  const normalizedNotes = typeof notesFromWh === "string" ? notesFromWh.trim() : "";

  return prisma.queueEntry.update({
    where: { id },
    data: {
      notesFromWh: normalizedNotes || null,
      logs: {
        create: {
          type: "WH_NOTES",
          userName: resolvedName,
          actorUserId,
          note: normalizedNotes || null,
        },
      },
    },
    include: {
      customer: true,
      gate: true,
    },
  });
}

function isNextStatus(current, next) {
  const idx = STATUS_FLOW.indexOf(current);
  const nextIdx = STATUS_FLOW.indexOf(next);
  if (idx === -1 || nextIdx === -1) return false;
  return nextIdx === idx + 1;
}

function isPrevStatus(current, prev) {
  const idx = STATUS_FLOW.indexOf(current);
  const prevIdx = STATUS_FLOW.indexOf(prev);
  if (idx === -1 || prevIdx === -1) return false;
  return prevIdx === idx - 1;
}

async function ensureTallymanExists(employeeId) {
  if (!employeeId || typeof employeeId !== "string") {
    throw createHttpError(400, "Tallyman wajib dipilih");
  }
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    throw createHttpError(400, "Data Tallyman tidak ditemukan");
  }
  if (employee.position !== "TALLYMAN") {
    throw createHttpError(400, "Karyawan yang dipilih harus berposisi Tallyman");
  }
  return employee;
}

async function getOptionalTallyman(employeeId) {
  if (!employeeId || typeof employeeId !== "string" || !employeeId.trim()) {
    return null;
  }
  return ensureTallymanExists(employeeId);
}

async function changeQueueStatus(
  id,
  newStatus,
  actorUser,
  gateId,
  cancelReason,
  pickerEmployeeId,
  loadingType
) {
  const entry = await prisma.queueEntry.findUnique({ where: { id } });
  if (!entry) throw createHttpError(404, "Data tidak ditemukan");

  const currentStatus = entry.status;
  if (currentStatus === newStatus) {
    throw createHttpError(400, "Status baru sama dengan status saat ini");
  }
  if (currentStatus === "SELESAI" || currentStatus === "BATAL") {
    throw createHttpError(400, "Status sudah final dan tidak bisa diubah");
  }

  if (newStatus === "BATAL") {
    if (currentStatus !== "MENUNGGU" && currentStatus !== "IN_WH") {
      throw createHttpError(400, "Batal hanya bisa dilakukan sampai status IN_WH");
    }
    const reason = typeof cancelReason === "string" ? cancelReason.trim() : "";
    if (!reason) {
      throw createHttpError(400, "Alasan batal wajib diisi");
    }
  } else if (!isNextStatus(currentStatus, newStatus) && !isPrevStatus(currentStatus, newStatus)) {
    throw createHttpError(400, "Perubahan status tidak valid");
  }

  const timeUpdates = {};
  let gateUpdate = {};
  let pickerEmployeeUpdate = {};
  let normalizedNote = null;
  if (newStatus === "IN_WH" && entry.status === "MENUNGGU") {
    if (!gateId || typeof gateId !== "string") {
      throw createHttpError(400, "Gate wajib dipilih");
    }
    const gate = await prisma.gate.findUnique({ where: { id: gateId } });
    if (!gate) {
      throw createHttpError(400, "Gate tidak ditemukan");
    }
    gateUpdate = { gateId: gate.id };
  }
  if (newStatus === "PROSES") {
    const pickerEmployee = await getOptionalTallyman(pickerEmployeeId);
    if (pickerEmployee) {
      pickerEmployeeUpdate = { pickerEmployeeId: pickerEmployee.id };
      normalizedNote = `tallyman=${pickerEmployee.name} (${pickerEmployee.nik})`;
    }
  }
  if (newStatus === "IN_WH" && entry.status === "PROSES") {
    pickerEmployeeUpdate = { pickerEmployeeId: null };
  }
  if (newStatus === "IN_WH" && !entry.inWhTime) timeUpdates.inWhTime = new Date();
  if (newStatus === "PROSES" && !entry.startTime) timeUpdates.startTime = new Date();
  if (newStatus === "SELESAI" && !entry.finishTime) timeUpdates.finishTime = new Date();

  let loadingTypeUpdate = {};
  if (newStatus === "SELESAI") {
    if (!isAllowedLoadingType(loadingType)) {
      throw createHttpError(400, "Loading Type wajib diisi");
    }
    loadingTypeUpdate = { loadingType };
  }

  const resolvedName = actorUser?.name || "system";
  const actorUserId = actorUser?.id || null;
  const normalizedCancelReason =
    newStatus === "BATAL" && typeof cancelReason === "string" ? cancelReason.trim() : null;
  const logNote = normalizedCancelReason || normalizedNote;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.queueEntry.update({
      where: { id },
      data: {
        status: newStatus,
        ...gateUpdate,
        ...pickerEmployeeUpdate,
        ...timeUpdates,
        ...loadingTypeUpdate,
        logs: {
          create: {
            type: "STATUS_CHANGE",
            fromStatus: currentStatus,
            toStatus: newStatus,
            note: logNote,
            userName: resolvedName,
            actorUserId,
          },
        },
      },
      include: {
        customer: true,
        gate: true,
        pickerEmployee: true,
      },
    });

    // BATAL membebaskan slot schedule item (S4). Partial unique index
    // queue_entry_active_schedule_item_unique otomatis mengizinkan item
    // ditautkan ke antrian baru.
    if (newStatus === "BATAL" && entry.scheduleItemId) {
      await tx.shipmentScheduleItem.update({
        where: { id: entry.scheduleItemId },
        data: { status: "PLANNED" },
      });
    }

    return result;
  });

  return withLegacyContainerNumber(updated);
}

module.exports = {
  AUTO_COMPLETE_AFTER_DAYS,
  getUserName,
  createQueueEntry,
  listQueueEntries,
  listQueueEntriesForExport,
  listQueueEntriesForDisplay,
  autoCompleteExpiredQueueEntries,
  getEntryRemainingMinutes,
  getQueueEntryById,
  updateQueueEntry,
  updateQueueWhNotes,
  changeQueueStatus,
};

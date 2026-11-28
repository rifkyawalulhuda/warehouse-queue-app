const prisma = require("../utils/prisma");

const ALLOWED_STORE_TYPES = new Set(["STORE_IN", "STORE_OUT"]);
const ALLOWED_TRUCK_TYPES = ["CDD", "CDE", "FUSO", "WB", "FT20", "FT40", "OTHER"];
const SORTABLE_FIELDS = new Set(["scheduleDate", "storeType", "customerName", "createdAt"]);

const TRUCK_TYPE_LABELS = {
  CDD: "CDD",
  CDE: "CDE",
  FUSO: "FUSO",
  WB: "W/B",
  FT20: "20 ft",
  FT40: "40 ft",
  OTHER: "Other",
};
const PRINT_TRUCK_COLUMNS = ["CDE", "CDD", "FUSO", "WB", "FT20", "FT40", "OTHER"];

const SCHEDULE_ITEM_STATUSES = ["PLANNED", "LINKED", "NO_SHOW", "NO_SHOW_CLOSED"];

function createHttpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

function parseDateOnly(dateStr) {
  if (typeof dateStr !== "string" || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();
  const parts = trimmed.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

/**
 * Menggabungkan tanggal schedule (@db.Date, tersimpan sebagai UTC midnight)
 * dengan jam "HH:mm" menjadi Date lokal, supaya konsisten dengan cara
 * registerTime antrian disimpan (new Date("YYYY-MM-DDTHH:mm") = waktu lokal).
 */
function combineDateAndTime(scheduleDate, timeStr, dayOffset = 0) {
  if (!scheduleDate || typeof timeStr !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return new Date(
    scheduleDate.getUTCFullYear(),
    scheduleDate.getUTCMonth(),
    scheduleDate.getUTCDate() + dayOffset,
    hours,
    minutes,
    0,
    0
  );
}

/**
 * Plat nomor: huruf besar, spasi dirapikan jadi satu tetapi TIDAK dihapus.
 * "b  7778 seu" -> "B 7778 SEU". Spasi dipertahankan supaya plat tampil
 * apa adanya seperti yang ditulis di Schedule Pengiriman.
 */
function normalizePlateNumber(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ").toUpperCase();
  return normalized || null;
}

function normalizeContainerNumbers(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim().toUpperCase() : ""))
    .filter(Boolean);
}

function normalizeSort(query) {
  const rawSortBy = typeof query.sortBy === "string" ? query.sortBy : "";
  const rawSortDir = typeof query.sortDir === "string" ? query.sortDir.toLowerCase() : "";
  const sortBy = SORTABLE_FIELDS.has(rawSortBy) ? rawSortBy : "createdAt";
  const sortDir = rawSortDir === "asc" ? "asc" : "desc";
  return { sortBy, sortDir };
}

function buildOrderBy(sortBy, sortDir) {
  if (sortBy === "scheduleDate") {
    return [{ scheduleDate: sortDir }, { createdAt: "desc" }];
  }
  if (sortBy === "storeType") {
    return [{ storeType: sortDir }, { scheduleDate: "desc" }, { createdAt: "desc" }];
  }
  if (sortBy === "customerName") {
    return [{ customer: { name: sortDir } }, { scheduleDate: "desc" }, { createdAt: "desc" }];
  }
  return [{ createdAt: sortDir }, { scheduleDate: "desc" }];
}

function mapTruckTypeCandidates(search) {
  if (!search) return [];
  const q = search.trim().toLowerCase();
  if (!q) return [];
  return ALLOWED_TRUCK_TYPES.filter((type) => {
    const label = TRUCK_TYPE_LABELS[type] || type;
    return type.toLowerCase().includes(q) || label.toLowerCase().includes(q);
  });
}

/**
 * Normalisasi satu item schedule.
 * Phase 1: 1 baris = 1 truk. `qty` tidak lagi diterima.
 * `plannedStart`/`plannedFinish` dikirim sebagai "HH:mm" dan digabung dengan
 * scheduleDate. Finish lebih kecil dari start dianggap shift lewat tengah malam.
 */
function normalizeItem(item, scheduleDate, { requireNewFields }) {
  const truckType = typeof item.truckType === "string" ? item.truckType.trim().toUpperCase() : "";
  const truckTypeOtherRaw =
    typeof item.truckTypeOther === "string" ? item.truckTypeOther.trim() : "";

  if (!ALLOWED_TRUCK_TYPES.includes(truckType)) {
    throw createHttpError(400, "truckType tidak valid");
  }
  if (truckType === "OTHER" && !truckTypeOtherRaw) {
    throw createHttpError(400, "truckTypeOther wajib diisi saat truckType OTHER");
  }

  const plateNumber = normalizePlateNumber(item.plateNumber);
  if (requireNewFields && !plateNumber) {
    throw createHttpError(400, "Plat Nomor wajib diisi");
  }

  const startRaw = typeof item.plannedStart === "string" ? item.plannedStart.trim() : "";
  const finishRaw = typeof item.plannedFinish === "string" ? item.plannedFinish.trim() : "";
  if (requireNewFields && (!startRaw || !finishRaw)) {
    throw createHttpError(400, "Estimasi Start dan Estimasi Finish wajib diisi");
  }

  let plannedStart = null;
  let plannedFinish = null;
  if (startRaw) {
    plannedStart = combineDateAndTime(scheduleDate, startRaw);
    if (!plannedStart) throw createHttpError(400, "Estimasi Start harus format HH:mm");
  }
  if (finishRaw) {
    plannedFinish = combineDateAndTime(scheduleDate, finishRaw);
    if (!plannedFinish) throw createHttpError(400, "Estimasi Finish harus format HH:mm");
    // Shift lewat tengah malam: 23:00 -> 01:00 berarti selesai H+1.
    if (plannedStart && plannedFinish.getTime() <= plannedStart.getTime()) {
      plannedFinish = combineDateAndTime(scheduleDate, finishRaw, 1);
    }
  }

  const transporterId =
    typeof item.transporterId === "string" && item.transporterId.trim()
      ? item.transporterId.trim()
      : null;
  const driverName =
    typeof item.driverName === "string" && item.driverName.trim() ? item.driverName.trim() : null;

  return {
    truckType,
    truckTypeOther: truckType === "OTHER" ? truckTypeOtherRaw : null,
    plateNumber,
    transporterId,
    driverName,
    containerNumbers: normalizeContainerNumbers(item.containerNumbers),
    plannedStart,
    plannedFinish,
  };
}

function normalizeItems(items, scheduleDate) {
  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError(400, "Items wajib diisi minimal 1");
  }
  return items.map((item) => {
    const isExisting = typeof item.id === "string" && item.id.trim();
    // Item baru wajib lengkap. Item lama boleh belum punya plat/waktu (data
    // sebelum Phase 1) agar tetap bisa diedit tanpa dipaksa melengkapi.
    const normalized = normalizeItem(item, scheduleDate, { requireNewFields: !isExisting });
    return { ...normalized, id: isExisting ? item.id.trim() : null };
  });
}

function buildWhere(query) {
  const where = {};
  const scheduleDate = parseDateOnly(query.date);
  if (scheduleDate) {
    where.scheduleDate = scheduleDate;
  }

  if (typeof query.storeType === "string" && ALLOWED_STORE_TYPES.has(query.storeType)) {
    where.storeType = query.storeType;
  }

  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    const truckTypeCandidates = mapTruckTypeCandidates(search);
    where.OR = [
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { items: { some: { truckTypeOther: { contains: search, mode: "insensitive" } } } },
      { items: { some: { plateNumber: { contains: search, mode: "insensitive" } } } },
      { items: { some: { driverName: { contains: search, mode: "insensitive" } } } },
      { items: { some: { transporter: { name: { contains: search, mode: "insensitive" } } } } },
    ];
    if (truckTypeCandidates.length > 0) {
      where.OR.push({ items: { some: { truckType: { in: truckTypeCandidates } } } });
    }
  }

  return where;
}

function buildExportWhere(query) {
  const dateFrom = parseDateOnly(query.dateFrom);
  const dateTo = parseDateOnly(query.dateTo);

  if (!dateFrom || !dateTo) {
    return {};
  }

  return {
    scheduleDate: {
      gte: dateFrom,
      lte: dateTo,
    },
  };
}

const ITEM_INCLUDE = {
  transporter: { select: { id: true, name: true } },
};

function mapScheduleListItem(row) {
  const typeKeys = new Set(
    row.items.map((item) => `${item.truckType}::${(item.truckTypeOther || "").toLowerCase()}`)
  );

  return {
    id: row.id,
    scheduleDate: row.scheduleDate,
    storeType: row.storeType,
    customer: row.customer,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // Phase 1: 1 baris = 1 truk, jadi totalTrucks = jumlah item.
    totalTrucks: row.items.length,
    totalTypes: typeKeys.size,
  };
}

async function ensureCustomerExists(customerId) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) {
    throw createHttpError(400, "Customer tidak ditemukan");
  }
}

async function ensureTransportersExist(items) {
  const ids = [...new Set(items.map((item) => item.transporterId).filter(Boolean))];
  if (ids.length === 0) return;
  const found = await prisma.transporter.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const foundIds = new Set(found.map((row) => row.id));
  const missing = ids.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw createHttpError(400, "Transporter tidak ditemukan");
  }
}

function normalizeSchedulePayload(data) {
  const scheduleDate = parseDateOnly(data.scheduleDate);
  if (!scheduleDate) {
    throw createHttpError(400, "scheduleDate harus format YYYY-MM-DD");
  }

  const storeType = typeof data.storeType === "string" ? data.storeType.trim().toUpperCase() : "";
  if (!ALLOWED_STORE_TYPES.has(storeType)) {
    throw createHttpError(400, "storeType harus STORE_IN atau STORE_OUT");
  }

  const customerId = typeof data.customerId === "string" ? data.customerId.trim() : "";
  if (!customerId) {
    throw createHttpError(400, "customerId wajib diisi");
  }

  const items = normalizeItems(data.items, scheduleDate);
  return { scheduleDate, storeType, customerId, items };
}

function toItemCreateData(item) {
  const { id, ...rest } = item;
  return rest;
}

async function createSchedule(data, actorUserId) {
  const payload = normalizeSchedulePayload(data);
  await ensureCustomerExists(payload.customerId);
  await ensureTransportersExist(payload.items);

  return prisma.shipmentSchedule.create({
    data: {
      scheduleDate: payload.scheduleDate,
      storeType: payload.storeType,
      customerId: payload.customerId,
      createdByUserId: actorUserId || null,
      items: {
        create: payload.items.map(toItemCreateData),
      },
    },
    include: {
      customer: true,
      items: {
        orderBy: { createdAt: "asc" },
        include: ITEM_INCLUDE,
      },
      createdByUser: {
        select: { id: true, name: true, username: true, role: true },
      },
    },
  });
}

async function listSchedules(query) {
  const { sortBy, sortDir } = normalizeSort(query);
  const rawPage = typeof query.page === "string" ? Number(query.page) : Number(query.page);
  const rawLimit = typeof query.limit === "string" ? Number(query.limit) : Number(query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 15;
  let page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const where = buildWhere(query);
  const total = await prisma.shipmentSchedule.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (page > totalPages) page = totalPages;
  const skip = (page - 1) * limit;

  const rows = await prisma.shipmentSchedule.findMany({
    where,
    orderBy: buildOrderBy(sortBy, sortDir),
    include: {
      customer: true,
      items: {
        select: {
          truckType: true,
          truckTypeOther: true,
        },
      },
    },
    skip,
    take: limit,
  });

  return {
    data: rows.map(mapScheduleListItem),
    meta: {
      page,
      limit,
      total,
      totalItems: total,
      totalPages,
      sortBy,
      sortDir,
    },
  };
}

async function listSchedulesForExport(query) {
  const where = buildExportWhere(query);
  return prisma.shipmentSchedule.findMany({
    where,
    orderBy: [{ scheduleDate: "desc" }, { createdAt: "desc" }],
    include: {
      customer: true,
      items: {
        orderBy: { createdAt: "asc" },
        include: ITEM_INCLUDE,
      },
    },
  });
}

function createPrintTruckMap() {
  return PRINT_TRUCK_COLUMNS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
}

async function listSchedulesForPrint(query) {
  const where = buildWhere(query);
  const rows = await prisma.shipmentSchedule.findMany({
    where,
    orderBy: [{ customer: { name: "asc" } }, { createdAt: "desc" }],
    include: {
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
      items: {
        select: {
          truckType: true,
        },
      },
    },
  });

  const grouped = new Map();

  rows.forEach((schedule) => {
    const customerName = schedule.customer?.name?.trim() || "-";
    const customerKey = customerName.toLowerCase();
    if (!grouped.has(customerKey)) {
      grouped.set(customerKey, {
        customerName,
        storeIn: createPrintTruckMap(),
        storeOut: createPrintTruckMap(),
      });
    }
    const target = grouped.get(customerKey);
    const bucket = schedule.storeType === "STORE_OUT" ? target.storeOut : target.storeIn;

    // Phase 1: qty dihapus, jadi setiap item dihitung 1 truk.
    schedule.items.forEach((item) => {
      const key = PRINT_TRUCK_COLUMNS.includes(item.truckType) ? item.truckType : "OTHER";
      bucket[key] += 1;
    });
  });

  const data = Array.from(grouped.values()).sort((a, b) =>
    a.customerName.localeCompare(b.customerName)
  );

  return {
    columns: PRINT_TRUCK_COLUMNS.map((key) => ({
      key,
      label: TRUCK_TYPE_LABELS[key] || key,
    })),
    data,
  };
}

async function getScheduleById(id) {
  if (!id) {
    throw createHttpError(400, "ID schedule tidak valid");
  }
  const schedule = await prisma.shipmentSchedule.findUnique({
    where: { id },
    include: {
      customer: true,
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          ...ITEM_INCLUDE,
          queueEntries: {
            select: { id: true, status: true },
          },
        },
      },
      createdByUser: {
        select: { id: true, name: true, username: true, role: true },
      },
    },
  });
  if (!schedule) {
    throw createHttpError(404, "Schedule tidak ditemukan");
  }
  return schedule;
}

/**
 * Update memakai diff berbasis id:
 *   - item dengan id  -> update
 *   - item tanpa id   -> create
 *   - item lama hilang -> delete, DITOLAK bila sudah punya antrian non-BATAL
 *
 * Nilai snapshot plan di QueueEntry sengaja tidak ikut berubah saat schedule
 * diedit. Itu justru tujuan snapshot (keputusan Q6).
 */
async function updateSchedule(id, data) {
  if (!id) {
    throw createHttpError(400, "ID schedule tidak valid");
  }
  const payload = normalizeSchedulePayload(data);
  await ensureCustomerExists(payload.customerId);
  await ensureTransportersExist(payload.items);

  const existing = await prisma.shipmentSchedule.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          queueEntries: {
            select: { id: true, status: true },
          },
        },
      },
    },
  });
  if (!existing) {
    throw createHttpError(404, "Schedule tidak ditemukan");
  }

  const existingById = new Map(existing.items.map((item) => [item.id, item]));
  const incomingIds = new Set(payload.items.map((item) => item.id).filter(Boolean));

  // Item yang dikirim dengan id tapi bukan milik schedule ini.
  for (const incomingId of incomingIds) {
    if (!existingById.has(incomingId)) {
      throw createHttpError(400, "Item schedule tidak dikenal pada jadwal ini");
    }
  }

  const toDelete = existing.items.filter((item) => !incomingIds.has(item.id));
  const blocked = toDelete.filter((item) =>
    item.queueEntries.some((entry) => entry.status !== "BATAL")
  );
  if (blocked.length > 0) {
    const plates = blocked
      .map((item) => item.plateNumber || TRUCK_TYPE_LABELS[item.truckType] || item.id)
      .join(", ");
    throw createHttpError(
      400,
      `Item schedule berikut sudah memiliki antrian truk sehingga tidak bisa dihapus: ${plates}`
    );
  }

  // S8: plat nomor terkunci selama item terhubung ke antrian aktif. Tanpa ini,
  // plat di schedule bisa berbeda dengan plat di antrian dan tautan jadi menyesatkan.
  const plateConflicts = [];
  for (const item of payload.items) {
    if (!item.id) continue;
    const current = existingById.get(item.id);
    if (!current) continue;
    const hasActiveEntry = current.queueEntries.some((entry) => entry.status !== "BATAL");
    if (!hasActiveEntry) continue;
    if ((current.plateNumber || null) !== (item.plateNumber || null)) {
      plateConflicts.push(current.plateNumber || current.id);
    }
  }
  if (plateConflicts.length > 0) {
    throw createHttpError(
      400,
      `Plat Nomor tidak bisa diubah karena item sudah terhubung ke antrian: ${plateConflicts.join(", ")}`
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (toDelete.length > 0) {
        const deletedIds = toDelete.map((item) => item.id);
        // Antrian BATAL tetap menyimpan snapshot plan, jadi cukup dilepas
        // tautannya sebelum item dihapus. Tanpa ini FK Restrict menolak
        // penghapusan dan pengguna menerima error database mentah.
        await tx.queueEntry.updateMany({
          where: { scheduleItemId: { in: deletedIds } },
          data: { scheduleItemId: null },
        });
        await tx.shipmentScheduleItem.deleteMany({
          where: { id: { in: deletedIds } },
        });
      }

      for (const item of payload.items) {
        const { id: itemId, ...rest } = item;
        if (itemId) {
          await tx.shipmentScheduleItem.update({
            where: { id: itemId },
            data: rest,
          });
        } else {
          await tx.shipmentScheduleItem.create({
            data: { ...rest, scheduleId: id },
          });
        }
      }

      return tx.shipmentSchedule.update({
        where: { id },
        data: {
          scheduleDate: payload.scheduleDate,
          storeType: payload.storeType,
          customerId: payload.customerId,
        },
        include: {
          customer: true,
          items: {
            orderBy: { createdAt: "asc" },
            include: ITEM_INCLUDE,
          },
          createdByUser: {
            select: { id: true, name: true, username: true, role: true },
          },
        },
      });
    });
  } catch (err) {
    if (err && err.code === "P2025") {
      throw createHttpError(404, "Schedule tidak ditemukan");
    }
    throw err;
  }
}

async function deleteSchedule(id) {
  if (!id) {
    throw createHttpError(400, "ID schedule tidak valid");
  }

  const linkedCount = await prisma.queueEntry.count({
    where: {
      scheduleItem: { scheduleId: id },
      status: { not: "BATAL" },
    },
  });
  if (linkedCount > 0) {
    throw createHttpError(
      400,
      `Schedule tidak bisa dihapus karena ${linkedCount} truk sudah memiliki antrian`
    );
  }

  try {
    return await prisma.shipmentSchedule.delete({
      where: { id },
      include: {
        customer: true,
      },
    });
  } catch (err) {
    if (err && err.code === "P2025") {
      throw createHttpError(404, "Schedule tidak ditemukan");
    }
    throw err;
  }
}

/**
 * Daftar item schedule yang bisa dipilih di form Antrian Truk.
 *
 * Filter:
 *   - status PLANNED / NO_SHOW (LINKED dan NO_SHOW_CLOSED tidak muncul)
 *   - plannedStart dalam jendela overdue (default 7 hari ke belakang s.d. hari ini)
 *   - tidak punya antrian non-BATAL
 *   - kategori cocok dengan storeType (STORE_IN -> RECEIVING, STORE_OUT -> DELIVERY)
 */
async function listAvailableItems(query) {
  const category = typeof query.category === "string" ? query.category.trim().toUpperCase() : "";
  if (category && category !== "RECEIVING" && category !== "DELIVERY") {
    throw createHttpError(400, "category harus RECEIVING atau DELIVERY");
  }

  const settings = await getScheduleSettings();
  const overdueDays = settings.overdueWindowDays;

  const now = new Date();
  const windowStart = new Date(now.getTime() - overdueDays * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const where = {
    status: { in: ["PLANNED", "NO_SHOW"] },
    plannedStart: { gte: windowStart, lte: windowEnd },
  };

  if (category) {
    where.schedule = {
      storeType: category === "RECEIVING" ? "STORE_IN" : "STORE_OUT",
    };
  }

  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    where.OR = [
      { plateNumber: { contains: search, mode: "insensitive" } },
      { driverName: { contains: search, mode: "insensitive" } },
      { containerNumbers: { has: search.toUpperCase() } },
      { schedule: { customer: { name: { contains: search, mode: "insensitive" } } } },
      { transporter: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const rawLimit = Number(query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 200) : 50;

  const rows = await prisma.shipmentScheduleItem.findMany({
    where,
    orderBy: [{ plannedStart: "asc" }],
    take: limit,
    include: {
      transporter: { select: { id: true, name: true } },
      schedule: {
        select: {
          id: true,
          scheduleDate: true,
          storeType: true,
          customer: { select: { id: true, name: true } },
        },
      },
    },
  });

  return rows.map((item) => ({
    id: item.id,
    scheduleId: item.scheduleId,
    scheduleDate: item.schedule.scheduleDate,
    storeType: item.schedule.storeType,
    category: item.schedule.storeType === "STORE_IN" ? "RECEIVING" : "DELIVERY",
    customerId: item.schedule.customer?.id || null,
    customerName: item.schedule.customer?.name || null,
    plateNumber: item.plateNumber,
    truckType: item.truckType,
    truckTypeOther: item.truckTypeOther,
    transporterId: item.transporterId,
    transporterName: item.transporter?.name || null,
    driverName: item.driverName,
    containerNumbers: item.containerNumbers,
    plannedStart: item.plannedStart,
    plannedFinish: item.plannedFinish,
    status: item.status,
  }));
}

/**
 * Pengaturan schedule/report dari AppSetting. Dibaca setiap query supaya
 * perubahan toleransi langsung berlaku (retroaktif, keputusan S10).
 */
async function getScheduleSettings() {
  const keys = [
    "report.onTimeToleranceArrivalMinutes",
    "report.onTimeToleranceFinishMinutes",
    "schedule.backdateMaxDays",
    "schedule.overdueWindowDays",
    "schedule.noShowGraceHours",
  ];
  const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } } });
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const toInt = (key, fallback) => {
    const parsed = Number(map.get(key));
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
  };

  return {
    onTimeToleranceArrivalMinutes: toInt(
      "report.onTimeToleranceArrivalMinutes",
      15
    ),
    onTimeToleranceFinishMinutes: toInt("report.onTimeToleranceFinishMinutes", 15),
    backdateMaxDays: toInt("schedule.backdateMaxDays", 7),
    overdueWindowDays: toInt("schedule.overdueWindowDays", 7),
    noShowGraceHours: toInt("schedule.noShowGraceHours", 24),
  };
}

/**
 * Menandai item schedule sebagai NO_SHOW bila sudah melewati
 * plannedFinish + graceHours dan belum pernah ditautkan ke antrian.
 *
 * Sistem hanya MENANDAI (S1). Penutupan final (NO_SHOW_CLOSED) dilakukan
 * ADMIN lewat endpoint terpisah, dan item NO_SHOW tetap bisa dipakai kalau
 * truknya ternyata datang dalam jendela overdue.
 */
async function markNoShowScheduleItems(now = new Date()) {
  const settings = await getScheduleSettings();
  const cutoff = new Date(now.getTime() - settings.noShowGraceHours * 60 * 60 * 1000);

  const result = await prisma.shipmentScheduleItem.updateMany({
    where: {
      status: "PLANNED",
      plannedFinish: { not: null, lt: cutoff },
      queueEntries: { none: { status: { not: "BATAL" } } },
    },
    data: { status: "NO_SHOW", noShowMarkedAt: now },
  });

  return { updatedCount: result.count || 0 };
}

async function closeNoShowItem(id, actorUser) {
  if (!id) {
    throw createHttpError(400, "ID item schedule tidak valid");
  }
  const item = await prisma.shipmentScheduleItem.findUnique({
    where: { id },
    include: {
      queueEntries: { select: { id: true, status: true } },
    },
  });
  if (!item) {
    throw createHttpError(404, "Item schedule tidak ditemukan");
  }
  if (item.queueEntries.some((entry) => entry.status !== "BATAL")) {
    throw createHttpError(400, "Item ini sudah memiliki antrian truk");
  }
  if (item.status === "NO_SHOW_CLOSED") {
    throw createHttpError(400, "Item ini sudah ditutup sebagai no-show");
  }

  return prisma.shipmentScheduleItem.update({
    where: { id },
    data: {
      status: "NO_SHOW_CLOSED",
      noShowClosedAt: new Date(),
      noShowClosedByUserId: actorUser?.id || null,
    },
  });
}

// ---------------------------------------------------------------------------
// Import bulk Schedule dari Excel
// ---------------------------------------------------------------------------

const MAX_IMPORT_ROWS = 500;
const MAX_SHIFT_MINUTES = 12 * 60;

const STORE_TYPE_ALIASES = {
  RECEIVING: "STORE_IN",
  "RECEIVING (PENERIMAAN)": "STORE_IN",
  PENERIMAAN: "STORE_IN",
  "STORE IN": "STORE_IN",
  STORE_IN: "STORE_IN",
  DELIVERY: "STORE_OUT",
  "DELIVERY (PENGIRIMAN)": "STORE_OUT",
  PENGIRIMAN: "STORE_OUT",
  "STORE OUT": "STORE_OUT",
  STORE_OUT: "STORE_OUT",
};

const TRUCK_TYPE_ALIASES = {
  CDD: "CDD",
  CDE: "CDE",
  FUSO: "FUSO",
  WB: "WB",
  "W/B": "WB",
  WINGBOX: "WB",
  "WING BOX": "WB",
  FT20: "FT20",
  "20FT": "FT20",
  "20 FT": "FT20",
  FT40: "FT40",
  "40FT": "FT40",
  "40 FT": "FT40",
  OTHER: "OTHER",
  LAINNYA: "OTHER",
  LAIN: "OTHER",
};

/**
 * Tanggal dari sel Excel. Menerima sel tanggal asli, serial angka Excel,
 * teks YYYY-MM-DD, dan teks DD/MM/YYYY. Hasilnya selalu UTC midnight karena
 * kolom scheduleDate bertipe @db.Date.
 */
function parseImportDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    // Serial tanggal Excel: 25569 = jarak hari 1899-12-30 -> 1970-01-01.
    const ms = Math.round((value - 25569) * 86400000);
    const parsed = new Date(ms);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const iso = parseDateOnly(trimmed);
    if (iso) return iso;
    const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
    if (dmy) {
      const day = String(dmy[1]).padStart(2, "0");
      const month = String(dmy[2]).padStart(2, "0");
      return parseDateOnly(`${dmy[3]}-${month}-${day}`);
    }
  }
  return null;
}

/** Jam dari sel Excel: teks "HH:mm", sel waktu Excel (pecahan hari), atau Date. */
function parseImportTime(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const fraction = value >= 1 ? value % 1 : value;
    if (fraction < 0) return null;
    const totalMinutes = Math.round(fraction * 1440);
    if (totalMinutes >= 1440) return null;
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  }
  if (typeof value === "string") {
    const match = /^(\d{1,2})[:.](\d{2})$/.exec(value.trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  return null;
}

function splitContainerNumbers(value) {
  if (typeof value !== "string") return [];
  return normalizeContainerNumbers(value.split(/[,;\n]/));
}

function dateKeyUtc(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Import bulk Schedule Delivery & Receiving dari Excel.
 * Satu baris = satu truk. Baris dikelompokkan ke schedule berdasarkan
 * Tanggal + Customer + Kategori (STORE_IN/STORE_OUT). Seluruh file divalidasi
 * lebih dulu; satu baris salah membatalkan seluruh import. Truk duplikat
 * (plat + tanggal + jam start) dilewati, bukan dianggap error.
 */
async function importSchedulesFromExcel(rows, options = {}) {
  const { actorUserId = null, fileName = null } = options;

  if (!Array.isArray(rows) || rows.length === 0) {
    throw createHttpError(400, "Data Excel tidak valid");
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw createHttpError(
      400,
      `Maksimal ${MAX_IMPORT_ROWS} baris per file. File ini berisi ${rows.length} baris.`
    );
  }

  const [customers, transporters] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, name: true } }),
    prisma.transporter.findMany({ select: { id: true, name: true, isActive: true } }),
  ]);
  const customerByName = new Map(customers.map((c) => [c.name.trim().toLowerCase(), c]));
  const transporterByName = new Map(transporters.map((t) => [t.name.trim().toLowerCase(), t]));

  const errors = [];
  const parsed = [];
  const seenInFile = new Set();
  let skippedInFile = 0;
  const truckTypeList = ALLOWED_TRUCK_TYPES.join(", ");

  for (const row of rows) {
    const rowNumber = row?.rowNumber || 0;
    const text = (value) => (typeof value === "string" ? value.trim() : "");

    const rawDate = row?.date;
    const rawCategory = text(row?.category);
    const rawCustomer = text(row?.customer);
    const rawPlate = text(row?.plate);
    const rawTruckType = text(row?.truckType);
    const rawTruckTypeOther = text(row?.truckTypeOther);
    const rawTransporter = text(row?.transporter);
    const rawDriver = text(row?.driver);
    const rawStart = row?.start;
    const rawFinish = row?.finish;

    const isEmptyRow =
      !text(rawDate) &&
      !rawCategory &&
      !rawCustomer &&
      !rawPlate &&
      !rawTruckType &&
      !rawTransporter &&
      !text(rawStart) &&
      !text(rawFinish);
    if (isEmptyRow) continue;

    const rowErrors = [];

    const scheduleDate = parseImportDate(rawDate);
    if (!scheduleDate) rowErrors.push("Tanggal wajib diisi dengan format YYYY-MM-DD");

    const storeType = STORE_TYPE_ALIASES[rawCategory.toUpperCase()] || null;
    if (!storeType) rowErrors.push("Kategori harus RECEIVING atau DELIVERY");

    let customer = null;
    if (!rawCustomer) {
      rowErrors.push("Customer wajib diisi");
    } else {
      customer = customerByName.get(rawCustomer.toLowerCase()) || null;
      if (!customer) rowErrors.push(`Customer "${rawCustomer}" tidak ditemukan di Master Customer`);
    }

    const plateNumber = normalizePlateNumber(rawPlate);
    if (!plateNumber) rowErrors.push("Plat Nomor wajib diisi");

    const truckType = TRUCK_TYPE_ALIASES[rawTruckType.toUpperCase()] || null;
    if (!truckType) {
      rowErrors.push(`Tipe Truk tidak dikenal. Pilihan: ${truckTypeList}`);
    } else if (truckType === "OTHER" && !rawTruckTypeOther) {
      rowErrors.push("Tipe Lain wajib diisi saat Tipe Truk OTHER");
    }

    let transporterId = null;
    if (rawTransporter) {
      const found = transporterByName.get(rawTransporter.toLowerCase()) || null;
      if (!found) {
        rowErrors.push(`Transporter "${rawTransporter}" tidak ditemukan di Master Transporter`);
      } else if (!found.isActive) {
        rowErrors.push(`Transporter "${rawTransporter}" nonaktif`);
      } else {
        transporterId = found.id;
      }
    }

    const startTime = parseImportTime(rawStart);
    if (!startTime) rowErrors.push("Estimasi Start wajib diisi (HH:mm)");
    const finishTime = parseImportTime(rawFinish);
    if (!finishTime) rowErrors.push("Estimasi Finish wajib diisi (HH:mm)");

    let plannedStart = null;
    let plannedFinish = null;
    if (scheduleDate && startTime && finishTime) {
      plannedStart = combineDateAndTime(scheduleDate, startTime);
      // Shift lewat tengah malam didukung: kalau finish <= start, anggap H+1.
      // Durasi di atas 12 jam dianggap salah ketik (09:00 -> 08:00 = 23 jam).
      const finishSameDay = combineDateAndTime(scheduleDate, finishTime);
      plannedFinish =
        finishSameDay.getTime() <= plannedStart.getTime()
          ? combineDateAndTime(scheduleDate, finishTime, 1)
          : finishSameDay;
      const durationMinutes = (plannedFinish.getTime() - plannedStart.getTime()) / 60000;
      if (durationMinutes > MAX_SHIFT_MINUTES) {
        rowErrors.push("Estimasi Finish maksimal 12 jam setelah Estimasi Start");
      } else if (durationMinutes <= 0) {
        rowErrors.push("Estimasi Finish harus setelah Estimasi Start");
      }
    }

    if (rowErrors.length > 0) {
      errors.push(`Baris ${rowNumber}: ${rowErrors.join(", ")}`);
      continue;
    }

    const duplicateKey = `${plateNumber}|${dateKeyUtc(scheduleDate)}|${startTime}`;
    if (seenInFile.has(duplicateKey)) {
      skippedInFile += 1;
      continue;
    }
    seenInFile.add(duplicateKey);

    parsed.push({
      rowNumber,
      scheduleDate,
      storeType,
      customerId: customer.id,
      customerName: customer.name,
      plateNumber,
      truckType,
      truckTypeOther: truckType === "OTHER" ? rawTruckTypeOther : null,
      transporterId,
      driverName: rawDriver || null,
      containerNumbers: splitContainerNumbers(row?.containers),
      plannedStart,
      plannedFinish,
      duplicateKey,
      startTime,
    });
  }

  if (errors.length > 0) {
    throw createHttpError(400, "Validasi import gagal", errors);
  }
  if (parsed.length === 0) {
    throw createHttpError(400, "Tidak ada data schedule yang valid");
  }

  // Duplikat terhadap data yang sudah ada: plat + tanggal + jam start.
  const involvedDates = [...new Set(parsed.map((row) => dateKeyUtc(row.scheduleDate)))].map(
    (key) => new Date(`${key}T00:00:00.000Z`)
  );
  const existingItems = await prisma.shipmentScheduleItem.findMany({
    where: { schedule: { scheduleDate: { in: involvedDates } } },
    select: {
      plateNumber: true,
      plannedStart: true,
      schedule: { select: { scheduleDate: true } },
    },
  });
  const existingKeys = new Set();
  for (const item of existingItems) {
    if (!item.plateNumber || !item.plannedStart) continue;
    const hours = String(item.plannedStart.getHours()).padStart(2, "0");
    const minutes = String(item.plannedStart.getMinutes()).padStart(2, "0");
    existingKeys.add(
      `${item.plateNumber}|${dateKeyUtc(item.schedule.scheduleDate)}|${hours}:${minutes}`
    );
  }

  const toCreate = parsed.filter((row) => !existingKeys.has(row.duplicateKey));
  const skippedCount = parsed.length - toCreate.length + skippedInFile;
  if (toCreate.length === 0) {
    return {
      created: 0,
      skipped: skippedCount,
      total: parsed.length + skippedInFile,
      scheduleCount: 0,
      createdSchedules: 0,
      newSchedules: [],
    };
  }

  // Kelompokkan per Tanggal + Customer + Kategori.
  const groups = new Map();
  for (const row of toCreate) {
    const groupKey = `${dateKeyUtc(row.scheduleDate)}|${row.customerId}|${row.storeType}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        scheduleDate: row.scheduleDate,
        customerId: row.customerId,
        customerName: row.customerName,
        storeType: row.storeType,
        rows: [],
      });
    }
    groups.get(groupKey).rows.push(row);
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const groupList = [...groups.values()];
      const existingSchedules = await tx.shipmentSchedule.findMany({
        where: {
          scheduleDate: { in: [...new Set(groupList.map((g) => dateKeyUtc(g.scheduleDate)))].map(
            (key) => new Date(`${key}T00:00:00.000Z`)
          ) },
          customerId: { in: [...new Set(groupList.map((g) => g.customerId))] },
        },
        select: { id: true, scheduleDate: true, customerId: true, storeType: true },
      });
      const scheduleIdByKey = new Map(
        existingSchedules.map((s) => [
          `${dateKeyUtc(s.scheduleDate)}|${s.customerId}|${s.storeType}`,
          s.id,
        ])
      );

      const newSchedules = [];
      const itemRows = [];
      for (const group of groupList) {
        const groupKey = `${dateKeyUtc(group.scheduleDate)}|${group.customerId}|${group.storeType}`;
        let scheduleId = scheduleIdByKey.get(groupKey);
        if (!scheduleId) {
          const created = await tx.shipmentSchedule.create({
            data: {
              scheduleDate: group.scheduleDate,
              storeType: group.storeType,
              customerId: group.customerId,
              createdByUserId: actorUserId,
            },
            select: { id: true },
          });
          scheduleId = created.id;
          scheduleIdByKey.set(groupKey, scheduleId);
          newSchedules.push({
            date: dateKeyUtc(group.scheduleDate),
            customerName: group.customerName,
            category: group.storeType === "STORE_IN" ? "RECEIVING" : "DELIVERY",
            itemCount: group.rows.length,
          });
        }
        for (const row of group.rows) {
          itemRows.push({
            scheduleId,
            truckType: row.truckType,
            truckTypeOther: row.truckTypeOther,
            plateNumber: row.plateNumber,
            transporterId: row.transporterId,
            driverName: row.driverName,
            containerNumbers: row.containerNumbers,
            plannedStart: row.plannedStart,
            plannedFinish: row.plannedFinish,
            status: "PLANNED",
          });
        }
      }

      await tx.shipmentScheduleItem.createMany({ data: itemRows });

      await tx.scheduleImportLog.create({
        data: {
          fileName: fileName || null,
          rowCount: parsed.length + skippedInFile,
          createdCount: itemRows.length,
          skippedCount,
          scheduleCount: groups.size,
          note: `Import ${itemRows.length} truk ke ${groups.size} schedule`,
          actorUserId,
        },
      });

      return { createdSchedules: newSchedules.length, newSchedules };
    },
    { timeout: 60000, maxWait: 15000 }
  );

  return {
    created: toCreate.length,
    skipped: skippedCount,
    total: parsed.length + skippedInFile,
    scheduleCount: groups.size,
    createdSchedules: result.createdSchedules,
    newSchedules: result.newSchedules,
  };
}

async function listScheduleImportLogs(limit = 20) {
  return prisma.scheduleImportLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actorUser: { select: { id: true, name: true, username: true } } },
  });
}


async function listTemplateOptions() {
  const [customers, transporters] = await Promise.all([
    prisma.customer.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    prisma.transporter.findMany({
      where: { isActive: true },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    customers: customers.map((row) => row.name),
    transporters: transporters.map((row) => row.name),
  };
}

module.exports = {
  TRUCK_TYPE_LABELS,
  PRINT_TRUCK_COLUMNS,
  SCHEDULE_ITEM_STATUSES,
  ALLOWED_TRUCK_TYPES,
  createHttpError,
  combineDateAndTime,
  normalizePlateNumber,
  getScheduleSettings,
  createSchedule,
  listSchedules,
  listSchedulesForExport,
  listSchedulesForPrint,
  listAvailableItems,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  markNoShowScheduleItems,
  closeNoShowItem,
  importSchedulesFromExcel,
  listScheduleImportLogs,
  listTemplateOptions,
};

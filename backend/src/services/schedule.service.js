const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const ALLOWED_STORE_TYPES = new Set(["STORE_IN", "STORE_OUT"]);
const ALLOWED_TRUCK_TYPES = ["CDD", "CDE", "FUSO", "WB", "FT20", "FT40", "OTHER"];
const SORTABLE_FIELDS = new Set(["scheduleDate", "createdAt"]);

const TRUCK_TYPE_LABELS = {
  CDD: "CDD",
  CDE: "CDE",
  FUSO: "FUSO",
  WB: "W/B",
  FT20: "20 ft",
  FT40: "40 ft",
  OTHER: "Other",
};
const PRINT_TRUCK_COLUMNS = ["CDD", "CDE", "FUSO", "WB", "FT20", "FT40", "OTHER"];

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

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError(400, "Items wajib diisi minimal 1");
  }

  return items.map((item) => {
    const truckType = typeof item.truckType === "string" ? item.truckType.trim().toUpperCase() : "";
    const qty = Number(item.qty);
    const truckTypeOtherRaw =
      typeof item.truckTypeOther === "string" ? item.truckTypeOther.trim() : "";

    if (!ALLOWED_TRUCK_TYPES.includes(truckType)) {
      throw createHttpError(400, "truckType tidak valid");
    }
    if (!Number.isInteger(qty) || qty < 1) {
      throw createHttpError(400, "qty harus angka bulat minimal 1");
    }
    if (truckType === "OTHER" && !truckTypeOtherRaw) {
      throw createHttpError(400, "truckTypeOther wajib diisi saat truckType OTHER");
    }

    return {
      truckType,
      truckTypeOther: truckType === "OTHER" ? truckTypeOtherRaw : null,
      qty,
    };
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

function mapScheduleListItem(row) {
  const totalQty = row.items.reduce((sum, item) => sum + item.qty, 0);
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
    totalQty,
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

  const items = normalizeItems(data.items);
  return { scheduleDate, storeType, customerId, items };
}

async function createSchedule(data, actorUserId) {
  const payload = normalizeSchedulePayload(data);
  await ensureCustomerExists(payload.customerId);

  return prisma.shipmentSchedule.create({
    data: {
      scheduleDate: payload.scheduleDate,
      storeType: payload.storeType,
      customerId: payload.customerId,
      createdByUserId: actorUserId || null,
      items: {
        create: payload.items,
      },
    },
    include: {
      customer: true,
      items: {
        orderBy: { createdAt: "asc" },
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
          qty: true,
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
          qty: true,
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

    schedule.items.forEach((item) => {
      const key = PRINT_TRUCK_COLUMNS.includes(item.truckType) ? item.truckType : "OTHER";
      bucket[key] += item.qty || 0;
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

async function updateSchedule(id, data) {
  if (!id) {
    throw createHttpError(400, "ID schedule tidak valid");
  }
  const payload = normalizeSchedulePayload(data);
  await ensureCustomerExists(payload.customerId);

  try {
    return await prisma.shipmentSchedule.update({
      where: { id },
      data: {
        scheduleDate: payload.scheduleDate,
        storeType: payload.storeType,
        customerId: payload.customerId,
        items: {
          deleteMany: {},
          create: payload.items,
        },
      },
      include: {
        customer: true,
        items: {
          orderBy: { createdAt: "asc" },
        },
        createdByUser: {
          select: { id: true, name: true, username: true, role: true },
        },
      },
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

module.exports = {
  TRUCK_TYPE_LABELS,
  PRINT_TRUCK_COLUMNS,
  createSchedule,
  listSchedules,
  listSchedulesForExport,
  listSchedulesForPrint,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
};

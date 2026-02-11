const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

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

function buildDateRange(query) {
  const { date, dateFrom, dateTo } = query;

  if (dateFrom || dateTo) {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    return { from, to };
  }

  const dateObj = parseDateOnly(date) || new Date();
  const from = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0, 0);
  const to = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999);
  return { from, to };
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

function getRemainingSlaMinutes(entry) {
  if (entry.status === "MENUNGGU" || entry.status === "IN_WH") return 30;
  if (entry.status === "PROSES") return entry.category === "RECEIVING" ? 120 : 90;
  return null;
}

function getRemainingStartTime(entry) {
  if (entry.status === "MENUNGGU" || entry.status === "IN_WH") return entry.registerTime;
  if (entry.status === "PROSES") return entry.startTime;
  return null;
}

function getEntryRemainingPriority(entry, nowMs) {
  const slaMinutes = getRemainingSlaMinutes(entry);
  const startTime = getRemainingStartTime(entry);
  if (slaMinutes === null || !startTime) return 2;

  const startMs = new Date(startTime).getTime();
  if (Number.isNaN(startMs)) return 2;
  const elapsedMinutes = Math.floor((nowMs - startMs) / 60000);
  const remainingMinutes = slaMinutes - elapsedMinutes;

  if (remainingMinutes <= 0) return 0;
  if (remainingMinutes <= 15) return 1;
  return 2;
}

async function createQueueEntry(data, actorUser) {
  const resolvedName = actorUser?.name || "system";
  const actorUserId = actorUser?.id || null;
  return prisma.queueEntry.create({
    data: {
      category: data.category,
      customerId: data.customerId,
      driverName: data.driverName,
      truckNumber: data.truckNumber,
      containerNumber: data.containerNumber || null,
      registerTime: data.registerTime ? new Date(data.registerTime) : undefined,
      notes: data.notes || null,
      logs: {
        create: {
          type: "CREATE",
          userName: resolvedName,
          actorUserId,
          toStatus: "MENUNGGU",
        },
      },
    },
    include: {
      customer: true,
    },
  });
}

async function listQueueEntries(query) {
  const { status, category, search } = query;
  const { from, to } = buildDateRange(query);
  const { sortBy, sortDir } = normalizeSort(query);
  const rawPage = typeof query.page === "string" ? Number(query.page) : Number(query.page);
  const rawLimit = typeof query.limit === "string" ? Number(query.limit) : Number(query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 15;
  let page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const where = {};
  if (status) where.status = status;
  if (category) where.category = category;
  if (from || to) {
    where.registerTime = {};
    if (from) where.registerTime.gte = from;
    if (to) where.registerTime.lte = to;
  }
  if (search) {
    where.OR = [
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { driverName: { contains: search, mode: "insensitive" } },
      { truckNumber: { contains: search, mode: "insensitive" } },
      { containerNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.queueEntry.findMany({
    where,
    orderBy: buildOrderBy(sortBy, sortDir),
    include: {
      customer: true,
      gate: true,
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
  const data = prioritizedRows.slice(skip, skip + limit).map((item) => item.entry);

  return {
    data,
    meta: {
      page,
      limit,
      totalItems,
      totalPages,
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

  return prisma.queueEntry.findMany({
    where,
    orderBy: [{ registerTime: "desc" }],
    include: {
      customer: true,
      gate: true,
    },
  });
}

function getTodayRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from, to };
}

async function listQueueEntriesForDisplay() {
  const { from, to } = getTodayRange();
  const entries = await prisma.queueEntry.findMany({
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
    },
  });

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
    },
  });
  if (!entry) {
    throw createHttpError(404, "Data tidak ditemukan");
  }
  return entry;
}

async function updateQueueEntry(id, data, actorUser) {
  const entry = await prisma.queueEntry.findUnique({ where: { id } });
  if (!entry) throw createHttpError(404, "Data tidak ditemukan");
  if (entry.status === "SELESAI" || entry.status === "BATAL") {
    throw createHttpError(400, "Data tidak bisa diubah karena status sudah final");
  }

  const resolvedName = actorUser?.name || "system";
  const actorUserId = actorUser?.id || null;

  return prisma.queueEntry.update({
    where: { id },
    data: {
      category: data.category ?? undefined,
      customerId: data.customerId ?? undefined,
      driverName: data.driverName ?? undefined,
      truckNumber: data.truckNumber ?? undefined,
      containerNumber: data.containerNumber ?? undefined,
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

async function changeQueueStatus(id, newStatus, actorUser, gateId) {
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
  } else if (!isNextStatus(currentStatus, newStatus) && !isPrevStatus(currentStatus, newStatus)) {
    throw createHttpError(400, "Perubahan status tidak valid");
  }

  const timeUpdates = {};
  let gateUpdate = {};
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
  if (newStatus === "IN_WH" && !entry.inWhTime) timeUpdates.inWhTime = new Date();
  if (newStatus === "PROSES" && !entry.startTime) timeUpdates.startTime = new Date();
  if (newStatus === "SELESAI" && !entry.finishTime) timeUpdates.finishTime = new Date();

  const resolvedName = actorUser?.name || "system";
  const actorUserId = actorUser?.id || null;

  return prisma.queueEntry.update({
    where: { id },
    data: {
      status: newStatus,
      ...gateUpdate,
      ...timeUpdates,
      logs: {
        create: {
          type: "STATUS_CHANGE",
          fromStatus: currentStatus,
          toStatus: newStatus,
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
}

module.exports = {
  getUserName,
  createQueueEntry,
  listQueueEntries,
  listQueueEntriesForExport,
  listQueueEntriesForDisplay,
  getQueueEntryById,
  updateQueueEntry,
  changeQueueStatus,
};

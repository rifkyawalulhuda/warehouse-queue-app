const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const STATUS_FLOW = ["MENUNGGU", "IN_WH", "PROSES", "SELESAI"];

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

async function createQueueEntry(data, userName) {
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
          action: "CREATE",
          userName,
          newStatus: "MENUNGGU",
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

  return prisma.queueEntry.findMany({
    where,
    orderBy: [{ status: "asc" }, { registerTime: "asc" }],
    include: {
      customer: true,
    },
  });
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
    orderBy: [{ registerTime: "asc" }],
    include: {
      customer: true,
    },
  });
}

async function getQueueEntryById(id) {
  const entry = await prisma.queueEntry.findUnique({
    where: { id },
    include: { logs: { orderBy: { createdAt: "asc" } }, customer: true },
  });
  if (!entry) {
    throw createHttpError(404, "Data tidak ditemukan");
  }
  return entry;
}

async function updateQueueEntry(id, data, userName) {
  const entry = await prisma.queueEntry.findUnique({ where: { id } });
  if (!entry) throw createHttpError(404, "Data tidak ditemukan");
  if (entry.status === "SELESAI" || entry.status === "BATAL") {
    throw createHttpError(400, "Data tidak bisa diubah karena status sudah final");
  }

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
          action: "UPDATE",
          userName,
        },
      },
    },
    include: {
      customer: true,
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

async function changeQueueStatus(id, newStatus, userName) {
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
  if (newStatus === "IN_WH" && !entry.inWhTime) timeUpdates.inWhTime = new Date();
  if (newStatus === "PROSES" && !entry.startTime) timeUpdates.startTime = new Date();
  if (newStatus === "SELESAI" && !entry.finishTime) timeUpdates.finishTime = new Date();

  return prisma.queueEntry.update({
    where: { id },
    data: {
      status: newStatus,
      ...timeUpdates,
      logs: {
        create: {
          action: "STATUS_CHANGE",
          oldStatus: currentStatus,
          newStatus,
          userName,
        },
      },
    },
    include: {
      customer: true,
    },
  });
}

module.exports = {
  getUserName,
  createQueueEntry,
  listQueueEntries,
  listQueueEntriesForExport,
  getQueueEntryById,
  updateQueueEntry,
  changeQueueStatus,
};

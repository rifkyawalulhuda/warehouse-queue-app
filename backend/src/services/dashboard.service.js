const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const STATUS_ORDER = ["MENUNGGU", "IN_WH", "PROSES", "SELESAI", "BATAL"];

function createHttpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

function formatDateOnly(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}

function parseDateOnly(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr);
  if (!match) return null;
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function resolveDateRange(dateQuery) {
  if (!dateQuery) {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    return { date: formatDateOnly(today), from, to };
  }

  const parsed = parseDateOnly(dateQuery);
  if (!parsed) {
    throw createHttpError(400, "Format date tidak valid. Gunakan YYYY-MM-DD");
  }

  const from = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
  const to = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 59, 999);
  return { date: formatDateOnly(parsed), from, to };
}

async function fetchEntries(dateQuery) {
  const range = resolveDateRange(dateQuery);
  const entries = await prisma.queueEntry.findMany({
    where: {
      registerTime: {
        gte: range.from,
        lte: range.to,
      },
    },
    select: {
      id: true,
      category: true,
      status: true,
      registerTime: true,
      finishTime: true,
    },
  });
  return { range, entries };
}

function getSlaMinutes(category) {
  if (category === "RECEIVING") return 60;
  if (category === "DELIVERY") return 45;
  return null;
}

function durationMinutes(start, end) {
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return null;
  return Math.floor(diffMs / 60000);
}

async function getSummary(dateQuery) {
  const { range, entries } = await fetchEntries(dateQuery);
  const now = new Date();

  let total = 0;
  let delivery = 0;
  let receiving = 0;
  let waiting = 0;
  let processing = 0;
  let done = 0;
  let cancelled = 0;

  let finishedCount = 0;
  let finishedMinutesSum = 0;
  let overSlaCount = 0;

  entries.forEach((entry) => {
    total += 1;
    if (entry.category === "DELIVERY") delivery += 1;
    if (entry.category === "RECEIVING") receiving += 1;
    if (entry.status === "MENUNGGU") waiting += 1;
    if (entry.status === "IN_WH" || entry.status === "PROSES") processing += 1;
    if (entry.status === "SELESAI") done += 1;
    if (entry.status === "BATAL") cancelled += 1;

    if (entry.finishTime) {
      const minutes = durationMinutes(new Date(entry.registerTime), new Date(entry.finishTime));
      if (minutes !== null) {
        finishedMinutesSum += minutes;
        finishedCount += 1;
      }
    }

    const slaMinutes = getSlaMinutes(entry.category);
    if (slaMinutes) {
      const end = entry.finishTime ? new Date(entry.finishTime) : now;
      const minutes = durationMinutes(new Date(entry.registerTime), end);
      if (minutes !== null && minutes >= slaMinutes) {
        overSlaCount += 1;
      }
    }
  });

  const avgProcessMinutes = finishedCount ? Math.round(finishedMinutesSum / finishedCount) : 0;
  const overSlaPercent = total ? Math.round((overSlaCount / total) * 100) : 0;

  return {
    date: range.date,
    total,
    delivery,
    receiving,
    waiting,
    processing,
    done,
    cancelled,
    avgProcessMinutes,
    overSlaPercent,
  };
}

async function getHourly(dateQuery) {
  const { range, entries } = await fetchEntries(dateQuery);
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    total: 0,
    receiving: 0,
    delivery: 0,
  }));

  entries.forEach((entry) => {
    const hour = new Date(entry.registerTime).getHours();
    const bucket = buckets[hour];
    if (!bucket) return;
    bucket.total += 1;
    if (entry.category === "RECEIVING") bucket.receiving += 1;
    if (entry.category === "DELIVERY") bucket.delivery += 1;
  });

  return { date: range.date, items: buckets };
}

async function getStatus(dateQuery) {
  const { range, entries } = await fetchEntries(dateQuery);
  const counts = {
    MENUNGGU: 0,
    IN_WH: 0,
    PROSES: 0,
    SELESAI: 0,
    BATAL: 0,
  };

  entries.forEach((entry) => {
    if (counts[entry.status] !== undefined) {
      counts[entry.status] += 1;
    }
  });

  const items = STATUS_ORDER.map((status) => ({
    name: status,
    value: counts[status] || 0,
  }));

  return { date: range.date, items };
}

module.exports = {
  getSummary,
  getHourly,
  getStatus,
};

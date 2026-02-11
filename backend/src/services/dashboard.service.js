const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const STATUS_ORDER = ["MENUNGGU", "IN_WH", "PROSES", "SELESAI", "BATAL"];
const MONTHLY_TRUCK_COLUMNS = [
  { key: "CDE", label: "CDE" },
  { key: "CDD", label: "CDD" },
  { key: "FUSO", label: "FUSO" },
  { key: "WB", label: "W/B" },
  { key: "FT20", label: "20 ft" },
  { key: "FT40", label: "40 ft" },
  { key: "OTHER", label: "Other" },
];

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

function formatDateOnlyUtc(date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
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

function parseDateOnlyUtc(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr);
  if (!match) return null;
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function formatMonthOnly(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${year}-${month}`;
}

function resolveMonthRange(monthQuery) {
  if (!monthQuery) {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const from = new Date(Date.UTC(year, monthIndex, 1));
    const to = new Date(Date.UTC(year, monthIndex + 1, 1));
    const queueFrom = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const queueTo = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
    return {
      month: formatMonthOnly(now),
      year,
      monthIndex,
      from,
      to,
      queueFrom,
      queueTo,
    };
  }

  const match = /^(\d{4})-(\d{2})$/.exec(monthQuery);
  if (!match) {
    throw createHttpError(400, "Format month tidak valid. Gunakan YYYY-MM");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw createHttpError(400, "Format month tidak valid. Gunakan YYYY-MM");
  }

  const monthIndex = month - 1;
  const from = new Date(Date.UTC(year, monthIndex, 1));
  const to = new Date(Date.UTC(year, monthIndex + 1, 1));
  const queueFrom = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const queueTo = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
  return {
    month: `${year}-${String(month).padStart(2, "0")}`,
    year,
    monthIndex,
    from,
    to,
    queueFrom,
    queueTo,
  };
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

async function getScheduleSummary(dateQuery) {
  const range = resolveDateRange(dateQuery);
  const scheduleDate = parseDateOnlyUtc(range.date);
  if (!scheduleDate) {
    throw createHttpError(400, "Format date tidak valid. Gunakan YYYY-MM-DD");
  }

  const [storeInAggregate, storeOutAggregate] = await Promise.all([
    prisma.shipmentScheduleItem.aggregate({
      where: {
        schedule: {
          scheduleDate,
          storeType: "STORE_IN",
        },
      },
      _sum: {
        qty: true,
      },
    }),
    prisma.shipmentScheduleItem.aggregate({
      where: {
        schedule: {
          scheduleDate,
          storeType: "STORE_OUT",
        },
      },
      _sum: {
        qty: true,
      },
    }),
  ]);

  const storeIn = storeInAggregate?._sum?.qty || 0;
  const storeOut = storeOutAggregate?._sum?.qty || 0;

  return {
    date: range.date,
    storeIn,
    storeOut,
    total: storeIn + storeOut,
  };
}

async function getProgressSummary(dateQuery) {
  const range = resolveDateRange(dateQuery);
  const scheduleDate = parseDateOnlyUtc(range.date);
  if (!scheduleDate) {
    throw createHttpError(400, "Format date tidak valid. Gunakan YYYY-MM-DD");
  }

  const queueDateFilter = {
    registerTime: {
      gte: range.from,
      lte: range.to,
    },
  };

  const [targetQtyAggregate, selesaiCount, prosesCount] = await Promise.all([
    prisma.shipmentScheduleItem.aggregate({
      where: {
        schedule: {
          scheduleDate,
        },
      },
      _sum: {
        qty: true,
      },
    }),
    prisma.queueEntry.count({
      where: {
        ...queueDateFilter,
        status: "SELESAI",
      },
    }),
    prisma.queueEntry.count({
      where: {
        ...queueDateFilter,
        status: {
          notIn: ["SELESAI", "BATAL"],
        },
      },
    }),
  ]);

  const targetPengiriman = targetQtyAggregate?._sum?.qty || 0;

  const selesaiPct = targetPengiriman > 0 ? (selesaiCount / targetPengiriman) * 100 : 0;
  const prosesPct = targetPengiriman > 0 ? (prosesCount / targetPengiriman) * 100 : 0;

  return {
    date: range.date,
    targetPengiriman,
    selesaiCount,
    prosesCount,
    selesaiPct,
    prosesPct,
    totalPct: selesaiPct + prosesPct,
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

function formatDurationHumanMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "kurang dari 1 menit";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0 && remainingMinutes > 0) return `${hours} jam ${remainingMinutes} menit`;
  if (hours > 0 && remainingMinutes === 0) return `${hours} jam`;
  return `${remainingMinutes} menit`;
}

async function getTopCustomers(dateQuery) {
  const range = resolveDateRange(dateQuery);
  const entries = await prisma.queueEntry.findMany({
    where: {
      registerTime: {
        gte: range.from,
        lte: range.to,
      },
      finishTime: {
        not: null,
      },
    },
    select: {
      registerTime: true,
      finishTime: true,
      customer: { select: { name: true } },
    },
  });

  const grouped = new Map();
  entries.forEach((entry) => {
    if (!entry.finishTime) return;
    const minutes = durationMinutes(new Date(entry.registerTime), new Date(entry.finishTime));
    if (minutes === null) return;
    const name = entry.customer?.name || "-";
    const current = grouped.get(name) || { totalMinutes: 0, totalTransactions: 0 };
    current.totalMinutes += minutes;
    current.totalTransactions += 1;
    grouped.set(name, current);
  });

  const items = Array.from(grouped.entries()).map(([customerName, data]) => {
    const avgDurationMinutes = data.totalTransactions
      ? Math.round(data.totalMinutes / data.totalTransactions)
      : 0;
    return {
      customerName,
      avgDurationMinutes,
      totalTransactions: data.totalTransactions,
    };
  });

  items.sort((a, b) => b.avgDurationMinutes - a.avgDurationMinutes);

  return { date: range.date, items: items.slice(0, 5) };
}

async function getOverSla(dateQuery) {
  const range = resolveDateRange(dateQuery);
  const now = new Date();

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
      driverName: true,
      truckNumber: true,
      customer: { select: { name: true } },
    },
  });

  const items = entries
    .map((entry) => {
      if (entry.status === "BATAL") return null;
      const slaMinutes = getSlaMinutes(entry.category);
      if (!slaMinutes) return null;
      const end = entry.finishTime ? new Date(entry.finishTime) : now;
      const minutes = durationMinutes(new Date(entry.registerTime), end);
      if (minutes === null) return null;
      if (minutes < slaMinutes) return null;
      return {
        id: entry.id,
        customerName: entry.customer?.name || "-",
        driverName: entry.driverName,
        truckNumber: entry.truckNumber,
        category: entry.category,
        durationMinutes: minutes,
        slaMinutes,
        overMinutes: minutes - slaMinutes,
        status: entry.status,
      };
    })
    .filter(Boolean);

  items.sort((a, b) => b.overMinutes - a.overMinutes);

  return { date: range.date, items: items.slice(0, 5) };
}

async function getMonthlyScheduleTruckSummary(monthQuery) {
  const range = resolveMonthRange(monthQuery);

  const rows = await prisma.shipmentScheduleItem.findMany({
    where: {
      schedule: {
        scheduleDate: {
          gte: range.from,
          lt: range.to,
        },
      },
    },
    select: {
      truckType: true,
      qty: true,
      schedule: {
        select: {
          storeType: true,
        },
      },
    },
  });

  const bucketMap = MONTHLY_TRUCK_COLUMNS.reduce((acc, column) => {
    acc[column.key] = {
      key: column.key,
      label: column.label,
      storeInQty: 0,
      storeOutQty: 0,
      totalQty: 0,
    };
    return acc;
  }, {});

  rows.forEach((row) => {
    const key = bucketMap[row.truckType] ? row.truckType : "OTHER";
    const qty = Number(row.qty) || 0;
    if (row.schedule?.storeType === "STORE_OUT") {
      bucketMap[key].storeOutQty += qty;
    } else {
      bucketMap[key].storeInQty += qty;
    }
    bucketMap[key].totalQty += qty;
  });

  const items = MONTHLY_TRUCK_COLUMNS.map((column) => bucketMap[column.key]);
  const totalQty = items.reduce((sum, item) => sum + item.totalQty, 0);

  return {
    month: range.month,
    totalQty,
    items,
  };
}

async function getMonthlyReport(monthQuery) {
  const range = resolveMonthRange(monthQuery);

  const [queueEntries, scheduleItems, monthlyTruckSummary] = await Promise.all([
    prisma.queueEntry.findMany({
      where: {
        registerTime: {
          gte: range.queueFrom,
          lt: range.queueTo,
        },
      },
      select: {
        id: true,
        category: true,
        status: true,
        registerTime: true,
        finishTime: true,
        driverName: true,
        truckNumber: true,
        customer: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.shipmentScheduleItem.findMany({
      where: {
        schedule: {
          scheduleDate: {
            gte: range.from,
            lt: range.to,
          },
        },
      },
      select: {
        qty: true,
        truckType: true,
        truckTypeOther: true,
        schedule: {
          select: {
            scheduleDate: true,
            storeType: true,
            customer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    getMonthlyScheduleTruckSummary(range.month),
  ]);

  const now = new Date();

  const queueSummary = {
    total: 0,
    delivery: 0,
    receiving: 0,
    waiting: 0,
    processing: 0,
    done: 0,
    cancelled: 0,
    avgProcessMinutes: 0,
    overSlaPercent: 0,
  };

  const dailyQueueMap = new Map();
  const dailyScheduleMap = new Map();
  const queueStatusCounts = {
    MENUNGGU: 0,
    IN_WH: 0,
    PROSES: 0,
    SELESAI: 0,
    BATAL: 0,
  };

  const queueDurationByCustomer = new Map();
  let finishedCount = 0;
  let finishedMinutesSum = 0;
  let overSlaCount = 0;

  const monthCursor = new Date(Date.UTC(range.year, range.monthIndex, 1));
  const monthEnd = new Date(Date.UTC(range.year, range.monthIndex + 1, 1));
  while (monthCursor < monthEnd) {
    const dateKey = formatDateOnlyUtc(monthCursor);
    dailyQueueMap.set(dateKey, {
      date: dateKey,
      total: 0,
      delivery: 0,
      receiving: 0,
      done: 0,
    });
    dailyScheduleMap.set(dateKey, {
      date: dateKey,
      storeInQty: 0,
      storeOutQty: 0,
      totalQty: 0,
    });
    monthCursor.setUTCDate(monthCursor.getUTCDate() + 1);
  }

  const overSlaItemsRaw = [];

  queueEntries.forEach((entry) => {
    queueSummary.total += 1;
    if (entry.category === "DELIVERY") queueSummary.delivery += 1;
    if (entry.category === "RECEIVING") queueSummary.receiving += 1;
    if (entry.status === "MENUNGGU") queueSummary.waiting += 1;
    if (entry.status === "IN_WH" || entry.status === "PROSES") queueSummary.processing += 1;
    if (entry.status === "SELESAI") queueSummary.done += 1;
    if (entry.status === "BATAL") queueSummary.cancelled += 1;

    if (queueStatusCounts[entry.status] !== undefined) {
      queueStatusCounts[entry.status] += 1;
    }

    const queueDateKey = formatDateOnly(new Date(entry.registerTime));
    if (!dailyQueueMap.has(queueDateKey)) {
      dailyQueueMap.set(queueDateKey, {
        date: queueDateKey,
        total: 0,
        delivery: 0,
        receiving: 0,
        done: 0,
      });
    }
    const queueDay = dailyQueueMap.get(queueDateKey);
    queueDay.total += 1;
    if (entry.category === "DELIVERY") queueDay.delivery += 1;
    if (entry.category === "RECEIVING") queueDay.receiving += 1;
    if (entry.status === "SELESAI") queueDay.done += 1;

    if (entry.finishTime) {
      const minutes = durationMinutes(new Date(entry.registerTime), new Date(entry.finishTime));
      if (minutes !== null) {
        finishedMinutesSum += minutes;
        finishedCount += 1;

        const customerName = entry.customer?.name || "-";
        const current = queueDurationByCustomer.get(customerName) || {
          totalMinutes: 0,
          totalTransactions: 0,
        };
        current.totalMinutes += minutes;
        current.totalTransactions += 1;
        queueDurationByCustomer.set(customerName, current);
      }
    }

    if (entry.status !== "BATAL") {
      const slaMinutes = getSlaMinutes(entry.category);
      if (slaMinutes) {
        const end = entry.finishTime ? new Date(entry.finishTime) : now;
        const minutes = durationMinutes(new Date(entry.registerTime), end);
        if (minutes !== null && minutes >= slaMinutes) {
          overSlaCount += 1;
          overSlaItemsRaw.push({
            id: entry.id,
            date: formatDateOnly(new Date(entry.registerTime)),
            customerName: entry.customer?.name || "-",
            driverName: entry.driverName,
            truckNumber: entry.truckNumber,
            category: entry.category,
            status: entry.status,
            overMinutes: minutes - slaMinutes,
            durationMinutes: minutes,
          });
        }
      }
    }
  });

  queueSummary.avgProcessMinutes = finishedCount ? Math.round(finishedMinutesSum / finishedCount) : 0;
  queueSummary.overSlaPercent = queueSummary.total
    ? Math.round((overSlaCount / queueSummary.total) * 100)
    : 0;

  const scheduleSummary = {
    storeInQty: 0,
    storeOutQty: 0,
    totalQty: 0,
  };

  const scheduleQtyByCustomer = new Map();

  scheduleItems.forEach((item) => {
    const qty = Number(item.qty) || 0;
    const storeType = item.schedule?.storeType;
    const dateKey = formatDateOnlyUtc(new Date(item.schedule?.scheduleDate));

    if (!dailyScheduleMap.has(dateKey)) {
      dailyScheduleMap.set(dateKey, {
        date: dateKey,
        storeInQty: 0,
        storeOutQty: 0,
        totalQty: 0,
      });
    }

    const scheduleDay = dailyScheduleMap.get(dateKey);
    if (storeType === "STORE_OUT") {
      scheduleSummary.storeOutQty += qty;
      scheduleDay.storeOutQty += qty;
    } else {
      scheduleSummary.storeInQty += qty;
      scheduleDay.storeInQty += qty;
    }
    scheduleSummary.totalQty += qty;
    scheduleDay.totalQty += qty;

    const customerName = item.schedule?.customer?.name || "-";
    const current = scheduleQtyByCustomer.get(customerName) || {
      customerName,
      storeInQty: 0,
      storeOutQty: 0,
      totalQty: 0,
    };
    if (storeType === "STORE_OUT") {
      current.storeOutQty += qty;
    } else {
      current.storeInQty += qty;
    }
    current.totalQty += qty;
    scheduleQtyByCustomer.set(customerName, current);
  });

  const topCustomers = Array.from(queueDurationByCustomer.entries())
    .map(([customerName, data]) => ({
      customerName,
      avgDurationMinutes: data.totalTransactions
        ? Math.round(data.totalMinutes / data.totalTransactions)
        : 0,
      totalTransactions: data.totalTransactions,
    }))
    .sort((a, b) => b.avgDurationMinutes - a.avgDurationMinutes)
    .slice(0, 10);

  const overSlaItems = overSlaItemsRaw
    .sort((a, b) => b.overMinutes - a.overMinutes)
    .slice(0, 10);

  const scheduleTopCustomers = Array.from(scheduleQtyByCustomer.values())
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, 10);

  const queueDaily = Array.from(dailyQueueMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const scheduleDaily = Array.from(dailyScheduleMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    month: range.month,
    generatedAt: new Date().toISOString(),
    queueSummary,
    scheduleSummary,
    queueStatusItems: STATUS_ORDER.map((status) => ({
      name: status,
      value: queueStatusCounts[status] || 0,
    })),
    dailyQueue: queueDaily,
    dailySchedule: scheduleDaily,
    truckCategoryItems: monthlyTruckSummary.items,
    topCustomers,
    overSlaItems,
    scheduleTopCustomers,
  };
}

module.exports = {
  getSummary,
  getScheduleSummary,
  getProgressSummary,
  getHourly,
  getStatus,
  getTopCustomers,
  getOverSla,
  getMonthlyScheduleTruckSummary,
  getMonthlyReport,
};

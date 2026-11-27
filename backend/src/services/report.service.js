const prisma = require("../utils/prisma");
const { getScheduleSettings } = require("./schedule.service");

const MINUTE_MS = 60 * 1000;

function createHttpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

function parseDateOnly(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.trim().split("-");
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

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function diffMinutes(later, earlier) {
  if (!later || !earlier) return null;
  const diff = (new Date(later).getTime() - new Date(earlier).getTime()) / MINUTE_MS;
  return Math.round(diff);
}

function resolveRange(query) {
  const dateFrom = parseDateOnly(query.dateFrom);
  const dateTo = parseDateOnly(query.dateTo);
  const today = new Date();

  const fromDate = dateFrom || new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const toDate = dateTo || fromDate;

  if (fromDate.getTime() > toDate.getTime()) {
    throw createHttpError(400, "dateFrom tidak boleh lebih besar dari dateTo");
  }

  return {
    scheduleFrom: fromDate,
    scheduleTo: toDate,
    registerFrom: startOfLocalDay(fromDate),
    registerTo: endOfLocalDay(toDate),
  };
}

function evaluateOnTime(varianceMinutes, toleranceMinutes) {
  if (varianceMinutes === null) return null;
  // T2: datang lebih awal tetap on-time; yang dihitung terlambat hanya
  // selisih positif di atas toleransi.
  return varianceMinutes <= toleranceMinutes;
}

function summarize(rows, toleranceArrival, toleranceFinish) {
  const arrivalKnown = rows.filter((row) => row.varianceArrivalMinutes !== null);
  const finishKnown = rows.filter((row) => row.varianceFinishMinutes !== null);

  const arrivalLate = arrivalKnown.filter(
    (row) => row.varianceArrivalMinutes > toleranceArrival
  ).length;
  const finishLate = finishKnown.filter(
    (row) => row.varianceFinishMinutes > toleranceFinish
  ).length;

  const avg = (values) =>
    values.length === 0
      ? null
      : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

  return {
    totalPlan: rows.length,
    totalActual: rows.filter((row) => row.queueEntryId).length,
    totalNoShow: rows.filter((row) => row.scheduleStatus === "NO_SHOW").length,
    totalNoShowClosed: rows.filter((row) => row.scheduleStatus === "NO_SHOW_CLOSED").length,
    arrival: {
      measured: arrivalKnown.length,
      onTime: arrivalKnown.length - arrivalLate,
      late: arrivalLate,
      onTimeRate:
        arrivalKnown.length === 0
          ? null
          : Math.round(((arrivalKnown.length - arrivalLate) / arrivalKnown.length) * 1000) / 10,
      avgVarianceMinutes: avg(arrivalKnown.map((row) => row.varianceArrivalMinutes)),
      maxLateMinutes:
        arrivalLate === 0
          ? null
          : Math.max(
              ...arrivalKnown
                .map((row) => row.varianceArrivalMinutes)
                .filter((value) => value > toleranceArrival)
            ),
    },
    finish: {
      measured: finishKnown.length,
      onTime: finishKnown.length - finishLate,
      late: finishLate,
      onTimeRate:
        finishKnown.length === 0
          ? null
          : Math.round(((finishKnown.length - finishLate) / finishKnown.length) * 1000) / 10,
      avgVarianceMinutes: avg(finishKnown.map((row) => row.varianceFinishMinutes)),
    },
    tolerance: {
      arrivalMinutes: toleranceArrival,
      finishMinutes: toleranceFinish,
    },
  };
}

/**
 * Menyusun filter report dari query.
 *
 * R4: sebuah baris ikut masuk periode bila SALAH SATU tanggalnya jatuh di
 * dalam rentang — tanggal rencana untuk sisi Plan, jam tiba untuk sisi Aktual.
 * Tanpa ini, truk yang direncanakan 31 Des tapi tiba 2 Jan hilang dari kedua
 * sheet saat diekspor per tahun.
 */
function buildReportWheres(query) {
  const range = resolveRange(query);

  const customerId =
    typeof query.customerId === "string" && query.customerId.trim() ? query.customerId.trim() : null;
  const transporterId =
    typeof query.transporterId === "string" && query.transporterId.trim()
      ? query.transporterId.trim()
      : null;
  const category =
    typeof query.category === "string" ? query.category.trim().toUpperCase() : "";

  const scheduleBase = {};
  if (customerId) scheduleBase.customerId = customerId;
  if (category === "RECEIVING") scheduleBase.storeType = "STORE_IN";
  if (category === "DELIVERY") scheduleBase.storeType = "STORE_OUT";

  const planWhere = {
    ...(transporterId ? { transporterId } : {}),
    OR: [
      {
        schedule: {
          ...scheduleBase,
          scheduleDate: { gte: range.scheduleFrom, lte: range.scheduleTo },
        },
      },
      {
        schedule: scheduleBase,
        queueEntries: {
          some: {
            status: { not: "BATAL" },
            registerTime: { gte: range.registerFrom, lte: range.registerTo },
          },
        },
      },
    ],
  };

  const actualWhere = {
    status: { not: "BATAL" },
    OR: [
      { registerTime: { gte: range.registerFrom, lte: range.registerTo } },
      {
        scheduleItem: {
          schedule: { scheduleDate: { gte: range.scheduleFrom, lte: range.scheduleTo } },
        },
      },
    ],
  };
  if (customerId) actualWhere.customerId = customerId;
  if (transporterId) actualWhere.transporterId = transporterId;
  if (category === "RECEIVING") actualWhere.category = "RECEIVING";
  if (category === "DELIVERY") actualWhere.category = "DELIVERY";

  return {
    range,
    filters: { customerId, transporterId, category },
    planWhere,
    actualWhere,
  };
}

/** Perkiraan jumlah baris export: total Plan + total Aktual pada periode. */
async function countReportRows(query) {
  const { planWhere, actualWhere } = buildReportWheres(query);
  const [plan, actual] = await Promise.all([
    prisma.shipmentScheduleItem.count({ where: planWhere }),
    prisma.queueEntry.count({ where: actualWhere }),
  ]);
  return plan + actual;
}

async function buildReport(query) {
  const { range, filters, planWhere, actualWhere } = buildReportWheres(query);
  const { customerId, transporterId, category } = filters;
  const settings = await getScheduleSettings();

  const items = await prisma.shipmentScheduleItem.findMany({
    where: planWhere,
    orderBy: [{ schedule: { scheduleDate: "asc" } }, { plannedStart: "asc" }],
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
      queueEntries: {
        where: { status: { not: "BATAL" } },
        orderBy: { registerTime: "asc" },
        select: {
          id: true,
          status: true,
          registerTime: true,
          inWhTime: true,
          startTime: true,
          finishTime: true,
          truckNumber: true,
          truckType: true,
          transporter: true,
          driverName: true,
          containerNumbers: true,
          customerId: true,
          autoCompleted: true,
          plannedStart: true,
          plannedFinish: true,
          customer: { select: { id: true, name: true } },
        },
      },
    },
  });

  const planRows = items.map((item) => {
    const entry = item.queueEntries[0] || null;
    // Perbandingan memakai snapshot plan pada antrian (bila ada), bukan nilai
    // plan terkini: perubahan jadwal setelah antrian dibuat tidak boleh
    // mengubah histori variance. Baris yang belum pernah ditautkan memakai
    // nilai plan saat ini.
    const plannedStart = entry?.plannedStart ?? item.plannedStart;
    const plannedFinish = entry?.plannedFinish ?? item.plannedFinish;
    const varianceArrivalMinutes = entry ? diffMinutes(entry.registerTime, plannedStart) : null;
    const varianceFinishMinutes = entry ? diffMinutes(entry.finishTime, plannedFinish) : null;
    const autoCompleted = Boolean(entry?.autoCompleted);

    return {
      scheduleItemId: item.id,
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
      plannedStart,
      plannedFinish,
      plannedStartOriginal: item.plannedStart,
      plannedFinishOriginal: item.plannedFinish,
      scheduleStatus: item.status,
      queueEntryId: entry?.id || null,
      queueStatus: entry?.status || null,
      registerTime: entry?.registerTime || null,
      finishTime: entry?.finishTime || null,
      actualTruckNumber: entry?.truckNumber || null,
      actualCustomerId: entry?.customerId || null,
      actualCustomerName: entry?.customer?.name || null,
      actualTransporterName: entry?.transporter || null,
      varianceArrivalMinutes,
      varianceFinishMinutes,
      // Auto-complete tidak dipakai untuk statistik (desain: dikecualikan).
      isOnTimeArrival: autoCompleted
        ? null
        : evaluateOnTime(varianceArrivalMinutes, settings.onTimeToleranceArrivalMinutes),
      isOnTimeFinish: autoCompleted
        ? null
        : evaluateOnTime(varianceFinishMinutes, settings.onTimeToleranceFinishMinutes),
      autoCompleted,
    };
  });

  // Tabel aktual: antrian yang waktunya jatuh di rentang, termasuk walk-in.
  const entries = await prisma.queueEntry.findMany({
    where: actualWhere,
    orderBy: { registerTime: "asc" },
    include: {
      customer: { select: { id: true, name: true } },
      scheduleItem: {
        select: {
          id: true,
          plateNumber: true,
          truckType: true,
          plannedStart: true,
          plannedFinish: true,
          schedule: {
            select: {
              scheduleDate: true,
              storeType: true,
              customer: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  const actualRows = entries
    .map((entry) => {
      const plan = entry.scheduleItem;
      // Snapshot pada antrian lebih diutamakan; item schedule hanya cadangan.
      const plannedStart = entry.plannedStart ?? plan?.plannedStart ?? null;
      const plannedFinish = entry.plannedFinish ?? plan?.plannedFinish ?? null;
      const varianceArrivalMinutes = diffMinutes(entry.registerTime, plannedStart);
      const varianceFinishMinutes = diffMinutes(entry.finishTime, plannedFinish);
      const autoCompleted = Boolean(entry.autoCompleted);

      return {
        queueEntryId: entry.id,
        scheduleItemId: entry.scheduleItemId,
        isWalkIn: !entry.scheduleItemId,
        registerTime: entry.registerTime,
        inWhTime: entry.inWhTime,
        startTime: entry.startTime,
        finishTime: entry.finishTime,
        status: entry.status,
        category: entry.category,
        truckNumber: entry.truckNumber,
        truckType: entry.truckType,
        transporterName: entry.transporter,
        driverName: entry.driverName,
        containerNumbers: entry.containerNumbers,
        customerId: entry.customer?.id || null,
        customerName: entry.customer?.name || null,
        plannedCustomerName: plan?.schedule?.customer?.name || null,
        plannedStart,
        plannedFinish,
        varianceArrivalMinutes,
        varianceFinishMinutes,
        isOnTimeArrival: autoCompleted
          ? null
          : evaluateOnTime(varianceArrivalMinutes, settings.onTimeToleranceArrivalMinutes),
        isOnTimeFinish: autoCompleted
          ? null
          : evaluateOnTime(varianceFinishMinutes, settings.onTimeToleranceFinishMinutes),
        autoCompleted,
      };
    });

  const groupBy =
    typeof query.groupBy === "string" && ["customer", "transporter", "date"].includes(query.groupBy)
      ? query.groupBy
      : "date";

  const groupsMap = new Map();
  planRows.forEach((row) => {
    let key;
    let label;
    if (groupBy === "customer") {
      key = row.customerId || "unknown";
      label = row.customerName || "-";
    } else if (groupBy === "transporter") {
      key = row.transporterId || "unknown";
      label = row.transporterName || "-";
    } else {
      const date = new Date(row.scheduleDate);
      key = date.toISOString().slice(0, 10);
      label = key;
    }
    if (!groupsMap.has(key)) groupsMap.set(key, { key, label, rows: [] });
    groupsMap.get(key).rows.push(row);
  });

  const groups = Array.from(groupsMap.values()).map((group) => ({
    key: group.key,
    label: group.label,
    summary: summarize(
      group.rows,
      settings.onTimeToleranceArrivalMinutes,
      settings.onTimeToleranceFinishMinutes
    ),
  }));

  return {
    range: {
      dateFrom: range.scheduleFrom,
      dateTo: range.scheduleTo,
    },
    filters: {
      customerId,
      transporterId,
      category: category || null,
      groupBy,
    },
    summary: summarize(
      planRows,
      settings.onTimeToleranceArrivalMinutes,
      settings.onTimeToleranceFinishMinutes
    ),
    groups: groups.sort((a, b) => a.label.localeCompare(b.label)),
    planRows,
    actualRows,
  };
}

module.exports = {
  buildReport,
  countReportRows,
  diffMinutes,
  evaluateOnTime,
};

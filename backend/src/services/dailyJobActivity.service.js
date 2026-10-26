const prisma = require("../utils/prisma");
const {
  STATUS_PROGRESS,
  STATUS_FINISHED,
  STATUS_CANCELLED,
  ACTIVITY_RECEIVING,
  ACTIVITY_DELIVERY,
  ACTIVITY_PICKING,
  ACTIVITY_STUFFING,
  MANPOWER_ACTIVITIES,
  parseWallClock,
  toUtcDateOnly,
  toDateOnlyString,
  toTimeString
} = require("./jobTransaction.service");

const REPORT_EMPTY = "KOSONG";
const REPORT_RUNNING = "BERJALAN";
const REPORT_DONE = "SELESAI";
const REPORT_CANCELLED = "BATAL";

const BUCKET_BY_TRUCK = {
  CDD: "cddCde",
  CDE: "cddCde",
  WB: "wingbox",
  FUSO: "wingbox",
  OTHER: "wingbox",
  FT20: "container",
  FT40: "container"
};

function createHttpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

function normalizeText(value, maxLength) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return maxLength ? text.slice(0, maxLength) : text;
}

function resolveActivityDate(value) {
  if (!value) throw createHttpError(400, "Tanggal wajib diisi");
  return toUtcDateOnly(parseWallClock(value, "Tanggal"));
}

function overlap(a, b) {
  if (!a.startAt || !b.startAt) return false;
  const aStart = a.startAt.getTime();
  const bStart = b.startAt.getTime();
  const aEnd = a.finishAt ? a.finishAt.getTime() : Number.POSITIVE_INFINITY;
  const bEnd = b.finishAt ? b.finishAt.getTime() : Number.POSITIVE_INFINITY;
  return aStart < bEnd && bStart < aEnd;
}

function deriveReportStatus(transactions) {
  if (transactions.length === 0) return REPORT_EMPTY;
  const active = transactions.filter(
    (row) => row.status === STATUS_PROGRESS || row.status === STATUS_FINISHED
  );
  if (active.length === 0) {
    // Hanya transaksi BATAL yang membuat laporan berstatus BATAL.
    // Hari yang isinya masih Draft belum punya pekerjaan berjalan -> KOSONG.
    const allCancelled = transactions.every((row) => row.status === STATUS_CANCELLED);
    return allCancelled ? REPORT_CANCELLED : REPORT_EMPTY;
  }
  if (active.some((row) => row.status === STATUS_PROGRESS)) return REPORT_RUNNING;
  return REPORT_DONE;
}

function buildSummary(transactions) {
  const receiving = { cddCde: 0, wingbox: 0, container: 0 };
  const delivery = { cddCde: 0, wingbox: 0, container: 0 };

  transactions.forEach((row) => {
    if (!MANPOWER_ACTIVITIES.includes(row.activityType)) return;
    const bucket = BUCKET_BY_TRUCK[row.truckType];
    if (!bucket) return;
    const target = row.activityType === ACTIVITY_RECEIVING ? receiving : delivery;
    target[bucket] += row.qty || 0;
  });

  const cell = (value) => (value > 0 ? String(value) : null);

  return {
    recCddCde: cell(receiving.cddCde),
    recWingbox: cell(receiving.wingbox),
    recContainer: cell(receiving.container),
    delCddCde: cell(delivery.cddCde),
    delWingboxOther: cell(delivery.wingbox),
    delContainer: cell(delivery.container),
    totals: {
      receiving: { ...receiving, total: receiving.cddCde + receiving.wingbox + receiving.container },
      delivery: { ...delivery, total: delivery.cddCde + delivery.wingbox + delivery.container }
    }
  };
}

function buildSessions(transactions, activityType) {
  const rows = transactions.filter(
    (row) => row.activityType === activityType && row.status !== STATUS_CANCELLED
  );

  const map = new Map();
  rows.forEach((row) => {
    const key = row.employeeId || row.employeeName;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });

  const sessions = [...map.entries()].map(([key, items]) => {
    const sorted = [...items].sort((a, b) => {
      const aTime = a.startAt ? a.startAt.getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.startAt ? b.startAt.getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });

    const qty = { qtyCdd: 0, qtyWb: 0, qtyFuso: 0, qty20ft: 0, qty40ft: 0 };
    sorted.forEach((row) => {
      if (row.truckType === "CDD" || row.truckType === "CDE") qty.qtyCdd += row.qty || 0;
      else if (row.truckType === "WB") qty.qtyWb += row.qty || 0;
      else if (row.truckType === "FUSO") qty.qtyFuso += row.qty || 0;
      else if (row.truckType === "OTHER") qty.qtyWb += row.qty || 0;
      else if (row.truckType === "FT20") qty.qty20ft += row.qty || 0;
      else if (row.truckType === "FT40") qty.qty40ft += row.qty || 0;
    });

    const startAt = sorted[0].startAt ?? null;
    const allFinished = sorted.every((row) => row.status === STATUS_FINISHED);
    const finishAt = allFinished
      ? sorted.reduce((latest, row) => {
          if (!row.finishAt) return latest;
          if (!latest) return row.finishAt;
          return row.finishAt.getTime() > latest.getTime() ? row.finishAt : latest;
        }, null)
      : null;

    const confirmation = [...sorted]
      .reverse()
      .map((row) => row.confirmation)
      .find(Boolean);

    return {
      key,
      employeeId: sorted[0].employeeId,
      employeeName: sorted[0].employeeName,
      jobRole: sorted[0].jobRole,
      activityType,
      ...qty,
      qtyTotal: qty.qtyCdd + qty.qtyWb + qty.qtyFuso + qty.qty20ft + qty.qty40ft,
      startAt,
      finishAt,
      timeStart: toTimeString(startAt),
      timeFinish: toTimeString(finishAt),
      isFinish: allFinished,
      isPending: !allFinished,
      confirmation: confirmation || null,
      transactionIds: sorted.map((row) => row.id)
    };
  });

  return sessions.sort((a, b) => {
    const aTime = a.startAt ? a.startAt.getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.startAt ? b.startAt.getTime() : Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    return a.employeeName.localeCompare(b.employeeName);
  });
}

function pairSessions(tallySessions, operatorSessions) {
  const used = new Set();
  const groups = [];

  tallySessions.forEach((tally) => {
    let operator = operatorSessions.find((row) => !used.has(row.key) && overlap(tally, row));
    if (!operator) operator = operatorSessions.find((row) => !used.has(row.key)) || null;
    if (operator) used.add(operator.key);
    groups.push({ tally, operator });
  });

  operatorSessions
    .filter((row) => !used.has(row.key))
    .forEach((operator) => groups.push({ tally: null, operator }));

  return groups;
}

function buildSessionRows(transactions, activityType) {
  return transactions
    .filter((row) => row.activityType === activityType && row.status !== STATUS_CANCELLED)
    .sort((a, b) => {
      const aTime = a.startAt ? a.startAt.getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.startAt ? b.startAt.getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    })
    .map((row) => ({
      id: row.id,
      totalDo: row.totalDo,
      totalMember: row.totalMember,
      total: activityType === ACTIVITY_PICKING
        ? row.totalDo !== null ? `${row.totalDo} DO` : null
        : row.totalDo !== null ? `${row.totalDo} DO` : null,
      startAt: row.startAt,
      finishAt: row.finishAt,
      timeWork:
        row.startAt && row.finishAt
          ? `${toTimeString(row.startAt)} - ${toTimeString(row.finishAt)}`
          : toTimeString(row.startAt),
      isPending: row.status === STATUS_PROGRESS,
      isFinish: row.status === STATUS_FINISHED,
      confirmation: row.confirmation,
      status: row.status
    }));
}

function buildReport(activity, transactions) {
  const tallySessions = buildSessions(transactions, ACTIVITY_RECEIVING);
  const operatorSessions = buildSessions(transactions, ACTIVITY_DELIVERY);

  const groups = pairSessions(tallySessions, operatorSessions).map((group, index) => ({
    groupIndex: index,
    tally: group.tally,
    operator: group.operator
  }));

  const summary = buildSummary(transactions);

  const counts = { ALL: transactions.length, DRAFT: 0, PROSES: 0, SELESAI: 0, BATAL: 0 };
  transactions.forEach((row) => {
    const key = String(row.status || "").toUpperCase();
    if (key in counts) counts[key] += 1;
  });

  return {
    id: activity?.id || null,
    activityDate: toDateOnlyString(
      activity?.activityDate || (transactions[0]?.transactionDate ?? new Date())
    ),
    notes: activity?.notes || null,
    status: deriveReportStatus(transactions),
    summary,
    groups,
    picking: buildSessionRows(transactions, ACTIVITY_PICKING),
    stuffing: buildSessionRows(transactions, ACTIVITY_STUFFING),
    transactions: transactions.length,
    counts,
    updatedAt: activity?.updatedAt || null,
    createdAt: activity?.createdAt || null
  };
}

async function loadReport(where) {
  const activity = await prisma.dailyJobActivity.findUnique({
    where,
    include: {
      transactions: {
        orderBy: [{ startAt: "asc" }, { createdAt: "asc" }],
        include: {
          employee: { select: { id: true, name: true, position: true } }
        }
      }
    }
  });

  if (!activity) return null;
  return buildReport(activity, activity.transactions);
}

async function getDailyJobActivityByDate(dateValue) {
  const activityDate = resolveActivityDate(dateValue);
  const report = await loadReport({ activityDate });
  if (report) return report;

  return buildReport(null, []);
}

async function getDailyJobActivityById(id) {
  const report = await loadReport({ id });
  if (!report) throw createHttpError(404, "Laporan Daily Job Activity tidak ditemukan");
  return report;
}

async function listDailyJobActivities(query) {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query?.limit) || 30));

  const where = {};
  if (query?.date) {
    where.activityDate = resolveActivityDate(query.date);
  } else if (query?.dateFrom || query?.dateTo) {
    const from = resolveActivityDate(query.dateFrom || query.dateTo);
    const to = resolveActivityDate(query.dateTo || query.dateFrom);
    if (from.getTime() > to.getTime()) {
      throw createHttpError(400, "Tanggal mulai tidak boleh lebih besar dari tanggal akhir");
    }
    where.activityDate = { gte: from, lte: to };
  }

  const [total, rows] = await Promise.all([
    prisma.dailyJobActivity.count({ where }),
    prisma.dailyJobActivity.findMany({
      where,
      orderBy: { activityDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        transactions: {
          select: {
            id: true,
            status: true,
            activityType: true,
            jobRole: true,
            employeeId: true,
            truckType: true,
            qty: true,
            totalDo: true,
            totalMember: true,
            startAt: true,
            finishAt: true,
            confirmation: true
          }
        }
      }
    })
  ]);

  const items = rows.map((row) => {
    const report = buildReport(row, row.transactions);
    return {
      id: report.id,
      activityDate: report.activityDate,
      notes: report.notes,
      status: report.status,
      summary: report.summary,
      groups: report.groups,
      picking: report.picking,
      stuffing: report.stuffing,
      counts: report.counts,
      transactions: report.transactions,
      manpowerGroupCount: report.groups.length,
      manpowerRowCount: report.groups.reduce(
        (sum, group) => sum + (group.tally ? 1 : 0) + (group.operator ? 1 : 0),
        0
      ),
      pickingRowCount: report.picking.length,
      stuffingRowCount: report.stuffing.length,
      updatedAt: report.updatedAt
    };
  });

  const counts = { ALL: 0, KOSONG: 0, BERJALAN: 0, SELESAI: 0, BATAL: 0 };
  items.forEach((item) => {
    counts.ALL += 1;
    if (item.status in counts) counts[item.status] += 1;
  });

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      counts
    }
  };
}

async function updateDailyJobActivityNotes(id, notes, actor) {
  const existing = await prisma.dailyJobActivity.findUnique({ where: { id } });
  if (!existing) throw createHttpError(404, "Laporan Daily Job Activity tidak ditemukan");

  const normalized = normalizeText(notes, 1000);

  const updated = await prisma.dailyJobActivity.update({
    where: { id },
    data: {
      notes: normalized,
      updatedById: actor?.id || null,
      logs: {
        create: {
          action: "NOTES",
          userId: actor?.id || null,
          note: normalized ? "Catatan laporan diperbarui" : "Catatan laporan dikosongkan"
        }
      }
    }
  });

  return { id: updated.id, notes: updated.notes };
}

module.exports = {
  REPORT_EMPTY,
  REPORT_RUNNING,
  REPORT_DONE,
  REPORT_CANCELLED,
  getDailyJobActivityByDate,
  getDailyJobActivityById,
  listDailyJobActivities,
  updateDailyJobActivityNotes,
  buildReport,
  resolveActivityDate
};

const prisma = require("../utils/prisma");

const STATUS_DRAFT = "DRAFT";
const STATUS_PROGRESS = "PROSES";
const STATUS_FINISHED = "SELESAI";
const STATUS_CANCELLED = "BATAL";

const LOCKED_STATUSES = [STATUS_FINISHED, STATUS_CANCELLED];

const ACTIVITY_RECEIVING = "RECEIVING";
const ACTIVITY_DELIVERY = "DELIVERY";
const ACTIVITY_PICKING = "PICKING";
const ACTIVITY_STUFFING = "STUFFING";

const MANPOWER_ACTIVITIES = [ACTIVITY_RECEIVING, ACTIVITY_DELIVERY];
const SESSION_ACTIVITIES = [ACTIVITY_PICKING, ACTIVITY_STUFFING];
const ALL_ACTIVITIES = [...MANPOWER_ACTIVITIES, ...SESSION_ACTIVITIES];

const TRUCK_TYPES = ["CDD", "CDE", "FUSO", "WB", "FT20", "FT40", "OTHER"];

const EXPORT_ROW_LIMIT = 5000;

/**
 * Peran (jobRole) kini dipilih user dan tidak lagi diturunkan dari jenis pekerjaan.
 * Jenis pekerjaan hanya menentukan bentuk input (manpower vs sesi kerja).
 *
 * Nilai default peran diambil dari posisi karyawan di Master Karyawan, lalu
 * boleh di-override lewat payload.jobRole.
 */
const JOB_ROLES = ["TALLY", "OPERATOR"];

const ROLE_BY_POSITION = {
  TALLYMAN: "TALLY",
  OPR_FORKLIFT: "OPERATOR"
};

/** Posisi yang boleh dipilih untuk Receiving/Delivery. FOREMAN tidak termasuk. */
const FIELD_POSITIONS = Object.keys(ROLE_BY_POSITION);

const TRANSACTION_INCLUDE = {
  employee: { select: { id: true, name: true, nik: true, position: true } },
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
  dailyJobActivity: { select: { id: true, activityDate: true } }
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

function normalizeInteger(value, field) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) throw createHttpError(400, `${field} harus berupa angka`);
  const rounded = Math.trunc(num);
  if (rounded < 0) throw createHttpError(400, `${field} tidak boleh negatif`);
  return rounded;
}

/**
 * Waktu disimpan sebagai wall-clock UTC agar tidak bergeser oleh timezone server.
 * Input "2026-10-25T13:00" -> 2026-10-25T13:00:00.000Z
 */
function parseWallClock(value, field) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw createHttpError(400, `${field} tidak valid`);
    return value;
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!match) throw createHttpError(400, `${field} tidak valid. Gunakan format YYYY-MM-DDTHH:mm`);
  const [, y, m, d, hh, mm] = match;
  const parsed = new Date(
    Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh || 0), Number(mm || 0), 0, 0)
  );
  if (Number.isNaN(parsed.getTime())) throw createHttpError(400, `${field} tidak valid`);
  return parsed;
}

function toUtcDateOnly(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toDateOnlyString(date) {
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function toTimeString(date) {
  if (!date) return null;
  const pad = (num) => String(num).padStart(2, "0");
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function mapTransaction(row) {
  if (!row) return null;
  return {
    ...row,
    transactionDate: toDateOnlyString(row.transactionDate),
    timeStart: toTimeString(row.startAt),
    timeFinish: toTimeString(row.finishAt)
  };
}

async function ensureDailyJobActivity(tx, transactionDate, actorId) {
  const existing = await tx.dailyJobActivity.findUnique({ where: { activityDate: transactionDate } });
  if (existing) return existing;
  return tx.dailyJobActivity.create({
    data: {
      activityDate: transactionDate,
      createdById: actorId || null,
      updatedById: actorId || null
    }
  });
}

async function resolveEmployee(employeeId) {
  const id = normalizeText(employeeId, 60);
  if (!id) throw createHttpError(400, "Karyawan wajib dipilih");
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) throw createHttpError(400, "Karyawan tidak ditemukan di Master Karyawan");
  return employee;
}

function normalizeActivityType(value) {
  const type = normalizeText(value, 20);
  if (!type || !ALL_ACTIVITIES.includes(type.toUpperCase())) {
    throw createHttpError(400, "activityType tidak valid");
  }
  return type.toUpperCase();
}

function normalizeJobRole(value, fallback) {
  const raw = normalizeText(value, 20);
  if (!raw) return fallback;
  const role = raw.toUpperCase();
  if (!JOB_ROLES.includes(role)) {
    throw createHttpError(400, "Peran harus Tallyman atau Operator");
  }
  return role;
}

async function buildManpowerData(payload, actor) {
  const activityType = normalizeActivityType(payload?.activityType);
  const employee = await resolveEmployee(payload?.employeeId);

  if (!FIELD_POSITIONS.includes(employee.position)) {
    throw createHttpError(
      400,
      `Karyawan ${employee.name} berposisi ${employee.position}. Hanya Tallyman dan Operator yang dapat dipilih untuk ${activityType}.`
    );
  }

  const jobRole = normalizeJobRole(payload?.jobRole, ROLE_BY_POSITION[employee.position]);

  const truckType = normalizeText(payload?.truckType, 10);
  if (!truckType || !TRUCK_TYPES.includes(truckType.toUpperCase())) {
    throw createHttpError(400, "Tipe truk wajib dipilih");
  }
  const normalizedTruckType = truckType.toUpperCase();
  const truckTypeOther =
    normalizedTruckType === "OTHER" ? normalizeText(payload?.truckTypeOther, 60) : null;
  if (normalizedTruckType === "OTHER" && !truckTypeOther) {
    throw createHttpError(400, "Keterangan tipe truk wajib diisi untuk OTHER");
  }

  const qty = normalizeInteger(payload?.qty, "Qty") ?? 1;
  if (qty < 1) throw createHttpError(400, "Qty minimal 1");

  return {
    activityType,
    jobRole,
    employeeId: employee.id,
    employeeName: employee.name,
    truckType: normalizedTruckType,
    truckTypeOther,
    qty,
    totalDo: null,
    totalMember: null,
    confirmation: normalizeText(payload?.confirmation, 500)
  };
}

function buildSessionData(payload) {
  const activityType = normalizeActivityType(payload?.activityType);
  const totalDo = normalizeInteger(payload?.totalDo, "Total DO");
  const totalMember = normalizeInteger(payload?.totalMember, "Total member");
  if (totalDo === null && totalMember === null) {
    throw createHttpError(400, "Total DO atau total member wajib diisi");
  }

  return {
    activityType,
    jobRole: null,
    employeeId: null,
    employeeName: activityType,
    truckType: null,
    truckTypeOther: null,
    qty: 1,
    totalDo,
    totalMember,
    confirmation: normalizeText(payload?.confirmation, 500)
  };
}

async function buildTransactionData(payload, actor) {
  const activityType = normalizeActivityType(payload?.activityType);
  const base = MANPOWER_ACTIVITIES.includes(activityType)
    ? await buildManpowerData(payload, actor)
    : buildSessionData(payload);

  const startAt = parseWallClock(payload?.startAt, "Waktu mulai");
  const finishAt = parseWallClock(payload?.finishAt, "Waktu selesai");

  if (finishAt && !startAt) {
    throw createHttpError(400, "Waktu selesai tidak boleh diisi tanpa waktu mulai");
  }
  if (startAt && finishAt && finishAt.getTime() <= startAt.getTime()) {
    throw createHttpError(400, "Waktu selesai harus lebih besar dari waktu mulai");
  }

  const explicitDate = payload?.transactionDate ? parseWallClock(payload.transactionDate, "Tanggal") : null;
  const transactionDate = toUtcDateOnly(startAt || explicitDate || new Date());

  return {
    ...base,
    transactionDate,
    startAt,
    finishAt,
    status: startAt ? (finishAt ? STATUS_FINISHED : STATUS_PROGRESS) : STATUS_DRAFT
  };
}

async function assertNoEmployeeOverlap({ employeeId, startAt, finishAt, excludeId }) {
  if (!employeeId || !startAt) return;

  const candidates = await prisma.jobTransaction.findMany({
    where: {
      employeeId,
      status: STATUS_PROGRESS,
      id: excludeId ? { not: excludeId } : undefined,
      startAt: { not: null }
    },
    select: { id: true, startAt: true, finishAt: true, activityType: true }
  });

  const end = finishAt ? finishAt.getTime() : Number.POSITIVE_INFINITY;
  const conflict = candidates.find((row) => {
    const otherStart = row.startAt.getTime();
    const otherEnd = row.finishAt ? row.finishAt.getTime() : Number.POSITIVE_INFINITY;
    return startAt.getTime() < otherEnd && otherStart < end;
  });

  if (conflict) {
    throw createHttpError(
      422,
      "Karyawan ini masih punya pekerjaan lain yang berjalan pada waktu tersebut",
      {
        code: "EMPLOYEE_OVERLAP",
        conflict: {
          id: conflict.id,
          activityType: conflict.activityType,
          startAt: conflict.startAt,
          finishAt: conflict.finishAt
        }
      }
    );
  }
}

async function createJobTransaction(payload, actor) {
  const data = await buildTransactionData(payload, actor);

  await assertNoEmployeeOverlap({
    employeeId: data.employeeId,
    startAt: data.startAt,
    finishAt: data.finishAt
  });

  const created = await prisma.$transaction(async (tx) => {
    const activity = await ensureDailyJobActivity(tx, data.transactionDate, actor?.id);

    return tx.jobTransaction.create({
      data: {
        ...data,
        dailyJobActivityId: activity.id,
        createdById: actor?.id || null,
        updatedById: actor?.id || null,
        logs: {
          create: {
            action: data.status === STATUS_DRAFT ? "CREATE" : "START",
            toStatus: data.status,
            userId: actor?.id || null,
            note:
              data.status === STATUS_DRAFT
                ? `Transaksi dibuat (${data.activityType})`
                : data.status === STATUS_FINISHED
                  ? `Transaksi dicatat dan langsung selesai (${data.activityType})`
                  : `Transaksi dibuat dan langsung diproses (${data.activityType})`
          }
        }
      },
      include: TRANSACTION_INCLUDE
    });
  });

  return mapTransaction(created);
}

async function updateJobTransaction(id, payload, actor) {
  const existing = await prisma.jobTransaction.findUnique({ where: { id } });
  if (!existing) throw createHttpError(404, "Transaksi pekerjaan tidak ditemukan");

  if (LOCKED_STATUSES.includes(existing.status) && actor?.role !== "ADMIN") {
    throw createHttpError(403, "Transaksi sudah SELESAI atau BATAL. Hanya ADMIN yang dapat mengubah.");
  }

  const data = await buildTransactionData(payload, actor);

  await assertNoEmployeeOverlap({
    employeeId: data.employeeId,
    startAt: data.startAt,
    finishAt: data.finishAt,
    excludeId: id
  });

  const updated = await prisma.$transaction(async (tx) => {
    const activity = await ensureDailyJobActivity(tx, data.transactionDate, actor?.id);

    return tx.jobTransaction.update({
      where: { id },
      data: {
        ...data,
        dailyJobActivityId: activity.id,
        updatedById: actor?.id || null,
        logs: {
          create: {
            action: "UPDATE",
            fromStatus: existing.status,
            toStatus: data.status,
            userId: actor?.id || null,
            note: "Transaksi diperbarui"
          }
        }
      },
      include: TRANSACTION_INCLUDE
    });
  });

  return mapTransaction(updated);
}

async function startJobTransaction(id, payload, actor) {
  const existing = await prisma.jobTransaction.findUnique({ where: { id } });
  if (!existing) throw createHttpError(404, "Transaksi pekerjaan tidak ditemukan");

  if (existing.status === STATUS_CANCELLED) {
    throw createHttpError(400, "Transaksi sudah BATAL dan tidak bisa diproses");
  }
  if (existing.status === STATUS_PROGRESS) {
    const current = await prisma.jobTransaction.findUnique({ where: { id }, include: TRANSACTION_INCLUDE });
    return mapTransaction(current);
  }
  if (existing.status === STATUS_FINISHED) {
    throw createHttpError(400, "Transaksi sudah SELESAI. Gunakan Kembali untuk membuka.");
  }

  const startAt = parseWallClock(payload?.startAt, "Waktu mulai");
  if (!startAt) throw createHttpError(400, "Waktu mulai wajib diisi saat Confirm");

  await assertNoEmployeeOverlap({
    employeeId: existing.employeeId,
    startAt,
    finishAt: null,
    excludeId: id
  });

  const transactionDate = toUtcDateOnly(startAt);

  const updated = await prisma.$transaction(async (tx) => {
    const activity = await ensureDailyJobActivity(tx, transactionDate, actor?.id);

    return tx.jobTransaction.update({
      where: { id },
      data: {
        status: STATUS_PROGRESS,
        startAt,
        transactionDate,
        dailyJobActivityId: activity.id,
        updatedById: actor?.id || null,
        logs: {
          create: {
            action: "START",
            fromStatus: existing.status,
            toStatus: STATUS_PROGRESS,
            userId: actor?.id || null,
            note: "Pekerjaan dikonfirmasi dan mulai diproses"
          }
        }
      },
      include: TRANSACTION_INCLUDE
    });
  });

  return mapTransaction(updated);
}

async function finishJobTransaction(id, payload, actor) {
  const existing = await prisma.jobTransaction.findUnique({ where: { id } });
  if (!existing) throw createHttpError(404, "Transaksi pekerjaan tidak ditemukan");

  if (existing.status === STATUS_CANCELLED) {
    throw createHttpError(400, "Transaksi sudah BATAL dan tidak bisa diselesaikan");
  }
  if (existing.status === STATUS_FINISHED) {
    const current = await prisma.jobTransaction.findUnique({ where: { id }, include: TRANSACTION_INCLUDE });
    return mapTransaction(current);
  }
  if (existing.status !== STATUS_PROGRESS || !existing.startAt) {
    throw createHttpError(400, "Transaksi harus diproses (Confirm) terlebih dahulu", {
      code: "INVALID_TRANSITION",
      currentStatus: existing.status
    });
  }

  const finishAt = parseWallClock(payload?.finishAt, "Waktu selesai");
  if (!finishAt) throw createHttpError(400, "Waktu selesai wajib diisi saat Finish");
  if (finishAt.getTime() <= existing.startAt.getTime()) {
    throw createHttpError(400, "Waktu selesai harus lebih besar dari waktu mulai");
  }

  const confirmation =
    normalizeText(payload?.confirmation, 500) ?? existing.confirmation ?? null;

  const updated = await prisma.jobTransaction.update({
    where: { id },
    data: {
      status: STATUS_FINISHED,
      finishAt,
      confirmation,
      updatedById: actor?.id || null,
      logs: {
        create: {
          action: "FINISH",
          fromStatus: existing.status,
          toStatus: STATUS_FINISHED,
          userId: actor?.id || null,
          note: "Pekerjaan diselesaikan"
        }
      }
    },
    include: TRANSACTION_INCLUDE
  });

  return mapTransaction(updated);
}

async function reopenJobTransaction(id, actor) {
  if (actor?.role !== "ADMIN") {
    throw createHttpError(403, "Hanya ADMIN yang dapat mengembalikan status transaksi");
  }

  const existing = await prisma.jobTransaction.findUnique({ where: { id } });
  if (!existing) throw createHttpError(404, "Transaksi pekerjaan tidak ditemukan");
  if (existing.status === STATUS_CANCELLED) {
    throw createHttpError(400, "Transaksi BATAL tidak bisa dibuka kembali");
  }
  if (existing.status === STATUS_DRAFT) {
    throw createHttpError(400, "Transaksi masih DRAFT");
  }

  const nextStatus = existing.status === STATUS_FINISHED ? STATUS_PROGRESS : STATUS_DRAFT;

  const updated = await prisma.jobTransaction.update({
    where: { id },
    data: {
      status: nextStatus,
      finishAt: null,
      startAt: nextStatus === STATUS_DRAFT ? null : existing.startAt,
      updatedById: actor?.id || null,
      logs: {
        create: {
          action: "REOPEN",
          fromStatus: existing.status,
          toStatus: nextStatus,
          userId: actor?.id || null,
          note: `Status dikembalikan dari ${existing.status} ke ${nextStatus}`
        }
      }
    },
    include: TRANSACTION_INCLUDE
  });

  return mapTransaction(updated);
}

async function cancelJobTransaction(id, reason, actor) {
  if (actor?.role !== "ADMIN") {
    throw createHttpError(403, "Hanya ADMIN yang dapat membatalkan transaksi");
  }

  const existing = await prisma.jobTransaction.findUnique({ where: { id } });
  if (!existing) throw createHttpError(404, "Transaksi pekerjaan tidak ditemukan");
  if (existing.status === STATUS_CANCELLED) {
    throw createHttpError(400, "Transaksi sudah BATAL");
  }

  const cancelReason = normalizeText(reason, 500);
  if (!cancelReason) throw createHttpError(400, "Alasan pembatalan wajib diisi");

  const updated = await prisma.jobTransaction.update({
    where: { id },
    data: {
      status: STATUS_CANCELLED,
      cancelReason,
      updatedById: actor?.id || null,
      logs: {
        create: {
          action: "CANCEL",
          fromStatus: existing.status,
          toStatus: STATUS_CANCELLED,
          userId: actor?.id || null,
          note: `Dibatalkan: ${cancelReason}`
        }
      }
    },
    include: TRANSACTION_INCLUDE
  });

  return mapTransaction(updated);
}

async function deleteJobTransaction(id, actor) {
  const existing = await prisma.jobTransaction.findUnique({ where: { id } });
  if (!existing) throw createHttpError(404, "Transaksi pekerjaan tidak ditemukan");

  if (existing.status === STATUS_FINISHED && actor?.role !== "ADMIN") {
    throw createHttpError(403, "Transaksi SELESAI hanya dapat dihapus oleh ADMIN");
  }

  await prisma.$transaction(async (tx) => {
    await tx.jobTransactionLog.create({
      data: {
        jobTransactionId: id,
        action: "DELETE",
        fromStatus: existing.status,
        userId: actor?.id || null,
        note: `Transaksi ${existing.activityType} dihapus`
      }
    });
    await tx.jobTransaction.delete({ where: { id } });
  });

  return { id };
}

async function getJobTransactionById(id) {
  const row = await prisma.jobTransaction.findUnique({
    where: { id },
    include: {
      ...TRANSACTION_INCLUDE,
      logs: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { user: { select: { id: true, name: true } } }
      }
    }
  });
  if (!row) throw createHttpError(404, "Transaksi pekerjaan tidak ditemukan");
  return mapTransaction(row);
}

function buildTransactionWhere(query) {
  const where = {};

  if (query?.date) {
    where.transactionDate = parseWallClock(query.date, "Tanggal");
  } else if (query?.dateFrom || query?.dateTo) {
    const from = parseWallClock(query.dateFrom || query.dateTo, "Tanggal mulai");
    const to = parseWallClock(query.dateTo || query.dateFrom, "Tanggal akhir");
    if (from.getTime() > to.getTime()) {
      throw createHttpError(400, "Tanggal mulai tidak boleh lebih besar dari tanggal akhir");
    }
    where.transactionDate = { gte: toUtcDateOnly(from), lte: toUtcDateOnly(to) };
  }

  const status = normalizeText(query?.status, 20);
  if (status && status.toUpperCase() !== "ALL") where.status = status.toUpperCase();

  const activityType = normalizeText(query?.activityType, 20);
  if (activityType && activityType.toUpperCase() !== "ALL") {
    where.activityType = activityType.toUpperCase();
  }

  const search = normalizeText(query?.search, 100);
  if (search) {
    where.OR = [
      { employeeName: { contains: search, mode: "insensitive" } },
      { truckTypeOther: { contains: search, mode: "insensitive" } },
      { confirmation: { contains: search, mode: "insensitive" } }
    ];
  }

  return where;
}

/**
 * Sortir dijalankan di server supaya konsisten untuk semua halaman.
 * Kolom yang diizinkan dibatasi daftar putih — nilai dari query tidak
 * pernah langsung dipakai sebagai nama kolom Prisma.
 */
const SORT_FIELDS = {
  time: ["startAt", "createdAt"],
  activity: ["activityType", "startAt"],
  employee: ["employeeName", "startAt"],
  truck: ["truckType", "startAt"],
  status: ["status", "startAt"],
  date: ["transactionDate", "startAt"]
};

function resolveOrderBy(query) {
  const key = normalizeText(query?.sortBy, 20)?.toLowerCase();
  const fields = SORT_FIELDS[key];

  if (!fields) {
    return [
      { startAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" }
    ];
  }

  const dir = String(query?.sortDir || "asc").toLowerCase() === "desc" ? "desc" : "asc";
  const orderBy = fields.map((field) => {
    if (field === "startAt") return { startAt: { sort: dir, nulls: "last" } };
    return { [field]: dir };
  });
  orderBy.push({ id: "asc" });
  return orderBy;
}

async function listJobTransactionsForExport(query) {
  const where = buildTransactionWhere(query);
  const rows = await prisma.jobTransaction.findMany({
    where,
    include: TRANSACTION_INCLUDE,
    orderBy: resolveOrderBy(query),
    take: EXPORT_ROW_LIMIT
  });

  return {
    items: rows.map(mapTransaction),
    truncated: rows.length >= EXPORT_ROW_LIMIT,
    limit: EXPORT_ROW_LIMIT
  };
}

async function listJobTransactions(query) {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query?.limit) || 30));

  const where = buildTransactionWhere(query);

  const rangeWhere = { ...where };
  if (where.status) delete rangeWhere.status;

  const [total, rows, statusGroups] = await Promise.all([
    prisma.jobTransaction.count({ where }),
    prisma.jobTransaction.findMany({
      where,
      include: TRANSACTION_INCLUDE,
      orderBy: resolveOrderBy(query),
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.jobTransaction.groupBy({
      by: ["status"],
      where: rangeWhere,
      _count: { _all: true }
    })
  ]);

  const counts = { ALL: 0, DRAFT: 0, PROSES: 0, SELESAI: 0, BATAL: 0 };
  statusGroups.forEach((group) => {
    const key = String(group.status || "").toUpperCase();
    const value = group._count?._all ?? 0;
    if (key in counts) counts[key] = value;
    counts.ALL += value;
  });

  return {
    items: rows.map(mapTransaction),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      counts
    }
  };
}

module.exports = {
  STATUS_DRAFT,
  STATUS_PROGRESS,
  STATUS_FINISHED,
  STATUS_CANCELLED,
  ACTIVITY_RECEIVING,
  ACTIVITY_DELIVERY,
  ACTIVITY_PICKING,
  ACTIVITY_STUFFING,
  MANPOWER_ACTIVITIES,
  SESSION_ACTIVITIES,
  TRUCK_TYPES,
  createJobTransaction,
  updateJobTransaction,
  startJobTransaction,
  finishJobTransaction,
  reopenJobTransaction,
  cancelJobTransaction,
  deleteJobTransaction,
  getJobTransactionById,
  listJobTransactions,
  listJobTransactionsForExport,
  buildTransactionWhere,
  resolveOrderBy,
  SORT_FIELDS,
  EXPORT_ROW_LIMIT,
  mapTransaction,
  toTimeString,
  toDateOnlyString,
  parseWallClock,
  toUtcDateOnly
};

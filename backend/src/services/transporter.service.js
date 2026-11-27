const prisma = require("../utils/prisma");
const { parsePagination, paginateQuery } = require("../utils/pagination");

const SORTABLE_FIELDS = new Set(["name", "isActive", "createdAt", "updatedAt"]);

function createHttpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

/** Nama transporter: trim + rapatkan spasi. Huruf besar/kecil dibiarkan. */
function normalizeName(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function normalizeSort(query) {
  const rawSortBy = typeof query.sortBy === "string" ? query.sortBy : "";
  const rawSortDir = typeof query.sortDir === "string" ? query.sortDir.toLowerCase() : "";
  const sortBy = SORTABLE_FIELDS.has(rawSortBy) ? rawSortBy : "name";
  const sortDir = rawSortDir === "desc" ? "desc" : "asc";
  return { sortBy, sortDir };
}

async function listTransporters(query) {
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const activeOnly =
    query.activeOnly === "1" || query.activeOnly === "true" || query.activeOnly === true;
  const status = typeof query.status === "string" ? query.status.trim().toLowerCase() : "";
  const { sortBy, sortDir } = normalizeSort(query);

  const where = {};
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }
  if (activeOnly || status === "active") {
    where.isActive = true;
  } else if (status === "inactive") {
    where.isActive = false;
  }

  const pagination = parsePagination(query);
  if (pagination) {
    return paginateQuery(
      prisma.transporter,
      { where, orderBy: [{ [sortBy]: sortDir }, { name: "asc" }] },
      pagination
    );
  }

  // Legacy: `limit` dipakai dropdown untuk mengambil banyak sekaligus tanpa paging.
  const rawLimit = Number(query.limit);
  const take = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 500) : undefined;

  const data = await prisma.transporter.findMany({
    where,
    orderBy: [{ [sortBy]: sortDir }, { name: "asc" }],
    take,
  });
  return { data, meta: null };
}

async function createTransporter(data) {
  const name = normalizeName(data?.name);
  if (!name) throw createHttpError(400, "Nama transporter wajib diisi");

  // Cegah duplikat case-insensitive: "logistik x" dan "Logistik X" adalah
  // transporter yang sama.
  const existing = await prisma.transporter.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    return existing;
  }

  try {
    return await prisma.transporter.create({ data: { name } });
  } catch (err) {
    if (err && err.code === "P2002") {
      throw createHttpError(400, "Nama transporter sudah terdaftar");
    }
    throw err;
  }
}

async function updateTransporter(id, data) {
  if (!id) throw createHttpError(400, "ID transporter tidak valid");
  const patch = {};

  if (data?.name !== undefined) {
    const name = normalizeName(data.name);
    if (!name) throw createHttpError(400, "Nama transporter wajib diisi");
    patch.name = name;
  }
  if (data?.isActive !== undefined) {
    patch.isActive = Boolean(data.isActive);
  }
  if (Object.keys(patch).length === 0) {
    throw createHttpError(400, "Tidak ada perubahan");
  }

  try {
    return await prisma.transporter.update({ where: { id }, data: patch });
  } catch (err) {
    if (err && err.code === "P2002") {
      throw createHttpError(400, "Nama transporter sudah terdaftar");
    }
    if (err && err.code === "P2025") {
      throw createHttpError(404, "Transporter tidak ditemukan");
    }
    throw err;
  }
}

/**
 * Hapus hanya jika belum dipakai. Kalau sudah dipakai, arahkan user untuk
 * menonaktifkan saja, supaya histori antrian dan schedule tetap utuh.
 */
async function deleteTransporter(id) {
  if (!id) throw createHttpError(400, "ID transporter tidak valid");

  const [queueCount, scheduleCount] = await Promise.all([
    prisma.queueEntry.count({ where: { transporterId: id } }),
    prisma.shipmentScheduleItem.count({ where: { transporterId: id } }),
  ]);

  if (queueCount > 0 || scheduleCount > 0) {
    throw createHttpError(
      409,
      `Transporter sudah dipakai (${scheduleCount} jadwal, ${queueCount} antrian). Nonaktifkan saja.`
    );
  }

  try {
    return await prisma.transporter.delete({ where: { id } });
  } catch (err) {
    if (err && err.code === "P2025") {
      throw createHttpError(404, "Transporter tidak ditemukan");
    }
    throw err;
  }
}

module.exports = {
  createHttpError,
  listTransporters,
  createTransporter,
  updateTransporter,
  deleteTransporter,
};

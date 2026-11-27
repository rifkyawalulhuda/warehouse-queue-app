const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

function toPositiveInt(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Pagination hanya aktif kalau client mengirim `page` atau `pageSize`.
 *
 * Tanpa keduanya endpoint tetap mengembalikan seluruh data, supaya dropdown
 * (customer, transporter, gate) dan export lama tidak ikut terpotong.
 * `limit` sengaja tidak dihitung sebagai pageSize karena `limit` sudah dipakai
 * sebagai batas atas legacy pada beberapa endpoint.
 */
function parsePagination(query = {}) {
  const rawPage = toPositiveInt(query.page);
  const rawPageSize = toPositiveInt(query.pageSize);
  if (!rawPage && !rawPageSize) return null;

  const pageSize = Math.min(rawPageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = rawPage || 1;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

function buildPaginationMeta(pagination, total) {
  if (!pagination) return null;
  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize));
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages,
    hasPrev: pagination.page > 1,
    hasNext: pagination.page < totalPages,
  };
}

/**
 * Jalankan findMany dengan atau tanpa pagination.
 * `model` adalah delegate Prisma (mis. prisma.customer).
 */
async function paginateQuery(model, args, pagination) {
  if (!pagination) {
    const data = await model.findMany(args);
    return { data, meta: null };
  }

  const [total, data] = await Promise.all([
    model.count({ where: args.where }),
    model.findMany({
      ...args,
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return { data, meta: buildPaginationMeta(pagination, total) };
}

function normalizeSort(query, sortableFields, fallbackField, fallbackDir = "asc") {
  const rawSortBy = typeof query.sortBy === "string" ? query.sortBy : "";
  const rawSortDir = typeof query.sortDir === "string" ? query.sortDir.toLowerCase() : "";
  const sortBy = sortableFields.has(rawSortBy) ? rawSortBy : fallbackField;
  const sortDir = rawSortDir === "desc" ? "desc" : rawSortDir === "asc" ? "asc" : fallbackDir;
  return { sortBy, sortDir };
}

function normalizeSearch(query) {
  return typeof query.search === "string" ? query.search.trim() : "";
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePagination,
  buildPaginationMeta,
  paginateQuery,
  normalizeSort,
  normalizeSearch,
};

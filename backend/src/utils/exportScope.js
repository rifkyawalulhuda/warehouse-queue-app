const MAX_RANGE_DAYS = 366;

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function startOfDay(year, monthIndex, day) {
  return new Date(year, monthIndex, day, 0, 0, 0, 0);
}

function endOfDay(year, monthIndex, day) {
  return new Date(year, monthIndex, day, 23, 59, 59, 999);
}

function parseDateOnly(value) {
  if (typeof value !== "string" || !value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function daysBetweenInclusive(from, to) {
  const startUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const endUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((endUtc - startUtc) / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * Menormalkan parameter scope export menjadi rentang tanggal yang pasti.
 * Mode yang didukung: "year" (default), "month", "range".
 *
 * Tahun selalu berarti 1 Januari 00:00 sampai 31 Desember 23:59 waktu lokal.
 * Rentang manual dibatasi MAX_RANGE_DAYS hari supaya export tidak pernah
 * menarik seluruh tabel sekaligus.
 */
function resolveExportScope(query = {}, now = new Date()) {
  const rawMode = typeof query.mode === "string" ? query.mode.toLowerCase() : "";
  const currentYear = now.getFullYear();

  const hasRange = Boolean(query.dateFrom || query.dateTo);
  const mode = rawMode === "range" || (!rawMode && hasRange) ? "range" : rawMode === "month" ? "month" : "year";

  if (mode === "month") {
    const year = Number(query.year);
    const month = Number(query.month);
    const effectiveYear = Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : currentYear;
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw createHttpError(400, "Bulan export wajib dipilih (1-12)");
    }
    const from = startOfDay(effectiveYear, month - 1, 1);
    const to = endOfDay(effectiveYear, month - 1, new Date(effectiveYear, month, 0).getDate());
    return {
      mode,
      year: effectiveYear,
      month,
      dateFrom: `${effectiveYear}-${pad2(month)}-01`,
      dateTo: `${effectiveYear}-${pad2(month)}-${pad2(to.getDate())}`,
      from,
      to,
      days: daysBetweenInclusive(from, to),
      label: `Bulan ${pad2(month)}/${effectiveYear}`,
      fileToken: `${effectiveYear}-${pad2(month)}`,
    };
  }

  if (mode === "range") {
    const fromDate = parseDateOnly(query.dateFrom);
    const toDate = parseDateOnly(query.dateTo || query.dateFrom);
    if (!fromDate || !toDate) {
      throw createHttpError(400, "Rentang tanggal export tidak valid");
    }
    if (fromDate.getTime() > toDate.getTime()) {
      throw createHttpError(400, "Tanggal mulai tidak boleh lebih besar dari tanggal akhir");
    }
    const days = daysBetweenInclusive(fromDate, toDate);
    if (days > MAX_RANGE_DAYS) {
      throw createHttpError(400, `Rentang export maksimal ${MAX_RANGE_DAYS} hari`);
    }
    const from = startOfDay(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    const to = endOfDay(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
    return {
      mode,
      year: null,
      month: null,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo || query.dateFrom,
      from,
      to,
      days,
      label: `${query.dateFrom} sampai ${query.dateTo || query.dateFrom}`,
      fileToken: `${query.dateFrom}_sampai_${query.dateTo || query.dateFrom}`,
    };
  }

  const year = Number(query.year);
  const effectiveYear = Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : currentYear;
  const from = startOfDay(effectiveYear, 0, 1);
  const to = endOfDay(effectiveYear, 11, 31);
  return {
    mode: "year",
    year: effectiveYear,
    month: null,
    dateFrom: `${effectiveYear}-01-01`,
    dateTo: `${effectiveYear}-12-31`,
    from,
    to,
    days: daysBetweenInclusive(from, to),
    label: `Tahun ${effectiveYear}`,
    fileToken: `${effectiveYear}`,
  };
}

module.exports = {
  MAX_RANGE_DAYS,
  resolveExportScope,
  parseDateOnly,
};

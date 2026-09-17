export type DateInput = string | number | Date | null | undefined

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Jam saja, format 24 jam dengan titik dua. Contoh: "15:14" */
export function formatTimeId(value: DateInput, fallback = '-'): string {
  const date = toDate(value)
  if (!date) return fallback
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Tanggal saja. Contoh: "17/09/2026" */
export function formatDateId(value: DateInput, fallback = '-'): string {
  const date = toDate(value)
  if (!date) return fallback
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

/** Tanggal + jam 24 jam tanpa detik. Contoh: "17/09/2026 15:14" */
export function formatDateTimeId(value: DateInput, fallback = '-'): string {
  const date = toDate(value)
  if (!date) return fallback
  return `${formatDateId(date)} ${formatTimeId(date)}`
}

/** Nama hari dalam bahasa Indonesia. Contoh: "Kamis" */
export function formatWeekdayId(value: DateInput, fallback = '-'): string {
  const date = toDate(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(date)
}

/** Nama bulan + tahun dalam bahasa Indonesia. Contoh: "September 2026" */
export function formatMonthYearId(value: DateInput, fallback = '-'): string {
  const date = toDate(value)
  if (!date) return fallback
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date)
}

import type {
  JobActivityType,
  JobTransaction,
  JobTransactionStatus,
  JobTruckType
} from '@/services/jobTransactionApi'

export const ACTIVITY_OPTIONS: Array<{ value: JobActivityType; label: string; group: string }> = [
  { value: 'RECEIVING', label: 'Receiving', group: 'Man Power' },
  { value: 'DELIVERY', label: 'Delivery', group: 'Man Power' },
  { value: 'PICKING', label: 'Picking', group: 'Sesi Kerja' },
  { value: 'STUFFING', label: 'Stuffing', group: 'Sesi Kerja' }
]

export const TRUCK_OPTIONS: Array<{ value: JobTruckType; label: string }> = [
  { value: 'CDD', label: 'CDD' },
  { value: 'CDE', label: 'CDE' },
  { value: 'WB', label: 'Wingbox' },
  { value: 'FUSO', label: 'Fuso' },
  { value: 'FT20', label: '20 ft' },
  { value: 'FT40', label: '40 ft' },
  { value: 'OTHER', label: 'Lainnya' }
]

export const MANPOWER_ACTIVITIES: JobActivityType[] = ['RECEIVING', 'DELIVERY']

export const isManpower = (type: JobActivityType) => MANPOWER_ACTIVITIES.includes(type)

export const roleFor = (type: JobActivityType) => (type === 'RECEIVING' ? 'TALLY' : 'OPERATOR')

export const positionFor = (type: JobActivityType) =>
  type === 'RECEIVING' ? 'TALLYMAN' : 'OPR_FORKLIFT'

export const activityLabel = (type: JobActivityType) =>
  ACTIVITY_OPTIONS.find((option) => option.value === type)?.label || type

export const truckLabel = (row: Pick<JobTransaction, 'truckType' | 'truckTypeOther'>) => {
  if (!row.truckType) return '-'
  if (row.truckType === 'OTHER') return row.truckTypeOther ? `Lainnya · ${row.truckTypeOther}` : 'Lainnya'
  return TRUCK_OPTIONS.find((option) => option.value === row.truckType)?.label || row.truckType
}

const pad = (value: number) => String(value).padStart(2, '0')

/** ISO (wall-clock UTC) -> nilai untuk <input type="datetime-local"> */
export const toDateTimeInput = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}`
}

/** ISO (wall-clock UTC) -> "DD/MM/YYYY HH:mm" */
export const formatWallClock = (value?: string | null, fallback = '-') => {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}`
}

export const formatTimeOnly = (value?: string | null, fallback = '-') => {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

/** "YYYY-MM-DDTHH:mm" (wall clock) -> epoch ms pada basis UTC */
export const wallClockToMs = (value?: string | null) => {
  if (!value) return NaN
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (!match) return NaN
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]))
}

/** Wall clock saat ini pada basis UTC, sebanding dengan nilai tersimpan */
export const wallClockNowMs = () => {
  const now = new Date()
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes())
}

export const durationLabel = (startAt?: string | null, finishAt?: string | null) => {
  if (!startAt) return ''
  const start = wallClockToMs(startAt)
  const end = finishAt ? wallClockToMs(finishAt) : wallClockNowMs()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return ''
  const minutes = Math.round((end - start) / 60000)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}j` : `${hours}j ${rest}m`
}

export const todayInput = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Tanggal hari ini digeser sejumlah hari (negatif = mundur). */
export const dateInputOffset = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const monthStartInput = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
}

/** Hari terakhir bulan berjalan — dipakai agar rencana/draft bertanggal maju tetap terlihat. */
export const monthEndInput = () => {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`
}

/** "2026-10-26" -> "26 Okt" */
export const shortDateLabel = (value?: string | null) => {
  if (!value) return ''
  const parts = value.split('-')
  if (parts.length !== 3) return value
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

export const TRANSACTION_STATUS_LABEL: Record<JobTransactionStatus, string> = {
  DRAFT: 'Draft',
  PROSES: 'Proses',
  SELESAI: 'Selesai',
  BATAL: 'Batal'
}

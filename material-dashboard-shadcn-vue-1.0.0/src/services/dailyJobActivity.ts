import api from '@/services/api'
import type { JobActivityType, JobTransactionStatus } from '@/services/jobTransactionApi'

export type DailyJobReportStatus = 'KOSONG' | 'BERJALAN' | 'SELESAI' | 'BATAL'

export type DailyJobSession = {
  key: string
  employeeId: string | null
  employeeName: string
  jobRole: string
  activityType: string
  qtyCdd: number
  qtyWb: number
  qtyFuso: number
  qty20ft: number
  qty40ft: number
  qtyTotal: number
  startAt: string | null
  finishAt: string | null
  timeStart: string | null
  timeFinish: string | null
  isFinish: boolean
  isPending: boolean
  confirmation: string | null
  transactionIds: string[]
}

export type DailyJobGroup = {
  groupIndex: number
  tally: DailyJobSession | null
  operator: DailyJobSession | null
}

export type DailyJobSessionRow = {
  id: string
  totalDo: number | null
  totalMember: number | null
  total: string | null
  startAt: string | null
  finishAt: string | null
  timeWork: string | null
  isPending: boolean
  isFinish: boolean
  confirmation: string | null
  status: JobTransactionStatus
}

export type DailyJobReport = {
  id: string | null
  activityDate: string
  notes: string | null
  status: DailyJobReportStatus
  summary: {
    recCddCde: string | null
    recWingbox: string | null
    recContainer: string | null
    delCddCde: string | null
    delWingboxOther: string | null
    delContainer: string | null
    totals: {
      receiving: { cddCde: number; wingbox: number; container: number; total: number }
      delivery: { cddCde: number; wingbox: number; container: number; total: number }
    }
  }
  groups: DailyJobGroup[]
  picking: DailyJobSessionRow[]
  stuffing: DailyJobSessionRow[]
  transactions: number
  counts: { ALL: number; DRAFT: number; PROSES: number; SELESAI: number; BATAL: number }
  manpowerGroupCount?: number
  manpowerRowCount?: number
  pickingRowCount?: number
  stuffingRowCount?: number
  updatedAt: string | null
  createdAt: string | null
}

export type DailyJobReportCounts = {
  ALL: number
  KOSONG: number
  BERJALAN: number
  SELESAI: number
  BATAL: number
}

export const listDailyJobActivities = (params?: {
  date?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}) => api.get('/daily-job-activities', { params })

export const getDailyJobActivityByDate = (date: string) =>
  api.get('/daily-job-activities', { params: { date } })

export const getDailyJobActivityById = (id: string) =>
  api.get(`/daily-job-activities/${id}`)

export const updateDailyJobActivityNotes = (id: string, notes: string) =>
  api.patch(`/daily-job-activities/${id}/notes`, { notes })

export const exportDailyJobActivityExcel = (id: string) =>
  api.get(`/daily-job-activities/${id}/export-excel`, { responseType: 'blob' })

export type { JobActivityType }

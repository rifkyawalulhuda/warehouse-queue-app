import api from '@/services/api'
import type { TableMeta } from '@/types/table'

export type ScheduleAvailableItem = {
  id: string
  scheduleId: string
  scheduleDate: string
  storeType: 'STORE_IN' | 'STORE_OUT'
  category: 'RECEIVING' | 'DELIVERY'
  customerId: string | null
  customerName: string | null
  plateNumber: string | null
  truckType: string
  truckTypeOther: string | null
  transporterId: string | null
  transporterName: string | null
  driverName: string | null
  containerNumbers: string[]
  plannedStart: string | null
  plannedFinish: string | null
  status: 'PLANNED' | 'LINKED' | 'NO_SHOW' | 'NO_SHOW_CLOSED'
}

export type Transporter = {
  id: string
  name: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type AppSetting = {
  key: string
  value: string
  label: string
  min: number | null
  max: number | null
  editable: boolean
  updatedAt: string
  updatedBy: { id: string; name: string; username: string } | null
}

export const getAvailableScheduleItems = (params?: {
  category?: 'RECEIVING' | 'DELIVERY'
  search?: string
  limit?: number
}) => api.get<{ ok: boolean; data: ScheduleAvailableItem[] }>('/schedules/available-items', { params })

export const closeNoShowItem = (itemId: string) =>
  api.patch(`/schedules/items/${itemId}/close-no-show`)

export const getTransporters = (params?: {
  search?: string
  activeOnly?: boolean
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  limit?: number
  page?: number
  pageSize?: number
}) =>
  api.get<{ ok: boolean; data: Transporter[]; meta?: TableMeta }>('/transporters', { params })

export const createTransporter = (name: string) =>
  api.post<{ ok: boolean; data: Transporter }>('/transporters', { name })

export const importTransporterExcel = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post<{ ok: boolean; data: { created: number; skipped: number; total: number } }>(
    '/transporters/import',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
}

export const downloadTransporterTemplate = () =>
  api.get('/transporters/template', { responseType: 'blob' })

export type ScheduleImportResult = {
  created: number
  skipped: number
  total: number
  scheduleCount: number
  createdSchedules: number
  newSchedules: { date: string; customerName: string; category: string; itemCount: number }[]
}

export type ScheduleImportLog = {
  id: string
  fileName: string | null
  rowCount: number
  createdCount: number
  skippedCount: number
  scheduleCount: number
  note: string | null
  createdAt: string
  actorUser: { id: string; name: string; username: string } | null
}

export const importScheduleExcel = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post<{ ok: boolean; data: ScheduleImportResult }>('/schedules/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const downloadScheduleImportTemplate = () =>
  api.get('/schedules/import-template', { responseType: 'blob' })

export const getScheduleImportLogs = (limit = 10) =>
  api.get<{ ok: boolean; data: ScheduleImportLog[] }>('/schedules/import-logs', { params: { limit } })

export const getSettings = () => api.get<{ ok: boolean; data: AppSetting[] }>('/settings')

export const updateSettings = (payload: Record<string, number>) =>
  api.patch('/settings', payload)

export type ReportPlanRow = {
  scheduleItemId: string
  scheduleId: string
  scheduleDate: string
  storeType: 'STORE_IN' | 'STORE_OUT'
  category: 'RECEIVING' | 'DELIVERY'
  customerId: string | null
  customerName: string | null
  plateNumber: string | null
  truckType: string
  truckTypeOther: string | null
  transporterId: string | null
  transporterName: string | null
  driverName: string | null
  containerNumbers: string[]
  plannedStart: string | null
  plannedFinish: string | null
  scheduleStatus: string
  queueEntryId: string | null
  queueStatus: string | null
  registerTime: string | null
  finishTime: string | null
  actualTruckNumber: string | null
  actualCustomerId: string | null
  actualCustomerName: string | null
  actualTransporterName: string | null
  varianceArrivalMinutes: number | null
  varianceFinishMinutes: number | null
  isOnTimeArrival: boolean | null
  isOnTimeFinish: boolean | null
  autoCompleted: boolean
}

export type ReportActualRow = {
  queueEntryId: string
  scheduleItemId: string | null
  isWalkIn: boolean
  registerTime: string
  inWhTime: string | null
  startTime: string | null
  finishTime: string | null
  status: string
  category: 'RECEIVING' | 'DELIVERY'
  truckNumber: string
  truckType: string | null
  transporterName: string | null
  driverName: string
  containerNumbers: string[]
  customerId: string | null
  customerName: string | null
  plannedCustomerName: string | null
  plannedStart: string | null
  plannedFinish: string | null
  varianceArrivalMinutes: number | null
  varianceFinishMinutes: number | null
  isOnTimeArrival: boolean | null
  isOnTimeFinish: boolean | null
  autoCompleted: boolean
}

export type ReportSummary = {
  totalPlan: number
  totalActual: number
  totalNoShow: number
  totalNoShowClosed: number
  arrival: {
    measured: number
    onTime: number
    late: number
    onTimeRate: number | null
    avgVarianceMinutes: number | null
    maxLateMinutes: number | null
  }
  finish: {
    measured: number
    onTime: number
    late: number
    onTimeRate: number | null
    avgVarianceMinutes: number | null
  }
  tolerance: {
    arrivalMinutes: number
    finishMinutes: number
  }
}

export type ReportResponse = {
  range: { dateFrom: string; dateTo: string }
  filters: {
    customerId: string | null
    transporterId: string | null
    category: string | null
    groupBy: 'date' | 'customer' | 'transporter'
  }
  summary: ReportSummary
  groups: { key: string; label: string; summary: ReportSummary }[]
  planRows: ReportPlanRow[]
  actualRows: ReportActualRow[]
}

export const getScheduleReport = (params: {
  dateFrom: string
  dateTo: string
  customerId?: string
  transporterId?: string
  category?: 'RECEIVING' | 'DELIVERY'
  groupBy?: 'date' | 'customer' | 'transporter'
}) => api.get<{ ok: boolean; data: ReportResponse }>('/reports/schedule-vs-actual', { params })

export const exportScheduleReport = (params: {
  dateFrom: string
  dateTo: string
  customerId?: string
  transporterId?: string
  category?: 'RECEIVING' | 'DELIVERY'
  groupBy?: 'date' | 'customer' | 'transporter'
}) => api.get('/reports/schedule-vs-actual/export', { params, responseType: 'blob' })

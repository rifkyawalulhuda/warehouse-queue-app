import api from '@/services/api'

export type JobTransactionStatus = 'DRAFT' | 'PROSES' | 'SELESAI' | 'BATAL'
export type JobActivityType = 'RECEIVING' | 'DELIVERY' | 'PICKING' | 'STUFFING'
export type JobRole = 'TALLY' | 'OPERATOR'
export type JobTruckType = 'CDD' | 'CDE' | 'FUSO' | 'WB' | 'FT20' | 'FT40' | 'OTHER'

export type JobTransaction = {
  id: string
  dailyJobActivityId: string
  transactionDate: string
  activityType: JobActivityType
  jobRole: JobRole | null
  employeeId: string | null
  employeeName: string
  employee?: { id: string; name: string; nik: string; position: string } | null
  truckType: JobTruckType | null
  truckTypeOther: string | null
  qty: number
  totalDo: number | null
  totalMember: number | null
  startAt: string | null
  finishAt: string | null
  timeStart: string | null
  timeFinish: string | null
  status: JobTransactionStatus
  confirmation: string | null
  cancelReason: string | null
  createdBy?: { id: string; name: string } | null
  updatedBy?: { id: string; name: string } | null
  logs?: Array<{
    id: string
    action: string
    note: string | null
    fromStatus: string | null
    toStatus: string | null
    createdAt: string
    user?: { id: string; name: string } | null
  }>
  createdAt: string
  updatedAt: string
}

export type JobTransactionStatusCounts = {
  ALL: number
  DRAFT: number
  PROSES: number
  SELESAI: number
  BATAL: number
}

export type JobTransactionPayload = {
  activityType: JobActivityType
  employeeId?: string | null
  truckType?: JobTruckType | null
  truckTypeOther?: string | null
  qty?: number | null
  totalDo?: number | null
  totalMember?: number | null
  startAt?: string | null
  finishAt?: string | null
  confirmation?: string | null
  transactionDate?: string | null
}

export const listJobTransactions = (params?: {
  date?: string
  dateFrom?: string
  dateTo?: string
  status?: 'ALL' | JobTransactionStatus
  activityType?: 'ALL' | JobActivityType
  search?: string
  page?: number
  limit?: number
}) => api.get('/job-transactions', { params })

export const getJobTransactionById = (id: string) => api.get(`/job-transactions/${id}`)

export const createJobTransaction = (payload: JobTransactionPayload) =>
  api.post('/job-transactions', payload)

export const updateJobTransaction = (id: string, payload: JobTransactionPayload) =>
  api.put(`/job-transactions/${id}`, payload)

export const startJobTransaction = (id: string, startAt: string) =>
  api.patch(`/job-transactions/${id}/start`, { startAt })

export const finishJobTransaction = (
  id: string,
  payload: { finishAt: string; confirmation?: string | null }
) => api.patch(`/job-transactions/${id}/finish`, payload)

export const reopenJobTransaction = (id: string) =>
  api.patch(`/job-transactions/${id}/reopen`)

export const cancelJobTransaction = (id: string, reason: string) =>
  api.patch(`/job-transactions/${id}/cancel`, { reason })

export const deleteJobTransaction = (id: string) => api.delete(`/job-transactions/${id}`)

export type JobTransactionExportParams = {
  date?: string
  dateFrom?: string
  dateTo?: string
  status?: 'ALL' | JobTransactionStatus
  activityType?: 'ALL' | JobActivityType
  search?: string
}

export const exportJobTransactions = (params?: JobTransactionExportParams) =>
  api.get('/job-transactions/export', { params, responseType: 'blob' })

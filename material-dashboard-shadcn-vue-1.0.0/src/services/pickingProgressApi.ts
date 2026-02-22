import api from '@/services/api'

export type PickingStatus = 'MENUNGGU' | 'ON_PROCESS' | 'SELESAI' | 'BATAL'

export type PickingLog = {
  id: string
  action: 'CREATE' | 'START' | 'UPDATE_PICKED_QTY' | 'FINISH' | 'CANCEL'
  note?: string | null
  fromStatus?: PickingStatus | null
  toStatus?: PickingStatus | null
  userId?: string | null
  user?: { id: string; name: string; username: string; role: string } | null
  createdAt: string
}

export type PickingProgressEntry = {
  id: string
  date: string
  customerId: string
  customer?: { id: string; name: string } | null
  doNumber?: string | null
  destination?: string | null
  volumeCbm?: number | null
  plTimeRelease?: string | null
  noContainer: string
  noDock: string
  pickingQty: number
  pickedQty: number
  remainQty?: number
  pickingProgressPercent?: number
  slaPerBarcodeMinutes: number
  slaTotalMinutes: number
  startTime?: string | null
  finishTime?: string | null
  deadlineTime?: string | null
  timeRemainingSeconds?: number | null
  isOverSla: boolean
  isNearSla: boolean
  status: PickingStatus
  createdById?: string | null
  createdBy?: { id: string; name: string; username: string; role: string } | null
  updatedById?: string | null
  updatedBy?: { id: string; name: string; username: string; role: string } | null
  pickerEmployeeId?: string | null
  pickerEmployee?: { id: string; nik: string; name: string; position: string } | null
  logs?: PickingLog[]
  createdAt: string
  updatedAt: string
}

export const createPickingProgress = (payload: {
  date?: string
  customerId: string
  doNumber: string
  destination: string
  volumeCbm: number
  plTimeRelease?: string
  pickingQty: number
}) => {
  return api.post('/picking-progress', payload)
}

export const listPickingProgress = (params: {
  date?: string
  status?: 'ALL' | PickingStatus
  search?: string
  page?: number
  limit?: number
  sort?: 'createdAt' | 'startTime' | 'finishTime'
  sortDir?: 'asc' | 'desc'
}) => {
  return api.get('/picking-progress', { params })
}

export const getPickingProgressById = (id: string) => {
  return api.get(`/picking-progress/${id}`)
}

export const startPickingProgress = (id: string, pickerEmployeeId: string) => {
  return api.patch(`/picking-progress/${id}/start`, { pickerEmployeeId })
}

export const updatePickingPickedQty = (id: string, delta: number) => {
  return api.patch(`/picking-progress/${id}/picked-qty`, { delta })
}

export const finishPickingProgress = (id: string) => {
  return api.patch(`/picking-progress/${id}/finish`)
}

export const cancelPickingProgress = (id: string, reason: string) => {
  return api.patch(`/picking-progress/${id}/cancel`, { reason })
}

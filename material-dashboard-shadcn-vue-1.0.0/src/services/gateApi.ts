import api from '@/services/api'

export type Gate = {
  id: string
  gateNo: string
  area: string
  warehouse: 'WH1' | 'WH2' | 'DG'
  createdAt: string
}

export type GatePayload = {
  gateNo: string
  area: string
  warehouse: Gate['warehouse']
}

export const listGates = (params?: {
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}) => {
  return api.get('/gates', { params })
}

export const createGate = (payload: GatePayload) => {
  return api.post('/gates', payload)
}

export const updateGate = (id: string, payload: GatePayload) => {
  return api.patch(`/gates/${id}`, payload)
}

export const deleteGate = (id: string) => {
  return api.delete(`/gates/${id}`)
}

export const downloadGateTemplate = () => {
  return api.get('/gates/template', { responseType: 'blob' })
}

export const importGateExcel = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/gates/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

export const exportGateExcel = () => {
  return api.get('/gates/export', { responseType: 'blob' })
}

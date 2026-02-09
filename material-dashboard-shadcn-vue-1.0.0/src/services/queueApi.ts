import api from '@/services/api'

export type MasterGate = {
  id: string
  gateNo: string
  area: string
  warehouse: 'WH1' | 'WH2' | 'DG'
}

export const getMasterGates = (params?: { warehouse?: MasterGate['warehouse'] }) => {
  return api.get('/master-gates', { params })
}

export const setInWh = (id: string, gateId: string) => {
  return api.patch(`/queue/${id}/set-in-wh`, { gateId })
}

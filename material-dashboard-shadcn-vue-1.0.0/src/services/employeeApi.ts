import api from '@/services/api'

export type EmployeePosition = 'FOREMAN' | 'TALLYMAN' | 'OPR_FORKLIFT'

export type Employee = {
  id: string
  nik: string
  name: string
  position: EmployeePosition
  createdAt: string
  updatedAt: string
}

export type EmployeePayload = {
  nik: string
  name: string
  position: EmployeePosition
}

export const listEmployees = () => {
  return api.get('/employees')
}

export const createEmployee = (payload: EmployeePayload) => {
  return api.post('/employees', payload)
}

export const updateEmployee = (id: string, payload: EmployeePayload) => {
  return api.patch(`/employees/${id}`, payload)
}

export const deleteEmployee = (id: string) => {
  return api.delete(`/employees/${id}`)
}

export const importEmployeeExcel = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/employees/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

export const downloadEmployeeTemplate = () => {
  return api.get('/employees/template', { responseType: 'blob' })
}

export const exportEmployeeExcel = () => {
  return api.get('/employees/export', { responseType: 'blob' })
}

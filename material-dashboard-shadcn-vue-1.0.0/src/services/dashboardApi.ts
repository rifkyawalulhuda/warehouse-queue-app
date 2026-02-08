import api from '@/services/api'

export const getDashboardSummary = (date: string) => api.get(`/dashboard/summary`, { params: { date } })

export const getDashboardHourly = (date: string) => api.get(`/dashboard/hourly`, { params: { date } })

export const getDashboardStatus = (date: string) => api.get(`/dashboard/status`, { params: { date } })

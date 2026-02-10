import api from '@/services/api'

export const getDashboardSummary = (date: string) => api.get(`/dashboard/summary`, { params: { date } })

export const getDashboardScheduleSummary = (date: string) =>
  api.get(`/dashboard/schedule-summary`, { params: { date } })

export const getDashboardProgressSummary = (date: string) =>
  api.get(`/dashboard/progress-summary`, { params: { date } })

export const getDashboardHourly = (date: string) => api.get(`/dashboard/hourly`, { params: { date } })

export const getDashboardStatus = (date: string) => api.get(`/dashboard/status`, { params: { date } })

export const getTopCustomers = (date: string) => api.get(`/dashboard/top-customers`, { params: { date } })

export const getOverSla = (date: string) => api.get(`/dashboard/over-sla`, { params: { date } })

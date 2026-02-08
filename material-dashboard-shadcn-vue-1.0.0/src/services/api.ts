import axios from 'axios'
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '@/constants/auth'

const api = axios.create({
  baseURL: '/api'
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      localStorage.removeItem(AUTH_USER_KEY)
      const baseUrl = import.meta.env.BASE_URL || '/'
      if (!window.location.pathname.endsWith('/login')) {
        window.location.assign(`${baseUrl}login`)
      }
    }
    return Promise.reject(error)
  }
)

export default api

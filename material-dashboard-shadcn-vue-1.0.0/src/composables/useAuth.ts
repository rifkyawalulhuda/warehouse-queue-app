import { computed, ref } from 'vue'
import api from '@/services/api'
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '@/constants/auth'

type AuthUser = {
  id: string
  name: string
  username: string
  role: 'ADMIN' | 'WAREHOUSE'
}

const token = ref<string | null>(null)
const user = ref<AuthUser | null>(null)
const initialized = ref(false)

const setAuth = (newToken: string, newUser: AuthUser) => {
  token.value = newToken
  user.value = newUser
  localStorage.setItem(AUTH_TOKEN_KEY, newToken)
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser))
}

const clearAuth = () => {
  token.value = null
  user.value = null
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
}

const initFromStorage = () => {
  if (initialized.value) return
  const storedToken = localStorage.getItem(AUTH_TOKEN_KEY)
  const storedUser = localStorage.getItem(AUTH_USER_KEY)
  if (storedToken && storedUser) {
    try {
      token.value = storedToken
      user.value = JSON.parse(storedUser) as AuthUser
    } catch {
      clearAuth()
    }
  }
  initialized.value = true
}

const login = async (username: string, password: string) => {
  const response = await api.post('/auth/login', { username, password })
  const payload = response.data?.data
  if (!payload?.token || !payload?.user) {
    throw new Error('Login gagal')
  }
  setAuth(payload.token, payload.user)
  return payload.user as AuthUser
}

const logout = async () => {
  try {
    await api.post('/auth/logout')
  } catch {
    // ignore
  } finally {
    clearAuth()
  }
}

const fetchMe = async () => {
  const response = await api.get('/auth/me')
  const payload = response.data?.data
  if (payload) {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY)
    if (storedToken) {
      setAuth(storedToken, payload as AuthUser)
    }
  }
  return payload as AuthUser
}

const isAuthenticated = computed(() => Boolean(token.value))

export const useAuth = () => ({
  token,
  user,
  initialized,
  isAuthenticated,
  initFromStorage,
  login,
  logout,
  fetchMe,
})

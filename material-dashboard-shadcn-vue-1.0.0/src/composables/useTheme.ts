import { computed, ref } from 'vue'

type ThemeMode = 'light' | 'dark'

const THEME_STORAGE_KEY = 'warehouse-theme'
const theme = ref<ThemeMode>('light')
const initialized = ref(false)

const getPreferredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const applyTheme = (value: ThemeMode) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', value === 'dark')
  root.style.colorScheme = value
}

const setTheme = (value: ThemeMode) => {
  theme.value = value
  applyTheme(value)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, value)
  }
}

const toggleTheme = () => {
  setTheme(theme.value === 'dark' ? 'light' : 'dark')
}

const initTheme = () => {
  if (initialized.value) return
  initialized.value = true

  if (typeof window === 'undefined') {
    applyTheme(theme.value)
    return
  }

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
  const resolvedTheme: ThemeMode = saved === 'dark' || saved === 'light' ? saved : getPreferredTheme()
  theme.value = resolvedTheme
  applyTheme(resolvedTheme)
}

const isDark = computed(() => theme.value === 'dark')

export const useTheme = () => ({
  theme,
  isDark,
  initTheme,
  setTheme,
  toggleTheme,
})

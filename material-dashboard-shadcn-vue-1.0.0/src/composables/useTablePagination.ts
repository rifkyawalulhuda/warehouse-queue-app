import { ref, watch } from 'vue'

const STORAGE_PREFIX = 'table-page-size:'

/**
 * State pagination tabel: halaman, ukuran halaman (diingat per tabel),
 * dan total baris dari metadata backend.
 */
export function useTablePagination(options: { key: string; defaultPageSize?: number }) {
  const defaultPageSize = options.defaultPageSize ?? 10
  const stored =
    typeof window !== 'undefined'
      ? Number(window.localStorage.getItem(STORAGE_PREFIX + options.key))
      : NaN

  const page = ref(1)
  const pageSize = ref(
    Number.isFinite(stored) && stored > 0 ? stored : defaultPageSize
  )
  const total = ref(0)
  const totalPages = ref(1)

  watch(pageSize, (value) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_PREFIX + options.key, String(value))
  })

  const applyMeta = (meta: { page?: number; pageSize?: number; total?: number; totalPages?: number } | null | undefined) => {
    if (!meta) return
    total.value = meta.total ?? 0
    totalPages.value = Math.max(1, meta.totalPages ?? 1)
    if (typeof meta.page === 'number') page.value = meta.page
  }

  /** Reset ke halaman 1 (dipakai saat pencarian/filter berubah). */
  const resetPage = () => {
    page.value = 1
  }

  const setPageSize = (value: number) => {
    pageSize.value = value
    page.value = 1
  }

  return { page, pageSize, total, totalPages, applyMeta, resetPage, setPageSize }
}

/** Debounce sederhana untuk input pencarian. */
export function useDebouncedCallback(callback: () => void, delay = 300) {
  let timer: number | undefined
  const run = () => {
    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(callback, delay)
  }
  const cancel = () => {
    if (timer) window.clearTimeout(timer)
  }
  return { run, cancel }
}

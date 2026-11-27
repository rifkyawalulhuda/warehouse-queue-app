import { computed, reactive, ref } from 'vue'
import api from '@/services/api'

export type ExportJobStatus = 'MENUNGGU' | 'PROSES' | 'SELESAI' | 'GAGAL'

export type ExportJob = {
  id: string
  type: string
  status: ExportJobStatus
  scopeLabel: string
  rowCount: number
  fileName: string | null
  fileSize: number | null
  error: string | null
  createdAt: string
  finishedAt: string | null
  expiresAt: string | null
  downloadable: boolean
}

export type ExportToast = {
  id: string
  tone: 'success' | 'error' | 'info'
  title: string
  message: string
  job?: ExportJob
}

const jobs = reactive<Record<string, ExportJob>>({})
const toasts = ref<ExportToast[]>([])
const downloading = reactive<Record<string, boolean>>({})

const POLL_INTERVAL_MS = 3000
let pollTimer: number | undefined

const isPending = (status: ExportJobStatus) => status === 'MENUNGGU' || status === 'PROSES'

const pendingCount = computed(
  () => Object.values(jobs).filter((job) => isPending(job.status)).length
)

function pushToast(toast: Omit<ExportToast, 'id'>) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  toasts.value = [...toasts.value, { ...toast, id }]

  if (toast.tone !== 'error') {
    window.setTimeout(() => dismissToast(id), 8000)
  } else {
    window.setTimeout(() => dismissToast(id), 15000)
  }
}

function dismissToast(id: string) {
  toasts.value = toasts.value.filter((item) => item.id !== id)
}

const stopped = (job: ExportJob) => !isPending(job.status)

function applyJob(next: ExportJob) {
  const previous = jobs[next.id]
  jobs[next.id] = next

  if (previous && isPending(previous.status)) {
    if (next.status === 'SELESAI') {
      pushToast({
        tone: 'success',
        title: 'Export selesai',
        message: `${next.scopeLabel}  -  ${next.rowCount.toLocaleString('id-ID')} baris siap diunduh.`,
        job: next,
      })
    } else if (next.status === 'GAGAL') {
      pushToast({
        tone: 'error',
        title: 'Export gagal',
        message: next.error || 'Terjadi kesalahan saat membuat file export.',
        job: next,
      })
    }
  }

  if (Object.values(jobs).every(stopped)) {
    stopPolling()
  }
}

async function refreshJob(id: string) {
  try {
    const { data } = await api.get(`/exports/jobs/${id}`)
    if (data?.data) applyJob(data.data as ExportJob)
    return data?.data as ExportJob | undefined
  } catch {
    return undefined
  }
}

async function pollOnce() {
  const pending = Object.values(jobs).filter((job) => isPending(job.status))
  await Promise.all(pending.map((job) => refreshJob(job.id)))
}

function startPolling() {
  if (pollTimer) return
  pollTimer = window.setInterval(() => {
    void pollOnce()
  }, POLL_INTERVAL_MS)
}

function stopPolling() {
  if (pollTimer) {
    window.clearInterval(pollTimer)
    pollTimer = undefined
  }
}

function registerJob(job: ExportJob) {
  jobs[job.id] = job
  startPolling()
}

async function createJob(payload: Record<string, unknown>) {
  const { data } = await api.post('/exports/jobs', payload)
  const job = data?.data as ExportJob
  if (job) registerJob(job)
  return job
}

async function loadRecentJobs(limit = 5) {
  const { data } = await api.get('/exports/jobs', { params: { limit } })
  const list = (data?.data || []) as ExportJob[]
  list.forEach((job) => {
    if (!jobs[job.id]) jobs[job.id] = job
  })
  if (list.some((job) => isPending(job.status))) startPolling()
  return list
}

async function downloadJob(job: ExportJob) {
  if (!job?.downloadable) return
  downloading[job.id] = true
  try {
    const response = await api.get(`/exports/jobs/${job.id}/file`, { responseType: 'blob' })
    saveBlob(response.data, job.fileName || 'export.xlsx')
    dismissToast(toasts.value.find((toast) => toast.job?.id === job.id)?.id || '')
  } catch (error: any) {
    const message =
      error?.response?.data?.message || 'Gagal mengunduh file export. Coba export ulang.'
    pushToast({ tone: 'error', title: 'Unduh gagal', message })
  } finally {
    downloading[job.id] = false
  }
}

function saveBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export function useExportJobs() {
  return {
    jobs,
    toasts,
    downloading,
    pendingCount,
    registerJob,
    createJob,
    loadRecentJobs,
    refreshJob,
    downloadJob,
    dismissToast,
    pushToast,
    saveBlob,
  }
}
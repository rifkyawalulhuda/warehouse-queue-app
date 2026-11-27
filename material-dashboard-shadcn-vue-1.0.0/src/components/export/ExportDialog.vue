<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { CalendarDays, Download, Loader2, Clock, CheckCircle2, AlertTriangle, Database } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import api from '@/services/api'
import { useExportJobs, type ExportJob } from '@/composables/useExportJobs'

type ExportType = 'QUEUE' | 'PICKING_PROGRESS' | 'SCHEDULE' | 'REPORT_SCHEDULE_VS_ACTUAL'
type ScopeMode = 'year' | 'month' | 'range'

type ScopePrefill = {
  mode?: ScopeMode
  year?: number
  month?: number
  dateFrom?: string
  dateTo?: string
}

const props = defineProps<{
  modelValue: boolean
  type: ExportType
  syncPath: string
  title?: string
  subtitle?: string
  prefill?: ScopePrefill
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

const { createJob, downloadJob, loadRecentJobs, jobs, downloading, pushToast } = useExportJobs()

const loading = ref(false)
const estimating = ref(false)
const submitting = ref(false)
const error = ref<string | null>(null)
const years = ref<number[]>([])
const syncRowLimit = ref(5000)

const now = new Date()
const form = reactive({
  mode: 'year' as ScopeMode,
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  dateFrom: '',
  dateTo: '',
})

const estimate = ref<{
  count: number
  mode: 'sync' | 'async'
  scopeLabel: string
  dateFrom: string
  dateTo: string
} | null>(null)

const yearSelectRef = ref<HTMLSelectElement | null>(null)

const titleText = computed(() => props.title || 'Export Excel')
const isAsync = computed(() => estimate.value?.mode === 'async')
const hasData = computed(() => (estimate.value?.count ?? 0) > 0)

const recentJobs = computed(() => {
  const list = Object.values(jobs)
    .filter((job) => job.type === props.type)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return list.slice(0, 3)
})

const close = () => emit('update:modelValue', false)

/**
 * Mengisi periode dari halaman pemanggil (mis. filter report yang sedang
 * dilihat). Nilai yang tidak dikirim dibiarkan apa adanya.
 */
const applyPrefill = () => {
  const prefill = props.prefill
  if (!prefill) return
  if (prefill.mode) form.mode = prefill.mode
  if (prefill.year) form.year = prefill.year
  if (prefill.month) form.month = prefill.month
  if (prefill.dateFrom) form.dateFrom = prefill.dateFrom
  if (prefill.dateTo) form.dateTo = prefill.dateTo
}

const scopeParams = () => {
  if (form.mode === 'month') {
    return { mode: 'month', year: form.year, month: form.month }
  }
  if (form.mode === 'range') {
    return { mode: 'range', dateFrom: form.dateFrom, dateTo: form.dateTo || form.dateFrom }
  }
  return { mode: 'year', year: form.year }
}

const getErrorMessage = (err: any, fallback: string) =>
  err?.response?.data?.message || err?.message || fallback

const formatCount = (value: number) => value.toLocaleString('id-ID')

const scopeValid = computed(() => {
  if (form.mode === 'range') {
    return Boolean(form.dateFrom) && Boolean(form.dateTo)
  }
  if (form.mode === 'month') {
    return Boolean(form.month)
  }
  return true
})

const scopeHint = computed(() => {
  if (form.mode === 'month' && !form.month) return 'Pilih bulan untuk melihat jumlah baris'
  if (form.mode === 'range') {
    if (!form.dateFrom && !form.dateTo) return 'Isi tanggal Dari dan Sampai'
    if (!form.dateFrom) return 'Tanggal Dari belum diisi'
    if (!form.dateTo) return 'Tanggal Sampai belum diisi'
  }
  return 'Jumlah baris belum diketahui'
})

let estimateTimer: number | undefined

const fetchEstimate = async () => {
  if (!scopeValid.value) {
    estimate.value = null
    error.value = null
    return
  }
  estimating.value = true
  error.value = null
  try {
    const { data } = await api.get('/exports/estimate', {
      params: { type: props.type, ...scopeParams() },
    })
    estimate.value = data?.data || null
    if (data?.data?.syncRowLimit) syncRowLimit.value = data.data.syncRowLimit
  } catch (err) {
    estimate.value = null
    error.value = getErrorMessage(err, 'Gagal menghitung jumlah baris')
  } finally {
    estimating.value = false
  }
}

const scheduleEstimate = () => {
  if (estimateTimer) window.clearTimeout(estimateTimer)
  estimateTimer = window.setTimeout(() => {
    void fetchEstimate()
  }, 350)
}

watch(
  () => [form.mode, form.year, form.month, form.dateFrom, form.dateTo],
  () => {
    estimate.value = null
    scheduleEstimate()
  }
)

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    error.value = null
    submitting.value = false

    if (years.value.length === 0) {
      loading.value = true
      try {
        const { data } = await api.get('/exports/options')
        const entry = data?.data?.options?.[props.type]
        years.value = entry?.years?.length ? entry.years : [now.getFullYear()]
        syncRowLimit.value =
          entry?.syncRowLimit || data?.data?.syncRowLimit || 5000
        form.year = entry?.defaultYear || years.value[0]
      } catch (err) {
        error.value = getErrorMessage(err, 'Gagal memuat pilihan tahun')
      } finally {
        loading.value = false
      }
    }

    applyPrefill()
    void loadRecentJobs().catch(() => undefined)
    await fetchEstimate()
    await nextTick()
    yearSelectRef.value?.focus()
  }
)

const handleClose = () => {
  if (submitting.value) return
  close()
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') handleClose()
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) window.addEventListener('keydown', handleKeydown)
    else window.removeEventListener('keydown', handleKeydown)
  }
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (estimateTimer) window.clearTimeout(estimateTimer)
})

const downloadSync = async () => {
  const response = await api.get(props.syncPath, {
    params: scopeParams(),
    responseType: 'blob',
  })
  const disposition = response.headers?.['content-disposition'] || ''
  const match = /filename="?([^";]+)"?/i.exec(disposition)
  const rawName = match?.[1]
  const fileName =
    rawName ||
    `export_${estimate.value?.dateFrom || ''}_${estimate.value?.dateTo || ''}.xlsx`
  const url = window.URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

const handleSubmit = async () => {
  if (!scopeValid.value) {
    error.value = 'Lengkapi rentang tanggal terlebih dahulu'
    return
  }
  if (!hasData.value) {
    error.value = 'Tidak ada data pada periode ini'
    return
  }

  submitting.value = true
  error.value = null
  try {
    if (isAsync.value) {
      const job = await createJob({ type: props.type, ...scopeParams() })
      pushToast({
        tone: 'info',
        title: 'Export sedang dibuat',
        message: `${job?.scopeLabel || 'File export'} · ${formatCount(job?.rowCount || 0)} baris. Anda akan diberi tahu saat siap.`,
      })
      close()
      return
    }
    await downloadSync()
    close()
  } catch (err) {
    error.value = getErrorMessage(err, 'Gagal export data')
  } finally {
    submitting.value = false
  }
}

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const jobStatusLabel = (job: ExportJob) => {
  if (job.status === 'MENUNGGU') return 'Menunggu'
  if (job.status === 'PROSES') return 'Diproses'
  if (job.status === 'SELESAI') return 'Selesai'
  return 'Gagal'
}

const jobStatusClass = (job: ExportJob) => {
  if (job.status === 'SELESAI') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (job.status === 'GAGAL') return 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
  return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
}
</script>

<template>
  <div v-if="modelValue" class="fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/45 backdrop-blur-[2px]" @click="handleClose"></div>

    <div
      class="absolute left-1/2 top-1/2 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
    >
      <div class="border-b border-border/70 px-5 py-4">
        <h3 id="export-dialog-title" class="text-base font-semibold tracking-tight">
          {{ titleText }}
        </h3>
        <p class="mt-0.5 text-xs text-muted-foreground">
          {{ subtitle || 'Pilih periode data yang ingin diunduh. Data lama tetap tersedia per tahun.' }}
        </p>
      </div>

      <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div>
          <p class="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Periode
          </p>
          <div class="grid grid-cols-3 gap-1 rounded-xl border border-border/70 bg-muted/40 p-1">
            <button
              v-for="option in [
                { key: 'year', label: 'Tahun' },
                { key: 'month', label: 'Bulan' },
                { key: 'range', label: 'Rentang' },
              ]"
              :key="option.key"
              type="button"
              class="rounded-lg px-2 py-2 text-xs font-medium transition-colors"
              :class="
                form.mode === option.key
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:text-foreground'
              "
              :aria-pressed="form.mode === option.key"
              @click="form.mode = option.key as ScopeMode"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div v-if="form.mode === 'year'" class="space-y-1.5">
          <label for="export-year" class="text-sm text-muted-foreground">Tahun</label>
          <select
            id="export-year"
            ref="yearSelectRef"
            v-model.number="form.year"
            class="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            :disabled="loading"
          >
            <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
          </select>
        </div>

        <div v-if="form.mode === 'month'" class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label for="export-month-year" class="text-sm text-muted-foreground">Tahun</label>
            <select
              id="export-month-year"
              ref="yearSelectRef"
              v-model.number="form.year"
              class="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              :disabled="loading"
            >
              <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
            </select>
          </div>
          <div class="space-y-1.5">
            <label for="export-month" class="text-sm text-muted-foreground">Bulan</label>
            <select
              id="export-month"
              v-model.number="form.month"
              class="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option v-for="(label, index) in MONTHS" :key="label" :value="index + 1">
                {{ label }}
              </option>
            </select>
          </div>
        </div>

        <div v-if="form.mode === 'range'" class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label for="export-date-from" class="text-sm text-muted-foreground">Dari</label>
            <div class="relative">
              <input
                id="export-date-from"
                v-model="form.dateFrom"
                type="date"
                class="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <CalendarDays class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <div class="space-y-1.5">
            <label for="export-date-to" class="text-sm text-muted-foreground">Sampai</label>
            <div class="relative">
              <input
                id="export-date-to"
                v-model="form.dateTo"
                type="date"
                class="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <CalendarDays class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <p class="col-span-2 text-[11px] text-muted-foreground">
            Maksimal 366 hari per export.
          </p>
        </div>

        <div class="rounded-xl border border-border/70 bg-muted/30 p-3">
          <div class="flex items-center gap-2 text-sm">
            <Loader2 v-if="estimating || loading" class="h-4 w-4 animate-spin text-muted-foreground" />
            <Database v-else class="h-4 w-4 text-muted-foreground" />
            <span v-if="estimating" class="text-muted-foreground">Menghitung jumlah baris...</span>
            <span v-else-if="estimate" class="font-medium">
              {{ formatCount(estimate.count) }} baris
              <span class="text-muted-foreground">· {{ estimate.scopeLabel }}</span>
            </span>
            <span v-else class="text-muted-foreground">{{ scopeHint }}</span>
          </div>

          <div v-if="estimate && !hasData" class="mt-2 flex items-start gap-2 text-xs">
            <AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span class="text-amber-700 dark:text-amber-300">
              Tidak ada data pada periode ini. Pilih periode lain.
            </span>
          </div>

          <div v-else-if="estimate" class="mt-2 flex items-start gap-2 text-xs">
            <Clock v-if="isAsync" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <CheckCircle2 v-else class="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span :class="isAsync ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'">
              {{
                isAsync
                  ? `Lebih dari ${formatCount(syncRowLimit)} baris, file dibuat di latar belakang. Anda akan diberi notifikasi saat siap.`
                  : 'File langsung diunduh.'
              }}
            </span>
          </div>
        </div>

        <p v-if="error" class="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300" role="alert">
          {{ error }}
        </p>

        <div v-if="recentJobs.length > 0" class="space-y-2">
          <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Export terakhir
          </p>
          <div
            v-for="job in recentJobs"
            :key="job.id"
            class="flex items-center justify-between gap-2 rounded-xl border border-border/70 px-3 py-2"
          >
            <div class="min-w-0">
              <p class="truncate text-xs font-medium">{{ job.scopeLabel }}</p>
              <p class="text-[11px] text-muted-foreground">
                {{ formatCount(job.rowCount) }} baris
                <span v-if="job.fileSize"> · {{ formatFileSize(job.fileSize) }}</span>
              </p>
            </div>
            <span class="rounded-full border px-2 py-0.5 text-[10px] font-medium" :class="jobStatusClass(job)">
              {{ jobStatusLabel(job) }}
            </span>
            <button
              v-if="job.downloadable"
              type="button"
              class="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium transition hover:bg-accent"
              :disabled="downloading[job.id]"
              @click="downloadJob(job)"
            >
              <Loader2 v-if="downloading[job.id]" class="h-3 w-3 animate-spin" />
              <Download v-else class="h-3 w-3" />
              Unduh
            </button>
            <AlertTriangle v-else-if="job.status === 'GAGAL'" class="h-4 w-4 shrink-0 text-red-500" />
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-border/70 px-5 py-3">
        <Button variant="ghost" :disabled="submitting" @click="handleClose">Batal</Button>
        <Button :disabled="submitting || estimating || !hasData" @click="handleSubmit">
          <Loader2 v-if="submitting || estimating" class="mr-1.5 h-4 w-4 animate-spin" />
          <Download v-else class="mr-1.5 h-4 w-4" />
          {{ submitting ? 'Memproses...' : isAsync ? 'Buat file export' : 'Download Excel' }}
        </Button>
      </div>
    </div>
  </div>
</template>
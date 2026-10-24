<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Input from '@/components/ui/Input.vue'
import Combobox from '@/components/ui/Combobox.vue'
import ActionMenu, { type ActionItem } from '@/components/ui/ActionMenu.vue'
import DailyJobStamp from '@/components/dailyJob/DailyJobStamp.vue'
import DailyJobConfirmModal from '@/components/dailyJob/DailyJobConfirmModal.vue'
import DailyJobCancelModal from '@/components/dailyJob/DailyJobCancelModal.vue'
import JobTransactionFormModal from '@/components/jobTransaction/JobTransactionFormModal.vue'
import JobTransactionFinishModal from '@/components/jobTransaction/JobTransactionFinishModal.vue'
import {
  Plus,
  RefreshCw,
  Play,
  CheckCircle2,
  Search,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet
} from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'
import { listEmployees, type Employee } from '@/services/employeeApi'
import {
  cancelJobTransaction,
  createJobTransaction,
  deleteJobTransaction,
  exportJobTransactions,
  finishJobTransaction,
  listJobTransactions,
  reopenJobTransaction,
  startJobTransaction,
  updateJobTransaction,
  type JobActivityType,
  type JobTransaction,
  type JobTransactionPayload,
  type JobTransactionStatus,
  type JobTransactionStatusCounts
} from '@/services/jobTransactionApi'
import {
  ACTIVITY_OPTIONS,
  activityLabel,
  dateInputOffset,
  durationLabel,
  formatTimeOnly,
  isManpower,
  monthEndInput,
  monthStartInput,
  shortDateLabel,
  todayInput,
  TRANSACTION_STATUS_LABEL,
  truckLabel
} from '@/components/jobTransaction/meta'
import { statusBubbleClass, statusCardClass } from '@/lib/statusCard'

const route = useRoute()
const { user, initFromStorage } = useAuth()
initFromStorage()
const isAdmin = computed(() => user.value?.role === 'ADMIN')

const pad = (value: number) => String(value).padStart(2, '0')

type StatusFilter = 'ALL' | JobTransactionStatus
type QuickRange = 'today' | 'week' | 'month' | 'custom'

const filters = ref({
  dateFrom: todayInput(),
  dateTo: todayInput(),
  status: 'ALL' as StatusFilter,
  activityType: 'ALL' as 'ALL' | JobActivityType,
  search: ''
})
const activeRange = ref<QuickRange>('today')

const items = ref<JobTransaction[]>([])
const counts = ref<JobTransactionStatusCounts>({ ALL: 0, DRAFT: 0, PROSES: 0, SELESAI: 0, BATAL: 0 })
const meta = ref({ page: 1, limit: 30, total: 0, totalPages: 1 })
const page = ref(1)
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const employees = ref<Employee[]>([])

const isMobile = ref(false)
const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024
}

const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const formInitial = ref<JobTransaction | null>(null)
const formSubmitting = ref(false)
const formError = ref<string | null>(null)

const finishOpen = ref(false)
const finishTarget = ref<JobTransaction | null>(null)
const finishSubmitting = ref(false)
const finishError = ref<string | null>(null)

const cancelOpen = ref(false)
const cancelTarget = ref<JobTransaction | null>(null)
const cancelSubmitting = ref(false)
const cancelError = ref<string | null>(null)

const confirmOpen = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmLabel = ref('Ya, Lanjutkan')
const confirmError = ref<string | null>(null)
const confirmSubmitting = ref(false)
const pendingAction = ref<{ type: 'start' | 'reopen' | 'delete'; row: JobTransaction } | null>(null)

let successTimer: number | undefined
let searchTimer: number | undefined

const exporting = ref(false)
const exportError = ref<string | null>(null)

const showSuccess = (message: string) => {
  success.value = message
  if (successTimer) window.clearTimeout(successTimer)
  successTimer = window.setTimeout(() => {
    success.value = null
  }, 3500)
}

const statusCards = computed(() => [
  { key: 'ALL' as StatusFilter, label: 'Semua', value: counts.value.ALL },
  { key: 'DRAFT' as StatusFilter, label: 'Draft', value: counts.value.DRAFT },
  { key: 'PROSES' as StatusFilter, label: 'Proses', value: counts.value.PROSES },
  { key: 'SELESAI' as StatusFilter, label: 'Selesai', value: counts.value.SELESAI },
  { key: 'BATAL' as StatusFilter, label: 'Batal', value: counts.value.BATAL }
])

const activityOptions = computed(() => [
  { value: 'ALL', label: 'Semua pekerjaan' },
  ...ACTIVITY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))
])

const quickRanges: Array<{ key: QuickRange; label: string }> = [
  { key: 'today', label: 'Hari ini' },
  { key: 'week', label: '7 hari' },
  { key: 'month', label: 'Bulan ini' }
]

const rangeSummary = computed(() => {
  if (filters.value.dateFrom === filters.value.dateTo) {
    return shortDateLabel(filters.value.dateFrom)
  }
  return `${shortDateLabel(filters.value.dateFrom)} – ${shortDateLabel(filters.value.dateTo)}`
})

const multiDayRange = computed(() => filters.value.dateFrom !== filters.value.dateTo)

const getErrorMessage = (err: any, fallback: string) =>
  err?.response?.data?.message || err?.message || fallback

let lastFetchedSearch = ''

const fetchList = async () => {
  loading.value = true
  error.value = null
  lastFetchedSearch = filters.value.search
  try {
    const response = await listJobTransactions({
      dateFrom: filters.value.dateFrom || undefined,
      dateTo: filters.value.dateTo || undefined,
      status: filters.value.status,
      activityType: filters.value.activityType,
      search: filters.value.search.trim() || undefined,
      page: page.value,
      limit: meta.value.limit
    })
    items.value = (response.data?.items ?? []) as JobTransaction[]
    meta.value = response.data?.meta ?? meta.value
    if (response.data?.meta?.counts) counts.value = response.data.meta.counts
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal memuat transaksi')
    items.value = []
  } finally {
    loading.value = false
  }
}

const loadEmployees = async () => {
  try {
    const response = await listEmployees()
    employees.value = (response.data?.items ?? response.data?.data ?? []) as Employee[]
  } catch {
    employees.value = []
  }
}

const applyQuickRange = (range: QuickRange) => {
  activeRange.value = range
  if (range === 'today') {
    filters.value.dateFrom = todayInput()
    filters.value.dateTo = todayInput()
  } else if (range === 'week') {
    filters.value.dateFrom = dateInputOffset(-6)
    filters.value.dateTo = todayInput()
  } else if (range === 'month') {
    filters.value.dateFrom = monthStartInput()
    filters.value.dateTo = monthEndInput()
  }
  page.value = 1
  fetchList()
}

const onDateChange = () => {
  activeRange.value = 'custom'
  page.value = 1
  fetchList()
}

const onActivityChange = () => {
  page.value = 1
  fetchList()
}

const setStatus = (value: StatusFilter) => {
  filters.value.status = filters.value.status === value ? 'ALL' : value
  page.value = 1
  fetchList()
}

const resetFilters = () => {
  filters.value = {
    dateFrom: todayInput(),
    dateTo: todayInput(),
    status: 'ALL',
    activityType: 'ALL',
    search: ''
  }
  activeRange.value = 'today'
  page.value = 1
  fetchList()
}

const buildExportFilename = () => {
  const from = filters.value.dateFrom
  const to = filters.value.dateTo
  if (from && to) return `transaksi-pekerjaan_${from}_sampai_${to}.xlsx`
  return 'transaksi-pekerjaan.xlsx'
}

const readBlobError = async (err: any, fallback: string) => {
  const data = err?.response?.data
  if (data instanceof Blob) {
    try {
      const text = await data.text()
      const parsed = JSON.parse(text)
      if (parsed?.message) return String(parsed.message)
    } catch {
      return fallback
    }
  }
  return getErrorMessage(err, fallback)
}

const handleExport = async () => {
  if (exporting.value) return
  exporting.value = true
  exportError.value = null
  try {
    const response = await exportJobTransactions({
      dateFrom: filters.value.dateFrom || undefined,
      dateTo: filters.value.dateTo || undefined,
      status: filters.value.status,
      activityType: filters.value.activityType,
      search: filters.value.search.trim() || undefined
    })

    const rowCount = Number(response.headers?.['x-export-row-count'])
    const truncated = response.headers?.['x-export-truncated'] === '1'

    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = buildExportFilename()
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)

    if (Number.isFinite(rowCount) && rowCount > 0) {
      showSuccess(
        truncated
          ? `${rowCount} transaksi diexport (dibatasi ${rowCount} baris pertama)`
          : `${rowCount} transaksi diexport ke Excel`
      )
    } else {
      showSuccess('File Excel diunduh')
    }
  } catch (err: any) {
    exportError.value = await readBlobError(err, 'Gagal export Excel')
  } finally {
    exporting.value = false
  }
}

const openCreate = () => {
  formMode.value = 'create'
  formInitial.value = null
  formError.value = null
  formOpen.value = true
}

const openEdit = (row: JobTransaction) => {
  formMode.value = 'edit'
  formInitial.value = row
  formError.value = null
  formOpen.value = true
}

const submitForm = async (payload: JobTransactionPayload, startNow: boolean) => {
  formSubmitting.value = true
  formError.value = null
  try {
    const body: JobTransactionPayload = startNow ? payload : { ...payload, startAt: null }

    if (formMode.value === 'edit' && formInitial.value) {
      await updateJobTransaction(formInitial.value.id, body)
      showSuccess('Transaksi diperbarui')
    } else {
      await createJobTransaction(body)
      showSuccess(startNow ? 'Transaksi dimulai' : 'Draft transaksi disimpan')
    }
    formOpen.value = false
    await fetchList()
  } catch (err: any) {
    const code = err?.response?.data?.details?.code
    if (code === 'EMPLOYEE_OVERLAP') {
      formError.value = 'Karyawan ini masih punya pekerjaan berjalan pada waktu tersebut.'
      return
    }
    formError.value = getErrorMessage(err, 'Gagal menyimpan transaksi')
  } finally {
    formSubmitting.value = false
  }
}

const requestStart = (row: JobTransaction) => {
  pendingAction.value = { type: 'start', row }
  confirmTitle.value = 'Mulai pekerjaan ini?'
  confirmMessage.value = `${row.employeeName} · ${activityLabel(row.activityType)} akan dicatat mulai sekarang.`
  confirmLabel.value = 'Ya, Mulai'
  confirmError.value = null
  confirmOpen.value = true
}

const requestReopen = (row: JobTransaction) => {
  const target = row.status === 'SELESAI' ? 'PROSES' : 'DRAFT'
  pendingAction.value = { type: 'reopen', row }
  confirmTitle.value = 'Kembalikan status?'
  confirmMessage.value = `Status kembali dari ${TRANSACTION_STATUS_LABEL[row.status]} ke ${
    TRANSACTION_STATUS_LABEL[target as JobTransactionStatus]
  }.`
  confirmLabel.value = 'Ya, Kembalikan'
  confirmError.value = null
  confirmOpen.value = true
}

const requestDelete = (row: JobTransaction) => {
  pendingAction.value = { type: 'delete', row }
  confirmTitle.value = 'Hapus transaksi?'
  confirmMessage.value = `Transaksi ${row.employeeName} · ${activityLabel(row.activityType)} akan dihapus permanen.`
  confirmLabel.value = 'Ya, Hapus'
  confirmError.value = null
  confirmOpen.value = true
}

const nowWallClock = () => {
  const date = new Date()
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

const executeConfirmed = async () => {
  const action = pendingAction.value
  if (!action) return
  confirmSubmitting.value = true
  confirmError.value = null
  try {
    if (action.type === 'start') {
      await startJobTransaction(action.row.id, nowWallClock())
      showSuccess('Pekerjaan dimulai')
    } else if (action.type === 'reopen') {
      await reopenJobTransaction(action.row.id)
      showSuccess('Status transaksi dikembalikan')
    } else {
      await deleteJobTransaction(action.row.id)
      showSuccess('Transaksi dihapus')
    }
    confirmOpen.value = false
    pendingAction.value = null
    await fetchList()
  } catch (err: any) {
    const code = err?.response?.data?.details?.code
    if (code === 'EMPLOYEE_OVERLAP') {
      confirmError.value = 'Karyawan ini masih punya pekerjaan berjalan pada waktu tersebut.'
      return
    }
    confirmError.value = getErrorMessage(err, 'Gagal memproses aksi')
  } finally {
    confirmSubmitting.value = false
  }
}

const openFinish = (row: JobTransaction) => {
  finishTarget.value = row
  finishError.value = null
  finishOpen.value = true
}

const submitFinish = async (payload: { finishAt: string; confirmation: string | null }) => {
  if (!finishTarget.value) return
  finishSubmitting.value = true
  finishError.value = null
  try {
    await finishJobTransaction(finishTarget.value.id, payload)
    finishOpen.value = false
    finishTarget.value = null
    showSuccess('Pekerjaan diselesaikan')
    await fetchList()
  } catch (err: any) {
    finishError.value = getErrorMessage(err, 'Gagal menyelesaikan transaksi')
  } finally {
    finishSubmitting.value = false
  }
}

const openCancel = (row: JobTransaction) => {
  cancelTarget.value = row
  cancelError.value = null
  cancelOpen.value = true
}

const submitCancel = async (reason: string) => {
  if (!cancelTarget.value) return
  cancelSubmitting.value = true
  cancelError.value = null
  try {
    await cancelJobTransaction(cancelTarget.value.id, reason)
    cancelOpen.value = false
    cancelTarget.value = null
    showSuccess('Transaksi dibatalkan')
    await fetchList()
  } catch (err: any) {
    cancelError.value = getErrorMessage(err, 'Gagal membatalkan transaksi')
  } finally {
    cancelSubmitting.value = false
  }
}

const changePage = (next: number) => {
  if (next < 1 || next > meta.value.totalPages) return
  page.value = next
  fetchList()
}

const secondaryActions = (row: JobTransaction): ActionItem[] => {
  const actions: ActionItem[] = []
  if (row.status !== 'SELESAI' && row.status !== 'BATAL') {
    actions.push({ key: 'edit', label: 'Ubah', icon: 'edit' })
  }
  if (isAdmin.value && (row.status === 'SELESAI' || row.status === 'PROSES')) {
    actions.push({ key: 'reopen', label: 'Kembalikan status', icon: 'undo' })
  }
  if (isAdmin.value && row.status !== 'BATAL') {
    actions.push({ key: 'cancel', label: 'Batalkan', icon: 'cancel', danger: true })
  }
  if (isAdmin.value) {
    actions.push({ key: 'delete', label: 'Hapus', icon: 'delete', danger: true })
  }
  return actions
}

const onSecondary = (row: JobTransaction, key: string) => {
  if (key === 'edit') openEdit(row)
  else if (key === 'reopen') requestReopen(row)
  else if (key === 'cancel') openCancel(row)
  else if (key === 'delete') requestDelete(row)
}

const timeRange = (row: JobTransaction) => {
  if (!row.startAt) return 'Belum dimulai'
  const start = formatTimeOnly(row.startAt)
  const finish = row.finishAt ? formatTimeOnly(row.finishAt) : 'berjalan'
  return `${start} → ${finish}`
}

const workloadPrimary = (row: JobTransaction) => {
  if (isManpower(row.activityType)) return row.employeeName
  return `${row.totalMember ?? 0} member`
}

const rowLabel = (row: JobTransaction) => {
  const who = isManpower(row.activityType) ? row.employeeName : `${row.totalMember ?? 0} member`
  return `${activityLabel(row.activityType)} · ${who}`
}

const workloadSecondary = (row: JobTransaction) => {
  if (isManpower(row.activityType)) return null
  return `${row.totalDo ?? 0} DO`
}

const unitLabel = (row: JobTransaction) => {
  if (!isManpower(row.activityType)) return '—'
  return `${truckLabel(row)} × ${row.qty}`
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)

  const queryDate = typeof route.query.date === 'string' ? route.query.date : ''
  if (queryDate) {
    filters.value.dateFrom = queryDate
    filters.value.dateTo = queryDate
    activeRange.value = 'custom'
  }

  loadEmployees()
  fetchList()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  if (successTimer) window.clearTimeout(successTimer)
  if (searchTimer) window.clearTimeout(searchTimer)
})

watch(
  () => filters.value.search,
  (value) => {
    if (value === lastFetchedSearch) return
    if (searchTimer) window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => {
      page.value = 1
      fetchList()
    }, 400)
  }
)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Transaksi Pekerjaan</h1>
        <p class="text-muted-foreground">
          Catat pekerjaan manpower, picking, dan stuffing. Laporan harian terbentuk otomatis.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          :disabled="exporting"
          :title="`Export semua baris sesuai filter aktif (${rangeSummary})`"
          @click="handleExport"
        >
          <FileSpreadsheet class="mr-2 h-4 w-4" :class="exporting ? 'animate-pulse' : ''" aria-hidden="true" />
          {{ exporting ? 'Menyiapkan…' : 'Export Excel' }}
        </Button>
        <Button size="sm" variant="outline" :disabled="loading" @click="fetchList">
          <RefreshCw class="mr-2 h-4 w-4" :class="loading ? 'animate-spin' : ''" aria-hidden="true" />
          Refresh
        </Button>
        <Button size="sm" @click="openCreate">
          <Plus class="mr-2 h-4 w-4" aria-hidden="true" />
          Tambah Transaksi
        </Button>
      </div>
    </div>

    <div class="mx-auto w-full max-w-5xl">
      <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
        <button
          v-for="card in statusCards"
          :key="card.key"
          type="button"
          class="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="[
            statusCardClass(card.key),
            filters.status === card.key ? 'ring-2 ring-primary/40 border-primary' : ''
          ]"
          :aria-pressed="filters.status === card.key"
          @click="setStatus(card.key)"
        >
          <span class="text-sm font-semibold">{{ card.label }}</span>
          <span
            class="inline-flex min-w-8 items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums"
            :class="statusBubbleClass(card.key)"
          >
            {{ card.value }}
          </span>
        </button>
      </div>
    </div>

    <Card>
      <CardHeader class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              v-for="range in quickRanges"
              :key="range.key"
              type="button"
              class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              :class="activeRange === range.key
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border/70 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground'"
              :aria-pressed="activeRange === range.key"
              @click="applyQuickRange(range.key)"
            >
              {{ range.label }}
            </button>
            <span class="ml-1 text-xs text-muted-foreground tabular-nums">{{ rangeSummary }}</span>
          </div>
          <p class="text-xs text-muted-foreground tabular-nums">
            {{ counts.ALL }} transaksi
            <template v-if="counts.PROSES > 0"> · {{ counts.PROSES }} berjalan</template>
          </p>
        </div>

        <div class="grid gap-3 md:grid-cols-4">
          <div class="relative">
            <Search
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              v-model="filters.search"
              type="text"
              placeholder="Cari karyawan atau catatan"
              class="pl-9"
              aria-label="Cari transaksi"
            />
          </div>
          <Combobox
            v-model="filters.activityType"
            :options="activityOptions"
            :searchable="false"
            placeholder="Semua pekerjaan"
            search-placeholder="Cari pekerjaan..."
            empty-text="Pekerjaan tidak ditemukan"
            @update:model-value="onActivityChange"
          />
          <input
            v-model="filters.dateFrom"
            type="date"
            aria-label="Dari tanggal"
            class="h-11 w-full rounded-xl border border-input/80 bg-card/75 px-3 text-sm shadow-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @change="onDateChange"
          />
          <input
            v-model="filters.dateTo"
            type="date"
            aria-label="Sampai tanggal"
            class="h-11 w-full rounded-xl border border-input/80 bg-card/75 px-3 text-sm shadow-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @change="onDateChange"
          />
        </div>

        <div v-if="filters.status !== 'ALL' || filters.activityType !== 'ALL' || filters.search" class="flex items-center gap-2">
          <span class="text-[11px] text-muted-foreground">Filter aktif:</span>
          <button
            type="button"
            class="text-[11px] text-primary underline-offset-4 hover:underline"
            @click="resetFilters"
          >
            Reset semua
          </button>
        </div>
      </CardHeader>

      <CardContent>
        <div
          v-if="error || exportError"
          class="mb-3 flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
          role="alert"
        >
          <span>{{ exportError || error }}</span>
          <button
            v-if="exportError"
            type="button"
            class="shrink-0 text-xs font-medium underline underline-offset-4"
            @click="exportError = null"
          >
            Tutup
          </button>
        </div>
        <div
          v-if="success"
          class="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
          role="status"
        >
          {{ success }}
        </div>

        <div v-if="!isMobile" class="overflow-x-auto rounded-lg border">
          <table class="w-full min-w-[860px] text-sm">
            <thead class="bg-muted/60 text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left font-medium">Waktu</th>
                <th class="px-3 py-2 text-left font-medium">Pekerjaan</th>
                <th class="px-3 py-2 text-left font-medium">Karyawan / Beban</th>
                <th class="px-3 py-2 text-left font-medium">Unit</th>
                <th class="px-3 py-2 text-left font-medium">Status</th>
                <th class="w-32 px-3 py-2 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="px-3 py-12 text-center text-sm text-muted-foreground">
                  Memuat transaksi…
                </td>
              </tr>
              <tr
                v-for="row in items"
                v-else
                :key="row.id"
                class="border-t border-border/60 transition-colors hover:bg-muted/45"
              >
                <td class="px-3 py-2.5">
                  <p
                    class="text-[13px] font-semibold tabular-nums"
                    :class="row.startAt ? '' : 'text-muted-foreground'"
                  >
                    {{ timeRange(row) }}
                  </p>
                  <p class="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                    <template v-if="multiDayRange">{{ shortDateLabel(row.transactionDate) }}</template>
                    <template v-if="multiDayRange && durationLabel(row.startAt, row.finishAt)"> · </template>
                    <template v-if="durationLabel(row.startAt, row.finishAt)">
                      {{ durationLabel(row.startAt, row.finishAt) }}
                    </template>
                    <template v-if="!multiDayRange && !durationLabel(row.startAt, row.finishAt)">
                      Belum ada durasi
                    </template>
                  </p>
                </td>
                <td class="px-3 py-2.5">
                  <span class="font-medium">{{ activityLabel(row.activityType) }}</span>
                  <span
                    v-if="row.jobRole"
                    class="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                  >
                    {{ row.jobRole }}
                  </span>
                </td>
                <td class="px-3 py-2.5">
                  <p class="text-[13px]">{{ workloadPrimary(row) }}</p>
                  <p v-if="workloadSecondary(row)" class="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {{ workloadSecondary(row) }}
                  </p>
                </td>
                <td class="px-3 py-2.5 text-[13px] tabular-nums text-muted-foreground">
                  {{ unitLabel(row) }}
                </td>
                <td class="px-3 py-2.5">
                  <DailyJobStamp :status="row.status" size="sm" :rotate="false" />
                </td>
                <td class="px-3 py-2.5">
                  <div class="flex items-center justify-end gap-1">
                    <Button
                      v-if="row.status === 'DRAFT'"
                      size="sm"
                      variant="outline"
                      class="h-8 px-2.5 text-[12px]"
                      @click="requestStart(row)"
                    >
                      <Play class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      Mulai
                    </Button>
                    <Button
                      v-else-if="row.status === 'PROSES'"
                      size="sm"
                      variant="outline"
                      class="h-8 px-2.5 text-[12px]"
                      @click="openFinish(row)"
                    >
                      <CheckCircle2 class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      Selesaikan
                    </Button>
                    <ActionMenu
                      v-if="secondaryActions(row).length"
                      :items="secondaryActions(row)"
                      :label="`Aksi lain untuk ${rowLabel(row)}`"
                      @select="onSecondary(row, $event)"
                    />
                    <span
                      v-else-if="row.status !== 'DRAFT' && row.status !== 'PROSES'"
                      class="px-1 text-xs text-muted-foreground"
                    >
                      —
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="space-y-2.5">
          <p v-if="loading" class="py-10 text-center text-sm text-muted-foreground">Memuat transaksi…</p>
          <article
            v-for="row in items"
            v-else
            :key="row.id"
            class="rounded-xl border border-border/70 bg-background/40 p-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm font-semibold">
                  {{ activityLabel(row.activityType) }}
                  <span
                    v-if="row.jobRole"
                    class="ml-1 text-[10px] font-normal uppercase tracking-wide text-muted-foreground"
                  >
                    {{ row.jobRole }}
                  </span>
                </p>
                <p class="mt-0.5 truncate text-[13px]">{{ workloadPrimary(row) }}</p>
              </div>
              <DailyJobStamp :status="row.status" size="sm" :rotate="false" />
            </div>

            <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tabular-nums text-muted-foreground">
              <span>{{ timeRange(row) }}</span>
              <template v-if="durationLabel(row.startAt, row.finishAt)">
                <span aria-hidden="true">·</span>
                <span>{{ durationLabel(row.startAt, row.finishAt) }}</span>
              </template>
              <template v-if="isManpower(row.activityType)">
                <span aria-hidden="true">·</span>
                <span>{{ unitLabel(row) }}</span>
              </template>
              <template v-else-if="workloadSecondary(row)">
                <span aria-hidden="true">·</span>
                <span>{{ workloadSecondary(row) }}</span>
              </template>
            </div>

            <div class="mt-2.5 flex items-center gap-2">
              <Button
                v-if="row.status === 'DRAFT'"
                variant="outline"
                class="h-11 flex-1 text-[13px]"
                @click="requestStart(row)"
              >
                <Play class="mr-1.5 h-4 w-4" aria-hidden="true" />
                Mulai
              </Button>
              <Button
                v-else-if="row.status === 'PROSES'"
                variant="outline"
                class="h-11 flex-1 text-[13px]"
                @click="openFinish(row)"
              >
                <CheckCircle2 class="mr-1.5 h-4 w-4" aria-hidden="true" />
                Selesaikan
              </Button>
              <span v-else class="flex-1 text-xs text-muted-foreground">
                {{ row.status === 'BATAL' ? 'Transaksi dibatalkan' : 'Pekerjaan selesai' }}
              </span>
              <ActionMenu
                v-if="secondaryActions(row).length"
                :items="secondaryActions(row)"
                :label="`Aksi lain untuk ${rowLabel(row)}`"
                size="md"
                @select="onSecondary(row, $event)"
              />
            </div>
          </article>
        </div>

        <div
          v-if="!loading && items.length === 0"
          class="flex flex-col items-center gap-3 px-4 py-14 text-center"
        >
          <span class="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ClipboardList class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <div>
            <p class="text-sm font-medium">Belum ada transaksi</p>
            <p class="mt-0.5 text-xs text-muted-foreground">
              Tidak ada pekerjaan pada rentang ini. Coba ubah tanggal atau mulai dari satu pekerjaan.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Button size="sm" @click="openCreate">
              <Plus class="mr-1.5 h-4 w-4" aria-hidden="true" />
              Tambah Transaksi
            </Button>
            <Button size="sm" variant="outline" @click="resetFilters">Hari ini</Button>
          </div>
        </div>

        <div
          v-if="meta.total > 0"
          class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
        >
          <p class="tabular-nums">{{ items.length }} dari {{ meta.total }} transaksi</p>
          <div class="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              :disabled="page <= 1"
              @click="changePage(page - 1)"
            >
              <ChevronLeft class="h-4 w-4" aria-hidden="true" />
              Sebelumnya
            </Button>
            <span class="px-2 tabular-nums">{{ meta.page }} / {{ meta.totalPages }}</span>
            <Button
              size="sm"
              variant="outline"
              :disabled="page >= meta.totalPages"
              @click="changePage(page + 1)"
            >
              Berikutnya
              <ChevronRight class="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <JobTransactionFormModal
      :open="formOpen"
      :mode="formMode"
      :initial="formInitial"
      :employees="employees"
      :submitting="formSubmitting"
      :error="formError"
      @close="formOpen = false"
      @submit="submitForm"
    />

    <JobTransactionFinishModal
      :open="finishOpen"
      :transaction="finishTarget"
      :submitting="finishSubmitting"
      :error="finishError"
      @close="finishOpen = false"
      @confirm="submitFinish"
    />

    <DailyJobConfirmModal
      :open="confirmOpen"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirm-label="confirmLabel"
      :submitting="confirmSubmitting"
      :error="confirmError"
      @close="confirmOpen = false; pendingAction = null"
      @confirm="executeConfirmed"
    />

    <DailyJobCancelModal
      :open="cancelOpen"
      :submitting="cancelSubmitting"
      :error="cancelError"
      :date-label="cancelTarget ? `${cancelTarget.employeeName} · ${activityLabel(cancelTarget.activityType)}` : ''"
      @close="cancelOpen = false"
      @confirm="submitCancel"
    />
  </div>
</template>

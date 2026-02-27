<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import Combobox from '@/components/ui/Combobox.vue'
import Input from '@/components/ui/Input.vue'
import PickingCreateModal from '@/components/picking/PickingCreateModal.vue'
import PickingEditModal from '@/components/picking/PickingEditModal.vue'
import PickingDetailDrawer from '@/components/picking/PickingDetailDrawer.vue'
import PickingTable from '@/components/picking/PickingTable.vue'
import { RefreshCw, Search, CalendarDays } from 'lucide-vue-next'
import api from '@/services/api'
import { useAuth } from '@/composables/useAuth'
import { listEmployees, type Employee } from '@/services/employeeApi'
import {
  cancelPickingProgress,
  createPickingProgress,
  downloadPickingProgressTemplate,
  exportPickingProgress,
  finishPickingProgress,
  getPickingProgressById,
  importPickingProgressExcel,
  listPickingProgress,
  printPickingProgressSummary,
  startPickingProgress,
  updatePickingProgress,
  updatePickingPickedQty,
  type PickingPrintSummary,
  type PickingSortField,
  type PickingProgressEntry,
} from '@/services/pickingProgressApi'

type Customer = {
  id: string
  name: string
}
type PickingStatusKey = 'MENUNGGU' | 'ON_PROCESS' | 'SELESAI' | 'BATAL'

const route = useRoute()
const router = useRouter()
const { user, initFromStorage } = useAuth()
initFromStorage()
const isWarehouse = computed(() => user.value?.role === 'WAREHOUSE')

const entries = ref<PickingProgressEntry[]>([])
const customers = ref<Customer[]>([])
const employees = ref<Employee[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

const createOpen = ref(false)
const createSubmitting = ref(false)
const editOpen = ref(false)
const editSubmitting = ref(false)
const editingEntry = ref<PickingProgressEntry | null>(null)
const drawerOpen = ref(false)
const selectedEntry = ref<PickingProgressEntry | null>(null)
const actionLoading = ref<Record<string, boolean>>({})
const exportOpen = ref(false)
const exporting = ref(false)
const exportError = ref<string | null>(null)
const printing = ref(false)
const printError = ref<string | null>(null)
const importing = ref(false)
const importFile = ref<File | null>(null)
const importFileInput = ref<HTMLInputElement | null>(null)
const filterDateFromInputRef = ref<HTMLInputElement | null>(null)
const filterDateToInputRef = ref<HTMLInputElement | null>(null)
const exportDateFromInputRef = ref<HTMLInputElement | null>(null)
const exportDateToInputRef = ref<HTMLInputElement | null>(null)

const page = ref(1)
const limit = ref(15)
const totalItems = ref(0)
const totalPages = ref(1)

const finishConfirmOpen = ref(false)
const cancelConfirmOpen = ref(false)
const pendingFinishEntry = ref<PickingProgressEntry | null>(null)
const pendingCancelEntry = ref<PickingProgressEntry | null>(null)
const cancelReason = ref('')
const cancelReasonError = ref('')
const startConfirmOpen = ref(false)
const pendingStartEntry = ref<PickingProgressEntry | null>(null)
const selectedPickerEmployeeId = ref('')
const pickedQtyModalOpen = ref(false)
const pendingPickedQtyEntry = ref<PickingProgressEntry | null>(null)
const pickedQtyInput = ref<string | number>('')
const pickedQtySubmitting = ref(false)
const pickedQtySubmitError = ref('')

const todayString = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

const shiftDateString = (baseYmd: string, offsetDays: number) => {
  if (!baseYmd) return ''
  const parsed = new Date(`${baseYmd}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return ''
  parsed.setDate(parsed.getDate() + offsetDays)
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseSearchQuery = (value: unknown) => {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

const filters = reactive({
  dateFrom: todayString(),
  dateTo: todayString(),
  status: 'ALL',
  search: parseSearchQuery(route.query.search),
})

const statusOptions = [
  { value: 'ALL', label: 'Semua' },
  { value: 'MENUNGGU', label: 'MENUNGGU' },
  { value: 'ON_PROCESS', label: 'ON_PROCESS' },
  { value: 'SELESAI', label: 'SELESAI' },
  { value: 'BATAL', label: 'BATAL' },
]

const SORTABLE_COLUMNS: PickingSortField[] = [
  'createdAt',
  'date',
  'customerName',
  'doNumber',
  'destination',
  'volumeCbm',
  'plTimeRelease',
  'pickingQty',
  'pickedQty',
  'startTime',
  'finishTime',
  'status',
  'pickerEmployeeName',
]

const sortBy = ref<PickingSortField>('createdAt')
const sortDir = ref<'asc' | 'desc'>('desc')
const statusCounts = ref<Record<PickingStatusKey, number>>({
  MENUNGGU: 0,
  ON_PROCESS: 0,
  SELESAI: 0,
  BATAL: 0,
})

const exportForm = reactive({
  dateFrom: '',
  dateTo: ''
})

const statusSequenceItems = computed(() => [
  { key: 'MENUNGGU' as const, label: 'Menunggu' },
  { key: 'ON_PROCESS' as const, label: 'On_Process' },
  { key: 'SELESAI' as const, label: 'Selesai' },
])

const isSequenceStatusActive = (status: PickingStatusKey) => filters.status === status

const toggleSequenceStatus = (status: PickingStatusKey) => {
  filters.status = filters.status === status ? 'ALL' : status
}

const getSequenceCardClass = (status: PickingStatusKey) => {
  const count = statusCounts.value[status] || 0
  if (count <= 0) return 'border-border bg-muted/40 text-muted-foreground'
  if (status === 'MENUNGGU') return 'border-yellow-200 bg-yellow-50 text-yellow-900'
  if (status === 'ON_PROCESS') return 'border-blue-200 bg-blue-50 text-blue-900'
  if (status === 'SELESAI') return 'border-green-200 bg-green-50 text-green-900'
  return 'border-red-200 bg-red-50 text-red-900'
}

const getSequenceBubbleClass = (status: PickingStatusKey) => {
  const count = statusCounts.value[status] || 0
  if (count <= 0) return 'border-border bg-background text-muted-foreground'
  if (status === 'MENUNGGU') return 'border-yellow-300 bg-yellow-100 text-yellow-800'
  if (status === 'ON_PROCESS') return 'border-blue-300 bg-blue-100 text-blue-800'
  if (status === 'SELESAI') return 'border-green-300 bg-green-100 text-green-800'
  return 'border-red-300 bg-red-100 text-red-800'
}

const getErrorMessage = (err: any, fallback: string) => {
  return err?.response?.data?.message || err?.message || fallback
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const normalizeNumber = (value: unknown) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const formatPercent = (value: unknown) => {
  const num = normalizeNumber(value)
  return `${num.toFixed(2).replace(/\.?0+$/, '')}%`
}

const formatDateForPrint = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = String(date.getFullYear())
  return `${dd}/${mm}/${yyyy}`
}

const formatDateTimeForPrint = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = String(date.getFullYear())
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`
}

const formatTimeRemainingForPrint = (seconds?: number | null, status?: string) => {
  if (status !== 'ON_PROCESS' || seconds === null || seconds === undefined) return '-'
  const abs = Math.abs(Number(seconds))
  const mins = Math.floor(abs / 60)
  const secs = abs % 60
  const text = `${mins}m ${String(secs).padStart(2, '0')}s`
  if (Number(seconds) < 0) return `Over SLA ${text}`
  return text
}

const buildPrintDateRangeText = (dateFrom?: string | null, dateTo?: string | null) => {
  const from = formatDateForPrint(dateFrom || '')
  const to = formatDateForPrint(dateTo || '')
  if (from === '-' && to === '-') return '-'
  if (from !== '-' && to !== '-') return `${from} s/d ${to}`
  if (from !== '-') return from
  return to
}

const buildPickingPrintHtml = (payload: {
  dateFrom?: string | null
  dateTo?: string | null
  status?: string | null
  search?: string | null
  summary?: PickingPrintSummary | null
  rows: PickingProgressEntry[]
}) => {
  const rows = Array.isArray(payload.rows) ? payload.rows : []
  const summary = payload.summary || {
    totalDo: 0,
    targetPickingQty: 0,
    pickedQty: 0,
    remainQty: 0,
    progressPercent: 0,
    statusCounts: { menunggu: 0, onProcess: 0, selesai: 0, batal: 0 },
  }

  const generatedAt = formatDateTimeForPrint(new Date().toISOString())
  const dateRangeText = buildPrintDateRangeText(payload.dateFrom, payload.dateTo)
  const statusText = payload.status && payload.status !== 'ALL' ? payload.status : 'Semua'
  const searchText = String(payload.search || '').trim() || '-'

  const bodyRows =
    rows.length > 0
      ? rows
          .map((row, index) => {
            const cancelReason =
              row.status === 'BATAL' ? String(row.logs?.[0]?.note || row.logs?.find((log) => log.action === 'CANCEL')?.note || '-') : '-'
            return `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(formatDateForPrint(row.date))}</td>
                <td class="left">${escapeHtml(row.customer?.name || '-')}</td>
                <td class="left">${escapeHtml(row.doNumber || '-')}</td>
                <td class="left">${escapeHtml(row.destination || '-')}</td>
                <td>${normalizeNumber(row.volumeCbm)}</td>
                <td>${escapeHtml(formatDateTimeForPrint(row.plTimeRelease || row.startTime || null))}</td>
                <td>${normalizeNumber(row.pickingQty)}</td>
                <td>${normalizeNumber(row.pickedQty)}</td>
                <td>${normalizeNumber(row.remainQty)}</td>
                <td>${escapeHtml(formatPercent(row.pickingProgressPercent))}</td>
                <td class="left">${escapeHtml(row.pickerEmployee?.name || '-')}</td>
                <td>${escapeHtml(formatTimeRemainingForPrint(row.timeRemainingSeconds, row.status))}</td>
                <td>${escapeHtml(formatDateTimeForPrint(row.startTime))}</td>
                <td>${escapeHtml(formatDateTimeForPrint(row.finishTime))}</td>
                <td>${escapeHtml(row.status || '-')}</td>
                <td class="left">${escapeHtml(cancelReason)}</td>
              </tr>
            `
          })
          .join('')
      : `<tr><td colspan="17" class="empty">Tidak ada data picking progress.</td></tr>`

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Print Picking Progress</title>
    <style>
      @page { size: A4 landscape; margin: 8mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; }
      .sheet { width: 100%; }
      .header { margin-bottom: 8px; }
      .header h1 { margin: 0; font-size: 20px; letter-spacing: 0.4px; }
      .header .subtitle { margin-top: 2px; font-size: 12px; }
      .meta { margin-top: 6px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; font-size: 11px; }
      .meta-item { border: 1px solid #d1d5db; padding: 4px 6px; border-radius: 4px; background: #fafafa; }
      .meta-item strong { font-size: 10px; color: #444; display: block; margin-bottom: 1px; }
      .summary { margin: 8px 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
      .summary-card { border: 1px solid #222; border-radius: 4px; overflow: hidden; }
      .summary-card .label { background: #f2f2f2; border-bottom: 1px solid #222; font-size: 10px; padding: 4px 6px; font-weight: 700; }
      .summary-card .value { font-size: 22px; font-weight: 700; text-align: center; padding: 8px 4px; min-height: 52px; display: flex; align-items: center; justify-content: center; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; }
      th, td { border: 1px solid #222; padding: 3px 4px; text-align: center; vertical-align: middle; word-wrap: break-word; }
      thead th { background: #f2f2f2; font-weight: 700; }
      th.left, td.left { text-align: left; }
      tbody tr:nth-child(even) { background: #fafafa; }
      .empty { text-align: center; color: #666; padding: 10px; }
      @media print {
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="header">
        <h1>PT. SANKYU INDONESIA INTERNATIONAL</h1>
        <div class="subtitle">Picking Progress Report</div>
        <div class="meta">
          <div class="meta-item"><strong>Periode</strong>${escapeHtml(dateRangeText)}</div>
          <div class="meta-item"><strong>Status</strong>${escapeHtml(statusText)}</div>
          <div class="meta-item"><strong>Search</strong>${escapeHtml(searchText)}</div>
          <div class="meta-item"><strong>Generated</strong>${escapeHtml(generatedAt)}</div>
        </div>
      </div>

      <div class="summary">
        <div class="summary-card">
          <div class="label">TOTAL DO PICKING</div>
          <div class="value">${summary.totalDo}</div>
        </div>
        <div class="summary-card">
          <div class="label">TARGET PICKING QTY (Barcode)</div>
          <div class="value">${summary.targetPickingQty}</div>
        </div>
        <div class="summary-card">
          <div class="label">PICKED QTY (Barcode)</div>
          <div class="value">${summary.pickedQty}</div>
        </div>
        <div class="summary-card">
          <div class="label">PROGRESS</div>
          <div class="value">${escapeHtml(formatPercent(summary.progressPercent))}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 34px;">No</th>
            <th style="width: 70px;">Tanggal</th>
            <th class="left" style="width: 116px;">Nama Customer</th>
            <th class="left" style="width: 90px;">DO Number</th>
            <th class="left" style="width: 110px;">Destination</th>
            <th style="width: 60px;">Volume</th>
            <th style="width: 110px;">PL Time Release</th>
            <th style="width: 62px;">Pick Qty</th>
            <th style="width: 62px;">Picked</th>
            <th style="width: 62px;">Remain</th>
            <th style="width: 68px;">Progress</th>
            <th class="left" style="width: 90px;">Nama Karyawan</th>
            <th style="width: 85px;">Time Remaining</th>
            <th style="width: 95px;">Start Time</th>
            <th style="width: 95px;">Finish Time</th>
            <th style="width: 70px;">Status</th>
            <th class="left" style="width: 140px;">Keterangan Batal</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    </div>
  </body>
</html>`
}

let successTimer: number | undefined
const showSuccess = (message: string) => {
  success.value = message
  if (successTimer) window.clearTimeout(successTimer)
  successTimer = window.setTimeout(() => {
    success.value = null
  }, 3000)
}

const parsePositiveInt = (value: unknown, fallback: number) => {
  const asNumber =
    typeof value === 'string'
      ? Number(value)
      : Array.isArray(value) && value.length > 0
        ? Number(value[0])
        : Number(value)
  if (!Number.isFinite(asNumber) || asNumber < 1) return fallback
  return Math.floor(asNumber)
}

const isPickingSortField = (value: unknown): value is PickingSortField => {
  return typeof value === 'string' && SORTABLE_COLUMNS.includes(value as PickingSortField)
}

const normalizeSortDir = (value: unknown): 'asc' | 'desc' | null => {
  if (typeof value !== 'string') return null
  const lowered = value.toLowerCase()
  if (lowered === 'asc' || lowered === 'desc') return lowered
  return null
}

const applyInitialRouteQuery = () => {
  if (typeof route.query.dateFrom === 'string' && route.query.dateFrom) {
    filters.dateFrom = route.query.dateFrom
  }
  if (typeof route.query.dateTo === 'string' && route.query.dateTo) {
    filters.dateTo = route.query.dateTo
  }
  if (typeof route.query.date === 'string' && route.query.date) {
    // Backward compatibility from old single-date query.
    filters.dateFrom = route.query.date
    filters.dateTo = route.query.date
  }
  if (typeof route.query.status === 'string' && route.query.status) {
    filters.status = route.query.status
  }
  filters.search = parseSearchQuery(route.query.search)
  page.value = parsePositiveInt(route.query.page, 1)
  const nextLimit = parsePositiveInt(route.query.limit, 15)
  limit.value = [15, 30, 50, 100].includes(nextLimit) ? nextLimit : 15
  if (isPickingSortField(route.query.sort)) {
    sortBy.value = route.query.sort
  }
  const parsedSortDir = normalizeSortDir(route.query.sortDir)
  if (parsedSortDir) {
    sortDir.value = parsedSortDir
  }
}

const syncQueryToRoute = () => {
  const nextQuery: Record<string, string> = {}
  if (filters.dateFrom) nextQuery.dateFrom = filters.dateFrom
  if (filters.dateTo) nextQuery.dateTo = filters.dateTo
  if (filters.status && filters.status !== 'ALL') nextQuery.status = filters.status
  if (filters.search) nextQuery.search = filters.search
  nextQuery.page = String(page.value)
  nextQuery.limit = String(limit.value)
  nextQuery.sort = sortBy.value
  nextQuery.sortDir = sortDir.value
  router.replace({ path: '/picking-progress', query: nextQuery })
}

const fetchList = async () => {
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    error.value = 'Tanggal mulai tidak boleh lebih besar dari tanggal akhir'
    return
  }
  loading.value = true
  error.value = null
  try {
    const response = await listPickingProgress({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      status: filters.status as any,
      search: filters.search || undefined,
      page: page.value,
      limit: limit.value,
      sort: sortBy.value,
      sortDir: sortDir.value,
    })
    entries.value = response.data?.items || []
    const serverCounts = response.data?.meta?.statusCounts || {}
    statusCounts.value = {
      MENUNGGU: Number(serverCounts.MENUNGGU || 0),
      ON_PROCESS: Number(serverCounts.ON_PROCESS || 0),
      SELESAI: Number(serverCounts.SELESAI || 0),
      BATAL: Number(serverCounts.BATAL || 0),
    }
    totalItems.value = response.data?.meta?.total || 0
    totalPages.value = response.data?.meta?.totalPages || 1
    page.value = response.data?.meta?.page || page.value
    limit.value = response.data?.meta?.limit || limit.value
    syncQueryToRoute()
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal memuat picking progress')
  } finally {
    loading.value = false
  }
}

const fetchCustomers = async () => {
  try {
    const response = await api.get('/customers')
    customers.value = response.data?.data || []
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal mengambil customer')
  }
}

const fetchEmployees = async () => {
  try {
    const response = await listEmployees()
    employees.value = response.data?.data || []
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal mengambil data karyawan')
  }
}

const openDetailById = async (id: string) => {
  drawerOpen.value = true
  try {
    const response = await getPickingProgressById(id)
    selectedEntry.value = response.data?.data || null
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal mengambil detail')
  }
}

const handleCreate = async (payload: {
  date: string
  customerId: string
  doNumber: string
  destination: string
  volumeCbm: number
  plTimeRelease: string
  pickingQty: number
}) => {
  createSubmitting.value = true
  error.value = null
  try {
    await createPickingProgress(payload)
    createOpen.value = false
    await fetchList()
    showSuccess('Transaksi picking berhasil ditambahkan')
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal menambah transaksi picking')
  } finally {
    createSubmitting.value = false
  }
}

const openEdit = (entry: PickingProgressEntry) => {
  editingEntry.value = entry
  editOpen.value = true
}

const closeEdit = () => {
  editOpen.value = false
  editingEntry.value = null
}

const handleEdit = async (payload: {
  date: string
  customerId: string
  doNumber: string
  destination: string
  volumeCbm: number
  plTimeRelease: string
  pickingQty: number
}) => {
  if (!editingEntry.value) return
  editSubmitting.value = true
  error.value = null
  try {
    await updatePickingProgress(editingEntry.value.id, payload)
    const updatedId = editingEntry.value.id
    closeEdit()
    await fetchList()
    await refreshDetailIfOpen(updatedId)
    showSuccess('Transaksi picking berhasil diupdate')
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal update transaksi picking')
  } finally {
    editSubmitting.value = false
  }
}

const openPickedQtyModal = (entry: PickingProgressEntry) => {
  pendingPickedQtyEntry.value = entry
  pickedQtyInput.value = String(entry.pickedQty)
  pickedQtySubmitError.value = ''
  pickedQtyModalOpen.value = true
}

const closePickedQtyModal = () => {
  pickedQtyModalOpen.value = false
  pendingPickedQtyEntry.value = null
  pickedQtyInput.value = ''
  pickedQtySubmitting.value = false
  pickedQtySubmitError.value = ''
}

const getPickedQtyInputText = () => {
  const value = pickedQtyInput.value
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const pickedQtyValidationError = computed(() => {
  if (!pickedQtyModalOpen.value) return ''
  const entry = pendingPickedQtyEntry.value
  if (!entry) return 'Data picking tidak ditemukan'
  const rawValue = getPickedQtyInputText()
  if (!rawValue) return 'Jumlah picked qty wajib diisi'
  if (!/^\d+$/.test(rawValue)) return 'Input hanya angka'

  const value = Number(rawValue)
  if (!Number.isInteger(value) || value < 0) return 'Input hanya angka'
  if (value > entry.pickingQty) {
    return 'Jumlah yang dimasukan melebihi Jumlah Barcode yang di Picking'
  }
  return ''
})

const withActionLoading = async (id: string, fn: () => Promise<void>) => {
  actionLoading.value[id] = true
  try {
    await fn()
  } finally {
    actionLoading.value[id] = false
  }
}

const refreshDetailIfOpen = async (id: string) => {
  if (!drawerOpen.value || selectedEntry.value?.id !== id) return
  await openDetailById(id)
}

const requestStart = (entry: PickingProgressEntry) => {
  pendingStartEntry.value = entry
  selectedPickerEmployeeId.value = ''
  startConfirmOpen.value = true
}

const executeStart = async () => {
  const entry = pendingStartEntry.value
  if (!entry) return
  if (!selectedPickerEmployeeId.value) {
    error.value = 'Nama karyawan wajib dipilih sebelum start'
    return
  }

  await withActionLoading(entry.id, async () => {
    try {
      await startPickingProgress(entry.id, selectedPickerEmployeeId.value)
      closeStartConfirm()
      await fetchList()
      await refreshDetailIfOpen(entry.id)
      showSuccess('Picking berhasil dimulai')
    } catch (err: any) {
      error.value = getErrorMessage(err, 'Gagal start picking')
    }
  })
}

const closeStartConfirm = () => {
  startConfirmOpen.value = false
  pendingStartEntry.value = null
  selectedPickerEmployeeId.value = ''
}

const submitPickedQty = async () => {
  const entry = pendingPickedQtyEntry.value
  if (!entry) {
    pickedQtySubmitError.value = 'Data picking tidak ditemukan'
    return
  }
  pickedQtySubmitError.value = ''
  if (pickedQtyValidationError.value) {
    pickedQtySubmitError.value = pickedQtyValidationError.value
    return
  }

  const nextPickedQty = Number(getPickedQtyInputText())
  const latestEntry = entries.value.find((item) => item.id === entry.id) || entry
  const delta = nextPickedQty - latestEntry.pickedQty
  if (delta === 0) {
    closePickedQtyModal()
    showSuccess('Tidak ada perubahan pada Picked Qty')
    return
  }

  pickedQtySubmitting.value = true
  await withActionLoading(entry.id, async () => {
    try {
      await updatePickingPickedQty(entry.id, delta)
      closePickedQtyModal()
      await fetchList()
      await refreshDetailIfOpen(entry.id)
      showSuccess('Picked Qty berhasil diperbarui')
    } catch (err: any) {
      const message = getErrorMessage(err, 'Gagal update picked qty')
      error.value = message
      pickedQtySubmitError.value = message
    } finally {
      pickedQtySubmitting.value = false
    }
  })
}

const handlePickedQtySaveClick = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  submitPickedQty()
}

const fillPickedQtyMax = () => {
  const entry = pendingPickedQtyEntry.value
  if (!entry) return
  pickedQtyInput.value = String(Math.max(0, Number(entry.pickingQty || 0)))
  pickedQtySubmitError.value = ''
}

const executeFinish = async (entry: PickingProgressEntry) => {
  await withActionLoading(entry.id, async () => {
    try {
      await finishPickingProgress(entry.id)
      closeFinishConfirm()
      await fetchList()
      await refreshDetailIfOpen(entry.id)
      showSuccess('Picking selesai')
    } catch (err: any) {
      error.value = getErrorMessage(err, 'Gagal finish picking')
    }
  })
}

const requestFinish = (entry: PickingProgressEntry) => {
  if (entry.pickedQty !== entry.pickingQty) {
    error.value = 'Picked Qty harus sama dengan Picking Qty sebelum Finish'
    return
  }
  pendingFinishEntry.value = entry
  finishConfirmOpen.value = true
}

const closeFinishConfirm = () => {
  finishConfirmOpen.value = false
  pendingFinishEntry.value = null
}

const getCancelReasonText = () => {
  return String(cancelReason.value || '').trim()
}

const closeCancelConfirm = () => {
  cancelConfirmOpen.value = false
  pendingCancelEntry.value = null
  cancelReason.value = ''
  cancelReasonError.value = ''
}

const executeCancel = async (entry: PickingProgressEntry) => {
  const reason = getCancelReasonText()
  if (!reason) {
    cancelReasonError.value = 'Alasan cancel wajib diisi'
    return
  }

  await withActionLoading(entry.id, async () => {
    try {
      await cancelPickingProgress(entry.id, reason)
      closeCancelConfirm()
      await fetchList()
      await refreshDetailIfOpen(entry.id)
      showSuccess('Transaksi picking dibatalkan')
    } catch (err: any) {
      const message = getErrorMessage(err, 'Gagal cancel picking')
      error.value = message
      cancelReasonError.value = message
    }
  })
}

const requestCancel = (entry: PickingProgressEntry) => {
  pendingCancelEntry.value = entry
  cancelReason.value = ''
  cancelReasonError.value = ''
  cancelConfirmOpen.value = true
}

const closeDrawer = () => {
  drawerOpen.value = false
  selectedEntry.value = null
}

const handleWhNotesSaved = async (entryId: string) => {
  await openDetailById(entryId)
  await fetchList()
}

const paginationItems = computed(() => {
  const total = totalPages.value
  const current = page.value
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const items: Array<number | string> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) items.push('...')
  for (let i = start; i <= end; i++) items.push(i)
  if (end < total - 1) items.push('...')
  items.push(total)
  return items
})

const formatEmployeeLabel = (employee?: Employee | null) => {
  if (!employee) return ''
  const nik = String(employee.nik || '').trim()
  return nik ? `${employee.name} (${nik})` : employee.name
}

const startEmployeeOptions = computed(() =>
  employees.value.map((employee) => ({
    value: employee.id,
    label: formatEmployeeLabel(employee),
  }))
)

const toggleSort = (column: PickingSortField) => {
  if (!isPickingSortField(column)) return
  if (sortBy.value !== column) {
    sortBy.value = column
    sortDir.value = 'asc'
  } else {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  }
  page.value = 1
  fetchList()
}

const goToPage = (target: number) => {
  if (target < 1 || target > totalPages.value || target === page.value) return
  page.value = target
  fetchList()
}

const buildExportFileName = () => {
  if (exportForm.dateFrom && exportForm.dateTo) {
    return `picking_progress_${exportForm.dateFrom}_sampai_${exportForm.dateTo}.xlsx`
  }
  return 'picking_progress.xlsx'
}

const closeExport = () => {
  exportOpen.value = false
  exportError.value = null
}

const openDatePicker = (input: HTMLInputElement | null) => {
  if (!input) return
  const pickerInput = input as HTMLInputElement & { showPicker?: () => void }
  if (typeof pickerInput.showPicker === 'function') {
    pickerInput.showPicker()
  } else {
    input.focus()
    input.click()
  }
}

const handleExportDownload = async () => {
  exportError.value = null
  const hasFrom = Boolean(exportForm.dateFrom)
  const hasTo = Boolean(exportForm.dateTo)
  if (hasFrom !== hasTo) {
    exportError.value = 'Tanggal Dari & Sampai harus diisi bersama'
    return
  }

  exporting.value = true
  try {
    const response = await exportPickingProgress(
      hasFrom && hasTo ? { dateFrom: exportForm.dateFrom, dateTo: exportForm.dateTo } : undefined
    )
    const downloadUrl = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = buildExportFileName()
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)

    exportOpen.value = false
    exportForm.dateFrom = ''
    exportForm.dateTo = ''
  } catch (err: any) {
    exportError.value = getErrorMessage(err, 'Gagal export excel')
  } finally {
    exporting.value = false
  }
}

const handlePrintPickingProgress = async () => {
  printError.value = null
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    printError.value = 'Tanggal mulai tidak boleh lebih besar dari tanggal akhir'
    return
  }

  printing.value = true
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    printError.value = 'Popup print diblokir browser. Izinkan popup lalu coba lagi.'
    printing.value = false
    return
  }

  printWindow.document.open()
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Menyiapkan Print...</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #111; }
          .muted { color: #666; }
        </style>
      </head>
      <body>
        <h3>Menyiapkan Print...</h3>
        <p class="muted">Mohon tunggu, data picking progress sedang diproses.</p>
      </body>
    </html>
  `)
  printWindow.document.close()

  try {
    const response = await printPickingProgressSummary({
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      status: filters.status as any,
      search: filters.search.trim() || undefined,
      sort: sortBy.value,
      sortDir: sortDir.value,
    })
    const payload = response.data?.data || {}
    const html = buildPickingPrintHtml({
      dateFrom: payload.dateFrom || filters.dateFrom,
      dateTo: payload.dateTo || filters.dateTo,
      status: payload.status || filters.status,
      search: payload.search || filters.search,
      summary: payload.summary as PickingPrintSummary,
      rows: (payload.rows || []) as PickingProgressEntry[],
    })

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => {
      printWindow.print()
    }, 300)
  } catch (err: any) {
    printError.value = getErrorMessage(err, 'Gagal menyiapkan print picking progress')
    printWindow.document.open()
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Gagal Print</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #111; }
            .error { color: #b91c1c; }
          </style>
        </head>
        <body>
          <h3 class="error">Gagal menyiapkan print</h3>
          <p>${escapeHtml(printError.value || 'Terjadi kesalahan')}</p>
        </body>
      </html>
    `)
    printWindow.document.close()
  } finally {
    printing.value = false
  }
}

const handleImportFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  importFile.value = target.files?.[0] || null
}

const resetImportFile = () => {
  importFile.value = null
  if (importFileInput.value) {
    importFileInput.value.value = ''
  }
}

const handleDownloadImportTemplate = async () => {
  try {
    const response = await downloadPickingProgressTemplate()
    const blob = new Blob([response.data], { type: response.headers['content-type'] })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = 'picking-progress-import-template.xlsx'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal download template')
  }
}

const handleImportExcel = async () => {
  if (!importFile.value) {
    error.value = 'File Excel wajib dipilih'
    return
  }

  importing.value = true
  error.value = null
  try {
    const response = await importPickingProgressExcel(importFile.value)
    const result = response.data?.data || {}
    const totalRows = Number(result.totalRows || 0)
    const successRows = Number(result.successRows || 0)
    const failedRows = Number(result.failedRows || 0)
    const importErrors = Array.isArray(result.errors) ? result.errors : []
    const importedDates = Array.isArray(result.importedDates)
      ? result.importedDates.map((value: unknown) => String(value || '')).filter(Boolean)
      : []
    let switchedToDate = ''

    if (successRows > 0) {
      if (filters.search) {
        filters.search = ''
      }
      if (importedDates.length > 0) {
        const importedDate = importedDates[0]
        const isInCurrentRange =
          (!filters.dateFrom || importedDate >= filters.dateFrom) &&
          (!filters.dateTo || importedDate <= filters.dateTo)
        if (!isInCurrentRange) {
          filters.dateFrom = shiftDateString(importedDate, -3)
          filters.dateTo = shiftDateString(importedDate, 3)
          switchedToDate = importedDate
        }
      }
    }

    await fetchList()
    resetImportFile()

    showSuccess(
      switchedToDate
        ? `Import selesai: ${successRows}/${totalRows} baris berhasil. Rentang tanggal otomatis disesuaikan (hingga ${switchedToDate}).`
        : `Import selesai: ${successRows}/${totalRows} baris berhasil`
    )
    if (failedRows > 0) {
      const firstError = importErrors[0]
      const firstErrorMessage =
        firstError?.rowNumber && firstError?.message
          ? `Baris ${firstError.rowNumber}: ${firstError.message}`
          : 'Periksa isi file template'
      error.value = `Terdapat ${failedRows} baris gagal diimport. ${firstErrorMessage}`
    }
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal import picking progress')
  } finally {
    importing.value = false
  }
}

let searchTimer: number | undefined
watch(
  () => [filters.dateFrom, filters.dateTo, filters.status],
  () => {
    page.value = 1
    fetchList()
  }
)

watch(
  () => filters.search,
  () => {
    if (searchTimer) window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => {
      page.value = 1
      fetchList()
    }, 400)
  }
)

watch(
  () => limit.value,
  () => {
    page.value = 1
    fetchList()
  }
)

watch(
  () => route.query.search,
  (value) => {
    const nextSearch = parseSearchQuery(value)
    if (filters.search !== nextSearch) {
      filters.search = nextSearch
    }
  }
)

let refreshTimer: number | undefined
onMounted(() => {
  applyInitialRouteQuery()
  fetchCustomers()
  fetchEmployees()
  fetchList()
  refreshTimer = window.setInterval(() => {
    fetchList()
  }, 30000)
})

onUnmounted(() => {
  if (searchTimer) window.clearTimeout(searchTimer)
  if (successTimer) window.clearTimeout(successTimer)
  if (refreshTimer) window.clearInterval(refreshTimer)
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Picking Progress</h1>
        <p class="text-muted-foreground">Monitoring progress picking</p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          class="border-blue-200 bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
          :disabled="printing"
          @click="handlePrintPickingProgress"
        >
          {{ printing ? 'Menyiapkan...' : 'Print Out' }}
        </Button>
        <Button size="sm" variant="outline" @click="exportOpen = true">Export Excel</Button>
        <Button v-if="!isWarehouse" size="sm" @click="createOpen = true">Tambah Transaksi</Button>
        <Button size="sm" variant="outline" @click="fetchList">
          <RefreshCw class="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
    </div>

    <Card v-if="!isWarehouse">
      <CardHeader>
        <div class="text-sm text-muted-foreground">Upload File Excel (.xlsx)</div>
      </CardHeader>
      <CardContent>
        <div class="flex flex-col gap-3 md:flex-row md:items-end">
          <div class="flex-1">
            <label class="text-sm text-muted-foreground">File Excel</label>
            <input
              ref="importFileInput"
              type="file"
              accept=".xlsx"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
              @change="handleImportFileChange"
            />
            <p class="mt-1 text-xs text-muted-foreground">
              Header kolom: Tanggal, Customer Name, DO Number, Destination, Volume (CBM), Picking Qty (Barcode).
              PL Time Release otomatis: tanggal mengikuti kolom Tanggal, jam mengikuti waktu upload file.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="text-sm text-primary underline-offset-4 hover:underline"
              @click="handleDownloadImportTemplate"
            >
              Download Template
            </button>
            <Button size="sm" :disabled="importing" @click="handleImportExcel">
              {{ importing ? 'Importing...' : 'Import' }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <div class="mx-auto w-full max-w-4xl">
      <div class="grid gap-3 md:grid-cols-4">
        <div
          v-for="(item, index) in statusSequenceItems"
          :key="item.key"
          class="relative"
        >
          <button
            type="button"
            class="w-full rounded-xl border px-4 py-3 text-left transition hover:shadow-sm"
            :class="[
              getSequenceCardClass(item.key),
              isSequenceStatusActive(item.key) ? 'ring-2 ring-primary/40 border-primary' : '',
            ]"
            @click="toggleSequenceStatus(item.key)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-semibold">{{ item.label }}</span>
              <span
                class="inline-flex min-w-8 items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold"
                :class="getSequenceBubbleClass(item.key)"
              >
                {{ statusCounts[item.key] }}
              </span>
            </div>
          </button>
          <span
            v-if="index < statusSequenceItems.length - 1"
            class="pointer-events-none absolute left-full top-1/2 hidden h-0.5 w-3 -translate-y-1/2 bg-border md:block"
          ></span>
        </div>
      </div>
    </div>

    <Card>
      <CardHeader>
        <div class="grid gap-3 md:grid-cols-4">
          <div class="relative">
            <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              v-model="filters.search"
              type="text"
              placeholder="Search semua kolom..."
              class="pl-9"
            />
          </div>
          <div>
            <Combobox
              v-model="filters.status"
              :options="statusOptions"
              placeholder="Pilih status..."
              search-placeholder="Cari status..."
              empty-text="Status tidak ditemukan"
            />
          </div>
          <div>
            <div class="grid grid-cols-2 gap-2">
              <div class="relative">
                <input
                  ref="filterDateFromInputRef"
                  v-model="filters.dateFrom"
                  type="date"
                  class="w-full appearance-none bg-transparent border rounded-md px-2 py-2 pr-10 text-sm"
                  title="Tanggal mulai"
                  @click="openDatePicker(filterDateFromInputRef)"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 inline-flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label="Pilih tanggal mulai"
                  @click="openDatePicker(filterDateFromInputRef)"
                >
                  <CalendarDays class="h-4 w-4" />
                </button>
              </div>
              <div class="relative">
                <input
                  ref="filterDateToInputRef"
                  v-model="filters.dateTo"
                  type="date"
                  class="w-full appearance-none bg-transparent border rounded-md px-2 py-2 pr-10 text-sm"
                  title="Tanggal akhir"
                  @click="openDatePicker(filterDateToInputRef)"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 inline-flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label="Pilih tanggal akhir"
                  @click="openDatePicker(filterDateToInputRef)"
                >
                  <CalendarDays class="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <div class="text-xs text-muted-foreground flex items-center">
            SLA per barcode: <span class="font-semibold ml-1">2.5 menit</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div v-if="error" class="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ error }}
        </div>
        <div v-if="printError" class="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ printError }}
        </div>
        <div v-if="success" class="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {{ success }}
        </div>

        <PickingTable
          :entries="entries"
          :loading="loading"
          :page="page"
          :limit="limit"
          :sort-by="sortBy"
          :sort-dir="sortDir"
          :can-cancel="!isWarehouse"
          :can-edit="!isWarehouse"
          @edit="openEdit"
          @start="requestStart"
          @input-picked="openPickedQtyModal"
          @finish="requestFinish"
          @cancel="requestCancel"
          @detail="openDetailById($event.id)"
          @toggle-sort="toggleSort"
        />

        <div class="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="flex items-center gap-2 text-sm">
            <span class="text-muted-foreground">Rows:</span>
            <select v-model.number="limit" class="bg-transparent border rounded-md px-2 py-1 text-sm">
              <option :value="15">15</option>
              <option :value="30">30</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
            <span class="text-muted-foreground">Total: {{ totalItems }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-1">
            <Button size="sm" variant="outline" :disabled="page === 1" @click="goToPage(page - 1)">
              Prev
            </Button>
            <template v-for="(item, idx) in paginationItems" :key="`${item}-${idx}`">
              <span v-if="item === '...'" class="px-2 text-muted-foreground">...</span>
              <Button
                v-else
                size="sm"
                :variant="item === page ? 'default' : 'ghost'"
                @click="goToPage(Number(item))"
              >
                {{ item }}
              </Button>
            </template>
            <Button size="sm" variant="outline" :disabled="page === totalPages" @click="goToPage(page + 1)">
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <PickingCreateModal
      :open="createOpen"
      :submitting="createSubmitting"
      :customers="customers"
      @close="createOpen = false"
      @submit="handleCreate"
    />

    <PickingEditModal
      :open="editOpen"
      :submitting="editSubmitting"
      :customers="customers"
      :entry="editingEntry"
      @close="closeEdit"
      @submit="handleEdit"
    />

    <PickingDetailDrawer
      :open="drawerOpen"
      :entry="selectedEntry"
      @close="closeDrawer"
      @wh-notes-saved="handleWhNotesSaved"
    />

    <div v-if="exportOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeExport"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Export Excel</h3>
        </div>
        <div class="p-4 space-y-3 text-sm">
          <div>
            <label class="text-sm text-muted-foreground">Tanggal Dari</label>
            <div class="relative mt-1">
              <input
                ref="exportDateFromInputRef"
                v-model="exportForm.dateFrom"
                type="date"
                class="w-full appearance-none bg-transparent border rounded-md px-2 py-2 pr-10 text-sm"
                @click="openDatePicker(exportDateFromInputRef)"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 inline-flex items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label="Pilih tanggal export dari"
                @click="openDatePicker(exportDateFromInputRef)"
              >
                <CalendarDays class="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Tanggal Sampai</label>
            <div class="relative mt-1">
              <input
                ref="exportDateToInputRef"
                v-model="exportForm.dateTo"
                type="date"
                class="w-full appearance-none bg-transparent border rounded-md px-2 py-2 pr-10 text-sm"
                @click="openDatePicker(exportDateToInputRef)"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 inline-flex items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label="Pilih tanggal export sampai"
                @click="openDatePicker(exportDateToInputRef)"
              >
                <CalendarDays class="h-4 w-4" />
              </button>
            </div>
          </div>
          <p class="text-xs text-muted-foreground">Kosongkan tanggal untuk export semua data.</p>
          <p v-if="exportError" class="text-xs text-red-600">{{ exportError }}</p>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeExport">Batal</Button>
          <Button :disabled="exporting" @click="handleExportDownload">
            {{ exporting ? 'Downloading...' : 'Download' }}
          </Button>
        </div>
      </div>
    </div>

    <div v-if="pickedQtyModalOpen" class="fixed inset-0 z-[70] pointer-events-none">
      <div class="absolute inset-0 z-0 bg-black/40 pointer-events-auto" @click="closePickedQtyModal"></div>
      <form
        novalidate
        class="absolute left-1/2 top-1/2 z-10 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border pointer-events-auto"
        @submit.prevent="submitPickedQty"
      >
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Input Picked Qty</h3>
        </div>
        <div class="p-4 space-y-3 text-sm">
          <p>
            Masukkan jumlah yang sudah terpicking untuk DO
            <span class="font-semibold">{{ pendingPickedQtyEntry?.doNumber }}</span>.
          </p>
          <p class="text-muted-foreground">
            Maksimal: <span class="font-semibold">{{ pendingPickedQtyEntry?.pickingQty ?? 0 }}</span>
          </p>
          <div>
            <label class="text-sm text-muted-foreground">Jumlah Picked Qty</label>
            <input
              v-model="pickedQtyInput"
              type="number"
              min="0"
              :max="pendingPickedQtyEntry?.pickingQty ?? 0"
              step="1"
              inputmode="numeric"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
              @input="pickedQtySubmitError = ''"
              @keydown.enter.prevent="submitPickedQty"
            />
            <p v-if="pickedQtyValidationError" class="mt-1 text-xs text-red-600">
              {{ pickedQtyValidationError }}
            </p>
            <p v-else-if="pickedQtySubmitError" class="mt-1 text-xs text-red-600">
              {{ pickedQtySubmitError }}
            </p>
          </div>
        </div>
        <div class="p-4 border-t flex items-center justify-between gap-2">
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            :disabled="!pendingPickedQtyEntry || pickedQtySubmitting"
            @click="fillPickedQtyMax"
          >
            Isi Maksimal
          </button>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              @click="closePickedQtyModal"
            >
              Batal
            </button>
            <button
              type="button"
              class="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              :disabled="Boolean(pickedQtyValidationError) || !pendingPickedQtyEntry || pickedQtySubmitting"
              @click="handlePickedQtySaveClick"
              @mousedown.stop
            >
              {{ pickedQtySubmitting ? 'Menyimpan...' : 'Simpan' }}
            </button>
          </div>
        </div>
      </form>
    </div>

    <div v-if="startConfirmOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeStartConfirm"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Start Picking</h3>
        </div>
        <div class="p-4 space-y-3 text-sm">
          <p>
            Pilih nama karyawan untuk transaksi
            <span class="font-semibold">{{ pendingStartEntry?.doNumber }}</span>.
          </p>
          <div>
            <label class="text-sm text-muted-foreground">Nama Karyawan</label>
            <div class="mt-1">
              <Combobox
                v-model="selectedPickerEmployeeId"
                :options="startEmployeeOptions"
                placeholder="Pilih karyawan..."
                search-placeholder="Cari nama / NIK..."
                empty-text="Karyawan tidak ditemukan"
              />
            </div>
          </div>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeStartConfirm">Batal</Button>
          <Button :disabled="!selectedPickerEmployeeId" @click="executeStart">Start</Button>
        </div>
      </div>
    </div>

    <div v-if="finishConfirmOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeFinishConfirm"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Konfirmasi Finish</h3>
        </div>
        <div class="p-4 text-sm">
          Selesaikan picking untuk DO
          <span class="font-semibold">{{ pendingFinishEntry?.doNumber }}</span>
          ?
          <div class="mt-1 text-muted-foreground">
            Picked Qty: {{ pendingFinishEntry?.pickedQty || 0 }}/{{ pendingFinishEntry?.pickingQty || 0 }}
          </div>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeFinishConfirm">Batal</Button>
          <Button :disabled="!pendingFinishEntry || actionLoading[pendingFinishEntry?.id || '']" @click="pendingFinishEntry && executeFinish(pendingFinishEntry)">
            {{ pendingFinishEntry && actionLoading[pendingFinishEntry.id] ? 'Memproses...' : 'Ya, Finish' }}
          </Button>
        </div>
      </div>
    </div>

    <div v-if="cancelConfirmOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeCancelConfirm"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Konfirmasi Cancel</h3>
        </div>
        <div class="p-4 space-y-3 text-sm">
          Batalkan transaksi picking untuk container
          <span class="font-semibold">{{ pendingCancelEntry?.doNumber }}</span>
          ?
          <div>
            <label class="text-sm text-muted-foreground">Alasan Cancel</label>
            <textarea
              v-model="cancelReason"
              rows="3"
              class="mt-1 w-full resize-none bg-transparent border rounded-md px-2 py-2 text-sm"
              placeholder="Tulis alasan pembatalan..."
              @input="cancelReasonError = ''"
            ></textarea>
            <p v-if="cancelReasonError" class="mt-1 text-xs text-red-600">{{ cancelReasonError }}</p>
          </div>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeCancelConfirm">Batal</Button>
          <Button
            variant="outline"
            class="border-red-200 bg-red-600 text-white hover:bg-red-700 hover:text-white"
            :disabled="!getCancelReasonText() || actionLoading[pendingCancelEntry?.id || '']"
            @click="pendingCancelEntry && executeCancel(pendingCancelEntry)"
          >
            {{ pendingCancelEntry && actionLoading[pendingCancelEntry.id] ? 'Memproses...' : 'Ya, Cancel' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

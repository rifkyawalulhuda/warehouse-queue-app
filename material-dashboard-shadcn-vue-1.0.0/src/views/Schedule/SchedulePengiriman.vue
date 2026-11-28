<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import Combobox from '@/components/ui/Combobox.vue'
import Input from '@/components/ui/Input.vue'
import { CalendarDays, RefreshCw, Search, Upload, Download, X, History } from 'lucide-vue-next'
import api from '@/services/api'
import ExportDialog from '@/components/export/ExportDialog.vue'
import { formatDateId, formatDateTimeId } from '@/lib/datetime'
import {
  getTransporters,
  closeNoShowItem,
  importScheduleExcel,
  downloadScheduleImportTemplate,
  getScheduleImportLogs,
  type Transporter,
  type ScheduleImportResult,
  type ScheduleImportLog,
} from '@/services/scheduleApi'

type StoreType = 'STORE_IN' | 'STORE_OUT'
type TruckType = 'CDD' | 'CDE' | 'FUSO' | 'WB' | 'FT20' | 'FT40' | 'OTHER'

type Customer = {
  id: string
  name: string
}

type ScheduleListItem = {
  id: string
  scheduleDate: string
  storeType: StoreType
  customer: Customer | null
  totalTypes: number
  totalTrucks: number
  createdAt: string
  updatedAt: string
}

type ScheduleItemStatus = 'PLANNED' | 'LINKED' | 'NO_SHOW' | 'NO_SHOW_CLOSED'

type ScheduleItem = {
  id: string
  scheduleId: string
  truckType: TruckType
  truckTypeOther?: string | null
  plateNumber?: string | null
  plannedStart?: string | null
  plannedFinish?: string | null
  transporterId?: string | null
  transporter?: { id: string; name: string } | null
  driverName?: string | null
  containerNumbers?: string[]
  status?: ScheduleItemStatus
  queueEntries?: { id: string; status: string }[]
  createdAt: string
}

type ScheduleDetail = {
  id: string
  scheduleDate: string
  storeType: StoreType
  customerId: string
  customer: Customer | null
  items: ScheduleItem[]
  createdAt: string
  updatedAt: string
}

type FormItem = {
  key: number
  id: string | null
  truckType: TruckType | ''
  truckTypeOther: string
  plateNumber: string
  plannedStart: string
  plannedFinish: string
  transporterId: string
  driverName: string
  containerNumbers: string[]
  status?: ScheduleItemStatus
}

type PrintColumn = {
  key: TruckType
  label: string
}

type PrintRow = {
  customerName: string
  storeIn: Record<string, number>
  storeOut: Record<string, number>
}

const storeTypeOptions: Array<{ label: string; value: '' | StoreType }> = [
  { label: 'Semua', value: '' },
  { label: 'Store In', value: 'STORE_IN' },
  { label: 'Store Out', value: 'STORE_OUT' }
]

const truckTypeOptions: Array<{ label: string; value: TruckType }> = [
  { label: 'CDD', value: 'CDD' },
  { label: 'CDE', value: 'CDE' },
  { label: 'FUSO', value: 'FUSO' },
  { label: 'W/B', value: 'WB' },
  { label: '20 ft', value: 'FT20' },
  { label: '40 ft', value: 'FT40' },
  { label: 'Other', value: 'OTHER' }
]

const schedules = ref<ScheduleListItem[]>([])
const customers = ref<Customer[]>([])
const transporters = ref<Transporter[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const page = ref(1)
const limit = ref(15)
const totalPages = ref(1)
const totalItems = ref(0)
const rowLimitOptions = [
  { label: '15', value: '15' },
  { label: '30', value: '30' },
  { label: '50', value: '50' },
  { label: '100', value: '100' }
]
const rowLimitValue = computed({
  get: () => String(limit.value),
  set: (value: string) => {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      limit.value = parsed
    }
  }
})
const sortBy = ref<'scheduleDate' | 'storeType' | 'customerName' | 'createdAt'>('createdAt')
const sortDir = ref<'asc' | 'desc'>('desc')
const submitting = ref(false)
const deleting = ref(false)
const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<string | null>(null)
const formError = ref<string | null>(null)
const detailOpen = ref(false)
const detailLoading = ref(false)
const detailData = ref<ScheduleDetail | null>(null)
const confirmOpen = ref(false)
const confirmData = ref<ScheduleListItem | null>(null)
const confirmRemoveItemOpen = ref(false)
const confirmRemoveItemIndex = ref<number | null>(null)
const exportOpen = ref(false)
const printing = ref(false)
const printError = ref<string | null>(null)

// --- Import Excel (bulk Schedule Delivery & Receiving) ---
const importOpen = ref(false)
const importing = ref(false)
const importFile = ref<File | null>(null)
const importFileInput = ref<HTMLInputElement | null>(null)
const importResult = ref<ScheduleImportResult | null>(null)
const importErrors = ref<string[]>([])
const importError = ref<string | null>(null)
const importLogs = ref<ScheduleImportLog[]>([])
const importLogsOpen = ref(false)
const importLogsLoading = ref(false)
const filterDateInputRef = ref<HTMLInputElement | null>(null)
const formDateInputRef = ref<HTMLInputElement | null>(null)
const route = useRoute()
const { user } = useAuth()
const canManageSchedule = computed(() => user.value?.role === 'ADMIN' || user.value?.role === 'CS')

const filters = reactive({
  date: '',
  storeType: '' as '' | StoreType,
  search: ''
})

let itemKey = 1
const createEmptyItem = (): FormItem => ({
  key: itemKey++,
  id: null,
  truckType: '',
  truckTypeOther: '',
  plateNumber: '',
  plannedStart: '',
  plannedFinish: '',
  transporterId: '',
  driverName: '',
  containerNumbers: ['']
})

const form = reactive({
  scheduleDate: '',
  storeType: 'STORE_IN' as StoreType,
  customerId: '',
  items: [createEmptyItem()] as FormItem[]
})

const storeTypeFilterOptions = computed(() =>
  storeTypeOptions.map((opt) => ({
    value: opt.value,
    label: opt.label,
  }))
)

const customerOptions = computed(() =>
  customers.value.map((customer) => ({
    value: customer.id,
    label: customer.name,
  }))
)

const truckTypeComboboxOptions = computed(() =>
  truckTypeOptions.map((opt) => ({
    value: opt.value,
    label: opt.label,
  }))
)

const transporterOptions = computed(() =>
  transporters.value.map((item) => ({
    value: item.id,
    label: item.name,
  }))
)

const statusLabels: Record<ScheduleItemStatus, string> = {
  PLANNED: 'Planned',
  LINKED: 'Sudah Ada Antrian',
  NO_SHOW: 'No Show',
  NO_SHOW_CLOSED: 'No Show (Ditutup)',
}

const statusBadgeClass = (status?: ScheduleItemStatus) => {
  if (status === 'LINKED') return 'bg-emerald-100 text-emerald-800'
  if (status === 'NO_SHOW') return 'bg-amber-100 text-amber-800'
  if (status === 'NO_SHOW_CLOSED') return 'bg-rose-100 text-rose-800'
  return 'bg-slate-100 text-slate-700'
}

const formatClock = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const todayString = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const tomorrowString = () => {
  const now = new Date()
  now.setDate(now.getDate() + 1)
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const toDateInput = (value?: string | null) => {
  if (!value) return ''
  const raw = value.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const raw = toDateInput(value)
  if (!raw) return '-'
  return formatDateId(raw)
}

const formatDateTime = (value?: string | null) => formatDateTimeId(value)

const storeTypeLabel = (value?: string | null) => {
  if (value === 'STORE_IN') return 'Store In'
  if (value === 'STORE_OUT') return 'Store Out'
  return '-'
}

const truckTypeLabel = (item: Pick<ScheduleItem, 'truckType' | 'truckTypeOther'>) => {
  if (item.truckType === 'OTHER') {
    return item.truckTypeOther?.trim() ? `Other - ${item.truckTypeOther}` : 'Other'
  }
  const found = truckTypeOptions.find((opt) => opt.value === item.truckType)
  return found?.label || item.truckType
}

const formTruckTypeLabel = (item: Pick<FormItem, 'truckType' | 'truckTypeOther'>) => {
  if (item.truckType === 'OTHER') {
    return item.truckTypeOther?.trim() ? `Other - ${item.truckTypeOther}` : 'Other'
  }
  if (!item.truckType) return '-'
  const found = truckTypeOptions.find((opt) => opt.value === item.truckType)
  return found?.label || item.truckType
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

const printDateLabel = (value?: string) => {
  const normalized = toDateInput(value)
  if (!normalized) return '-'
  return formatDate(normalized)
}

const buildPrintHtml = (payload: { date?: string | null; columns: PrintColumn[]; rows: PrintRow[] }) => {
  const columns = payload.columns || []
  const rows = payload.rows || []
  const columnHeaders = columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('')
  const bodyRows =
    rows.length > 0
      ? rows
          .map((row) => {
            const storeInCells = columns
              .map((col) => `<td>${row.storeIn?.[col.key] > 0 ? row.storeIn[col.key] : ''}</td>`)
              .join('')
            const storeOutCells = columns
              .map((col) => `<td>${row.storeOut?.[col.key] > 0 ? row.storeOut[col.key] : ''}</td>`)
              .join('')
            return `<tr><td class="left">${escapeHtml(row.customerName || '-')}</td>${storeInCells}${storeOutCells}</tr>`
          })
          .join('')
      : `<tr><td colspan="${columns.length * 2 + 1}" class="empty">Tidak ada data schedule.</td></tr>`

  const dateText = printDateLabel(payload.date || filters.date)
  const filterStoreTypeText = filters.storeType ? storeTypeLabel(filters.storeType) : 'Semua'
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Print Schedule Delivery & Receiving</title>
    <style>
      @page { size: A4 landscape; margin: 8mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; }
      .sheet { width: 100%; }
      .header { text-align: center; margin-bottom: 8px; }
      .header h1 { margin: 0; font-size: 20px; letter-spacing: 0.4px; }
      .header .subtitle { margin-top: 2px; font-size: 11px; }
      .header .meta { margin-top: 4px; display: flex; justify-content: space-between; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
      th, td { border: 1px solid #222; padding: 3px 4px; text-align: center; }
      thead th { background: #f2f2f2; font-weight: 700; }
      th.left, td.left { text-align: left; }
      tbody tr:nth-child(even) { background: #fafafa; }
      .customer-col { width: 240px; }
      .empty { text-align: center; color: #666; padding: 10px; }
      @media print {
        .sheet { page-break-after: auto; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="header">
        <h1>PT. SANKYU INDONESIA INTERNATIONAL</h1>
        <div class="subtitle">Schedule Delivery &amp; Receiving</div>
        <div class="meta">
          <span>Filter Store Type: ${escapeHtml(filterStoreTypeText)}</span>
          <span>Date: ${escapeHtml(dateText)}</span>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th rowspan="3" class="left customer-col">CUSTOMER</th>
            <th colspan="${columns.length}">STORE IN</th>
            <th colspan="${columns.length}">STORE OUT</th>
          </tr>
          <tr>
            <th colspan="${columns.length}">Type of Truck</th>
            <th colspan="${columns.length}">Type of Truck</th>
          </tr>
          <tr>
            ${columnHeaders}${columnHeaders}
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

const parseStoreTypeQuery = (value: unknown): '' | StoreType => {
  if (value === 'STORE_IN' || value === 'STORE_OUT') return value
  return ''
}

const parseSearchQuery = (value: unknown) => {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

const applyFiltersFromRoute = () => {
  const queryDate = typeof route.query.date === 'string' ? toDateInput(route.query.date) : ''
  const queryType = parseStoreTypeQuery(route.query.type)
  const querySearch = parseSearchQuery(route.query.search)

  filters.date = queryDate || todayString()
  filters.storeType = queryType
  filters.search = querySearch
}

const queryString = computed(() => {
  const params = new URLSearchParams()
  if (filters.date) params.set('date', filters.date)
  if (filters.storeType) params.set('storeType', filters.storeType)
  if (filters.search.trim()) params.set('search', filters.search.trim())
  params.set('page', String(page.value))
  params.set('limit', String(limit.value))
  params.set('sortBy', sortBy.value)
  params.set('sortDir', sortDir.value)
  return params.toString()
})

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

const fetchCustomers = async () => {
  try {
    const response = await api.get('/customers')
    customers.value = response.data?.data || []
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal mengambil customer')
  }
}

const fetchTransporters = async () => {
  try {
    const { data } = await getTransporters({ activeOnly: true } as any)
    transporters.value = data.data || []
  } catch {
    transporters.value = []
  }
}

const fetchList = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await api.get(`/schedules?${queryString.value}`)
    schedules.value = response.data?.data || []
    totalPages.value = response.data?.meta?.totalPages || 1
    totalItems.value = response.data?.meta?.total || response.data?.meta?.totalItems || 0
    page.value = response.data?.meta?.page || page.value
    limit.value = response.data?.meta?.limit || limit.value
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal mengambil schedule pengiriman')
  } finally {
    loading.value = false
  }
}

const fetchDetail = async (id: string) => {
  detailLoading.value = true
  try {
    const response = await api.get(`/schedules/${id}`)
    detailData.value = response.data?.data || null
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal mengambil detail schedule')
  } finally {
    detailLoading.value = false
  }
}

const openDetail = async (row: ScheduleListItem) => {
  detailOpen.value = true
  await fetchDetail(row.id)
}

const closeDetail = () => {
  detailOpen.value = false
  detailData.value = null
}

const closeNoShow = async (item: ScheduleItem) => {
  if (!detailData.value) return
  const confirmed = window.confirm(
    `Tutup jadwal ${item.plateNumber || '-'} sebagai No Show? Item ini tidak akan muncul lagi di pilihan Antrian Truk.`
  )
  if (!confirmed) return
  try {
    await closeNoShowItem(item.id)
    await fetchDetail(detailData.value.id)
    await fetchList()
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal menutup jadwal no show')
  }
}

const resetForm = () => {
  form.scheduleDate = ''
  form.storeType = 'STORE_IN'
  form.customerId = ''
  form.items = [createEmptyItem()]
  formError.value = null
}

const openCreate = () => {
  if (!canManageSchedule.value) return
  formMode.value = 'create'
  editingId.value = null
  resetForm()
  if (!form.scheduleDate) {
    form.scheduleDate = tomorrowString()
  }
  formOpen.value = true
}

const openEdit = async (row: ScheduleListItem) => {
  if (!canManageSchedule.value) return
  formMode.value = 'edit'
  editingId.value = row.id
  formError.value = null
  submitting.value = false

  try {
    const response = await api.get(`/schedules/${row.id}`)
    const data: ScheduleDetail | null = response.data?.data || null
    if (!data) {
      formError.value = 'Data schedule tidak ditemukan'
      return
    }
    form.scheduleDate = toDateInput(data.scheduleDate)
    form.storeType = data.storeType
    form.customerId = data.customerId
    form.items = (data.items || []).map((item) => ({
      key: itemKey++,
      id: item.id,
      truckType: item.truckType,
      truckTypeOther: item.truckTypeOther || '',
      plateNumber: item.plateNumber || '',
      plannedStart: formatClock(item.plannedStart) === '-' ? '' : formatClock(item.plannedStart),
      plannedFinish: formatClock(item.plannedFinish) === '-' ? '' : formatClock(item.plannedFinish),
      transporterId: item.transporterId || '',
      driverName: item.driverName || '',
      containerNumbers:
        item.containerNumbers && item.containerNumbers.length > 0 ? [...item.containerNumbers] : [''],
      status: item.status
    }))
    if (form.items.length === 0) {
      form.items = [createEmptyItem()]
    }
    formOpen.value = true
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal mengambil data untuk edit')
  }
}

const closeForm = () => {
  formOpen.value = false
  editingId.value = null
  confirmRemoveItemOpen.value = false
  confirmRemoveItemIndex.value = null
  formError.value = null
}

const addItem = () => {
  form.items.push(createEmptyItem())
}

const removeItem = (index: number) => {
  if (form.items.length <= 1) return
  form.items.splice(index, 1)
}

const requestRemoveItem = (index: number) => {
  if (form.items.length <= 1) return
  if (formMode.value !== 'edit') {
    removeItem(index)
    return
  }
  confirmRemoveItemIndex.value = index
  confirmRemoveItemOpen.value = true
}

const closeConfirmRemoveItem = () => {
  confirmRemoveItemOpen.value = false
  confirmRemoveItemIndex.value = null
}

const confirmRemoveItem = () => {
  const index = confirmRemoveItemIndex.value
  if (index === null) {
    closeConfirmRemoveItem()
    return
  }
  if (index < 0 || index >= form.items.length) {
    closeConfirmRemoveItem()
    return
  }
  removeItem(index)
  closeConfirmRemoveItem()
}

const onTruckTypeChange = (item: FormItem) => {
  if (item.truckType !== 'OTHER') {
    item.truckTypeOther = ''
  }
}

const onTruckTypeSelect = (item: FormItem, value: string) => {
  item.truckType = (value as TruckType) || ''
  onTruckTypeChange(item)
}

const validateForm = () => {
  if (!form.scheduleDate) return 'Tanggal wajib diisi'
  if (!form.storeType) return 'Store Type wajib dipilih'
  if (!form.customerId) return 'Customer wajib dipilih'
  if (form.items.length === 0) return 'Minimal ada 1 truk'

  for (let i = 0; i < form.items.length; i += 1) {
    const item = form.items[i]
    const row = i + 1
    if (!item.truckType) return `Jenis Truck baris ${row} wajib dipilih`
    if (item.truckType === 'OTHER' && !item.truckTypeOther.trim()) {
      return `Jenis Truck Lainnya baris ${row} wajib diisi`
    }
    // Item lama (sudah tersimpan sebelum Phase 1) boleh belum lengkap.
    if (!item.id) {
      if (!item.plateNumber.trim()) return `Plat Nomor baris ${row} wajib diisi`
      if (!item.plannedStart) return `Estimasi Start baris ${row} wajib diisi`
      if (!item.plannedFinish) return `Estimasi Finish baris ${row} wajib diisi`
    }
  }

  return null
}

const addContainerField = (item: FormItem) => {
  item.containerNumbers.push('')
}

const removeContainerField = (item: FormItem, index: number) => {
  item.containerNumbers.splice(index, 1)
  if (item.containerNumbers.length === 0) item.containerNumbers.push('')
}

const buildPayload = () => {
  return {
    scheduleDate: form.scheduleDate,
    storeType: form.storeType,
    customerId: form.customerId,
    items: form.items.map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      truckType: item.truckType,
      truckTypeOther: item.truckType === 'OTHER' ? item.truckTypeOther.trim() : undefined,
      plateNumber: item.plateNumber.trim(),
      plannedStart: item.plannedStart,
      plannedFinish: item.plannedFinish,
      transporterId: item.transporterId || undefined,
      driverName: item.driverName.trim() || undefined,
      containerNumbers: item.containerNumbers.map((value) => value.trim()).filter(Boolean)
    }))
  }
}

const submitForm = async () => {
  if (!canManageSchedule.value) return
  const validationError = validateForm()
  if (validationError) {
    formError.value = validationError
    return
  }

  submitting.value = true
  formError.value = null
  try {
    const payload = buildPayload()
    if (formMode.value === 'create') {
      await api.post('/schedules', payload)
      success.value = 'Schedule berhasil ditambahkan'
      // Default tanggal form adalah H+1, jadi set filter ke tanggal schedule baru
      // agar data yang baru dibuat langsung terlihat di tabel.
      filters.date = payload.scheduleDate
    } else if (editingId.value) {
      await api.put(`/schedules/${editingId.value}`, payload)
      success.value = 'Schedule berhasil diupdate'
      if (detailOpen.value && detailData.value?.id === editingId.value) {
        await fetchDetail(editingId.value)
      }
    }
    closeForm()
    await fetchList()
  } catch (err: any) {
    formError.value = getErrorMessage(err, 'Gagal menyimpan schedule')
  } finally {
    submitting.value = false
  }
}

const openConfirmDelete = (row: ScheduleListItem) => {
  if (!canManageSchedule.value) return
  confirmData.value = row
  confirmOpen.value = true
}

const closeConfirmDelete = () => {
  confirmOpen.value = false
  confirmData.value = null
}

const confirmDelete = async () => {
  if (!canManageSchedule.value || !confirmData.value) return
  deleting.value = true
  try {
    await api.delete(`/schedules/${confirmData.value.id}`)
    if (detailOpen.value && detailData.value?.id === confirmData.value.id) {
      closeDetail()
    }
    await fetchList()
    success.value = 'Schedule berhasil dihapus'
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal menghapus schedule')
  } finally {
    deleting.value = false
    closeConfirmDelete()
  }
}

const toggleSort = (column: 'scheduleDate' | 'storeType' | 'customerName' | 'createdAt') => {
  if (sortBy.value !== column) {
    sortBy.value = column
    sortDir.value = 'desc'
  } else {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  }
  page.value = 1
  fetchList()
}

const sortIndicator = (column: 'scheduleDate' | 'storeType' | 'customerName' | 'createdAt') => {
  if (sortBy.value !== column) return '\u2195'
  return sortDir.value === 'asc' ? '\u2191' : '\u2193'
}

const goToPage = (target: number) => {
  if (target < 1 || target > totalPages.value || target === page.value) return
  page.value = target
  fetchList()
}

const resetImportState = () => {
  importFile.value = null
  importResult.value = null
  importErrors.value = []
  importError.value = null
  if (importFileInput.value) importFileInput.value.value = ''
}

const openImport = () => {
  resetImportState()
  importOpen.value = true
}

const closeImport = () => {
  if (importing.value) return
  importOpen.value = false
  resetImportState()
}

const handleImportSchedule = async () => {
  if (!importFile.value) {
    importError.value = 'File Excel wajib dipilih'
    return
  }

  importing.value = true
  importError.value = null
  importErrors.value = []
  importResult.value = null
  try {
    const response = await importScheduleExcel(importFile.value)
    const result = response.data?.data ?? null
    importResult.value = result
    importFile.value = null
    if (importFileInput.value) importFileInput.value.value = ''
    await fetchList()
    success.value = result
      ? `Import selesai: ${result.created} truk ditambahkan ke ${result.scheduleCount} jadwal (${result.skipped} dilewati)`
      : 'Import schedule selesai'
  } catch (err: any) {
    const details = err?.response?.data?.details
    if (Array.isArray(details) && details.length > 0) {
      importErrors.value = details
      importError.value = err?.response?.data?.message || 'Validasi import gagal'
    } else {
      importError.value = getErrorMessage(err, 'Gagal import schedule')
    }
  } finally {
    importing.value = false
  }
}

const handleDownloadImportTemplate = async () => {
  try {
    const response = await downloadScheduleImportTemplate()
    const blob = new Blob([response.data], { type: response.headers['content-type'] })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'template-schedule-delivery-receiving.xlsx'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  } catch (err: any) {
    importError.value = getErrorMessage(err, 'Gagal download template')
  }
}

const handleDownloadImportErrors = () => {
  if (importErrors.value.length === 0) return
  const content = importErrors.value.join('\r\n')
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'kesalahan-import-schedule.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

const openImportLogs = async () => {
  importLogsOpen.value = true
  importLogsLoading.value = true
  try {
    const response = await getScheduleImportLogs(20)
    importLogs.value = response.data?.data ?? []
  } catch (err: any) {
    importError.value = getErrorMessage(err, 'Gagal mengambil riwayat import')
  } finally {
    importLogsLoading.value = false
  }
}

const handlePrintSchedule = async () => {
  printError.value = null
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
        <p class="muted">Mohon tunggu, data schedule sedang diproses.</p>
      </body>
    </html>
  `)
  printWindow.document.close()

  try {
    const response = await api.get('/schedules/print-summary', {
      params: {
        date: filters.date || undefined,
        storeType: filters.storeType || undefined,
        search: filters.search.trim() || undefined
      }
    })
    const payload = response.data?.data || {}

    const html = buildPrintHtml({
      date: payload.date || filters.date,
      columns: (payload.columns || []) as PrintColumn[],
      rows: (payload.rows || []) as PrintRow[]
    })

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => {
      printWindow.print()
    }, 300)
  } catch (err: any) {
    printError.value = getErrorMessage(err, 'Gagal menyiapkan print schedule')
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

let searchTimer: number | undefined

watch(
  () => [filters.date, filters.storeType],
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

onMounted(() => {
  applyFiltersFromRoute()
  if (canManageSchedule.value) {
    fetchCustomers()
    fetchTransporters()
  }
  fetchList()
})

watch(
  () => [route.query.date, route.query.type, route.query.search],
  () => {
    applyFiltersFromRoute()
  }
)

watch(
  () => canManageSchedule.value,
  (allowed) => {
    if (allowed && customers.value.length === 0) {
      fetchCustomers()
      fetchTransporters()
    }
  }
)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Schedule Delivery & Receiving</h1>
        <p class="text-muted-foreground">Monitoring Jadwal Delivery & Receiving</p>
      </div>
      <div class="flex items-center gap-2">
        <Button v-if="canManageSchedule" size="sm" variant="outline" @click="openImport">
          <Upload class="mr-2 h-4 w-4" />
          Import Excel
        </Button>
        <Button size="sm" variant="outline" @click="exportOpen = true">Export Excel</Button>
        <Button size="sm" variant="outline" class="border-blue-200 bg-blue-600 text-white hover:bg-blue-700 hover:text-white" :disabled="printing" @click="handlePrintSchedule">
          {{ printing ? 'Menyiapkan...' : 'Print Out' }}
        </Button>
        <Button v-if="canManageSchedule" size="sm" @click="openCreate">Tambah Jadwal</Button>
        <Button size="sm" variant="outline" @click="fetchList">
          <RefreshCw class="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
    </div>

    <Card>
      <CardHeader>
        <div class="grid gap-3 md:grid-cols-3">
          <div class="relative">
            <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              v-model="filters.search"
              type="text"
              placeholder="Search customer / jenis truck"
              class="pl-9"
            />
          </div>
          <div>
            <Combobox
              v-model="filters.storeType"
              :options="storeTypeFilterOptions"
              placeholder="Pilih store type..."
              search-placeholder="Cari store type..."
              empty-text="Store type tidak ditemukan"
            />
          </div>
          <div>
            <div class="relative">
              <input
                ref="filterDateInputRef"
                v-model="filters.date"
                type="date"
                class="w-full appearance-none bg-transparent border rounded-md px-2 py-2 pr-10 text-sm"
                @click="openDatePicker(filterDateInputRef)"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 inline-flex items-center px-3 text-muted-foreground hover:text-foreground"
                @click="openDatePicker(filterDateInputRef)"
                aria-label="Pilih tanggal"
              >
                <CalendarDays class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div v-if="error" class="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ error }}
        </div>
        <div
          v-if="printError"
          class="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700"
        >
          {{ printError }}
        </div>
        <div v-if="success" class="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {{ success }}
        </div>
        <div class="overflow-x-auto border rounded-lg">
          <table class="min-w-full text-sm">
            <thead class="bg-muted/60 text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left font-medium">No</th>
                <th class="px-3 py-2 text-left font-medium">
                  <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="toggleSort('scheduleDate')">
                    Tanggal <span class="text-xs">{{ sortIndicator('scheduleDate') }}</span>
                  </button>
                </th>
                <th class="px-3 py-2 text-left font-medium">
                  <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="toggleSort('storeType')">
                    Store Type <span class="text-xs">{{ sortIndicator('storeType') }}</span>
                  </button>
                </th>
                <th class="px-3 py-2 text-left font-medium">
                  <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="toggleSort('customerName')">
                    Customer Name <span class="text-xs">{{ sortIndicator('customerName') }}</span>
                  </button>
                </th>
                <th class="px-3 py-2 text-left font-medium">Total Jenis Truck</th>
                <th class="px-3 py-2 text-left font-medium">Total Truk</th>
                <th class="px-3 py-2 text-left font-medium">
                  <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="toggleSort('createdAt')">
                    Created At <span class="text-xs">{{ sortIndicator('createdAt') }}</span>
                  </button>
                </th>
                <th class="px-3 py-2 text-left font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="8" class="px-3 py-6 text-center text-muted-foreground">Loading...</td>
              </tr>
              <tr v-else-if="schedules.length === 0">
                <td colspan="8" class="px-3 py-6 text-center text-muted-foreground">Data kosong.</td>
              </tr>
              <tr v-for="(row, index) in schedules" :key="row.id" class="border-t">
                <td class="px-3 py-2">{{ (page - 1) * limit + index + 1 }}</td>
                <td class="px-3 py-2">{{ formatDate(row.scheduleDate) }}</td>
                <td class="px-3 py-2">
                  <span
                    class="inline-flex rounded-full border px-2 py-0.5 text-xs"
                    :class="
                      row.storeType === 'STORE_IN'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-blue-300 bg-blue-50 text-blue-700'
                    "
                  >
                    {{ storeTypeLabel(row.storeType) }}
                  </span>
                </td>
                <td class="px-3 py-2">{{ row.customer?.name || '-' }}</td>
                <td class="px-3 py-2">{{ row.totalTypes }}</td>
                <td class="px-3 py-2">{{ row.totalTrucks }}</td>
                <td class="px-3 py-2">{{ formatDateTime(row.createdAt) }}</td>
                <td class="px-3 py-2">
                  <div class="flex items-center gap-2">
                    <Button size="sm" variant="outline" @click="openDetail(row)">Detail</Button>
                    <Button v-if="canManageSchedule" size="sm" variant="outline" @click="openEdit(row)">Edit</Button>
                    <Button v-if="canManageSchedule" size="sm" variant="outline" class="border-red-200 bg-red-600 text-white hover:bg-red-700 hover:text-white" @click="openConfirmDelete(row)">Hapus</Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="flex items-center gap-2 text-sm">
            <span class="text-muted-foreground">Rows:</span>
            <div class="w-24">
              <Combobox
                v-model="rowLimitValue"
                :options="rowLimitOptions"
                :searchable="false"
                placeholder="Rows"
                search-placeholder="Cari jumlah rows..."
                empty-text="Jumlah rows tidak ditemukan"
              />
            </div>
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

    <div v-if="formOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeForm"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold">
              {{ formMode === 'create' ? 'Tambah Jadwal' : 'Edit Jadwal' }}
            </h3>
            <p class="text-sm text-muted-foreground">Input jadwal pengiriman (Store In / Store Out)</p>
          </div>
          <Button variant="outline" size="sm" @click="closeForm">Tutup</Button>
        </div>

        <div class="max-h-[70vh] overflow-y-auto p-4 space-y-4 text-sm">
          <div class="grid gap-3 md:grid-cols-3">
            <div>
              <label class="text-muted-foreground">Tanggal</label>
              <div class="relative mt-1">
                <input
                  ref="formDateInputRef"
                  v-model="form.scheduleDate"
                  type="date"
                  class="w-full appearance-none bg-transparent border rounded-md px-2 py-2 pr-10 text-sm"
                  @click="openDatePicker(formDateInputRef)"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 inline-flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label="Pilih tanggal jadwal"
                  @click="openDatePicker(formDateInputRef)"
                >
                  <CalendarDays class="h-4 w-4" />
                </button>
              </div>
            </div>
            <div class="md:col-span-2">
              <label class="text-muted-foreground">Store Type</label>
              <div class="mt-2 flex flex-wrap items-center gap-4">
                <label class="inline-flex items-center gap-2">
                  <input v-model="form.storeType" type="radio" value="STORE_IN" class="h-4 w-4" />
                  Store In
                </label>
                <label class="inline-flex items-center gap-2">
                  <input v-model="form.storeType" type="radio" value="STORE_OUT" class="h-4 w-4" />
                  Store Out
                </label>
              </div>
            </div>
          </div>

          <div>
            <label class="text-muted-foreground">Customer</label>
            <div class="mt-1">
              <Combobox
                v-model="form.customerId"
                :options="customerOptions"
                placeholder="Pilih customer..."
                search-placeholder="Cari customer..."
                empty-text="Customer tidak ditemukan"
              />
            </div>
            <p v-if="form.customerId" class="mt-1 text-xs text-muted-foreground">
              Terpilih: {{ customerOptions.find((item) => item.value === form.customerId)?.label || '-' }}
            </p>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-muted-foreground">Detail Jenis Truk</label>
              <Button size="sm" variant="outline" @click="addItem">+ Tambah Truk</Button>
            </div>

            <div
              v-for="(item, idx) in form.items"
              :key="item.key"
              class="rounded-md border p-3"
            >
              <div class="grid gap-3 md:grid-cols-12">
                <div class="md:col-span-3">
                  <label class="text-xs text-muted-foreground">Jenis Truck</label>
                  <div class="mt-1">
                    <Combobox
                      :model-value="item.truckType"
                      :options="truckTypeComboboxOptions"
                      placeholder="Pilih jenis truck..."
                      search-placeholder="Cari jenis truck..."
                      empty-text="Jenis truck tidak ditemukan"
                      @update:model-value="(value) => onTruckTypeSelect(item, value)"
                    />
                  </div>
                </div>

                <div v-if="item.truckType === 'OTHER'" class="md:col-span-3">
                  <label class="text-xs text-muted-foreground">Jenis Truck Lainnya</label>
                  <input
                    v-model="item.truckTypeOther"
                    type="text"
                    class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
                    placeholder="Isi jenis truck lainnya"
                  />
                </div>

                <div :class="item.truckType === 'OTHER' ? 'md:col-span-3' : 'md:col-span-5'">
                  <label class="text-xs text-muted-foreground">Plat Nomor</label>
                  <input
                    v-model="item.plateNumber"
                    type="text"
                    class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm uppercase"
                    placeholder="B 1234 XYZ"
                  />
                </div>

                <div class="md:col-span-2">
                  <label class="text-xs text-muted-foreground">Estimasi Start</label>
                  <input
                    v-model="item.plannedStart"
                    type="time"
                    class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
                  />
                </div>

                <div class="md:col-span-2">
                  <label class="text-xs text-muted-foreground">Estimasi Finish</label>
                  <input
                    v-model="item.plannedFinish"
                    type="time"
                    class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
                  />
                </div>
              </div>

              <div class="mt-3 grid gap-3 md:grid-cols-12">
                <div class="md:col-span-4">
                  <label class="text-xs text-muted-foreground">Transporter</label>
                  <div class="mt-1">
                    <Combobox
                      v-model="item.transporterId"
                      :options="transporterOptions"
                      placeholder="Pilih transporter..."
                      search-placeholder="Cari transporter..."
                      empty-text="Transporter belum terdaftar"
                    />
                  </div>
                </div>

                <div class="md:col-span-4">
                  <label class="text-xs text-muted-foreground">Driver Name (opsional)</label>
                  <input
                    v-model="item.driverName"
                    type="text"
                    class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
                    placeholder="Nama driver"
                  />
                </div>

                <div class="md:col-span-3">
                  <div class="flex items-center justify-between">
                    <label class="text-xs text-muted-foreground">No Container (opsional)</label>
                    <button
                      type="button"
                      class="text-xs text-primary hover:underline"
                      @click="addContainerField(item)"
                    >
                      Tambah
                    </button>
                  </div>
                  <div class="mt-1 space-y-2">
                    <div
                      v-for="(_, cIndex) in item.containerNumbers"
                      :key="cIndex"
                      class="flex items-center gap-1"
                    >
                      <input
                        v-model="item.containerNumbers[cIndex]"
                        type="text"
                        class="w-full bg-transparent border rounded-md px-2 py-2 text-sm uppercase"
                        placeholder="TCLU1234567"
                      />
                      <button
                        v-if="item.containerNumbers.length > 1"
                        type="button"
                        class="text-xs text-red-600 hover:underline"
                        @click="removeContainerField(item, cIndex)"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>

                <div class="flex items-end md:col-span-1">
                  <Button
                    size="sm"
                    variant="outline"
                    class="w-full border-red-200 bg-red-600 text-white hover:bg-red-700 hover:text-white"
                    :disabled="form.items.length === 1"
                    @click="requestRemoveItem(idx)"
                  >
                    Hapus
                  </Button>
                </div>
              </div>

              <p v-if="item.status" class="mt-2 text-xs text-muted-foreground">
                Status jadwal:
                <span
                  class="inline-flex rounded-full px-2 py-0.5"
                  :class="statusBadgeClass(item.status)"
                >
                  {{ statusLabels[item.status] }}
                </span>
              </p>
            </div>
          </div>

          <p v-if="formError" class="text-xs text-red-600">{{ formError }}</p>
        </div>

        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeForm">Batal</Button>
          <Button :disabled="submitting" @click="submitForm">
            {{ submitting ? 'Menyimpan...' : formMode === 'create' ? 'Simpan' : 'Update' }}
          </Button>
        </div>
      </div>
    </div>

    <div v-if="confirmRemoveItemOpen" class="fixed inset-0 z-[60]">
      <div class="absolute inset-0 bg-black/40" @click="closeConfirmRemoveItem"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Konfirmasi Hapus Jenis Truck</h3>
        </div>
        <div class="p-4 text-sm">
          <p>
            Hapus item
            <span class="font-semibold">
              {{
                confirmRemoveItemIndex !== null && form.items[confirmRemoveItemIndex]
                  ? formTruckTypeLabel(form.items[confirmRemoveItemIndex])
                  : '-'
              }}
            </span>
            dari jadwal ini?
          </p>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeConfirmRemoveItem">Batal</Button>
          <Button @click="confirmRemoveItem">Ya, Hapus</Button>
        </div>
      </div>
    </div>

    <div v-if="detailOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeDetail"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-6xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b flex items-center justify-between">
          <h3 class="text-lg font-semibold">Detail Schedule Pengiriman</h3>
          <Button variant="outline" size="sm" @click="closeDetail">Tutup</Button>
        </div>
        <div class="max-h-[70vh] overflow-y-auto p-4 space-y-4 text-sm">
          <div v-if="detailLoading" class="text-muted-foreground">Loading detail...</div>
          <template v-else-if="detailData">
            <div class="grid gap-3 md:grid-cols-2">
              <div>
                <p class="text-xs text-muted-foreground">Tanggal</p>
                <p class="font-medium">{{ formatDate(detailData.scheduleDate) }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Store Type</p>
                <p class="font-medium">{{ storeTypeLabel(detailData.storeType) }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Customer</p>
                <p class="font-medium">{{ detailData.customer?.name || '-' }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Created At</p>
                <p class="font-medium">{{ formatDateTime(detailData.createdAt) }}</p>
              </div>
            </div>

            <div class="overflow-x-auto border rounded-lg">
              <table class="min-w-full text-sm">
                <thead class="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium">No</th>
                    <th class="px-3 py-2 text-left font-medium">Jenis Truck</th>
                    <th class="px-3 py-2 text-left font-medium">Plat Nomor</th>
                    <th class="px-3 py-2 text-left font-medium">Estimasi Start</th>
                    <th class="px-3 py-2 text-left font-medium">Estimasi Finish</th>
                    <th class="px-3 py-2 text-left font-medium">Transporter</th>
                    <th class="px-3 py-2 text-left font-medium">Driver</th>
                    <th class="px-3 py-2 text-left font-medium">Container</th>
                    <th class="px-3 py-2 text-left font-medium">Status</th>
                    <th class="px-3 py-2 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="detailData.items.length === 0">
                    <td colspan="10" class="px-3 py-4 text-center text-muted-foreground">Tidak ada item.</td>
                  </tr>
                  <tr v-for="(item, idx) in detailData.items" :key="item.id" class="border-t">
                    <td class="px-3 py-2">{{ idx + 1 }}</td>
                    <td class="px-3 py-2">{{ truckTypeLabel(item) }}</td>
                    <td class="px-3 py-2">{{ item.plateNumber || '-' }}</td>
                    <td class="px-3 py-2">{{ formatClock(item.plannedStart) }}</td>
                    <td class="px-3 py-2">{{ formatClock(item.plannedFinish) }}</td>
                    <td class="px-3 py-2">{{ item.transporter?.name || '-' }}</td>
                    <td class="px-3 py-2">{{ item.driverName || '-' }}</td>
                    <td class="px-3 py-2">
                      {{ item.containerNumbers && item.containerNumbers.length > 0 ? item.containerNumbers.join(', ') : '-' }}
                    </td>
                    <td class="px-3 py-2">
                      <span
                        class="inline-flex rounded-full px-2 py-0.5 text-xs"
                        :class="statusBadgeClass(item.status)"
                      >
                        {{ item.status ? statusLabels[item.status] : '-' }}
                      </span>
                    </td>
                    <td class="px-3 py-2 text-right">
                      <Button
                        v-if="item.status === 'NO_SHOW' && user?.role === 'ADMIN'"
                        size="sm"
                        variant="outline"
                        @click="closeNoShow(item)"
                      >
                        Tutup No Show
                      </Button>
                      <span v-else class="text-muted-foreground">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div v-if="confirmOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeConfirmDelete"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Konfirmasi Hapus</h3>
        </div>
        <div class="p-4 text-sm">
          <p>
            Hapus schedule
            <span class="font-semibold">{{ confirmData?.customer?.name || '-' }}</span>
            pada tanggal
            <span class="font-semibold">{{ formatDate(confirmData?.scheduleDate) }}</span>
            ?
          </p>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeConfirmDelete">Batal</Button>
          <Button :disabled="deleting" @click="confirmDelete">
            {{ deleting ? 'Menghapus...' : 'Ya, Hapus' }}
          </Button>
        </div>
      </div>
    </div>

    <div v-if="importOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeImport"></div>
      <div class="absolute left-1/2 top-1/2 max-h-[90vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-card shadow-xl">
        <div class="flex items-start justify-between gap-3 border-b p-4">
          <div>
            <h3 class="text-lg font-semibold">Import Schedule Delivery &amp; Receiving</h3>
            <p class="mt-1 text-xs text-muted-foreground">
              Satu baris mewakili satu truk. Maksimal 500 baris per file. Baris dengan jadwal yang
              sama (tanggal + customer + kategori) otomatis digabung.
            </p>
          </div>
          <button
            type="button"
            class="rounded-md p-1 text-muted-foreground hover:bg-muted"
            :disabled="importing"
            aria-label="Tutup"
            @click="closeImport"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <div class="space-y-3 p-4">
          <div class="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" @click="handleDownloadImportTemplate">
              <Download class="mr-2 h-4 w-4" />
              Unduh Template
            </Button>
            <Button size="sm" variant="ghost" @click="openImportLogs">
              <History class="mr-2 h-4 w-4" />
              Riwayat Import
            </Button>
          </div>

          <div>
            <label for="schedule-import-file" class="text-xs font-medium text-muted-foreground">
              File Excel (.xlsx)
            </label>
            <input
              id="schedule-import-file"
              ref="importFileInput"
              type="file"
              accept=".xlsx"
              class="mt-1 w-full min-w-0 max-w-full rounded-xl border border-input/80 bg-card/75 px-3 py-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium"
              :disabled="importing"
              @change="(e) => (importFile = (e.target as HTMLInputElement).files?.[0] || null)"
            />
          </div>

          <div
            v-if="importError && importErrors.length === 0"
            class="rounded-xl border border-red-300/60 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            role="alert"
          >
            {{ importError }}
          </div>

          <div
            v-if="importResult"
            class="rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          >
            <p>
              <span class="font-semibold">{{ importResult.created }}</span> truk ditambahkan ke
              <span class="font-semibold">{{ importResult.scheduleCount }}</span> jadwal
              (<span class="font-semibold">{{ importResult.createdSchedules }}</span> jadwal baru),
              <span class="font-semibold">{{ importResult.skipped }}</span> dilewati dari
              {{ importResult.total }} baris valid.
            </p>
            <ul v-if="importResult.newSchedules.length > 0" class="mt-2 space-y-0.5">
              <li v-for="(schedule, index) in importResult.newSchedules" :key="index">
                + {{ formatDateId(schedule.date) }} · {{ schedule.customerName }} ·
                {{ schedule.category }} · {{ schedule.itemCount }} truk
              </li>
            </ul>
          </div>

          <div
            v-if="importErrors.length > 0"
            class="rounded-xl border border-red-300/60 bg-red-50 px-3 py-2 dark:border-red-500/30 dark:bg-red-500/10"
          >
            <div class="flex items-start justify-between gap-3">
              <p class="text-xs font-semibold text-red-800 dark:text-red-300">
                Import dibatalkan. Perbaiki {{ importErrors.length }} baris berikut lalu unggah ulang:
              </p>
              <Button size="sm" variant="outline" @click="handleDownloadImportErrors">
                <Download class="mr-1.5 h-3.5 w-3.5" />
                Unduh daftar
              </Button>
            </div>
            <ul class="mt-2 max-h-64 space-y-0.5 overflow-y-auto text-xs text-red-700 dark:text-red-300">
              <li v-for="(message, index) in importErrors" :key="index">{{ message }}</li>
            </ul>
          </div>

          <div v-if="importLogsOpen" class="rounded-xl border bg-muted/30 p-3">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold">Riwayat import terakhir</p>
              <button
                type="button"
                class="text-xs text-muted-foreground hover:underline"
                @click="importLogsOpen = false"
              >
                Tutup
              </button>
            </div>
            <p v-if="importLogsLoading" class="mt-2 text-xs text-muted-foreground">Memuat...</p>
            <p v-else-if="importLogs.length === 0" class="mt-2 text-xs text-muted-foreground">
              Belum ada riwayat import.
            </p>
            <ul v-else class="mt-2 space-y-1 text-xs">
              <li
                v-for="log in importLogs"
                :key="log.id"
                class="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-border/50 pb-1 last:border-0"
              >
                <span class="font-medium">{{ formatDateTimeId(log.createdAt) }}</span>
                <span class="text-muted-foreground">
                  {{ log.actorUser?.name || 'Sistem' }} · {{ log.createdCount }} dibuat ·
                  {{ log.skippedCount }} dilewati · {{ log.scheduleCount }} jadwal
                </span>
                <span class="w-full text-muted-foreground/80">{{ log.fileName || '-' }}</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 border-t p-4">
          <Button variant="ghost" :disabled="importing" @click="closeImport">Batal</Button>
          <Button :disabled="importing || !importFile" @click="handleImportSchedule">
            {{ importing ? 'Mengimpor...' : 'Import' }}
          </Button>
        </div>
      </div>
    </div>

    <ExportDialog
      v-model="exportOpen"
      type="SCHEDULE"
      sync-path="/schedules/export"
      title="Export Schedule Pengiriman"
    />
  </div>
</template>

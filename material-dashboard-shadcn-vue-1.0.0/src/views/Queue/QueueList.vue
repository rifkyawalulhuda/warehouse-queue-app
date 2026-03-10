<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Combobox from '@/components/ui/Combobox.vue'
import QueueTable from '@/components/queue/QueueTable.vue'
import QueueDetailDrawer from '@/components/queue/QueueDetailDrawer.vue'
import QueueCreateModal from '@/components/queue/QueueCreateModal.vue'
import QueueEditModal from '@/components/queue/QueueEditModal.vue'
import { RefreshCw, Search, ChevronDown, CalendarDays } from 'lucide-vue-next'
import api from '@/services/api'
import { getMasterGates, setInWh, type MasterGate } from '@/services/queueApi'
import { useAuth } from '@/composables/useAuth'

type QueueLog = {
  id: string
  type: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'WH_NOTES'
  fromStatus?: string | null
  toStatus?: string | null
  note?: string | null
  userName?: string | null
  actorUser?: { id: string; name: string; username: string; role: string } | null
  createdAt: string
}

type QueueEntry = {
  id: string
  category: 'RECEIVING' | 'DELIVERY'
  customerId?: string | null
  customer?: { id: string; name: string } | null
  gateId?: string | null
  gate?: MasterGate | null
  driverName: string
  truckNumber: string
  containerNumber?: string | null
  registerTime: string
  inWhTime?: string | null
  startTime?: string | null
  finishTime?: string | null
  slaWaitingMinutes: number
  slaInWhProcessMinutes: number
  status: 'MENUNGGU' | 'IN_WH' | 'PROSES' | 'SELESAI' | 'BATAL'
  notes?: string | null
  notesFromWh?: string | null
  logs?: QueueLog[]
}

type Customer = {
  id: string
  name: string
}

const entries = ref<QueueEntry[]>([])
const customers = ref<Customer[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const { user } = useAuth()
const route = useRoute()
const router = useRouter()

const selectedEntry = ref<QueueEntry | null>(null)
const drawerOpen = ref(false)
const createOpen = ref(false)
const createSubmitting = ref(false)
const editOpen = ref(false)
const editSubmitting = ref(false)
const editingEntry = ref<QueueEntry | null>(null)
const confirmOpen = ref(false)
const confirmEntry = ref<QueueEntry | null>(null)
const confirmNextStatus = ref<QueueEntry['status'] | null>(null)
const cancelReason = ref('')
const cancelReasonError = ref('')
const setInWhOpen = ref(false)
const setInWhEntry = ref<QueueEntry | null>(null)
const selectedGateId = ref('')
const gateSearchQuery = ref('')
const masterGates = ref<MasterGate[]>([])
const gateLoading = ref(false)
const gateError = ref<string | null>(null)
const setInWhSubmitting = ref(false)
const gateDropdownOpen = ref(false)
const gateDropdownRef = ref<HTMLElement | null>(null)
const success = ref<string | null>(null)
const exportOpen = ref(false)
const exporting = ref(false)
const exportError = ref<string | null>(null)
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

const exportForm = reactive({
  dateFrom: '',
  dateTo: ''
})
const filterDateFromInputRef = ref<HTMLInputElement | null>(null)
const filterDateToInputRef = ref<HTMLInputElement | null>(null)
const exportDateFromInputRef = ref<HTMLInputElement | null>(null)
const exportDateToInputRef = ref<HTMLInputElement | null>(null)

const getErrorMessage = (err: any, fallback: string) => {
  return err?.response?.data?.message || err?.message || fallback
}

let successTimer: number | undefined

const showSuccess = (message: string) => {
  success.value = message
  if (successTimer) window.clearTimeout(successTimer)
  successTimer = window.setTimeout(() => {
    success.value = null
  }, 3000)
}

const todayString = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

const parseSearchQuery = (value: unknown) => {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
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

type QueueSortColumn =
  | 'registerTime'
  | 'inWhTime'
  | 'startTime'
  | 'finishTime'
  | 'customerName'
  | 'driverName'
  | 'truckNumber'
  | 'status'
type QueueStatusKey = 'MENUNGGU' | 'IN_WH' | 'PROSES' | 'SELESAI' | 'BATAL'

const filters = reactive({
  dateFrom: todayString(),
  dateTo: todayString(),
  status: '',
  category: '',
  search: parseSearchQuery(route.query.search),
})

const sortBy = ref<QueueSortColumn>('registerTime')
const sortDir = ref<'asc' | 'desc'>('desc')
const statusCounts = ref<Record<QueueStatusKey, number>>({
  MENUNGGU: 0,
  IN_WH: 0,
  PROSES: 0,
  SELESAI: 0,
  BATAL: 0,
})

const statusOptions = [
  { label: 'Semua', value: '' },
  { label: 'MENUNGGU', value: 'MENUNGGU' },
  { label: 'IN_WH', value: 'IN_WH' },
  { label: 'PROSES', value: 'PROSES' },
  { label: 'SELESAI', value: 'SELESAI' },
  { label: 'BATAL', value: 'BATAL' }
]

const statusSequenceItems = computed(() => [
  {
    key: 'MENUNGGU' as const,
    label: 'Menunggu',
  },
  {
    key: 'IN_WH' as const,
    label: 'In_WH',
  },
  {
    key: 'PROSES' as const,
    label: 'Proses',
  },
  {
    key: 'SELESAI' as const,
    label: 'Selesai',
  },
])

const isSequenceStatusActive = (status: QueueStatusKey) => filters.status === status

const toggleSequenceStatus = (status: QueueStatusKey) => {
  filters.status = filters.status === status ? '' : status
}

const statusSequenceColorClass = (status: QueueStatusKey) => {
  switch (status) {
    case 'MENUNGGU':
      return {
        card: 'border-yellow-200 bg-yellow-50 text-yellow-900',
        bubble: 'border-yellow-300 bg-yellow-100 text-yellow-800',
      }
    case 'IN_WH':
      return {
        card: 'border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-100',
        bubble: 'border-cyan-300 bg-cyan-100 text-cyan-800 dark:border-cyan-400/30 dark:bg-cyan-500/15 dark:text-cyan-100',
      }
    case 'PROSES':
      return {
        card: 'border-blue-200 bg-blue-50 text-blue-900',
        bubble: 'border-blue-300 bg-blue-100 text-blue-800',
      }
    case 'SELESAI':
      return {
        card: 'border-green-200 bg-green-50 text-green-900',
        bubble: 'border-green-300 bg-green-100 text-green-800',
      }
    default:
      return {
        card: 'border-border bg-muted/40 text-muted-foreground',
        bubble: 'border-border bg-background text-muted-foreground',
      }
  }
}

const getSequenceCardClass = (status: QueueStatusKey) => {
  const count = statusCounts.value[status] || 0
  if (count <= 0) return 'border-border bg-muted/40 text-muted-foreground'
  return statusSequenceColorClass(status).card
}

const getSequenceBubbleClass = (status: QueueStatusKey) => {
  const count = statusCounts.value[status] || 0
  if (count <= 0) return 'border-border bg-background text-muted-foreground'
  return statusSequenceColorClass(status).bubble
}

const categoryOptions = [
  { label: 'Semua', value: '' },
  { label: 'Receiving', value: 'RECEIVING' },
  { label: 'Delivery', value: 'DELIVERY' }
]

const canCreateTransaction = computed(() => user.value?.role === 'ADMIN' || user.value?.role === 'CS')
const canEditTransaction = computed(() => user.value?.role === 'ADMIN' || user.value?.role === 'CS')
const canOpenDisplay = computed(() => user.value?.role === 'ADMIN')

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
  if (typeof route.query.status === 'string') {
    filters.status = route.query.status
  }
  if (typeof route.query.category === 'string') {
    filters.category = route.query.category
  }
  filters.search = parseSearchQuery(route.query.search)
  page.value = parsePositiveInt(route.query.page, 1)
  const nextLimit = parsePositiveInt(route.query.limit, 15)
  limit.value = [15, 30, 50, 100].includes(nextLimit) ? nextLimit : 15
}

const syncQueryToRoute = () => {
  const nextQuery: Record<string, string> = {}
  if (filters.dateFrom) nextQuery.dateFrom = filters.dateFrom
  if (filters.dateTo) nextQuery.dateTo = filters.dateTo
  if (filters.status) nextQuery.status = filters.status
  if (filters.category) nextQuery.category = filters.category
  if (filters.search) nextQuery.search = filters.search
  nextQuery.page = String(page.value)
  nextQuery.limit = String(limit.value)
  nextQuery.sortBy = sortBy.value
  nextQuery.sortDir = sortDir.value
  if (typeof route.query.detailId === 'string' && route.query.detailId) {
    nextQuery.detailId = route.query.detailId
  }
  router.replace({ path: route.path, query: nextQuery })
}

const queryString = computed(() => {
  const params = new URLSearchParams()
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.status) params.set('status', filters.status)
  if (filters.category) params.set('category', filters.category)
  if (filters.search) params.set('search', filters.search)
  params.set('page', String(page.value))
  params.set('limit', String(limit.value))
  params.set('sortBy', sortBy.value)
  params.set('sortDir', sortDir.value)
  return params.toString()
})

const fetchList = async () => {
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    error.value = 'Tanggal mulai tidak boleh lebih besar dari tanggal akhir'
    return
  }

  loading.value = true
  error.value = null
  try {
    const url = `/queue?${queryString.value}`
    const response = await api.get(url)
    entries.value = response.data?.data || []
    const serverCounts = response.data?.meta?.statusCounts || {}
    statusCounts.value = {
      MENUNGGU: Number(serverCounts.MENUNGGU || 0),
      IN_WH: Number(serverCounts.IN_WH || 0),
      PROSES: Number(serverCounts.PROSES || 0),
      SELESAI: Number(serverCounts.SELESAI || 0),
      BATAL: Number(serverCounts.BATAL || 0),
    }
    totalPages.value = response.data?.meta?.totalPages || 1
    totalItems.value = response.data?.meta?.totalItems || 0
    page.value = response.data?.meta?.page || page.value
    limit.value = response.data?.meta?.limit || limit.value
    syncQueryToRoute()
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Terjadi kesalahan')
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

const fetchMasterGates = async () => {
  gateLoading.value = true
  gateError.value = null
  try {
    const response = await getMasterGates()
    masterGates.value = response.data?.data || []
  } catch (err: any) {
    gateError.value = getErrorMessage(err, 'Gagal memuat Master Gate')
  } finally {
    gateLoading.value = false
  }
}

const gateLabel = (gate: MasterGate) => {
  return `${gate.gateNo} - ${gate.area} (${gate.warehouse})`
}

const filteredGates = computed(() => {
  const q = gateSearchQuery.value.trim().toLowerCase()
  if (!q) return masterGates.value
  return masterGates.value.filter((gate) => {
    return (
      gate.gateNo.toLowerCase().includes(q) ||
      gate.area.toLowerCase().includes(q) ||
      gate.warehouse.toLowerCase().includes(q)
    )
  })
})

const fetchDetail = async (id: string) => {
  try {
    const response = await api.get(`/queue/${id}`)
    selectedEntry.value = response.data?.data
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal mengambil detail')
  }
}

const handleViewDetail = async (entry: QueueEntry) => {
  drawerOpen.value = true
  await fetchDetail(entry.id)
}

const openDetailById = async (id: string) => {
  drawerOpen.value = true
  await fetchDetail(id)
}

const handleChangeStatus = async (entry: QueueEntry, newStatus: QueueEntry['status']) => {
  if (newStatus === 'IN_WH' && entry.status === 'MENUNGGU') {
    setInWhEntry.value = entry
    selectedGateId.value = ''
    gateSearchQuery.value = ''
    gateError.value = null
    gateDropdownOpen.value = false
    setInWhOpen.value = true
    if (masterGates.value.length === 0) {
      await fetchMasterGates()
    }
    return
  }
  confirmEntry.value = entry
  confirmNextStatus.value = newStatus
  cancelReason.value = ''
  cancelReasonError.value = ''
  confirmOpen.value = true
}

const isCancelStatusFlow = computed(() => confirmNextStatus.value === 'BATAL')

const getCancelReasonText = () => {
  return String(cancelReason.value || '').trim()
}

const closeConfirm = () => {
  confirmOpen.value = false
  confirmEntry.value = null
  confirmNextStatus.value = null
  cancelReason.value = ''
  cancelReasonError.value = ''
}

const closeSetInWh = () => {
  setInWhOpen.value = false
  setInWhEntry.value = null
  selectedGateId.value = ''
  gateSearchQuery.value = ''
  gateError.value = null
  gateDropdownOpen.value = false
}

const submitSetInWh = async () => {
  if (!setInWhEntry.value || !selectedGateId.value) return
  setInWhSubmitting.value = true
  error.value = null
  try {
    await setInWh(setInWhEntry.value.id, selectedGateId.value)
    await fetchList()
    if (drawerOpen.value && selectedEntry.value?.id === setInWhEntry.value.id) {
      await fetchDetail(setInWhEntry.value.id)
    }
    closeSetInWh()
    showSuccess('Status berhasil diubah ke IN_WH')
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal update status')
  } finally {
    setInWhSubmitting.value = false
  }
}

const selectGate = (gate: MasterGate) => {
  selectedGateId.value = gate.id
  gateSearchQuery.value = gateLabel(gate)
  gateDropdownOpen.value = false
}

const handleGateSearchInput = () => {
  gateDropdownOpen.value = true
  if (!selectedGateId.value) return
  const selected = masterGates.value.find((gate) => gate.id === selectedGateId.value)
  if (!selected) {
    selectedGateId.value = ''
    return
  }
  if (gateSearchQuery.value.trim() !== gateLabel(selected)) {
    selectedGateId.value = ''
  }
}

const openGateDropdown = () => {
  if (gateLoading.value || masterGates.value.length === 0) return
  gateDropdownOpen.value = true
}

const handleGateOutsideClick = (event: MouseEvent) => {
  if (!gateDropdownOpen.value) return
  const target = event.target as Node | null
  if (!target || !gateDropdownRef.value) return
  if (!gateDropdownRef.value.contains(target)) {
    gateDropdownOpen.value = false
  }
}

const executeChangeStatus = async () => {
  if (!confirmEntry.value || !confirmNextStatus.value) return
  const reason = getCancelReasonText()
  if (confirmNextStatus.value === 'BATAL' && !reason) {
    cancelReasonError.value = 'Alasan batal wajib diisi'
    return
  }
  try {
    const body: Record<string, any> = { newStatus: confirmNextStatus.value }
    if (confirmNextStatus.value === 'BATAL') {
      body.reason = reason
    }
    await api.patch(
      `/queue/${confirmEntry.value.id}/status`,
      body,
      {
        headers: {
          'x-user-name': 'admin'
        }
      }
    )
    await fetchList()
    if (drawerOpen.value && selectedEntry.value?.id === confirmEntry.value.id) {
      await fetchDetail(confirmEntry.value.id)
    }
  } catch (err: any) {
    const message = getErrorMessage(err, 'Gagal update status')
    error.value = message
    if (confirmNextStatus.value === 'BATAL') {
      cancelReasonError.value = message
    }
  } finally {
    closeConfirm()
  }
}

const handleCreate = async (payload: {
  customerId: string
  category: 'RECEIVING' | 'DELIVERY'
  driverName: string
  truckNumber: string
  containerNumber: string
  slaWaitingMinutes?: number
  slaInWhProcessMinutes?: number
  notes: string
  registerTime: string
}) => {
  createSubmitting.value = true
  error.value = null
  try {
    const body: Record<string, any> = {
      category: payload.category,
      customerId: payload.customerId,
      driverName: payload.driverName,
      truckNumber: payload.truckNumber,
    }
    if (typeof payload.slaWaitingMinutes === 'number') body.slaWaitingMinutes = payload.slaWaitingMinutes
    if (typeof payload.slaInWhProcessMinutes === 'number') {
      body.slaInWhProcessMinutes = payload.slaInWhProcessMinutes
    }
    if (payload.containerNumber.trim()) body.containerNumber = payload.containerNumber.trim()
    if (payload.notes.trim()) body.notes = payload.notes.trim()
    if (payload.registerTime) body.registerTime = new Date(payload.registerTime).toISOString()

    await api.post('/queue', body, {
      headers: {
        'x-user-name': 'admin'
      }
    })
    createOpen.value = false
    await fetchList()
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal menambah transaksi')
  } finally {
    createSubmitting.value = false
  }
}

const openEditFromDrawer = (entry: QueueEntry) => {
  if (!canEditTransaction.value) return
  editingEntry.value = entry
  editOpen.value = true
}

const closeEdit = () => {
  editOpen.value = false
  editingEntry.value = null
}

const handleEdit = async (payload: {
  customerId: string
  category: 'RECEIVING' | 'DELIVERY'
  driverName: string
  truckNumber: string
  containerNumber: string
  slaWaitingMinutes?: number
  slaInWhProcessMinutes?: number
  notes: string
  registerTime: string
}) => {
  if (!editingEntry.value) return
  editSubmitting.value = true
  error.value = null
  try {
    const body: Record<string, any> = {
      category: payload.category,
      customerId: payload.customerId,
      driverName: payload.driverName,
      truckNumber: payload.truckNumber,
      containerNumber: payload.containerNumber.trim(),
      notes: payload.notes.trim(),
    }
    if (typeof payload.slaWaitingMinutes === 'number') body.slaWaitingMinutes = payload.slaWaitingMinutes
    if (typeof payload.slaInWhProcessMinutes === 'number') {
      body.slaInWhProcessMinutes = payload.slaInWhProcessMinutes
    }
    if (payload.registerTime) {
      body.registerTime = new Date(payload.registerTime).toISOString()
    }

    const targetId = editingEntry.value.id
    await api.patch(`/queue/${targetId}`, body)
    closeEdit()
    await fetchList()
    if (drawerOpen.value && selectedEntry.value?.id === targetId) {
      await fetchDetail(targetId)
    }
    showSuccess('Transaksi berhasil diupdate')
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal update transaksi')
  } finally {
    editSubmitting.value = false
  }
}

const closeDrawer = () => {
  drawerOpen.value = false
  selectedEntry.value = null
}

const handleWhNotesSaved = async (entryId: string) => {
  await fetchDetail(entryId)
  await fetchList()
}

const isQueueSortColumn = (column: string): column is QueueSortColumn => {
  return (
    column === 'registerTime' ||
    column === 'inWhTime' ||
    column === 'startTime' ||
    column === 'finishTime' ||
    column === 'customerName' ||
    column === 'driverName' ||
    column === 'truckNumber' ||
    column === 'status'
  )
}

const toggleSort = (column: string) => {
  if (!isQueueSortColumn(column)) return
  if (sortBy.value !== column) {
    sortBy.value = column
    sortDir.value = 'desc'
  } else {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  }
  page.value = 1
  fetchList()
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

const goToPage = (target: number) => {
  if (target < 1 || target > totalPages.value || target === page.value) return
  page.value = target
  fetchList()
}

const buildExportFileName = () => {
  if (exportForm.dateFrom && exportForm.dateTo) {
    return `antrian_truk_${exportForm.dateFrom}_sampai_${exportForm.dateTo}.xlsx`
  }
  return 'antrian_truk.xlsx'
}

const openDisplayPage = () => {
  if (!canOpenDisplay.value) return
  const target = router.resolve('/display/antrian-truk')
  window.open(target.href, '_blank', 'noopener,noreferrer')
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
    const params = new URLSearchParams()
    if (hasFrom && hasTo) {
      params.set('dateFrom', exportForm.dateFrom)
      params.set('dateTo', exportForm.dateTo)
    }
    const url = params.toString() ? `/queue/export?${params.toString()}` : '/queue/export'
    const response = await api.get(url, { responseType: 'blob' })
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

let searchTimer: number | undefined

watch(
  () => [filters.dateFrom, filters.dateTo, filters.status, filters.category],
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
  applyInitialRouteQuery()
  fetchList()
  fetchCustomers()
  const detailId = route.query.detailId
  if (typeof detailId === 'string' && detailId) {
    openDetailById(detailId)
  }
})

let refreshTimer: number | undefined

onMounted(() => {
  refreshTimer = window.setInterval(() => {
    fetchList()
  }, 60000)
})

onUnmounted(() => {
  if (refreshTimer) window.clearInterval(refreshTimer)
})

onMounted(() => {
  document.addEventListener('click', handleGateOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleGateOutsideClick)
})

watch(
  () => route.query.detailId,
  (value) => {
    if (typeof value === 'string' && value) {
      openDetailById(value)
    }
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

</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Antrian Truk</h1>
        <p class="text-muted-foreground">Monitoring antrian masuk gudang</p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          v-if="canOpenDisplay"
          size="sm"
          variant="outline"
          class="border-blue-200 bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
          @click="openDisplayPage"
        >
          Display Antrian
        </Button>
        <Button size="sm" variant="outline" @click="exportOpen = true">Export Excel</Button>
        <Button v-if="canCreateTransaction" size="sm" @click="createOpen = true">Tambah Transaksi</Button>
        <Button size="sm" variant="outline" @click="fetchList">
          <RefreshCw class="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
    </div>

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
        <div class="grid gap-3 md:grid-cols-5">
          <div class="relative">
            <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              v-model="filters.search"
              type="text"
              placeholder="Search customer/driver/truck/container"
              class="pl-9"
            />
          </div>
          <div>
            <Combobox
              v-model="filters.status"
              :options="statusOptions"
              placeholder="Semua status"
              search-placeholder="Cari status..."
              empty-text="Status tidak ditemukan"
            />
          </div>
          <div>
            <Combobox
              v-model="filters.category"
              :options="categoryOptions"
              placeholder="Semua kategori"
              search-placeholder="Cari kategori..."
              empty-text="Kategori tidak ditemukan"
            />
          </div>
          <div class="relative">
            <input
              ref="filterDateFromInputRef"
              v-model="filters.dateFrom"
              type="date"
              class="w-full appearance-none bg-transparent border rounded-md px-2 py-2 pr-10 text-sm"
              @click="openDatePicker(filterDateFromInputRef)"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 inline-flex items-center px-3 text-muted-foreground hover:text-foreground"
              aria-label="Pilih tanggal dari"
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
              @click="openDatePicker(filterDateToInputRef)"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 inline-flex items-center px-3 text-muted-foreground hover:text-foreground"
              aria-label="Pilih tanggal sampai"
              @click="openDatePicker(filterDateToInputRef)"
            >
              <CalendarDays class="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div v-if="error" class="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ error }}
        </div>
        <div v-if="success" class="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {{ success }}
        </div>
        <QueueTable
          :entries="entries"
          :loading="loading"
          :sort-by="sortBy"
          :sort-dir="sortDir"
          @toggle-sort="toggleSort"
          @view-detail="handleViewDetail"
          @change-status="handleChangeStatus"
        />
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

    <QueueDetailDrawer
      :open="drawerOpen"
      :entry="selectedEntry"
      @close="closeDrawer"
      @wh-notes-saved="handleWhNotesSaved"
      @edit="openEditFromDrawer"
    />
    <QueueCreateModal
      v-if="canCreateTransaction"
      :open="createOpen"
      :submitting="createSubmitting"
      :customers="customers"
      @close="createOpen = false"
      @submit="handleCreate"
    />
    <QueueEditModal
      v-if="canEditTransaction"
      :open="editOpen"
      :submitting="editSubmitting"
      :customers="customers"
      :entry="editingEntry"
      @close="closeEdit"
      @submit="handleEdit"
    />

    <div v-if="setInWhOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeSetInWh"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Konfirmasi Set IN_WH</h3>
        </div>
        <div class="p-4 space-y-3 text-sm">
          <p class="text-muted-foreground">Pilih Gate No untuk transaksi ini sebelum melanjutkan.</p>
          <div ref="gateDropdownRef" class="relative">
            <label class="text-sm text-muted-foreground">Gate No</label>
            <div class="relative mt-1">
              <input
                v-model="gateSearchQuery"
                type="text"
                placeholder="Cari / pilih gate..."
                class="w-full bg-transparent border rounded-md pl-2 pr-9 py-2 text-sm"
                :disabled="gateLoading || masterGates.length === 0"
                @focus="openGateDropdown"
                @click="openGateDropdown"
                @input="handleGateSearchInput"
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                :disabled="gateLoading || masterGates.length === 0"
                @click="openGateDropdown"
                aria-label="Toggle gate list"
              >
                <ChevronDown class="h-4 w-4" />
              </button>
            </div>
            <div
              v-if="gateDropdownOpen"
              class="absolute z-10 mt-1 max-h-44 w-full overflow-auto rounded-md border bg-card shadow-sm"
            >
              <div v-if="gateLoading" class="px-3 py-2 text-xs text-muted-foreground">Memuat Master Gate...</div>
              <div v-else-if="masterGates.length === 0" class="px-3 py-2 text-xs text-muted-foreground">
                Master Gate masih kosong. Silakan isi Master Gate terlebih dahulu.
              </div>
              <div v-else-if="filteredGates.length === 0" class="px-3 py-2 text-xs text-muted-foreground">
                Tidak ada gate yang cocok
              </div>
              <button
                v-for="gate in filteredGates"
                :key="gate.id"
                type="button"
                class="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                :class="selectedGateId === gate.id ? 'bg-accent' : ''"
                @mousedown.prevent="selectGate(gate)"
              >
                {{ gateLabel(gate) }}
              </button>
            </div>
          </div>
          <div v-if="gateError" class="text-xs text-red-600">{{ gateError }}</div>
          <div
            v-else-if="!selectedGateId && gateSearchQuery.trim() && !gateLoading && masterGates.length > 0"
            class="text-xs text-red-600"
          >
            Gate wajib dipilih
          </div>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeSetInWh">Batal</Button>
          <Button :disabled="setInWhSubmitting || !selectedGateId || masterGates.length === 0" @click="submitSetInWh">
            {{ setInWhSubmitting ? 'Menyimpan...' : 'Konfirmasi' }}
          </Button>
        </div>
      </div>
    </div>

    <div v-if="confirmOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeConfirm"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">
            {{ isCancelStatusFlow ? 'Konfirmasi Batal' : 'Konfirmasi Ubah Status' }}
          </h3>
        </div>
        <div class="p-4 space-y-3 text-sm">
          <p>
            {{ isCancelStatusFlow ? 'Batalkan transaksi' : 'Ubah status' }}
            <span class="font-semibold">{{ confirmEntry?.truckNumber }}</span>
            dari
            <span class="font-semibold">{{ confirmEntry?.status }}</span>
            ke
            <span class="font-semibold">{{ confirmNextStatus }}</span>
            ?
          </p>
          <div v-if="isCancelStatusFlow">
            <label class="text-sm text-muted-foreground">Alasan Batal</label>
            <textarea
              v-model="cancelReason"
              rows="3"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
              placeholder="Masukkan alasan pembatalan..."
              @input="cancelReasonError = ''"
            ></textarea>
            <p v-if="cancelReasonError" class="mt-1 text-xs text-red-600">
              {{ cancelReasonError }}
            </p>
          </div>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeConfirm">Batal</Button>
          <Button :disabled="isCancelStatusFlow && !cancelReason.trim()" @click="executeChangeStatus">
            {{ isCancelStatusFlow ? 'Ya, Batal' : 'Ya, Ubah' }}
          </Button>
        </div>
      </div>
    </div>

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
  </div>
</template>

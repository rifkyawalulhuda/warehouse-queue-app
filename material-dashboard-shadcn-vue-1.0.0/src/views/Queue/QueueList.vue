<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import QueueTable from '@/components/queue/QueueTable.vue'
import QueueDetailDrawer from '@/components/queue/QueueDetailDrawer.vue'
import QueueCreateModal from '@/components/queue/QueueCreateModal.vue'
import { RefreshCw, Search, ChevronDown } from 'lucide-vue-next'
import api from '@/services/api'
import { getMasterGates, setInWh, type MasterGate } from '@/services/queueApi'
import { useAuth } from '@/composables/useAuth'

type QueueLog = {
  id: string
  type: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE'
  fromStatus?: string | null
  toStatus?: string | null
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
  status: 'MENUNGGU' | 'IN_WH' | 'PROSES' | 'SELESAI' | 'BATAL'
  notes?: string | null
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
const confirmOpen = ref(false)
const confirmEntry = ref<QueueEntry | null>(null)
const confirmNextStatus = ref<QueueEntry['status'] | null>(null)
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

const exportForm = reactive({
  dateFrom: '',
  dateTo: ''
})

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

type QueueSortColumn =
  | 'registerTime'
  | 'inWhTime'
  | 'startTime'
  | 'finishTime'
  | 'customerName'
  | 'driverName'
  | 'truckNumber'
  | 'status'

const filters = reactive({
  date: todayString(),
  status: '',
  category: '',
  search: ''
})

const sortBy = ref<QueueSortColumn>('registerTime')
const sortDir = ref<'asc' | 'desc'>('desc')

const statusOptions = [
  { label: 'Semua', value: '' },
  { label: 'MENUNGGU', value: 'MENUNGGU' },
  { label: 'IN_WH', value: 'IN_WH' },
  { label: 'PROSES', value: 'PROSES' },
  { label: 'SELESAI', value: 'SELESAI' },
  { label: 'BATAL', value: 'BATAL' }
]

const categoryOptions = [
  { label: 'Semua', value: '' },
  { label: 'Receiving', value: 'RECEIVING' },
  { label: 'Delivery', value: 'DELIVERY' }
]

const canCreateTransaction = computed(() => user.value?.role === 'ADMIN' || user.value?.role === 'CS')
const canOpenDisplay = computed(() => user.value?.role === 'ADMIN')

const queryString = computed(() => {
  const params = new URLSearchParams()
  params.set('date', filters.date)
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
  loading.value = true
  error.value = null
  try {
    const url = `/queue?${queryString.value}`
    const response = await api.get(url)
    entries.value = response.data?.data || []
    totalPages.value = response.data?.meta?.totalPages || 1
    totalItems.value = response.data?.meta?.totalItems || 0
    page.value = response.data?.meta?.page || page.value
    limit.value = response.data?.meta?.limit || limit.value
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
  confirmOpen.value = true
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
  try {
    await api.patch(
      `/queue/${confirmEntry.value.id}/status`,
      { newStatus: confirmNextStatus.value },
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
    error.value = getErrorMessage(err, 'Gagal update status')
  } finally {
    confirmOpen.value = false
    confirmEntry.value = null
    confirmNextStatus.value = null
  }
}

const handleCreate = async (payload: {
  customerId: string
  category: 'RECEIVING' | 'DELIVERY'
  driverName: string
  truckNumber: string
  containerNumber: string
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
      truckNumber: payload.truckNumber
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

const closeDrawer = () => {
  drawerOpen.value = false
  selectedEntry.value = null
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

let searchTimer: number | undefined

watch(
  () => [filters.date, filters.status, filters.category],
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

    <Card>
      <CardHeader>
        <div class="grid gap-3 md:grid-cols-4">
          <div class="flex items-center gap-2">
            <Search class="h-4 w-4 text-muted-foreground" />
            <input
              v-model="filters.search"
              type="text"
              placeholder="Search customer/driver/truck/container"
              class="flex-1 bg-transparent border-none outline-none text-sm"
            />
          </div>
          <div>
            <select v-model="filters.status" class="w-full bg-transparent border rounded-md px-2 py-2 text-sm">
              <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div>
            <select v-model="filters.category" class="w-full bg-transparent border rounded-md px-2 py-2 text-sm">
              <option v-for="opt in categoryOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div>
            <input v-model="filters.date" type="date" class="w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
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

    <QueueDetailDrawer :open="drawerOpen" :entry="selectedEntry" @close="closeDrawer" />
    <QueueCreateModal
      v-if="canCreateTransaction"
      :open="createOpen"
      :submitting="createSubmitting"
      :customers="customers"
      @close="createOpen = false"
      @submit="handleCreate"
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
      <div class="absolute inset-0 bg-black/40" @click="confirmOpen = false"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Konfirmasi Ubah Status</h3>
        </div>
        <div class="p-4 text-sm">
          <p>
            Ubah status
            <span class="font-semibold">{{ confirmEntry?.truckNumber }}</span>
            dari
            <span class="font-semibold">{{ confirmEntry?.status }}</span>
            ke
            <span class="font-semibold">{{ confirmNextStatus }}</span>
            ?
          </p>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="confirmOpen = false">Batal</Button>
          <Button @click="executeChangeStatus">Ya, Ubah</Button>
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
            <input v-model="exportForm.dateFrom" type="date" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Tanggal Sampai</label>
            <input v-model="exportForm.dateTo" type="date" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
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

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import QueueTable from '@/components/queue/QueueTable.vue'
import QueueDetailDrawer from '@/components/queue/QueueDetailDrawer.vue'
import QueueCreateModal from '@/components/queue/QueueCreateModal.vue'
import { RefreshCw, Search } from 'lucide-vue-next'
import api from '@/services/api'

type QueueLog = {
  id: string
  action: string
  oldStatus?: string | null
  newStatus?: string | null
  userName: string
  createdAt: string
}

type QueueEntry = {
  id: string
  category: 'RECEIVING' | 'DELIVERY'
  customerId?: string | null
  customer?: { id: string; name: string } | null
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

const selectedEntry = ref<QueueEntry | null>(null)
const drawerOpen = ref(false)
const createOpen = ref(false)
const createSubmitting = ref(false)
const confirmOpen = ref(false)
const confirmEntry = ref<QueueEntry | null>(null)
const confirmNextStatus = ref<QueueEntry['status'] | null>(null)
const exportOpen = ref(false)
const exporting = ref(false)
const exportError = ref<string | null>(null)

const exportForm = reactive({
  dateFrom: '',
  dateTo: ''
})

const getErrorMessage = (err: any, fallback: string) => {
  return err?.response?.data?.message || err?.message || fallback
}

const todayString = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

const filters = reactive({
  date: todayString(),
  status: '',
  category: '',
  search: ''
})

const sortBy = ref<
  'registerTime' | 'inWhTime' | 'startTime' | 'finishTime' | 'customerName' | 'driverName' | 'truckNumber' | 'status'
>('registerTime')
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

const queryString = computed(() => {
  const params = new URLSearchParams()
  params.set('date', filters.date)
  if (filters.status) params.set('status', filters.status)
  if (filters.category) params.set('category', filters.category)
  if (filters.search) params.set('search', filters.search)
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

const handleChangeStatus = async (entry: QueueEntry, newStatus: QueueEntry['status']) => {
  confirmEntry.value = entry
  confirmNextStatus.value = newStatus
  confirmOpen.value = true
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

const toggleSort = (column: typeof sortBy.value) => {
  if (sortBy.value !== column) {
    sortBy.value = column
    sortDir.value = 'desc'
  } else {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  }
  fetchList()
}

const buildExportFileName = () => {
  if (exportForm.dateFrom && exportForm.dateTo) {
    return `antrian_truk_${exportForm.dateFrom}_sampai_${exportForm.dateTo}.xlsx`
  }
  return 'antrian_truk.xlsx'
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
    fetchList()
  }
)

watch(
  () => filters.search,
  () => {
    if (searchTimer) window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => {
      fetchList()
    }, 400)
  }
)

onMounted(() => {
  fetchList()
  fetchCustomers()
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

</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Antrian Truk</h1>
        <p class="text-muted-foreground">Monitoring antrian masuk gudang</p>
      </div>
      <div class="flex items-center gap-2">
        <Button size="sm" variant="outline" @click="exportOpen = true">Export Excel</Button>
        <Button size="sm" @click="createOpen = true">Tambah Transaksi</Button>
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
        <QueueTable
          :entries="entries"
          :loading="loading"
          :sort-by="sortBy"
          :sort-dir="sortDir"
          @toggle-sort="toggleSort"
          @view-detail="handleViewDetail"
          @change-status="handleChangeStatus"
        />
      </CardContent>
    </Card>

    <QueueDetailDrawer :open="drawerOpen" :entry="selectedEntry" @close="closeDrawer" />
    <QueueCreateModal
      :open="createOpen"
      :submitting="createSubmitting"
      :customers="customers"
      @close="createOpen = false"
      @submit="handleCreate"
    />
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

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
  customerName: string
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

const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const entries = ref<QueueEntry[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const selectedEntry = ref<QueueEntry | null>(null)
const drawerOpen = ref(false)
const createOpen = ref(false)
const createSubmitting = ref(false)
const confirmOpen = ref(false)
const confirmEntry = ref<QueueEntry | null>(null)
const confirmNextStatus = ref<QueueEntry['status'] | null>(null)

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
  return params.toString()
})

const fetchList = async () => {
  loading.value = true
  error.value = null
  try {
    const url = `${apiBase}/api/queue?${queryString.value}`
    const response = await fetch(url)
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.message || 'Gagal mengambil data')
    }
    const payload = await response.json()
    entries.value = payload.data || []
  } catch (err: any) {
    error.value = err.message || 'Terjadi kesalahan'
  } finally {
    loading.value = false
  }
}

const fetchDetail = async (id: string) => {
  try {
    const response = await fetch(`${apiBase}/api/queue/${id}`)
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.message || 'Gagal mengambil detail')
    }
    const payload = await response.json()
    selectedEntry.value = payload.data
  } catch (err: any) {
    error.value = err.message || 'Gagal mengambil detail'
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
    const response = await fetch(`${apiBase}/api/queue/${confirmEntry.value.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-name': 'admin'
      },
      body: JSON.stringify({ newStatus: confirmNextStatus.value })
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.message || 'Gagal update status')
    }
    await fetchList()
    if (drawerOpen.value && selectedEntry.value?.id === confirmEntry.value.id) {
      await fetchDetail(confirmEntry.value.id)
    }
  } catch (err: any) {
    error.value = err.message || 'Gagal update status'
  } finally {
    confirmOpen.value = false
    confirmEntry.value = null
    confirmNextStatus.value = null
  }
}

const handleCreate = async (payload: {
  category: 'RECEIVING' | 'DELIVERY'
  customerName: string
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
      customerName: payload.customerName,
      driverName: payload.driverName,
      truckNumber: payload.truckNumber
    }
    if (payload.containerNumber.trim()) body.containerNumber = payload.containerNumber.trim()
    if (payload.notes.trim()) body.notes = payload.notes.trim()
    if (payload.registerTime) body.registerTime = new Date(payload.registerTime).toISOString()

    const response = await fetch(`${apiBase}/api/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-name': 'admin'
      },
      body: JSON.stringify(body)
    })
    if (!response.ok) {
      const resPayload = await response.json().catch(() => ({}))
      throw new Error(resPayload.message || 'Gagal menambah transaksi')
    }
    createOpen.value = false
    await fetchList()
  } catch (err: any) {
    error.value = err.message || 'Gagal menambah transaksi'
  } finally {
    createSubmitting.value = false
  }
}

const closeDrawer = () => {
  drawerOpen.value = false
  selectedEntry.value = null
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
        <QueueTable :entries="entries" :loading="loading" @view-detail="handleViewDetail" @change-status="handleChangeStatus" />
      </CardContent>
    </Card>

    <QueueDetailDrawer :open="drawerOpen" :entry="selectedEntry" @close="closeDrawer" />
    <QueueCreateModal :open="createOpen" :submitting="createSubmitting" @close="createOpen = false" @submit="handleCreate" />
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import api from '@/services/api'

type DisplayEntry = {
  id: string
  customer?: { id: string; name: string } | null
  category?: 'RECEIVING' | 'DELIVERY' | null
  driverName: string
  truckNumber: string
  containerNumber?: string | null
  registerTime: string
  status: 'MENUNGGU' | 'IN_WH' | 'PROSES' | 'SELESAI' | 'BATAL'
}

type Summary = {
  total: number
  delivery: number
  receiving: number
  menunggu: number
  proses: number
}

const entries = ref<DisplayEntry[]>([])
const summary = reactive<Summary>({
  total: 0,
  delivery: 0,
  receiving: 0,
  menunggu: 0,
  proses: 0
})
const loading = ref(false)
const error = ref<string | null>(null)
const now = ref(new Date())
const isFullscreen = ref(false)

const getErrorMessage = (err: any, fallback: string) => {
  return err?.response?.data?.message || err?.message || fallback
}

const fetchDisplay = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await api.get('/queue/display')
    entries.value = response.data?.data?.entries || []
    const s = response.data?.data?.summary || {}
    summary.total = s.total || 0
    summary.delivery = s.delivery || 0
    summary.receiving = s.receiving || 0
    summary.menunggu = s.menunggu || 0
    summary.proses = s.proses || 0
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal memuat data display')
  } finally {
    loading.value = false
  }
}

const statusLabel = (status: DisplayEntry['status']) => {
  if (status === 'MENUNGGU') return 'MENUNGGU'
  if (status === 'IN_WH') return 'IN WH'
  if (status === 'PROSES') return 'PROSES'
  if (status === 'SELESAI') return 'SELESAI'
  if (status === 'BATAL') return 'BATAL'
  return status
}

const categoryLabel = (category?: DisplayEntry['category']) => {
  if (category === 'RECEIVING') return 'Receiving'
  if (category === 'DELIVERY') return 'Delivery'
  return '-'
}

const categoryBadgeClass = (category?: DisplayEntry['category']) => {
  if (category === 'RECEIVING') return 'bg-blue-200 text-blue-900'
  if (category === 'DELIVERY') return 'bg-purple-200 text-purple-900'
  return 'bg-slate-200 text-slate-700'
}

const statusBadgeClass = (status: DisplayEntry['status']) => {
  if (status === 'MENUNGGU') return 'bg-yellow-200 text-yellow-900'
  if (status === 'IN_WH' || status === 'PROSES') return 'bg-blue-200 text-blue-900'
  if (status === 'SELESAI') return 'bg-green-200 text-green-900'
  return 'bg-slate-200 text-slate-700'
}

const rowHighlightClass = (status: DisplayEntry['status']) => {
  if (status === 'IN_WH' || status === 'PROSES') return 'bg-yellow-50'
  return ''
}

const formatTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const nowText = computed(() => {
  return now.value.toLocaleString()
})

const toggleFullscreen = async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  } catch {
    // ignore
  }
}

const handleFullscreenChange = () => {
  isFullscreen.value = Boolean(document.fullscreenElement)
}

let pollTimer: number | undefined
let clockTimer: number | undefined

onMounted(() => {
  fetchDisplay()
  pollTimer = window.setInterval(fetchDisplay, 12000)
  clockTimer = window.setInterval(() => {
    now.value = new Date()
  }, 1000)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onUnmounted(() => {
  if (pollTimer) window.clearInterval(pollTimer)
  if (clockTimer) window.clearInterval(clockTimer)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})
</script>

<template>
  <div class="min-h-screen bg-background p-6 md:p-10">
    <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="text-3xl md:text-4xl font-bold">Antrian Delivery & Receiving</h1>
        <p class="text-muted-foreground text-lg md:text-xl">Monitoring antrian hari ini</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="text-lg md:text-xl font-semibold">{{ nowText }}</div>
        <button
          type="button"
          class="px-4 py-2 rounded-md border bg-card text-sm font-semibold hover:bg-accent"
          @click="toggleFullscreen"
        >
          {{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}
        </button>
      </div>
    </header>

    <section class="mt-6 grid gap-4 md:grid-cols-5">
      <div class="rounded-lg border bg-card p-4">
        <div class="text-sm text-muted-foreground">Total Transaksi Hari Ini</div>
        <div class="text-2xl md:text-3xl font-bold">{{ summary.total }}</div>
      </div>
      <div class="rounded-lg border bg-card p-4">
        <div class="text-sm text-muted-foreground">Total Delivery Hari Ini</div>
        <div class="text-2xl md:text-3xl font-bold">{{ summary.delivery }}</div>
      </div>
      <div class="rounded-lg border bg-card p-4">
        <div class="text-sm text-muted-foreground">Total Receiving Hari Ini</div>
        <div class="text-2xl md:text-3xl font-bold">{{ summary.receiving }}</div>
      </div>
      <div class="rounded-lg border bg-card p-4">
        <div class="text-sm text-muted-foreground">Total Menunggu</div>
        <div class="text-2xl md:text-3xl font-bold">{{ summary.menunggu }}</div>
      </div>
      <div class="rounded-lg border bg-card p-4">
        <div class="text-sm text-muted-foreground">Total Sedang Diproses</div>
        <div class="text-2xl md:text-3xl font-bold">{{ summary.proses }}</div>
      </div>
    </section>

    <section class="mt-6">
      <div v-if="error" class="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
        {{ error }}
      </div>
      <div class="overflow-x-auto rounded-lg border">
        <table class="min-w-full text-lg">
          <thead class="bg-muted/60 text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left font-semibold">Kategori</th>
              <th class="px-4 py-3 text-left font-semibold">Driver Name</th>
              <th class="px-4 py-3 text-left font-semibold">No Truck</th>
              <th class="px-4 py-3 text-left font-semibold">No Container</th>
              <th class="px-4 py-3 text-left font-semibold">Customer Name</th>
              <th class="px-4 py-3 text-left font-semibold">Register Time</th>
              <th class="px-4 py-3 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="px-4 py-6 text-center text-muted-foreground">Loading...</td>
            </tr>
            <tr v-else-if="entries.length === 0">
              <td colspan="7" class="px-4 py-6 text-center text-muted-foreground">Data kosong.</td>
            </tr>
            <tr v-for="entry in entries" :key="entry.id" :class="['border-t', rowHighlightClass(entry.status)]">
              <td class="px-4 py-4">
                <span
                  class="inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold tracking-wide"
                  :class="categoryBadgeClass(entry.category)"
                >
                  {{ categoryLabel(entry.category) }}
                </span>
              </td>
              <td class="px-4 py-4 font-bold">{{ entry.driverName || '-' }}</td>
              <td class="px-4 py-4 font-semibold">{{ entry.truckNumber || '-' }}</td>
              <td class="px-4 py-4">{{ entry.containerNumber || '-' }}</td>
              <td class="px-4 py-4">{{ entry.customer?.name || '-' }}</td>
              <td class="px-4 py-4">{{ formatTime(entry.registerTime) }}</td>
              <td class="px-4 py-4">
                <span
                  :class="[
                    'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold tracking-wide',
                    statusBadgeClass(entry.status)
                  ]"
                >
                  {{ statusLabel(entry.status) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

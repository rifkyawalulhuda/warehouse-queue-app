<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import api from '@/services/api'

type DisplayEntry = {
  id: string
  customer?: { id: string; name: string } | null
  category?: 'RECEIVING' | 'DELIVERY' | null
  gate?: { id: string; gateNo: string; area: string; warehouse: 'WH1' | 'WH2' | 'DG' } | null
  driverName: string
  truckNumber: string
  containerNumber?: string | null
  registerTime: string
  inWhTime?: string | null
  startTime?: string | null
  status: 'MENUNGGU' | 'IN_WH' | 'PROSES' | 'SELESAI' | 'BATAL'
  remainingMinutes?: number | null
  statusTime?: string | null
  statusUpdatedAt?: string | null
  finishTime?: string | null
  updatedAt?: string | null
  lastStatusLog?: { createdAt?: string | null } | null
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

const formatGateShort = (gate?: DisplayEntry['gate'] | null) => {
  if (!gate?.gateNo) return '-'
  const gateNo = gate.gateNo.trim()
  if (!gate.warehouse) return gateNo
  return `${gateNo} - ${gate.warehouse}`
}

const formatGateArea = (gate?: DisplayEntry['gate'] | null) => {
  if (!gate?.area) return ''
  return gate.area.trim()
}

const formatStatusTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const sameDay = date.toDateString() === now.value.toDateString()
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${day}/${month} ${time}`
}

const getStatusTime = (entry: DisplayEntry) => {
  if (entry.statusTime) return entry.statusTime
  if (entry.statusUpdatedAt) return entry.statusUpdatedAt
  if (entry.lastStatusLog?.createdAt) return entry.lastStatusLog.createdAt
  if (entry.status === 'SELESAI' && entry.finishTime) return entry.finishTime
  if (entry.updatedAt) return entry.updatedAt
  return null
}

const parseRemainingMinutes = (value: unknown) => {
  if (value === null || value === undefined) return null
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

const getSlaMinutes = (entry: DisplayEntry) => {
  if (entry.status === 'MENUNGGU' || entry.status === 'IN_WH') return 30
  if (entry.status === 'PROSES') return entry.category === 'RECEIVING' ? 120 : 90
  return null
}

const getElapsedMinutes = (entry: DisplayEntry) => {
  if (entry.status === 'SELESAI' || entry.status === 'BATAL') return null
  const start =
    entry.status === 'PROSES' ? entry.startTime : entry.registerTime
  if (!start) return null
  const startMs = new Date(start).getTime()
  if (Number.isNaN(startMs)) return null
  const diffMs = now.value.getTime() - startMs
  if (diffMs < 0) return null
  return Math.floor(diffMs / 60000)
}

const getEffectiveRemainingMinutes = (entry: DisplayEntry) => {
  const fromApi = parseRemainingMinutes(entry.remainingMinutes)
  if (fromApi !== null) return fromApi
  const sla = getSlaMinutes(entry)
  const elapsed = getElapsedMinutes(entry)
  if (sla === null || elapsed === null) return null
  return sla - elapsed
}

const getSlaState = (entry: DisplayEntry) => {
  const remaining = getEffectiveRemainingMinutes(entry)
  if (remaining === null) return 'normal'
  if (remaining <= 0) return 'over'
  if (remaining < 15) return 'warning'
  return 'normal'
}

const rowClass = (entry: DisplayEntry) => {
  const state = getSlaState(entry)
  if (state === 'over') return 'bg-red-50 hover:bg-red-100 border-l-4 border-red-400'
  if (state === 'warning') return 'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-yellow-400'
  return 'hover:bg-gray-50'
}

const formatRemaining = (mins?: number | null) => {
  if (mins === null || mins === undefined) return '-'
  if (mins <= 0) return `Lewat ${Math.abs(mins)} menit`
  return `Sisa ${mins} menit`
}

const warningRows = computed(() => entries.value.filter((entry) => getSlaState(entry) === 'warning'))
const overRows = computed(() => entries.value.filter((entry) => getSlaState(entry) === 'over'))

const formatDisplayDateTime = (date: Date) => {
  const weekday = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(date)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const datePart = `${day}-${month}-${year}`
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  const timePart = `${hh}:${mm}:${ss}`
  return `${weekday}, ${datePart} ${timePart}`
}

const nowText = computed(() => {
  return formatDisplayDateTime(now.value)
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
        
        <p class="text-muted-foreground text-lg md:text-xl">PT. SANKYU INDONESIA INTERNATIONAL CIKARANG LOGISTIC CENTER</p>
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
      <div v-if="warningRows.length + overRows.length > 0" class="mb-4 space-y-2">
        <div v-if="overRows.length" class="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
          <div class="font-semibold">Melewati batas waktu (OVER)</div>
          <ul class="mt-1 list-disc pl-5 text-sm">
            <li v-for="entry in overRows.slice(0, 5)" :key="entry.id">
              {{ entry.driverName || '-' }} - {{ entry.truckNumber || '-' }}
              ({{ formatRemaining(getEffectiveRemainingMinutes(entry)) }})
            </li>
          </ul>
          <div v-if="overRows.length > 5" class="text-xs mt-1 opacity-80">
            +{{ overRows.length - 5 }} lainnya
          </div>
        </div>
        <div v-if="warningRows.length" class="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-yellow-900">
          <div class="font-semibold">Hampir melewati batas (&lt; 15 menit)</div>
          <ul class="mt-1 list-disc pl-5 text-sm">
            <li v-for="entry in warningRows.slice(0, 5)" :key="entry.id">
              {{ entry.driverName || '-' }} - {{ entry.truckNumber || '-' }}
              ({{ formatRemaining(getEffectiveRemainingMinutes(entry)) }})
            </li>
          </ul>
          <div v-if="warningRows.length > 5" class="text-xs mt-1 opacity-80">
            +{{ warningRows.length - 5 }} lainnya
          </div>
        </div>
      </div>
      <div class="overflow-x-auto rounded-lg border">
        <table class="min-w-full text-lg">
          <thead class="bg-muted/60 text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left font-semibold">Kategori</th>
              <th class="px-4 py-3 text-left font-semibold">Driver Name</th>
              <th class="px-4 py-3 text-left font-semibold">No Truck</th>
              <th class="px-3 py-3 text-left font-semibold">No Container</th>
              <th class="px-3 py-3 text-center font-semibold">Gate</th>
              <th class="px-3 py-3 text-left font-semibold">Customer Name</th>
              <th class="px-4 py-3 text-left font-semibold">Register Time</th>
              <th class="px-4 py-3 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="px-4 py-6 text-center text-muted-foreground">Loading...</td>
            </tr>
            <tr v-else-if="entries.length === 0">
              <td colspan="8" class="px-4 py-6 text-center text-muted-foreground">Data kosong.</td>
            </tr>
            <tr
              v-for="entry in entries"
              :key="entry.id"
              :class="['border-t', rowHighlightClass(entry.status), rowClass(entry)]"
            >
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
              <td class="px-3 py-4">{{ entry.containerNumber || '-' }}</td>
              <td class="px-3 py-4 text-center font-semibold whitespace-nowrap">
                <div class="flex flex-col items-center leading-tight">
                  <span>{{ formatGateShort(entry.gate) }}</span>
                  <span v-if="formatGateArea(entry.gate)" class="text-xs font-normal text-muted-foreground">
                    {{ formatGateArea(entry.gate) }}
                  </span>
                </div>
              </td>
              <td class="px-3 py-4">{{ entry.customer?.name || '-' }}</td>
              <td class="px-4 py-4">{{ formatTime(entry.registerTime) }}</td>
              <td class="px-4 py-4">
                <div class="flex flex-col items-start gap-1">
                  <span
                    :class="[
                      'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold tracking-wide',
                      statusBadgeClass(entry.status)
                    ]"
                  >
                    {{ statusLabel(entry.status) }}
                  </span>
                  <span class="text-xs text-muted-foreground">
                    {{ formatStatusTime(getStatusTime(entry)) }}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

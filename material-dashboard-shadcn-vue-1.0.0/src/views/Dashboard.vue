<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardTitle from '@/components/ui/CardTitle.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import HourlyTotalLineChart from '@/components/dashboard/HourlyTotalLineChart.vue'
import HourlyCategoryStackedBar from '@/components/dashboard/HourlyCategoryStackedBar.vue'
import StatusPieChart from '@/components/dashboard/StatusPieChart.vue'
import TopCustomerDurationTable from '@/components/dashboard/TopCustomerDurationTable.vue'
import OverSlaTable from '@/components/dashboard/OverSlaTable.vue'
import {
  getDashboardHourly,
  getDashboardProgressSummary,
  getDashboardScheduleSummary,
  getDashboardStatus,
  getDashboardSummary,
  getOverSla,
  getTopCustomers
} from '@/services/dashboardApi'

type Summary = {
  date: string
  total: number
  delivery: number
  receiving: number
  waiting: number
  processing: number
  done: number
  cancelled: number
  avgProcessMinutes: number
  overSlaPercent: number
}

type HourlyItem = { hour: string; total: number; receiving: number; delivery: number }
type StatusItem = { name: string; value: number }
type TopCustomerItem = { customerName: string; avgDurationMinutes: number; totalTransactions: number }
type OverSlaItem = { id: string; customerName: string; truckNumber: string; status: string; overMinutes: number }
type ScheduleSummary = { date: string; storeIn: number; storeOut: number; total: number }
type ProgressSummary = {
  date: string
  targetPengiriman: number
  selesaiCount: number
  prosesCount: number
  selesaiPct: number
  prosesPct: number
  totalPct: number
}

const getToday = () => {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const today = ref(getToday())
const selectedDate = ref(today.value)
const autoFollowToday = ref(true)
const router = useRouter()
const summary = reactive<Summary>({
  date: selectedDate.value,
  total: 0,
  delivery: 0,
  receiving: 0,
  waiting: 0,
  processing: 0,
  done: 0,
  cancelled: 0,
  avgProcessMinutes: 0,
  overSlaPercent: 0
})
const hourlyItems = ref<HourlyItem[]>([])
const statusItems = ref<StatusItem[]>([])
const topCustomers = ref<TopCustomerItem[]>([])
const overSlaItems = ref<OverSlaItem[]>([])
const scheduleSummary = reactive<ScheduleSummary>({
  date: selectedDate.value,
  storeIn: 0,
  storeOut: 0,
  total: 0
})
const isLoadingScheduleSummary = ref(false)
const progressSummary = reactive<ProgressSummary>({
  date: selectedDate.value,
  targetPengiriman: 0,
  selesaiCount: 0,
  prosesCount: 0,
  selesaiPct: 0,
  prosesPct: 0,
  totalPct: 0
})
const isLoadingProgress = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

const isToday = computed(() => selectedDate.value === today.value)
const hasProgressTarget = computed(() => progressSummary.targetPengiriman > 0)
const isOverTarget = computed(() => progressSummary.totalPct > 100)

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const selesaiWidth = computed(() => clamp(progressSummary.selesaiPct, 0, 100))
const prosesWidth = computed(() => clamp(progressSummary.prosesPct, 0, 100 - selesaiWidth.value))
const rawSelesaiPctText = computed(() => progressSummary.selesaiPct.toFixed(0))
const rawProsesPctText = computed(() => progressSummary.prosesPct.toFixed(0))
const rawTotalPctText = computed(() => progressSummary.totalPct.toFixed(0))
const selesaiBarLabel = computed(
  () => `Selesai: ${progressSummary.selesaiCount} (${rawSelesaiPctText.value}%)`
)
const prosesBarLabel = computed(
  () => `Proses: ${progressSummary.prosesCount} (${rawProsesPctText.value}%)`
)
const showSelesaiLabelInBar = computed(() => selesaiWidth.value >= 18)
const showProsesLabelInBar = computed(() => prosesWidth.value >= 18)

const getErrorMessage = (err: any, fallback: string) => {
  return err?.response?.data?.message || err?.message || fallback
}

const fetchDashboard = async () => {
  loading.value = true
  error.value = null
  try {
    const [summaryRes, hourlyRes, statusRes, topCustomerRes, overSlaRes] = await Promise.all([
      getDashboardSummary(selectedDate.value),
      getDashboardHourly(selectedDate.value),
      getDashboardStatus(selectedDate.value),
      getTopCustomers(selectedDate.value),
      getOverSla(selectedDate.value)
    ])

    const s = summaryRes.data || {}
    summary.date = s.date || selectedDate.value
    summary.total = s.total || 0
    summary.delivery = s.delivery || 0
    summary.receiving = s.receiving || 0
    summary.waiting = s.waiting || 0
    summary.processing = s.processing || 0
    summary.done = s.done || 0
    summary.cancelled = s.cancelled || 0
    summary.avgProcessMinutes = s.avgProcessMinutes || 0
    summary.overSlaPercent = s.overSlaPercent || 0

    hourlyItems.value = hourlyRes.data?.items || []
    statusItems.value = statusRes.data?.items || []
    topCustomers.value = topCustomerRes.data?.items || []
    overSlaItems.value = overSlaRes.data?.items || []
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal memuat dashboard')
  } finally {
    loading.value = false
  }
}

const fetchScheduleSummary = async () => {
  isLoadingScheduleSummary.value = true
  try {
    const response = await getDashboardScheduleSummary(selectedDate.value)
    const data = response.data?.data || response.data || {}
    scheduleSummary.date = data.date || selectedDate.value
    scheduleSummary.storeIn = data.storeIn || 0
    scheduleSummary.storeOut = data.storeOut || 0
    scheduleSummary.total = data.total || 0
  } catch (err: any) {
    scheduleSummary.date = selectedDate.value
    scheduleSummary.storeIn = 0
    scheduleSummary.storeOut = 0
    scheduleSummary.total = 0
    error.value = getErrorMessage(err, 'Gagal memuat dashboard')
  } finally {
    isLoadingScheduleSummary.value = false
  }
}

const fetchProgressSummary = async () => {
  isLoadingProgress.value = true
  try {
    const response = await getDashboardProgressSummary(selectedDate.value)
    const data = response.data?.data || response.data || {}
    progressSummary.date = data.date || selectedDate.value
    progressSummary.targetPengiriman = data.targetPengiriman || 0
    progressSummary.selesaiCount = data.selesaiCount || 0
    progressSummary.prosesCount = data.prosesCount || 0
    progressSummary.selesaiPct = data.selesaiPct || 0
    progressSummary.prosesPct = data.prosesPct || 0
    progressSummary.totalPct = data.totalPct || 0
  } catch (err: any) {
    progressSummary.date = selectedDate.value
    progressSummary.targetPengiriman = 0
    progressSummary.selesaiCount = 0
    progressSummary.prosesCount = 0
    progressSummary.selesaiPct = 0
    progressSummary.prosesPct = 0
    progressSummary.totalPct = 0
    error.value = getErrorMessage(err, 'Gagal memuat dashboard')
  } finally {
    isLoadingProgress.value = false
  }
}

let refreshTimer: number | undefined
let todayTimer: number | undefined

const openQueueDetail = (id: string) => {
  router.push({ path: '/antrian-truk', query: { detailId: id } })
}

const openSchedulePage = (type: 'STORE_IN' | 'STORE_OUT' | null) => {
  const query: Record<string, string> = {
    date: selectedDate.value
  }
  if (type) {
    query.type = type
  }
  router.push({ path: '/schedule-pengiriman', query })
}

const formatPrintDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  return `${match[3]}/${match[2]}/${match[1]}`
}

const handlePrintDashboard = () => {
  window.setTimeout(() => {
    window.print()
  }, 100)
}

const handleRefresh = async () => {
  await Promise.all([fetchDashboard(), fetchScheduleSummary(), fetchProgressSummary()])
}

const setupAutoRefresh = () => {
  if (refreshTimer) window.clearInterval(refreshTimer)
  if (!isToday.value) return
  refreshTimer = window.setInterval(() => {
    handleRefresh()
  }, 30000)
}

watch(
  () => selectedDate.value,
  (value) => {
    autoFollowToday.value = value === today.value
    handleRefresh()
    setupAutoRefresh()
  }
)

onMounted(() => {
  todayTimer = window.setInterval(() => {
    today.value = getToday()
    if (autoFollowToday.value) {
      selectedDate.value = today.value
    }
  }, 10000)
  handleRefresh()
  setupAutoRefresh()
})

onUnmounted(() => {
  if (refreshTimer) window.clearInterval(refreshTimer)
  if (todayTimer) window.clearInterval(todayTimer)
})
</script>

<template>
  <div id="dashboard-print-root" class="space-y-6">
    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div class="dashboard-print-title">
        <h1 class="text-xl font-bold tracking-tight">Dashboard Progress Delivery & Receiving</h1>
        <p class="text-muted-foreground">Monitoring Ringkasan operasional</p>
        <p class="dashboard-print-date">Tanggal: {{ formatPrintDate(selectedDate) }}</p>
      </div>
      <div class="dashboard-actions flex flex-wrap items-center gap-2">
        <input
          v-model="selectedDate"
          type="date"
          class="bg-transparent border rounded-md px-2 py-2 text-sm"
        />
        <Button size="sm" variant="outline" class="border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white" @click="handlePrintDashboard">Print</Button>
        <Button size="sm" variant="outline" @click="handleRefresh">Refresh</Button>
      </div>
    </div>

    <div v-if="error" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ error }}
      <Button size="sm" variant="ghost" class="ml-2" @click="handleRefresh">Retry</Button>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <Card
        class="cursor-pointer transition-all hover:border-primary/40 hover:shadow-md"
        @click="openSchedulePage('STORE_IN')"
      >
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Jumlah Store In</CardTitle>
          <span class="text-xs text-muted-foreground">View</span>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ isLoadingScheduleSummary ? '...' : scheduleSummary.storeIn }}</div>
        </CardContent>
      </Card>

      <Card
        class="cursor-pointer transition-all hover:border-primary/40 hover:shadow-md"
        @click="openSchedulePage('STORE_OUT')"
      >
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Jumlah Store Out</CardTitle>
          <span class="text-xs text-muted-foreground">View</span>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ isLoadingScheduleSummary ? '...' : scheduleSummary.storeOut }}</div>
        </CardContent>
      </Card>

      <Card
        class="cursor-pointer transition-all hover:border-primary/40 hover:shadow-md"
        @click="openSchedulePage(null)"
      >
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Total Pengiriman</CardTitle>
          <span class="text-xs text-muted-foreground">View</span>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ isLoadingScheduleSummary ? '...' : scheduleSummary.total }}</div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader class="pb-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <CardTitle class="text-sm font-medium">Loading Progress Chart</CardTitle>
          <span v-if="isOverTarget" class="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
            Over Target
          </span>
        </div>
      </CardHeader>
      <CardContent class="space-y-3">
        <div v-if="isLoadingProgress" class="text-sm text-muted-foreground">Loading progress...</div>
        <template v-else>
          <p v-if="!hasProgressTarget" class="text-sm text-muted-foreground">Belum ada target pengiriman</p>
          <div class="h-8 w-full overflow-hidden rounded-full bg-muted">
            <div class="flex h-full">
              <div
                class="flex h-full items-center justify-center overflow-hidden bg-[#28a745] transition-all duration-300"
                :style="{ width: `${selesaiWidth}%` }"
              >
                <span v-if="showSelesaiLabelInBar" class="truncate px-2 text-[11px] font-semibold text-white">
                  {{ selesaiBarLabel }}
                </span>
              </div>
              <div
                class="flex h-full items-center justify-center overflow-hidden bg-[#0d6efd] transition-all duration-300"
                :style="{ width: `${prosesWidth}%` }"
              >
                <span v-if="showProsesLabelInBar" class="truncate px-2 text-[11px] font-semibold text-white">
                  {{ prosesBarLabel }}
                </span>
              </div>
            </div>
          </div>
          <div class="grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
            <p>Target Receiving/Delivery: {{ progressSummary.targetPengiriman }}</p>
            <p>Total Progress: {{ rawTotalPctText }}%</p>
            <p v-if="!showSelesaiLabelInBar">Selesai: {{ progressSummary.selesaiCount }} ({{ rawSelesaiPctText }}%)</p>
            <p v-if="!showProsesLabelInBar">Proses: {{ progressSummary.prosesCount }} ({{ rawProsesPctText }}%)</p>
          </div>
        </template>
      </CardContent>
    </Card>

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Total Transaksi</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ summary.total }}</div>
          <p class="text-xs text-muted-foreground">Avg Process: {{ summary.avgProcessMinutes }} menit</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Delivery</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ summary.delivery }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Receiving</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ summary.receiving }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Menunggu</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ summary.waiting }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Sedang Diproses</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ summary.processing }}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">Over SLA</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ summary.overSlaPercent }}%</div>
        </CardContent>
      </Card>
    </div>

    <div v-if="loading" class="text-sm text-muted-foreground">Loading...</div>

    <div class="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Transaksi per Jam</CardTitle>
        </CardHeader>
        <CardContent>
          <HourlyTotalLineChart :items="hourlyItems" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receiving vs Delivery per Jam</CardTitle>
        </CardHeader>
        <CardContent>
          <HourlyCategoryStackedBar :items="hourlyItems" />
        </CardContent>
      </Card>
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
      <Card class="lg:col-span-1">
        <CardHeader>
          <CardTitle>Distribusi Status</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusPieChart :items="statusItems" />
        </CardContent>
      </Card>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Customer Terlama</CardTitle>
        </CardHeader>
        <CardContent>
          <TopCustomerDurationTable :items="topCustomers" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Over SLA</CardTitle>
        </CardHeader>
        <CardContent>
          <OverSlaTable :items="overSlaItems" @select="openQueueDetail" />
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<style>
.dashboard-print-date {
  display: none;
}

@media print {
  @page {
    size: A4 portrait;
    margin: 10mm;
  }

  aside,
  nav.bg-card.border-b,
  footer,
  .dashboard-actions {
    display: none !important;
  }

  .flex.h-screen.bg-background {
    display: block !important;
    height: auto !important;
  }

  .flex-1.flex.flex-col.overflow-hidden,
  main.flex-1.overflow-auto,
  .p-4.md\:p-8 {
    overflow: visible !important;
    height: auto !important;
  }

  #dashboard-print-root {
    margin: 0 !important;
    padding: 0 !important;
    font-size: 11px;
  }

  #dashboard-print-root canvas {
    max-width: 100% !important;
  }

  .dashboard-print-date {
    display: block !important;
    font-size: 12px;
    color: #555;
    margin-top: 4px;
  }
}
</style>

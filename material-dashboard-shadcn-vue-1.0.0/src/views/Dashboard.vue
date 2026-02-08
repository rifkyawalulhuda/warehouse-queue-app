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
import { getDashboardHourly, getDashboardStatus, getDashboardSummary, getOverSla, getTopCustomers } from '@/services/dashboardApi'

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

const todayString = () => new Date().toISOString().slice(0, 10)

const selectedDate = ref(todayString())
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
const loading = ref(false)
const error = ref<string | null>(null)

const isToday = computed(() => selectedDate.value === todayString())

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

let refreshTimer: number | undefined

const openQueueDetail = (id: string) => {
  router.push({ path: '/antrian-truk', query: { detailId: id } })
}

const setupAutoRefresh = () => {
  if (refreshTimer) window.clearInterval(refreshTimer)
  if (!isToday.value) return
  refreshTimer = window.setInterval(() => {
    fetchDashboard()
  }, 30000)
}

watch(
  () => selectedDate.value,
  () => {
    fetchDashboard()
    setupAutoRefresh()
  }
)

onMounted(() => {
  fetchDashboard()
  setupAutoRefresh()
})

onUnmounted(() => {
  if (refreshTimer) window.clearInterval(refreshTimer)
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Dashboard Antrian Truk</h1>
        <p class="text-muted-foreground">Ringkasan operasional</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <input
          v-model="selectedDate"
          type="date"
          class="bg-transparent border rounded-md px-2 py-2 text-sm"
        />
        <Button size="sm" variant="outline" @click="fetchDashboard">Refresh</Button>
      </div>
    </div>

    <div v-if="error" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ error }}
      <Button size="sm" variant="ghost" class="ml-2" @click="fetchDashboard">Retry</Button>
    </div>

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

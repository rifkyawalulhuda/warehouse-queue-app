<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import Combobox from '@/components/ui/Combobox.vue'
import ExportDialog from '@/components/export/ExportDialog.vue'
import ReportDataTable from '@/components/report/ReportDataTable.vue'
import type { ReportColumn } from '@/components/report/types'
import {
  getScheduleReport,
  getTransporters,
  type ReportActualRow,
  type ReportPlanRow,
  type ReportResponse,
  type Transporter
} from '@/services/scheduleApi'
import api from '@/services/api'

type Customer = { id: string; name: string }

const loading = ref(false)
const error = ref<string | null>(null)
const report = ref<ReportResponse | null>(null)
const customers = ref<Customer[]>([])
const transporters = ref<Transporter[]>([])
const exportOpen = ref(false)

type ScopeMode = 'year' | 'month' | 'range'

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
]

const now = new Date()
const pad = (value: number) => String(value).padStart(2, '0')
const today = () => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const firstOfMonth = () => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`

// R5: periode halaman memakai kontrol yang sama dengan modal export.
const period = reactive({
  mode: 'month' as ScopeMode,
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  dateFrom: firstOfMonth(),
  dateTo: today()
})

/** Mengubah periode terpilih menjadi rentang tanggal pasti untuk API report. */
const periodRange = computed(() => {
  if (period.mode === 'year') {
    return { dateFrom: `${period.year}-01-01`, dateTo: `${period.year}-12-31` }
  }
  if (period.mode === 'month') {
    const lastDay = new Date(period.year, period.month, 0).getDate()
    return {
      dateFrom: `${period.year}-${pad(period.month)}-01`,
      dateTo: `${period.year}-${pad(period.month)}-${pad(lastDay)}`
    }
  }
  return { dateFrom: period.dateFrom, dateTo: period.dateTo || period.dateFrom }
})

const periodLabel = computed(() => {
  if (period.mode === 'year') return `Tahun ${period.year}`
  if (period.mode === 'month') return `${MONTHS[period.month - 1]} ${period.year}`
  return `${periodRange.value.dateFrom} s/d ${periodRange.value.dateTo}`
})

const exportPrefill = computed(() => ({
  mode: period.mode,
  year: period.year,
  month: period.month,
  dateFrom: period.dateFrom,
  dateTo: period.dateTo
}))

const filters = reactive({
  customerId: '',
  transporterId: '',
  category: '' as '' | 'RECEIVING' | 'DELIVERY',
  groupBy: 'date' as 'date' | 'customer' | 'transporter'
})

const categoryOptions = [
  { value: 'RECEIVING', label: 'Receiving (STORE IN)' },
  { value: 'DELIVERY', label: 'Delivery (STORE OUT)' }
]

const groupByOptions = [
  { value: 'date', label: 'Per Tanggal' },
  { value: 'customer', label: 'Per Customer' },
  { value: 'transporter', label: 'Per Transporter' }
]

const customerOptions = computed(() =>
  customers.value.map((customer) => ({ value: customer.id, label: customer.name }))
)

const transporterOptions = computed(() =>
  transporters.value.map((item) => ({ value: item.id, label: item.name }))
)

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const formatVariance = (minutes?: number | null) => {
  if (minutes === null || minutes === undefined) return '-'
  const sign = minutes > 0 ? '+' : ''
  return `${sign}${minutes} mnt`
}

const varianceClass = (minutes?: number | null, onTime?: boolean | null) => {
  if (minutes === null || minutes === undefined) return 'text-muted-foreground'
  if (onTime === null || onTime === undefined) return 'text-muted-foreground'
  return onTime ? 'text-emerald-600' : 'text-red-600'
}

const onTimeLabel = (onTime?: boolean | null) => {
  if (onTime === null || onTime === undefined) return '-'
  return onTime ? 'On time' : 'Terlambat'
}

/**
 * Warna chip status. Teks statusnya selalu ikut tampil, jadi warna hanya
 * penguat — bukan satu-satunya penanda (WCAG color-not-only).
 */
const statusChipClass = (status?: string | null) => {
  const key = String(status || '').toUpperCase()
  if (key === 'SELESAI') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
  if (key === 'BATAL' || key === 'NO_SHOW') return 'bg-red-500/10 text-red-700 dark:text-red-400'
  if (key === 'NO_SHOW_CLOSED') return 'bg-muted text-muted-foreground'
  if (key === 'MENUNGGU') return 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
  if (key === 'IN_WH' || key === 'PROSES') return 'bg-sky-500/10 text-sky-700 dark:text-sky-400'
  if (key === 'PLANNED') return 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
  return 'bg-muted text-muted-foreground'
}

const percent = (value?: number | null) => {
  if (value === null || value === undefined) return '-'
  return `${value}%`
}

const summary = computed(() => report.value?.summary || null)

const fetchCustomers = async () => {
  try {
    const response = await api.get('/customers')
    customers.value = response.data?.data || []
  } catch {
    customers.value = []
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

const buildParams = () => {
  const params: Record<string, string> = {
    dateFrom: periodRange.value.dateFrom,
    dateTo: periodRange.value.dateTo,
    groupBy: filters.groupBy
  }
  if (filters.customerId) params.customerId = filters.customerId
  if (filters.transporterId) params.transporterId = filters.transporterId
  if (filters.category) params.category = filters.category
  return params
}

const fetchReport = async () => {
  loading.value = true
  error.value = null
  try {
    const { data } = await getScheduleReport(buildParams() as any)
    report.value = data.data
  } catch (err: any) {
    error.value = err?.response?.data?.message || 'Gagal memuat report'
    report.value = null
  } finally {
    loading.value = false
  }
}

const planRows = computed<ReportPlanRow[]>(() => report.value?.planRows || [])
const actualRows = computed<ReportActualRow[]>(() => report.value?.actualRows || [])

// --- Konfigurasi tabel report -------------------------------------------
// Kolom didefinisikan sekali di sini supaya ketiga tabel memakai perilaku
// sortir/pencarian/paginasi yang sama.
const groupColumns: ReportColumn[] = [
  { key: 'label', label: 'Kelompok', sortable: true, mobileTitle: true },
  { key: 'totalPlan', label: 'Rencana', align: 'right', sortable: true, sortType: 'number', mono: true, mobile: true },
  { key: 'totalActual', label: 'Aktual', align: 'right', sortable: true, sortType: 'number', mono: true, mobile: true },
  { key: 'onTimeRate', label: 'On-time Tiba', align: 'right', sortable: true, sortType: 'number', mono: true, mobile: true },
  { key: 'avgVariance', label: 'Avg Telat', align: 'right', sortable: true, sortType: 'number', mono: true, mobile: true }
]

const planColumns: ReportColumn[] = [
  { key: 'scheduleDate', label: 'Tanggal', sortable: true, sortType: 'date', mobile: true },
  { key: 'plateNumber', label: 'Plat', sortable: true, mobileTitle: true },
  { key: 'customerName', label: 'Customer Plan', sortable: true, mobile: true },
  { key: 'transporterName', label: 'Transporter Plan', sortable: true, mobile: true },
  { key: 'plannedStart', label: 'Estimasi Start', sortable: true, sortType: 'date', mobile: true },
  { key: 'registerTime', label: 'Aktual Tiba', sortable: true, sortType: 'date', mobile: true },
  {
    key: 'varianceArrivalMinutes',
    label: 'Variance Tiba',
    align: 'right',
    sortable: true,
    sortType: 'number',
    mono: true,
    mobile: true
  },
  { key: 'plannedFinish', label: 'Estimasi Finish', sortable: true, sortType: 'date' },
  { key: 'finishTime', label: 'Aktual Selesai', sortable: true, sortType: 'date' },
  {
    key: 'varianceFinishMinutes',
    label: 'Variance Selesai',
    align: 'right',
    sortable: true,
    sortType: 'number',
    mono: true
  },
  { key: 'statusText', label: 'Status', sortable: true, mobile: true }
]

const actualColumns: ReportColumn[] = [
  { key: 'registerTime', label: 'Tiba', sortable: true, sortType: 'date', mobile: true },
  { key: 'truckNumber', label: 'No Truck', sortable: true, mobileTitle: true },
  { key: 'customerName', label: 'Customer Aktual', sortable: true, mobile: true },
  { key: 'plannedCustomerName', label: 'Customer Plan', sortable: true },
  { key: 'transporterName', label: 'Transporter Aktual', sortable: true, mobile: true },
  { key: 'containerNumbers', label: 'Container', sortable: true, mobile: true },
  {
    key: 'varianceArrivalMinutes',
    label: 'Variance Tiba',
    align: 'right',
    sortable: true,
    sortType: 'number',
    mono: true,
    mobile: true
  },
  {
    key: 'varianceFinishMinutes',
    label: 'Variance Selesai',
    align: 'right',
    sortable: true,
    sortType: 'number',
    mono: true
  },
  { key: 'status', label: 'Status', sortable: true, mobile: true }
]

const groupTableRows = computed(() =>
  (report.value?.groups || []).map((group) => ({
    key: group.key,
    label: group.label,
    totalPlan: group.summary.totalPlan,
    totalActual: group.summary.totalActual,
    onTimeRate: group.summary.arrival.onTimeRate,
    avgVariance: group.summary.arrival.avgVarianceMinutes
  }))
)

const planTableRows = computed(() =>
  planRows.value.map((row) => ({
    ...row,
    statusText: row.queueStatus || row.scheduleStatus
  }))
)

const formatContainer = (value?: string[] | null) =>
  value && value.length > 0 ? value.join(', ') : '-'


onMounted(() => {
  fetchCustomers()
  fetchTransporters()
  fetchReport()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Report Schedule vs Aktual</h1>
        <p class="text-sm text-muted-foreground">
          Perbandingan waktu rencana pada Schedule Pengiriman dengan waktu aktual Antrian Truk.
        </p>
      </div>
      <Button variant="outline" size="sm" :disabled="loading" @click="exportOpen = true">
        Export Excel
      </Button>
    </div>

    <div class="rounded-lg border bg-card p-4">
      <div class="grid gap-3 md:grid-cols-6">
        <div class="md:col-span-2">
          <label class="text-xs text-muted-foreground">Periode</label>
          <div class="mt-1 inline-flex w-full rounded-lg border bg-muted/40 p-1">
            <button
              v-for="option in [
                { key: 'year', label: 'Tahun' },
                { key: 'month', label: 'Bulan' },
                { key: 'range', label: 'Rentang' }
              ]"
              :key="option.key"
              type="button"
              class="flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors"
              :class="
                period.mode === option.key
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:text-foreground'
              "
              :aria-pressed="period.mode === option.key"
              @click="period.mode = option.key as ScopeMode"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div v-if="period.mode === 'year'" class="md:col-span-1">
          <label class="text-xs text-muted-foreground">Tahun</label>
          <input
            v-model.number="period.year"
            type="number"
            min="2000"
            max="2100"
            class="mt-1 w-full rounded-md border bg-transparent px-2 py-2 text-sm"
          />
        </div>

        <template v-if="period.mode === 'month'">
          <div class="md:col-span-1">
            <label class="text-xs text-muted-foreground">Tahun</label>
            <input
              v-model.number="period.year"
              type="number"
              min="2000"
              max="2100"
              class="mt-1 w-full rounded-md border bg-transparent px-2 py-2 text-sm"
            />
          </div>
          <div class="md:col-span-1">
            <label class="text-xs text-muted-foreground">Bulan</label>
            <select
              v-model.number="period.month"
              class="mt-1 w-full rounded-md border bg-transparent px-2 py-2 text-sm"
            >
              <option v-for="(label, index) in MONTHS" :key="label" :value="index + 1">
                {{ label }}
              </option>
            </select>
          </div>
        </template>

        <template v-if="period.mode === 'range'">
          <div class="md:col-span-1">
            <label class="text-xs text-muted-foreground">Dari Tanggal</label>
            <input
              v-model="period.dateFrom"
              type="date"
              class="mt-1 w-full rounded-md border bg-transparent px-2 py-2 text-sm"
            />
          </div>
          <div class="md:col-span-1">
            <label class="text-xs text-muted-foreground">Sampai Tanggal</label>
            <input
              v-model="period.dateTo"
              type="date"
              class="mt-1 w-full rounded-md border bg-transparent px-2 py-2 text-sm"
            />
          </div>
        </template>

        <div>
          <label class="text-xs text-muted-foreground">Customer</label>
          <div class="mt-1">
            <Combobox
              v-model="filters.customerId"
              :options="customerOptions"
              placeholder="Semua customer"
              search-placeholder="Cari customer..."
              empty-text="Tidak ada customer"
            />
          </div>
        </div>
        <div>
          <label class="text-xs text-muted-foreground">Transporter</label>
          <div class="mt-1">
            <Combobox
              v-model="filters.transporterId"
              :options="transporterOptions"
              placeholder="Semua transporter"
              search-placeholder="Cari transporter..."
              empty-text="Tidak ada transporter"
            />
          </div>
        </div>
        <div>
          <label class="text-xs text-muted-foreground">Kategori</label>
          <div class="mt-1">
            <Combobox
              v-model="filters.category"
              :options="categoryOptions"
              placeholder="Semua kategori"
              search-placeholder="Cari kategori..."
              empty-text="Tidak ada kategori"
            />
          </div>
        </div>
        <div>
          <label class="text-xs text-muted-foreground">Kelompok</label>
          <div class="mt-1">
            <Combobox
              v-model="filters.groupBy"
              :options="groupByOptions"
              placeholder="Per tanggal"
              search-placeholder="Cari kelompok..."
              empty-text="Tidak ada pilihan"
            />
          </div>
        </div>
      </div>
      <div class="mt-3 flex items-center justify-between gap-2">
        <p class="text-xs text-muted-foreground">
          Periode: <span class="font-medium text-foreground">{{ periodLabel }}</span>
        </p>
        <Button variant="ghost" size="sm" :disabled="loading" @click="fetchReport">
          {{ loading ? 'Memuat...' : 'Terapkan' }}
        </Button>
      </div>
      <p v-if="error" class="mt-2 text-xs text-red-600">{{ error }}</p>
    </div>

    <div v-if="summary" class="grid gap-4 md:grid-cols-4">
      <div class="rounded-lg border bg-card p-4">
        <p class="text-xs text-muted-foreground">Total Rencana</p>
        <p class="mt-1 text-2xl font-bold">{{ summary.totalPlan }}</p>
        <p class="text-xs text-muted-foreground">No show: {{ summary.totalNoShow }}</p>
      </div>
      <div class="rounded-lg border bg-card p-4">
        <p class="text-xs text-muted-foreground">Total Aktual</p>
        <p class="mt-1 text-2xl font-bold">{{ summary.totalActual }}</p>
        <p class="text-xs text-muted-foreground">Termasuk walk-in</p>
      </div>
      <div class="rounded-lg border bg-card p-4">
        <p class="text-xs text-muted-foreground">On-time Kedatangan</p>
        <p class="mt-1 text-2xl font-bold">{{ percent(summary.arrival.onTimeRate) }}</p>
        <p class="text-xs text-muted-foreground">
          {{ summary.arrival.onTime }} on time / {{ summary.arrival.late }} terlambat
        </p>
      </div>
      <div class="rounded-lg border bg-card p-4">
        <p class="text-xs text-muted-foreground">Rata-rata Keterlambatan</p>
        <p class="mt-1 text-2xl font-bold">
          {{ summary.arrival.avgVarianceMinutes === null ? '-' : `${summary.arrival.avgVarianceMinutes} mnt` }}
        </p>
        <p class="text-xs text-muted-foreground">
          Toleransi {{ summary.tolerance.arrivalMinutes }} / {{ summary.tolerance.finishMinutes }} menit
        </p>
      </div>
    </div>

    <ReportDataTable
      v-if="report?.groups?.length"
      :columns="groupColumns"
      :rows="groupTableRows"
      row-key="key"
      table-label="Ringkasan per kelompok"
      :loading="loading"
      empty-title="Tidak ada kelompok"
      empty-description="Tidak ada data pada rentang ini."
      unit="kelompok"
      default-sort-key="label"
    >
      <template #cell="{ row, column }">
        <span v-if="column.key === 'label'" class="font-medium">{{ row.label }}</span>
        <span v-else-if="column.key === 'onTimeRate'">{{ percent(row.onTimeRate) }}</span>
        <span v-else-if="column.key === 'avgVariance'">
          {{
            row.avgVariance === null || row.avgVariance === undefined
              ? '-'
              : `${row.avgVariance} mnt`
          }}
        </span>
        <template v-else>{{ row[column.key] }}</template>
      </template>
    </ReportDataTable>

    <div class="space-y-2">
      <h2 class="text-sm font-semibold">Tabel Rencana (Schedule)</h2>
      <ReportDataTable
        :columns="planColumns"
        :rows="planTableRows"
        row-key="scheduleItemId"
        table-label="Tabel rencana schedule"
        :loading="loading"
        empty-title="Tidak ada rencana"
        empty-description="Tidak ada jadwal pada rentang ini."
        unit="rencana"
        default-sort-key="scheduleDate"
        default-sort-dir="asc"
        search-placeholder="Cari plat, customer, transporter..."
      >
        <template #cell="{ row, column }">
          <span v-if="column.key === 'scheduleDate'">{{ formatDate(row.scheduleDate) }}</span>
          <span v-else-if="column.key === 'plateNumber'" class="font-medium">
            {{ row.plateNumber || '-' }}
          </span>
          <span v-else-if="column.key === 'plannedStart'">
            {{ formatDateTime(row.plannedStart) }}
          </span>
          <span v-else-if="column.key === 'registerTime'">
            {{ formatDateTime(row.registerTime) }}
            <span v-if="row.autoCompleted" class="ml-1 text-xs text-amber-600">(auto)</span>
          </span>
          <span v-else-if="column.key === 'plannedFinish'">
            {{ formatDateTime(row.plannedFinish) }}
          </span>
          <span v-else-if="column.key === 'finishTime'">
            {{ formatDateTime(row.finishTime) }}
          </span>
          <span
            v-else-if="column.key === 'varianceArrivalMinutes'"
            :class="varianceClass(row.varianceArrivalMinutes, row.isOnTimeArrival)"
          >
            {{ formatVariance(row.varianceArrivalMinutes) }}
          </span>
          <span
            v-else-if="column.key === 'varianceFinishMinutes'"
            :class="varianceClass(row.varianceFinishMinutes, row.isOnTimeFinish)"
          >
            {{ formatVariance(row.varianceFinishMinutes) }}
          </span>
          <span v-else-if="column.key === 'statusText'" class="inline-flex items-center gap-1.5">
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :class="statusChipClass(row.statusText)"
            >
              {{ row.statusText || '-' }}
            </span>
            <span
              v-if="row.isOnTimeArrival !== null"
              class="text-xs"
              :class="row.isOnTimeArrival ? 'text-emerald-600' : 'text-red-600'"
            >
              {{ onTimeLabel(row.isOnTimeArrival) }}
            </span>
          </span>
          <span v-else>{{ row[column.key] ?? '-' }}</span>
        </template>
      </ReportDataTable>
    </div>

    <div class="space-y-2">
      <h2 class="text-sm font-semibold">Tabel Aktual (Antrian Truk)</h2>
      <ReportDataTable
        :columns="actualColumns"
        :rows="actualRows"
        row-key="queueEntryId"
        table-label="Tabel aktual antrian truk"
        :loading="loading"
        empty-title="Tidak ada antrian"
        empty-description="Tidak ada antrian pada rentang ini."
        unit="antrian"
        default-sort-key="registerTime"
        default-sort-dir="desc"
        search-placeholder="Cari no truck, customer, container..."
      >
        <template #cell="{ row, column }">
          <span v-if="column.key === 'registerTime'">{{ formatDateTime(row.registerTime) }}</span>
          <span v-else-if="column.key === 'truckNumber'" class="font-medium">
            {{ row.truckNumber }}
            <span
              v-if="row.isWalkIn"
              class="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              walk-in
            </span>
          </span>
          <span v-else-if="column.key === 'containerNumbers'">
            {{ formatContainer(row.containerNumbers) }}
          </span>
          <span
            v-else-if="column.key === 'varianceArrivalMinutes'"
            :class="varianceClass(row.varianceArrivalMinutes, row.isOnTimeArrival)"
          >
            {{ formatVariance(row.varianceArrivalMinutes) }}
          </span>
          <span
            v-else-if="column.key === 'varianceFinishMinutes'"
            :class="varianceClass(row.varianceFinishMinutes, row.isOnTimeFinish)"
          >
            {{ formatVariance(row.varianceFinishMinutes) }}
          </span>
          <span v-else-if="column.key === 'status'" class="inline-flex items-center gap-1.5">
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :class="statusChipClass(row.status)"
            >
              {{ row.status }}
            </span>
            <span v-if="row.autoCompleted" class="text-xs text-amber-600">(auto)</span>
          </span>
          <span v-else>{{ row[column.key] ?? '-' }}</span>
        </template>
      </ReportDataTable>
    </div>

    <ExportDialog
      v-model="exportOpen"
      type="REPORT_SCHEDULE_VS_ACTUAL"
      sync-path="/reports/schedule-vs-actual/export"
      title="Export Report Schedule vs Aktual"
      subtitle="Sheet Summary, Plan, dan Aktual. Periode dihitung dari tanggal rencana untuk sheet Plan dan dari jam truk tiba untuk sheet Aktual."
      :prefill="exportPrefill"
    />
  </div>
</template>

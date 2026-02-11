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
import MonthlyTruckCategoryStackedBar from '@/components/dashboard/MonthlyTruckCategoryStackedBar.vue'
import StatusPieChart from '@/components/dashboard/StatusPieChart.vue'
import TopCustomerDurationTable from '@/components/dashboard/TopCustomerDurationTable.vue'
import OverSlaTable from '@/components/dashboard/OverSlaTable.vue'
import {
  getDashboardHourly,
  getDashboardMonthlyReport,
  getMonthlyScheduleTruckSummary,
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
type MonthlyTruckCategoryItem = {
  key: string
  label: string
  storeInQty: number
  storeOutQty: number
  totalQty: number
}
type MonthlyTruckSummary = { month: string; totalQty: number; items: MonthlyTruckCategoryItem[] }
type MonthlyReportQueueStatusItem = { name: string; value: number }
type MonthlyReportDailyQueueItem = {
  date: string
  total: number
  delivery: number
  receiving: number
  done: number
}
type MonthlyReportDailyScheduleItem = {
  date: string
  storeInQty: number
  storeOutQty: number
  totalQty: number
}
type MonthlyReportTopCustomerItem = {
  customerName: string
  avgDurationMinutes: number
  totalTransactions: number
}
type MonthlyReportOverSlaItem = {
  id: string
  date: string
  customerName: string
  driverName: string
  truckNumber: string
  category: string
  status: string
  overMinutes: number
  durationMinutes: number
}
type MonthlyReportScheduleTopCustomerItem = {
  customerName: string
  storeInQty: number
  storeOutQty: number
  totalQty: number
}
type MonthlyReportPayload = {
  month: string
  generatedAt: string
  queueSummary: Summary
  scheduleSummary: { storeInQty: number; storeOutQty: number; totalQty: number }
  queueStatusItems: MonthlyReportQueueStatusItem[]
  dailyQueue: MonthlyReportDailyQueueItem[]
  dailySchedule: MonthlyReportDailyScheduleItem[]
  truckCategoryItems: MonthlyTruckCategoryItem[]
  topCustomers: MonthlyReportTopCustomerItem[]
  overSlaItems: MonthlyReportOverSlaItem[]
  scheduleTopCustomers: MonthlyReportScheduleTopCustomerItem[]
}
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

const getCurrentMonth = () => {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

const today = ref(getToday())
const selectedDate = ref(today.value)
const selectedScheduleMonth = ref(getCurrentMonth())
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
const monthlyTruckSummary = reactive<MonthlyTruckSummary>({
  month: selectedScheduleMonth.value,
  totalQty: 0,
  items: []
})
const isLoadingMonthlyTruckSummary = ref(false)
const isLoadingProgress = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const monthlyReportOpen = ref(false)
const monthlyReportMonth = ref(getCurrentMonth())
const monthlyReportPrinting = ref(false)
const monthlyReportError = ref<string | null>(null)

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

const formatMonthLabel = (value: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return value
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1)
  return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

const formatNumber = (value: number) => new Intl.NumberFormat('id-ID').format(value || 0)

const formatDurationHuman = (value: number) => {
  const totalMinutes = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []
  if (days > 0) parts.push(`${formatNumber(days)}h`)
  if (hours > 0) parts.push(`${formatNumber(hours)}j`)
  if (minutes > 0 || parts.length === 0) parts.push(`${formatNumber(minutes)}m`)
  return parts.join(' ')
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const formatDateToDisplay = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  return `${match[3]}/${match[2]}/${match[1]}`
}

const openMonthlyReportDialog = () => {
  monthlyReportError.value = null
  if (!monthlyReportMonth.value) {
    monthlyReportMonth.value = getCurrentMonth()
  }
  monthlyReportOpen.value = true
}

const closeMonthlyReportDialog = () => {
  if (monthlyReportPrinting.value) return
  monthlyReportOpen.value = false
  monthlyReportError.value = null
}

const buildMonthlyReportHtml = (report: MonthlyReportPayload) => {
  const monthLabel = formatMonthLabel(report.month || monthlyReportMonth.value)
  const generatedAt = report.generatedAt
    ? new Date(report.generatedAt).toLocaleString('id-ID')
    : new Date().toLocaleString('id-ID')

  const queueStatusRows =
    report.queueStatusItems?.length > 0
      ? report.queueStatusItems
          .map(
            (item) =>
              `<tr><td>${escapeHtml(item.name)}</td><td class="num">${formatNumber(item.value)}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="2" class="empty">Tidak ada data</td></tr>'

  const truckCategoryRows =
    report.truckCategoryItems?.length > 0
      ? report.truckCategoryItems
          .map(
            (item) =>
              `<tr><td>${escapeHtml(item.label)}</td><td class="num">${formatNumber(item.storeInQty)}</td><td class="num">${formatNumber(item.storeOutQty)}</td><td class="num strong">${formatNumber(item.totalQty)}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="4" class="empty">Tidak ada data</td></tr>'

  const topCustomerRows =
    report.topCustomers?.length > 0
      ? report.topCustomers
          .map(
            (item, idx) =>
              `<tr><td class="num">${idx + 1}</td><td>${escapeHtml(item.customerName)}</td><td class="num">${formatNumber(item.totalTransactions)}</td><td class="num">${formatDurationHuman(item.avgDurationMinutes)}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="4" class="empty">Tidak ada data</td></tr>'

  const scheduleTopCustomerRows =
    report.scheduleTopCustomers?.length > 0
      ? report.scheduleTopCustomers
          .map(
            (item, idx) =>
              `<tr><td class="num">${idx + 1}</td><td>${escapeHtml(item.customerName)}</td><td class="num">${formatNumber(item.storeInQty)}</td><td class="num">${formatNumber(item.storeOutQty)}</td><td class="num strong">${formatNumber(item.totalQty)}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="5" class="empty">Tidak ada data</td></tr>'

  const overSlaRows =
    report.overSlaItems?.length > 0
      ? report.overSlaItems
          .map(
            (item, idx) =>
              `<tr><td class="num">${idx + 1}</td><td>${formatDateToDisplay(item.date)}</td><td>${escapeHtml(item.customerName)}</td><td>${escapeHtml(item.driverName)}</td><td>${escapeHtml(item.truckNumber)}</td><td>${escapeHtml(item.status)}</td><td class="num">${formatDurationHuman(item.overMinutes)}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="7" class="empty">Tidak ada data</td></tr>'

  const dailyQueueRows =
    report.dailyQueue?.length > 0
      ? report.dailyQueue
          .map(
            (item) =>
              `<tr><td>${formatDateToDisplay(item.date)}</td><td class="num">${formatNumber(item.total)}</td><td class="num">${formatNumber(item.delivery)}</td><td class="num">${formatNumber(item.receiving)}</td><td class="num">${formatNumber(item.done)}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="5" class="empty">Tidak ada data</td></tr>'

  const dailyScheduleRows =
    report.dailySchedule?.length > 0
      ? report.dailySchedule
          .map(
            (item) =>
              `<tr><td>${formatDateToDisplay(item.date)}</td><td class="num">${formatNumber(item.storeInQty)}</td><td class="num">${formatNumber(item.storeOutQty)}</td><td class="num strong">${formatNumber(item.totalQty)}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="4" class="empty">Tidak ada data</td></tr>'

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Laporan Bulanan Dashboard</title>
    <style>
      @page { size: A4 portrait; margin: 10mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #fff; }
      .report { width: 100%; }
      .header { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
      .title { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.2px; }
      .subtitle { margin: 3px 0 0 0; color: #4b5563; font-size: 12px; }
      .meta { margin-top: 8px; display: flex; justify-content: space-between; gap: 8px; font-size: 11px; color: #374151; }
      .section { margin-top: 12px; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; }
      .section h3 { margin: 0; padding: 8px 10px; font-size: 13px; background: #f3f4f6; border-bottom: 1px solid #d1d5db; }
      .section-body { padding: 10px; }
      .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; background: #ffffff; }
      .card .label { font-size: 10px; color: #6b7280; }
      .card .value { margin-top: 4px; font-size: 18px; font-weight: 700; color: #0f172a; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { border: 1px solid #d1d5db; padding: 5px 6px; font-size: 11px; vertical-align: top; word-wrap: break-word; }
      th { background: #f9fafb; text-align: left; font-weight: 700; }
      td.num { text-align: right; white-space: nowrap; }
      td.strong { font-weight: 700; }
      .empty { text-align: center; color: #6b7280; padding: 10px 0; }
      .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .page-break { page-break-before: always; }
      @media print {
        .section, .card { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="report">
      <div class="header">
        <h1 class="title">PT. SANKYU INDONESIA - Laporan Bulanan Dashboard</h1>
        <p class="subtitle">Ringkasan seluruh data operasional Antrian & Schedule Store In-Out</p>
        <div class="meta">
          <span>Periode: ${escapeHtml(monthLabel)}</span>
          <span>Generated: ${escapeHtml(generatedAt)}</span>
        </div>
      </div>

      <div class="section">
        <h3>Ringkasan Antrian (Bulanan)</h3>
        <div class="section-body">
          <div class="cards">
            <div class="card"><div class="label">Total Transaksi</div><div class="value">${formatNumber(report.queueSummary?.total || 0)}</div></div>
            <div class="card"><div class="label">Delivery</div><div class="value">${formatNumber(report.queueSummary?.delivery || 0)}</div></div>
            <div class="card"><div class="label">Receiving</div><div class="value">${formatNumber(report.queueSummary?.receiving || 0)}</div></div>
            <div class="card"><div class="label">Avg Process</div><div class="value">${formatNumber(report.queueSummary?.avgProcessMinutes || 0)} m</div></div>
          </div>
          <div class="cards" style="margin-top:8px;">
            <div class="card"><div class="label">Menunggu</div><div class="value">${formatNumber(report.queueSummary?.waiting || 0)}</div></div>
            <div class="card"><div class="label">Sedang Diproses</div><div class="value">${formatNumber(report.queueSummary?.processing || 0)}</div></div>
            <div class="card"><div class="label">Selesai</div><div class="value">${formatNumber(report.queueSummary?.done || 0)}</div></div>
            <div class="card"><div class="label">Over SLA</div><div class="value">${formatNumber(report.queueSummary?.overSlaPercent || 0)}%</div></div>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Ringkasan Schedule In & Out (Total Qty Bulanan)</h3>
        <div class="section-body">
          <div class="cards">
            <div class="card"><div class="label">Store In Qty</div><div class="value">${formatNumber(report.scheduleSummary?.storeInQty || 0)}</div></div>
            <div class="card"><div class="label">Store Out Qty</div><div class="value">${formatNumber(report.scheduleSummary?.storeOutQty || 0)}</div></div>
            <div class="card"><div class="label">Total Qty</div><div class="value">${formatNumber(report.scheduleSummary?.totalQty || 0)}</div></div>
            <div class="card"><div class="label">Kategori Truk Aktif</div><div class="value">${formatNumber(report.truckCategoryItems?.filter((x) => x.totalQty > 0).length || 0)}</div></div>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Distribusi Status Antrian</h3>
        <div class="section-body">
          <table>
            <thead><tr><th>Status</th><th>Jumlah</th></tr></thead>
            <tbody>${queueStatusRows}</tbody>
          </table>
        </div>
      </div>

      <div class="section page-break">
        <h3>Distribusi Jenis Truk Schedule (Store In vs Store Out)</h3>
        <div class="section-body">
          <table>
            <thead><tr><th>Kategori Truk</th><th>Store In Qty</th><th>Store Out Qty</th><th>Total Qty</th></tr></thead>
            <tbody>${truckCategoryRows}</tbody>
          </table>
        </div>
      </div>

      <div class="section">
        <h3>Data Customer & Over SLA</h3>
        <div class="section-body two-col">
          <table>
            <thead><tr><th>No</th><th>Customer</th><th>Total Transaksi</th><th>Avg Durasi</th></tr></thead>
            <tbody>${topCustomerRows}</tbody>
          </table>
          <table>
            <thead><tr><th>No</th><th>Tanggal</th><th>Customer</th><th>Driver</th><th>Truck</th><th>Status</th><th>Over SLA</th></tr></thead>
            <tbody>${overSlaRows}</tbody>
          </table>
        </div>
      </div>

      <div class="section">
        <h3>Customer Schedule (Berdasarkan Qty)</h3>
        <div class="section-body">
          <table>
            <thead><tr><th>No</th><th>Customer</th><th>Store In Qty</th><th>Store Out Qty</th><th>Total Qty</th></tr></thead>
            <tbody>${scheduleTopCustomerRows}</tbody>
          </table>
        </div>
      </div>

      <div class="section page-break">
        <h3>Rekap Harian Antrian</h3>
        <div class="section-body">
          <table>
            <thead><tr><th>Tanggal</th><th>Total</th><th>Delivery</th><th>Receiving</th><th>Selesai</th></tr></thead>
            <tbody>${dailyQueueRows}</tbody>
          </table>
        </div>
      </div>

      <div class="section">
        <h3>Rekap Harian Schedule (Qty)</h3>
        <div class="section-body">
          <table>
            <thead><tr><th>Tanggal</th><th>Store In Qty</th><th>Store Out Qty</th><th>Total Qty</th></tr></thead>
            <tbody>${dailyScheduleRows}</tbody>
          </table>
        </div>
      </div>
    </div>
  </body>
</html>`
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

const fetchMonthlyTruckSummary = async () => {
  isLoadingMonthlyTruckSummary.value = true
  try {
    const response = await getMonthlyScheduleTruckSummary(selectedScheduleMonth.value)
    const data = response.data?.data || response.data || {}
    monthlyTruckSummary.month = data.month || selectedScheduleMonth.value
    monthlyTruckSummary.totalQty = data.totalQty || 0
    monthlyTruckSummary.items = data.items || []
  } catch (err: any) {
    monthlyTruckSummary.month = selectedScheduleMonth.value
    monthlyTruckSummary.totalQty = 0
    monthlyTruckSummary.items = []
    error.value = getErrorMessage(err, 'Gagal memuat dashboard')
  } finally {
    isLoadingMonthlyTruckSummary.value = false
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

const handlePrintMonthlyReport = async () => {
  monthlyReportError.value = null
  monthlyReportPrinting.value = true

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    monthlyReportPrinting.value = false
    monthlyReportError.value = 'Popup print diblokir browser. Izinkan popup lalu coba lagi.'
    return
  }

  printWindow.document.open()
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Menyiapkan Laporan Bulanan...</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #111; }
          .muted { color: #666; }
        </style>
      </head>
      <body>
        <h3>Menyiapkan Laporan Bulanan...</h3>
        <p class="muted">Mohon tunggu, data sedang diproses.</p>
      </body>
    </html>
  `)
  printWindow.document.close()

  try {
    const response = await getDashboardMonthlyReport(monthlyReportMonth.value)
    const payload = (response.data?.data || response.data || {}) as MonthlyReportPayload
    const html = buildMonthlyReportHtml(payload)
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => {
      printWindow.print()
    }, 300)
    monthlyReportOpen.value = false
  } catch (err: any) {
    const message = getErrorMessage(err, 'Gagal menyiapkan laporan bulanan')
    monthlyReportError.value = message
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
          <h3 class="error">Gagal menyiapkan laporan bulanan</h3>
          <p>${escapeHtml(message)}</p>
        </body>
      </html>
    `)
    printWindow.document.close()
  } finally {
    monthlyReportPrinting.value = false
  }
}

const handleRefresh = async () => {
  await Promise.all([
    fetchDashboard(),
    fetchScheduleSummary(),
    fetchProgressSummary(),
    fetchMonthlyTruckSummary()
  ])
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

watch(
  () => selectedScheduleMonth.value,
  () => {
    fetchMonthlyTruckSummary()
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
        <Button
          size="sm"
          variant="outline"
          class="border-blue-200 bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
          @click="openMonthlyReportDialog"
        >
          Print Laporan Bulanan
        </Button>
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
          <CardTitle class="text-sm font-medium">Total Store In/Out hari ini</CardTitle>
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

      <Card class="lg:col-span-2">
        <CardHeader class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Schedule Pengiriman per Jenis Truk (Bulanan)</CardTitle>
            <p class="text-xs text-muted-foreground">
              Total Qty Store In + Store Out untuk bulan {{ formatMonthLabel(monthlyTruckSummary.month) }}
            </p>
          </div>
          <input
            v-model="selectedScheduleMonth"
            type="month"
            class="w-full bg-transparent border rounded-md px-2 py-2 text-sm md:w-auto"
          />
        </CardHeader>
        <CardContent>
          <div v-if="isLoadingMonthlyTruckSummary" class="text-sm text-muted-foreground">
            Loading chart...
          </div>
          <template v-else>
            <p class="mb-3 text-xs text-muted-foreground">
              Total Qty Bulan Ini: {{ monthlyTruckSummary.totalQty }}
            </p>
            <MonthlyTruckCategoryStackedBar :items="monthlyTruckSummary.items" />
          </template>
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

    <div v-if="monthlyReportOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeMonthlyReportDialog"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Print Laporan Bulanan</h3>
          <p class="text-sm text-muted-foreground">Pilih bulan untuk cetak laporan dashboard menyeluruh.</p>
        </div>
        <div class="p-4 space-y-3 text-sm">
          <div>
            <label class="text-sm text-muted-foreground">Bulan Laporan</label>
            <input
              v-model="monthlyReportMonth"
              type="month"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
            />
          </div>
          <p v-if="monthlyReportError" class="text-xs text-red-600">{{ monthlyReportError }}</p>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" :disabled="monthlyReportPrinting" @click="closeMonthlyReportDialog">Batal</Button>
          <Button :disabled="monthlyReportPrinting || !monthlyReportMonth" @click="handlePrintMonthlyReport">
            {{ monthlyReportPrinting ? 'Menyiapkan...' : 'Print Sekarang' }}
          </Button>
        </div>
      </div>
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

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import DailyJobStamp from '@/components/dailyJob/DailyJobStamp.vue'
import { RefreshCw, ChevronRight, ChevronLeft, FileText } from 'lucide-vue-next'
import {
  listDailyJobActivities,
  type DailyJobReport,
  type DailyJobReportStatus
} from '@/services/dailyJobActivity'
import { dateInputOffset, monthEndInput, monthStartInput, shortDateLabel, todayInput } from '@/components/jobTransaction/meta'
import { statusBubbleClass, statusCardClass } from '@/lib/statusCard'
import { handleDateInputClick, openDatePicker } from '@/lib/datePicker'

const router = useRouter()

type StatusFilter = 'ALL' | DailyJobReportStatus
type QuickRange = 'today' | 'week' | 'month' | 'custom'

const filters = ref({ dateFrom: todayInput(), dateTo: todayInput(), status: 'ALL' as StatusFilter })
const activeRange = ref<QuickRange>('today')

const items = ref<DailyJobReport[]>([])
const counts = ref({ ALL: 0, KOSONG: 0, BERJALAN: 0, SELESAI: 0, BATAL: 0 })
const meta = ref({ page: 1, limit: 30, total: 0, totalPages: 1 })
const page = ref(1)
const loading = ref(false)
const error = ref<string | null>(null)
const isMobile = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024
}

const quickRanges: Array<{ key: QuickRange; label: string }> = [
  { key: 'today', label: 'Hari ini' },
  { key: 'week', label: '7 hari' },
  { key: 'month', label: 'Bulan ini' }
]

const statusCards = computed(() => [
  { key: 'ALL' as StatusFilter, label: 'Semua', value: counts.value.ALL },
  { key: 'BERJALAN' as StatusFilter, label: 'Berjalan', value: counts.value.BERJALAN },
  { key: 'SELESAI' as StatusFilter, label: 'Selesai', value: counts.value.SELESAI },
  { key: 'KOSONG' as StatusFilter, label: 'Kosong', value: counts.value.KOSONG },
  { key: 'BATAL' as StatusFilter, label: 'Batal', value: counts.value.BATAL }
])

const visibleItems = computed(() =>
  filters.value.status === 'ALL'
    ? items.value
    : items.value.filter((item) => item.status === filters.value.status)
)

const rangeSummary = computed(() => {
  if (filters.value.dateFrom === filters.value.dateTo) return shortDateLabel(filters.value.dateFrom)
  return `${shortDateLabel(filters.value.dateFrom)} – ${shortDateLabel(filters.value.dateTo)}`
})

const getErrorMessage = (err: any, fallback: string) =>
  err?.response?.data?.message || err?.message || fallback

const fetchList = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await listDailyJobActivities({
      dateFrom: filters.value.dateFrom || undefined,
      dateTo: filters.value.dateTo || undefined,
      page: page.value,
      limit: meta.value.limit
    })
    items.value = (response.data?.items ?? []) as DailyJobReport[]
    meta.value = response.data?.meta ?? meta.value
    if (response.data?.meta?.counts) counts.value = response.data.meta.counts
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal memuat laporan')
    items.value = []
  } finally {
    loading.value = false
  }
}

const applyQuickRange = (range: QuickRange) => {
  activeRange.value = range
  if (range === 'today') {
    filters.value.dateFrom = todayInput()
    filters.value.dateTo = todayInput()
  } else if (range === 'week') {
    filters.value.dateFrom = dateInputOffset(-6)
    filters.value.dateTo = todayInput()
  } else if (range === 'month') {
    filters.value.dateFrom = monthStartInput()
    filters.value.dateTo = monthEndInput()
  }
  page.value = 1
  fetchList()
}

const onDateChange = () => {
  activeRange.value = 'custom'
  page.value = 1
  fetchList()
}

const setStatus = (value: StatusFilter) => {
  filters.value.status = filters.value.status === value ? 'ALL' : value
}

const resetFilters = () => {
  filters.value = { dateFrom: todayInput(), dateTo: todayInput(), status: 'ALL' }
  activeRange.value = 'today'
  page.value = 1
  fetchList()
}

const changePage = (next: number) => {
  if (next < 1 || next > meta.value.totalPages) return
  page.value = next
  fetchList()
}

const openReport = (item: DailyJobReport) => {
  if (!item.id) return
  router.push({ name: 'Daily Job Activity Detail', params: { id: item.id } })
}

const dateParts = (value?: string | null) => {
  if (!value) return { day: '—', month: '', weekday: '' }
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return { day: value, month: '', weekday: '' }
  const dt = new Date(year, month - 1, day)
  return {
    day: String(day).padStart(2, '0'),
    month: dt.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
    weekday: dt.toLocaleDateString('id-ID', { weekday: 'long' })
  }
}

const summaryLine = (item: DailyJobReport) => {
  const rec = item.summary?.totals?.receiving?.total ?? 0
  const del = item.summary?.totals?.delivery?.total ?? 0
  return `REC ${rec} · DEL ${del}`
}

const groupCount = (item: DailyJobReport) => item.manpowerGroupCount ?? item.groups?.length ?? 0
const pickingCount = (item: DailyJobReport) => item.pickingRowCount ?? item.picking?.length ?? 0
const stuffingCount = (item: DailyJobReport) => item.stuffingRowCount ?? item.stuffing?.length ?? 0

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  fetchList()
})

onUnmounted(() => window.removeEventListener('resize', checkMobile))
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Daily Job Activity</h1>
        <p class="text-muted-foreground">
          Terbentuk otomatis dari Transaksi Pekerjaan. Halaman ini untuk membaca, mencetak, dan export.
        </p>
      </div>
      <Button size="sm" variant="outline" :disabled="loading" @click="fetchList">
        <RefreshCw class="mr-2 h-4 w-4" :class="loading ? 'animate-spin' : ''" aria-hidden="true" />
        Refresh
      </Button>
    </div>

    <div class="mx-auto w-full max-w-5xl">
      <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
        <button
          v-for="card in statusCards"
          :key="card.key"
          type="button"
          class="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="[
            statusCardClass(card.key),
            filters.status === card.key ? 'ring-2 ring-primary/40 border-primary' : ''
          ]"
          :aria-pressed="filters.status === card.key"
          @click="setStatus(card.key)"
        >
          <span class="text-sm font-semibold">{{ card.label }}</span>
          <span
            class="inline-flex min-w-8 items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums"
            :class="statusBubbleClass(card.key)"
          >
            {{ card.value }}
          </span>
        </button>
      </div>
    </div>

    <Card>
      <CardHeader class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              v-for="range in quickRanges"
              :key="range.key"
              type="button"
              class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              :class="activeRange === range.key
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border/70 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground'"
              :aria-pressed="activeRange === range.key"
              @click="applyQuickRange(range.key)"
            >
              {{ range.label }}
            </button>
            <span class="ml-1 text-xs text-muted-foreground tabular-nums">{{ rangeSummary }}</span>
          </div>
          <p class="text-xs text-muted-foreground tabular-nums">
            {{ counts.ALL }} laporan
            <template v-if="counts.BERJALAN > 0"> · {{ counts.BERJALAN }} berjalan</template>
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <input
            v-model="filters.dateFrom"
            type="date"
            aria-label="Dari tanggal"
            class="h-11 w-full cursor-pointer rounded-xl border border-input/80 bg-card/75 px-3 text-sm shadow-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="handleDateInputClick"
            @keydown.enter.prevent="openDatePicker($event.currentTarget as HTMLInputElement)"
            @change="onDateChange"
          />
          <input
            v-model="filters.dateTo"
            type="date"
            aria-label="Sampai tanggal"
            class="h-11 w-full cursor-pointer rounded-xl border border-input/80 bg-card/75 px-3 text-sm shadow-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="handleDateInputClick"
            @keydown.enter.prevent="openDatePicker($event.currentTarget as HTMLInputElement)"
            @change="onDateChange"
          />
        </div>

        <div v-if="filters.status !== 'ALL'" class="flex items-center gap-2">
          <span class="text-[11px] text-muted-foreground">Filter aktif:</span>
          <button
            type="button"
            class="text-[11px] text-primary underline-offset-4 hover:underline"
            @click="resetFilters"
          >
            Reset semua
          </button>
        </div>
      </CardHeader>

      <CardContent>
        <div
          v-if="error"
          class="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
          role="alert"
        >
          {{ error }}
        </div>

        <div v-if="!isMobile" class="overflow-x-auto rounded-lg border">
          <table class="w-full min-w-[820px] text-sm">
            <thead class="bg-muted/60 text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left font-medium">Tanggal</th>
                <th class="px-3 py-2 text-left font-medium">Status</th>
                <th class="px-3 py-2 text-center font-medium">Transaksi</th>
                <th class="px-3 py-2 text-center font-medium">Grup</th>
                <th class="px-3 py-2 text-center font-medium">Picking</th>
                <th class="px-3 py-2 text-center font-medium">Stuffing</th>
                <th class="px-3 py-2 text-left font-medium">Ringkasan</th>
                <th class="w-8 px-1 py-2"><span class="sr-only">Buka</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="8" class="px-3 py-12 text-center text-sm text-muted-foreground">
                  Memuat laporan…
                </td>
              </tr>
              <tr v-else-if="items.length > 0 && visibleItems.length === 0">
                <td colspan="8" class="px-3 py-12 text-center text-sm text-muted-foreground">
                  Tidak ada laporan berstatus ini pada rentang tanggal tersebut.
                </td>
              </tr>
              <tr
                v-for="item in visibleItems"
                v-else
                :key="item.id || item.activityDate"
                class="group cursor-pointer border-t border-border/60 transition-colors hover:bg-muted/45"
                tabindex="0"
                role="link"
                :aria-label="`Buka laporan ${item.activityDate}`"
                @click="openReport(item)"
                @keydown.enter="openReport(item)"
              >
                <td class="px-3 py-3">
                  <div class="flex items-baseline gap-2">
                    <span class="text-base font-bold leading-none tabular-nums">
                      {{ dateParts(item.activityDate).day }}
                    </span>
                    <span class="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {{ dateParts(item.activityDate).month }}
                    </span>
                  </div>
                  <p class="mt-1 text-[11px] capitalize text-muted-foreground">
                    {{ dateParts(item.activityDate).weekday }}
                  </p>
                </td>
                <td class="px-3 py-3">
                  <DailyJobStamp
                    v-if="item.status !== 'KOSONG'"
                    :status="item.status"
                    size="sm"
                    :rotate="false"
                  />
                  <span
                    v-else
                    class="rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    Kosong
                  </span>
                </td>
                <td class="px-3 py-3 text-center">
                  <span class="dja-count">{{ item.transactions }}</span>
                </td>
                <td class="px-3 py-3 text-center">
                  <span class="dja-count">{{ groupCount(item) }}</span>
                </td>
                <td class="px-3 py-3 text-center">
                  <span class="dja-count">{{ pickingCount(item) }}</span>
                </td>
                <td class="px-3 py-3 text-center">
                  <span class="dja-count">{{ stuffingCount(item) }}</span>
                </td>
                <td class="px-3 py-3 text-[11px] tabular-nums text-muted-foreground">
                  {{ summaryLine(item) }}
                </td>
                <td class="px-1 py-3">
                  <ChevronRight
                    class="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                    aria-hidden="true"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="space-y-2.5">
          <p v-if="loading" class="py-10 text-center text-sm text-muted-foreground">Memuat laporan…</p>
          <p v-else-if="items.length > 0 && visibleItems.length === 0" class="py-10 text-center text-sm text-muted-foreground">
            Tidak ada laporan berstatus ini pada rentang tanggal tersebut.
          </p>
          <button
            v-for="item in visibleItems"
            v-else
            :key="item.id || item.activityDate"
            type="button"
            class="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-background/40 px-3.5 py-3 text-left transition-colors hover:bg-muted/40"
            @click="openReport(item)"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-bold tabular-nums">{{ item.activityDate }}</span>
                <DailyJobStamp
                  v-if="item.status !== 'KOSONG'"
                  :status="item.status"
                  size="sm"
                  :rotate="false"
                />
                <span
                  v-else
                  class="rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  Kosong
                </span>
              </div>
              <p class="mt-1 text-[11px] tabular-nums text-muted-foreground">
                {{ item.transactions }} transaksi · {{ groupCount(item) }} grup · {{ summaryLine(item) }}
              </p>
            </div>
            <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </div>

        <div
          v-if="!loading && items.length === 0"
          class="flex flex-col items-center gap-3 px-4 py-14 text-center"
        >
          <span class="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileText class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <div>
            <p class="text-sm font-medium">Belum ada laporan</p>
            <p class="mt-0.5 text-xs text-muted-foreground">
              Laporan terbentuk otomatis setelah ada transaksi pekerjaan pada tanggal tersebut.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Button size="sm" @click="router.push({ name: 'Transaksi Pekerjaan' })">
              Buka Transaksi Pekerjaan
            </Button>
            <Button size="sm" variant="outline" @click="resetFilters">Hari ini</Button>
          </div>
        </div>

        <div
          v-if="meta.total > 0"
          class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
        >
          <p class="tabular-nums">{{ visibleItems.length }} dari {{ meta.total }} laporan</p>
          <div class="flex items-center gap-1">
            <Button size="sm" variant="outline" :disabled="page <= 1" @click="changePage(page - 1)">
              <ChevronLeft class="h-4 w-4" aria-hidden="true" />
              Sebelumnya
            </Button>
            <span class="px-2 tabular-nums">{{ meta.page }} / {{ meta.totalPages }}</span>
            <Button
              size="sm"
              variant="outline"
              :disabled="page >= meta.totalPages"
              @click="changePage(page + 1)"
            >
              Berikutnya
              <ChevronRight class="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.dja-count {
  display: inline-flex;
  min-width: 1.75rem;
  justify-content: center;
  border-radius: 999px;
  background-color: hsl(var(--muted));
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}
</style>

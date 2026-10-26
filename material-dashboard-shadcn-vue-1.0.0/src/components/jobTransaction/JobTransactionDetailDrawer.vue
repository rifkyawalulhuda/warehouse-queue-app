<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import DailyJobStamp from '@/components/dailyJob/DailyJobStamp.vue'
import {
  Ban,
  CheckCircle2,
  Clock,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
  X
} from 'lucide-vue-next'
import {
  getJobTransactionById,
  type JobTransaction,
  type JobTransactionStatus
} from '@/services/jobTransactionApi'
import {
  activityLabel,
  formatTimeOnly,
  formatWallClock,
  isManpower,
  roleLabelOf,
  truckLabel,
  wallClockToMs,
  wallClockNowMs
} from '@/components/jobTransaction/meta'

const props = defineProps<{
  open: boolean
  transaction: JobTransaction | null
  actionSubmitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'primary', row: JobTransaction): void
}>()

const detail = ref<JobTransaction | null>(null)
const loadingDetail = ref(false)
const detailError = ref<string | null>(null)

const panelRef = ref<HTMLElement | null>(null)
const closeRef = ref<HTMLElement | null>(null)
let restoreFocusTo: HTMLElement | null = null
let ticker: number | undefined
const nowMs = ref(wallClockNowMs())

/** Data baris dipakai lebih dulu supaya drawer tidak pernah kosong. */
const row = computed<JobTransaction | null>(() => detail.value || props.transaction)

const logs = computed(() => {
  const list = detail.value?.logs
  if (!list?.length) return []
  return [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
})

const primaryAction = computed(() => {
  const status = row.value?.status
  if (status === 'DRAFT') return { key: 'start' as const, label: 'Mulai sekarang', icon: Play }
  if (status === 'PROSES') {
    return { key: 'finish' as const, label: 'Selesaikan', icon: CheckCircle2 }
  }
  return null
})

const isRunning = computed(() => row.value?.status === 'PROSES')

/** Durasi transaksi berjalan ikut bertambah tanpa perlu membuka ulang drawer. */
const liveDuration = computed(() => {
  const start = row.value?.startAt
  if (!start) return null
  const startMs = wallClockToMs(start)
  if (Number.isNaN(startMs)) return null

  const endMs = row.value?.finishAt ? wallClockToMs(row.value.finishAt) : nowMs.value
  if (Number.isNaN(endMs) || endMs <= startMs) return null

  const minutes = Math.round((endMs - startMs) / 60000)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} menit`
  return rest === 0 ? `${hours} jam` : `${hours} jam ${rest} menit`
})

const transactionDateLabel = computed(() => {
  const value = row.value?.transactionDate
  if (!value) return '-'
  const parts = value.split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return value
  const date = new Date(parts[0], parts[1] - 1, parts[2])
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
})

const totalUnits = computed(() => {
  const item = row.value
  if (!item || !isManpower(item.activityType)) return null
  return `${truckLabel(item)} × ${item.qty ?? 0}`
})

const AUDIT_META: Record<
  string,
  { label: string; icon: typeof Play; tone: string }
> = {
  START: {
    label: 'Mulai dikonfirmasi',
    icon: Play,
    tone: 'border-blue-300/70 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200'
  },
  FINISH: {
    label: 'Pekerjaan diselesaikan',
    icon: CheckCircle2,
    tone: 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200'
  },
  UPDATE: {
    label: 'Transaksi diubah',
    icon: Pencil,
    tone: 'border-border/70 bg-muted/40 text-muted-foreground'
  },
  REOPEN: {
    label: 'Status dikembalikan',
    icon: RotateCcw,
    tone: 'border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200'
  },
  CANCEL: {
    label: 'Transaksi dibatalkan',
    icon: Ban,
    tone: 'border-red-300/70 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200'
  },
  DELETE: {
    label: 'Transaksi dihapus',
    icon: Trash2,
    tone: 'border-red-300/70 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200'
  }
}

const auditMeta = (action: string) =>
  AUDIT_META[String(action || '').toUpperCase()] || {
    label: action || 'Perubahan',
    icon: Pencil,
    tone: 'border-border/70 bg-muted/40 text-muted-foreground'
  }

const statusLabel = (value?: string | null) => {
  if (!value) return null
  const map: Record<JobTransactionStatus, string> = {
    DRAFT: 'Draft',
    PROSES: 'Proses',
    SELESAI: 'Selesai',
    BATAL: 'Batal'
  }
  return map[value as JobTransactionStatus] || value
}

const logTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const loadDetail = async () => {
  const id = props.transaction?.id
  if (!id) return
  loadingDetail.value = true
  detailError.value = null
  try {
    const response = await getJobTransactionById(id)
    detail.value = (response.data?.data ?? response.data) as JobTransaction
  } catch (err: any) {
    detailError.value =
      err?.response?.data?.message || err?.message || 'Gagal memuat riwayat transaksi'
  } finally {
    loadingDetail.value = false
  }
}

const focusPanel = async () => {
  await nextTick()
  closeRef.value?.focus()
}

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.stopPropagation()
    emit('close')
    return
  }
  if (event.key !== 'Tab' || !panelRef.value) return

  const focusables = [
    ...panelRef.value.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ].filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)

  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement as HTMLElement | null

  if (event.shiftKey && (active === first || !panelRef.value.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

const lockScroll = () => {
  document.body.style.overflow = 'hidden'
}

const unlockScroll = () => {
  document.body.style.overflow = ''
}

const startTicker = () => {
  stopTicker()
  nowMs.value = wallClockNowMs()
  ticker = window.setInterval(() => {
    nowMs.value = wallClockNowMs()
  }, 60000)
}

const stopTicker = () => {
  if (ticker) window.clearInterval(ticker)
  ticker = undefined
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      restoreFocusTo = document.activeElement as HTMLElement | null
      detail.value = null
      detailError.value = null
      lockScroll()
      document.addEventListener('keydown', handleKeydown)
      startTicker()
      focusPanel()
      await loadDetail()
      return
    }

    document.removeEventListener('keydown', handleKeydown)
    unlockScroll()
    stopTicker()
    detail.value = null
    detailError.value = null
    if (restoreFocusTo && document.contains(restoreFocusTo)) {
      restoreFocusTo.focus()
    }
    restoreFocusTo = null
  }
)

/** Setelah aksi berhasil, induk memperbarui baris -> ambil detail baru tanpa menutup drawer. */
watch(
  () => props.transaction?.updatedAt,
  (value, previous) => {
    if (!props.open || !value || value === previous) return
    loadDetail()
  }
)

/**
 * Induk memanggil ini setelah aksi berhasil. Diperlukan karena transaksi yang
 * sedang dibuka bisa berada di luar rentang filter, sehingga daftar tidak lagi
 * memuatnya dan `props.transaction` tidak pernah berubah.
 */
defineExpose({ reload: loadDetail })

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  unlockScroll()
  stopTicker()
})
</script>

<template>
  <!--
    z-50, sama dengan modal aksi. Drawer dirender sebelum modal di halaman induk,
    jadi modal tetap menang saat keduanya terbuka. Jangan naikkan ke z-60:
    modal konfirmasi akan tertutup drawer dan tombol terasa tidak merespons.
  -->
  <div v-if="open" class="fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px]" @click="emit('close')"></div>

    <aside
      ref="panelRef"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jt-detail-title"
      class="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col overflow-hidden rounded-t-3xl border border-border/70 bg-card shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:max-w-lg sm:rounded-none sm:rounded-l-3xl sm:border-l"
    >
      <div class="flex items-start justify-between gap-3 border-b border-border/60 px-5 pb-3 pt-3 sm:pt-4">
        <div class="min-w-0">
          <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Transaksi Pekerjaan
          </p>
          <h3 id="jt-detail-title" class="mt-0.5 truncate text-base font-semibold">
            {{ row ? activityLabel(row.activityType) : 'Detail transaksi' }}
            <span v-if="row?.jobRole" class="text-muted-foreground">· {{ roleLabelOf(row.jobRole) }}</span>
          </h3>
          <p class="truncate text-xs text-muted-foreground">
            {{ row ? (isManpower(row.activityType) ? row.employeeName : `${row.totalMember ?? 0} member`) : '—' }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <DailyJobStamp v-if="row" :status="row.status" size="sm" :rotate="false" />
          <button
            ref="closeRef"
            type="button"
            class="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Tutup detail"
            @click="emit('close')"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </div>

      <div class="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div
          v-if="primaryAction && row"
          class="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5"
        >
          <div class="min-w-0 flex-1">
            <p class="text-[11px] font-medium">
              {{ primaryAction.key === 'start' ? 'Transaksi belum dimulai' : 'Pekerjaan sedang berjalan' }}
            </p>
            <p class="truncate text-[11px] text-muted-foreground tabular-nums">
              {{ primaryAction.key === 'start' ? 'Catat waktu mulai sekarang.' : `Mulai ${formatWallClock(row.startAt)}` }}
            </p>
          </div>
          <Button
            size="sm"
            :disabled="actionSubmitting"
            @click="emit('primary', row)"
          >
            <component :is="primaryAction.icon" class="mr-1.5 h-4 w-4" aria-hidden="true" />
            {{ actionSubmitting ? 'Memproses…' : primaryAction.label }}
          </Button>
        </div>

        <section>
          <h4 class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Waktu
          </h4>
          <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div class="col-span-2">
              <dt class="text-[11px] text-muted-foreground">Tanggal</dt>
              <dd class="font-medium capitalize">{{ transactionDateLabel }}</dd>
            </div>
            <div>
              <dt class="text-[11px] text-muted-foreground">Mulai</dt>
              <dd class="font-medium tabular-nums">
                {{ row?.startAt ? formatTimeOnly(row.startAt) : '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-[11px] text-muted-foreground">Selesai</dt>
              <dd class="font-medium tabular-nums">
                {{ row?.finishAt ? formatTimeOnly(row.finishAt) : '—' }}
              </dd>
            </div>
            <div class="col-span-2">
              <dt class="text-[11px] text-muted-foreground">Durasi</dt>
              <dd class="flex items-center gap-1.5 font-medium tabular-nums">
                <Clock class="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <template v-if="liveDuration">
                  {{ liveDuration }}
                  <span
                    v-if="isRunning"
                    class="rounded-full border border-blue-300/70 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200"
                  >
                    berjalan
                  </span>
                </template>
                <span v-else class="text-muted-foreground">Belum ada durasi</span>
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h4 class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Pekerjaan
          </h4>
          <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div>
              <dt class="text-[11px] text-muted-foreground">Jenis</dt>
              <dd class="font-medium">{{ row ? activityLabel(row.activityType) : '—' }}</dd>
            </div>
            <div>
              <dt class="text-[11px] text-muted-foreground">Peran</dt>
              <dd class="font-medium">{{ row?.jobRole ? roleLabelOf(row.jobRole) : '—' }}</dd>
            </div>
            <div class="col-span-2">
              <dt class="text-[11px] text-muted-foreground">Karyawan</dt>
              <dd class="font-medium">
                <template v-if="row && isManpower(row.activityType)">
                  {{ row.employeeName }}
                  <span v-if="row.employee?.nik" class="ml-1 text-[11px] text-muted-foreground">
                    {{ row.employee.nik }}
                  </span>
                </template>
                <span v-else class="text-muted-foreground">—</span>
              </dd>
            </div>
            <div>
              <dt class="text-[11px] text-muted-foreground">Tipe truk</dt>
              <dd class="font-medium">{{ row && isManpower(row.activityType) ? truckLabel(row) : '—' }}</dd>
            </div>
            <div>
              <dt class="text-[11px] text-muted-foreground">Total unit</dt>
              <dd class="font-medium tabular-nums">{{ totalUnits || '—' }}</dd>
            </div>
            <div>
              <dt class="text-[11px] text-muted-foreground">Total member</dt>
              <dd class="font-medium tabular-nums">{{ row?.totalMember ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-[11px] text-muted-foreground">Total DO</dt>
              <dd class="font-medium tabular-nums">{{ row?.totalDo ?? '—' }}</dd>
            </div>
          </dl>
        </section>

        <section v-if="row?.confirmation || row?.cancelReason">
          <h4 class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Catatan
          </h4>
          <div class="mt-2 space-y-2">
            <div
              v-if="row?.confirmation"
              class="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm"
            >
              {{ row.confirmation }}
            </div>
            <div
              v-if="row?.cancelReason"
              class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
            >
              <span class="font-semibold">Alasan batal: </span>{{ row.cancelReason }}
            </div>
          </div>
        </section>

        <section>
          <h4 class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Riwayat
          </h4>

          <p v-if="loadingDetail && logs.length === 0" class="mt-2 text-xs text-muted-foreground">
            Memuat riwayat…
          </p>
          <p v-else-if="detailError" class="mt-2 text-xs text-red-600" role="alert">
            {{ detailError }}
          </p>
          <p v-else-if="logs.length === 0" class="mt-2 text-xs text-muted-foreground">
            Belum ada riwayat perubahan.
          </p>

          <ol v-else class="mt-2 space-y-2.5">
            <li v-for="(log, index) in logs" :key="log.id" class="flex gap-2.5">
              <div class="flex flex-col items-center">
                <span
                  class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
                  :class="auditMeta(log.action).tone"
                >
                  <component :is="auditMeta(log.action).icon" class="h-3 w-3" aria-hidden="true" />
                </span>
                <span
                  v-if="index < logs.length - 1"
                  class="mt-1 w-px flex-1 bg-border"
                  aria-hidden="true"
                ></span>
              </div>
              <div class="min-w-0 flex-1 pb-0.5">
                <div class="flex flex-wrap items-baseline justify-between gap-x-2">
                  <p class="text-[13px] font-medium">{{ auditMeta(log.action).label }}</p>
                  <p class="text-[10px] tabular-nums text-muted-foreground">
                    {{ logTime(log.createdAt) }}
                  </p>
                </div>
                <p
                  v-if="log.fromStatus || log.toStatus"
                  class="mt-0.5 text-[11px] text-muted-foreground"
                >
                  {{ statusLabel(log.fromStatus) || '—' }}
                  <span aria-hidden="true">→</span>
                  {{ statusLabel(log.toStatus) || '—' }}
                  <span v-if="log.user?.name"> · {{ log.user.name }}</span>
                </p>
                <p v-else-if="log.user?.name" class="mt-0.5 text-[11px] text-muted-foreground">
                  {{ log.user.name }}
                </p>
                <p v-if="log.note" class="mt-1 text-[11px] text-muted-foreground">{{ log.note }}</p>
              </div>
            </li>
          </ol>
        </section>

        <section>
          <h4 class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Pencatatan
          </h4>
          <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div>
              <dt class="text-[11px] text-muted-foreground">Dibuat oleh</dt>
              <dd class="font-medium">{{ row?.createdBy?.name || '—' }}</dd>
              <dd class="text-[11px] tabular-nums text-muted-foreground">
                {{ logTime(row?.createdAt) }}
              </dd>
            </div>
            <div>
              <dt class="text-[11px] text-muted-foreground">Terakhir diubah</dt>
              <dd class="font-medium">{{ row?.updatedBy?.name || '—' }}</dd>
              <dd class="text-[11px] tabular-nums text-muted-foreground">
                {{ logTime(row?.updatedAt) }}
              </dd>
            </div>
          </dl>
        </section>

        <section class="border-t border-border/50 pt-3">
          <h4 class="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Referensi
          </h4>
          <dl class="mt-1.5 space-y-1 text-[10px] text-muted-foreground">
            <div class="flex gap-1.5">
              <dt class="shrink-0">ID transaksi</dt>
              <dd class="truncate font-mono">{{ row?.id || '—' }}</dd>
            </div>
            <div class="flex gap-1.5">
              <dt class="shrink-0">ID laporan</dt>
              <dd class="truncate font-mono">{{ row?.dailyJobActivityId || '—' }}</dd>
            </div>
          </dl>
        </section>
      </div>
    </aside>
  </div>
</template>

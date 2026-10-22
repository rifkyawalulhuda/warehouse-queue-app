<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { AlertTriangle, Maximize, Minimize, Truck, Volume2, VolumeX } from 'lucide-vue-next'
import api from '@/services/api'
import { useTtsQueue } from '@/composables/useTtsQueue'
import { formatTimeId, formatWeekdayId } from '@/lib/datetime'

type DisplayEntry = {
  id: string
  customer?: { id: string; name: string } | null
  category?: 'RECEIVING' | 'DELIVERY' | null
  gate?: { id: string; gateNo: string; area: string; warehouse: 'WH1' | 'WH2' | 'DG' } | null
  driverName: string
  truckNumber: string
  containerNumber?: string | null
  transporter?: string | null
  registerTime: string
  inWhTime?: string | null
  startTime?: string | null
  slaWaitingMinutes: number
  slaInWhProcessMinutes: number
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
const lastUpdatedAt = ref<Date | null>(null)
const isFullscreen = ref(false)
const soundEnabled = ref(true)
const soundPreferenceKey = 'monitorSoundEnabled'
const prevStatusMap = ref(new Map<string, DisplayEntry['status']>())
const announcedInWh = ref(new Set<string>())
const initialized = ref(false)

if (typeof window !== 'undefined') {
  const saved = window.localStorage.getItem(soundPreferenceKey)
  if (saved === '0') soundEnabled.value = false
}

const { enqueue, blocked: soundBlocked, resume: resumeSound, supported: ttsSupported } = useTtsQueue({
  enabled: soundEnabled,
  lang: 'id-ID',
  gapMs: 4000,
  preferredGender: 'female',
  preferGoogle: true,
  rate: 0.94,
  pitch: 1.12,
})

const getErrorMessage = (err: any, fallback: string) => {
  return err?.response?.data?.message || err?.message || fallback
}

const fetchDisplay = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await api.get('/queue/display')
    const newEntries: DisplayEntry[] = response.data?.data?.entries || []
    detectStatusTransitions(newEntries)
    entries.value = newEntries
    const s = response.data?.data?.summary || {}
    summary.total = s.total || 0
    summary.delivery = s.delivery || 0
    summary.receiving = s.receiving || 0
    summary.menunggu = s.menunggu || 0
    summary.proses = s.proses || 0
    lastUpdatedAt.value = new Date()
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

const formatTime = (value?: string | null) => formatTimeId(value)

const formatGateArea = (gate?: DisplayEntry['gate'] | null) => {
  if (!gate?.area) return ''
  return gate.area.trim()
}

const formatGateSpeech = (gate?: DisplayEntry['gate'] | null) => {
  if (!gate?.gateNo) return '-'
  const gateNo = gate.gateNo.trim()
  const parts: string[] = [gateNo]
  if (gate.warehouse) {
    const warehouse = gate.warehouse.replace(/\s+/g, '')
    const spelledWarehouse = warehouse ? warehouse.split('').join(' ') : gate.warehouse
    parts.push(spelledWarehouse)
  }
  if (gate.area) {
    const area = gate.area.trim()
    if (area) parts.push(`Area ${area}`)
  }
  return parts.join(', ')
}

const resolveAreaType = (category?: DisplayEntry['category']) => {
  if (category === 'DELIVERY') return 'muat'
  if (category === 'RECEIVING') return 'bongkar'
  return 'operasional'
}

const formatTruckSpeech = (value?: string | null) => {
  if (!value) return '-'
  let text = value.trim()
  if (!text) return '-'
  // Separate letters and digits to help TTS clarity
  text = text.replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/(\d)([A-Za-z])/g, '$1 $2')
  // Spell out all digit sequences to avoid thousands pronunciation
  text = text.replace(/\d+/g, (match) => match.split('').join(' '))
  return text.replace(/\s+/g, ' ').trim()
}

const buildAnnouncement = (entry: DisplayEntry) => {
  const driverName = entry.driverName || '-'
  const truckNumber = formatTruckSpeech(entry.truckNumber)
  const gateNo = formatGateSpeech(entry.gate)
  const areaType = resolveAreaType(entry.category)
  return `Perhatian, driver ${driverName} dengan truk ${truckNumber}. Silakan menuju ${gateNo}. Anda dipersilakan masuk ke area ${areaType}. Terima kasih.`
}

const canAnnounce = (entry: DisplayEntry) => {
  return entry.status === 'IN_WH' && Boolean(entry.gate?.gateNo) && Boolean(entry.gate?.area)
}

const detectStatusTransitions = (newEntries: DisplayEntry[]) => {
  // Diff status between polling cycles; skip first load to avoid spam.
  if (!initialized.value) {
    initialized.value = true
    prevStatusMap.value = new Map(newEntries.map((entry) => [entry.id, entry.status]))
    announcedInWh.value = new Set(
      newEntries.filter((entry) => entry.status === 'IN_WH').map((entry) => entry.id)
    )
    return
  }

  const nextMap = new Map<string, DisplayEntry['status']>()
  for (const entry of newEntries) {
    if (!announcedInWh.value.has(entry.id) && canAnnounce(entry)) {
      const message = buildAnnouncement(entry)
      enqueue(message, 1000)
      enqueue(`Saya Ulangi. ${message}`)
      announcedInWh.value.add(entry.id)
    }
    nextMap.set(entry.id, entry.status)
  }
  prevStatusMap.value = nextMap
}

const formatStatusTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const sameDay = date.toDateString() === now.value.toDateString()
  if (sameDay) {
    return formatTimeId(date)
  }
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month} ${formatTimeId(date)}`
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
  if (entry.status === 'MENUNGGU') return entry.slaWaitingMinutes
  if (entry.status === 'IN_WH' || entry.status === 'PROSES') return entry.slaInWhProcessMinutes
  return null
}

const getElapsedMinutes = (entry: DisplayEntry) => {
  if (entry.status === 'SELESAI' || entry.status === 'BATAL') return null
  const start =
    entry.status === 'MENUNGGU'
      ? entry.registerTime
      : entry.inWhTime || entry.startTime
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
  if (remaining <= 15) return 'warning'
  return 'normal'
}

const formatRemaining = (mins?: number | null) => {
  if (mins === null || mins === undefined) return '-'
  if (mins === 0) return 'Waktu habis'
  if (mins < 0) return `Lewat ${Math.abs(mins)} menit`
  return `Sisa ${mins} menit`
}

const warningRows = computed(() => entries.value.filter((entry) => getSlaState(entry) === 'warning'))
const overRows = computed(() => entries.value.filter((entry) => getSlaState(entry) === 'over'))

const doneCount = computed(() => entries.value.filter((entry) => entry.status === 'SELESAI').length)
const batalCount = computed(() => entries.value.filter((entry) => entry.status === 'BATAL').length)

// Urutkan: yang lewat SLA di atas, lalu hampir lewat, lalu urutan asli dari API.
const sortedEntries = computed(() => {
  return entries.value
    .map((entry, index) => {
      const state = getSlaState(entry)
      const rank = state === 'over' ? 0 : state === 'warning' ? 1 : 2
      return { entry, index, rank }
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank
      return a.index - b.index
    })
    .map((item) => item.entry)
})

const rowClass = (entry: DisplayEntry) => {
  if (entry.status === 'BATAL') return 'row row--cancel'
  const tone = getSlaState(entry)
  if (tone === 'over') return 'row row--over'
  if (tone === 'warning') return 'row row--warning'
  if (entry.status === 'IN_WH' || entry.status === 'PROSES') return 'row row--active'
  if (entry.status === 'SELESAI') return 'row row--done'
  return 'row'
}

const slaTone = (entry: DisplayEntry) => getSlaState(entry)

const remainingLabel = (entry: DisplayEntry) => formatRemaining(getEffectiveRemainingMinutes(entry))

const remainingLabelCompact = (entry: DisplayEntry) => {
  const mins = getEffectiveRemainingMinutes(entry)
  if (mins === null || mins === undefined) return '-'
  if (mins === 0) return 'Habis'
  if (mins < 0) return `Lewat ${Math.abs(mins)}m`
  return `Sisa ${mins}m`
}

const padNo = (index: number) => String(index + 1).padStart(2, '0')

// Auto-scroll halus (ping-pong) bila baris melebihi tinggi area tabel.
const scrollRef = ref<HTMLElement | null>(null)
const prefersReducedMotion = ref(false)
const autoScrollPaused = ref(false)
let autoScrollTimer: number | undefined
let autoScrollDirection = 1

const stopAutoScroll = () => {
  if (autoScrollTimer) {
    window.clearInterval(autoScrollTimer)
    autoScrollTimer = undefined
  }
}

const startAutoScroll = () => {
  stopAutoScroll()
  if (prefersReducedMotion.value) return
  const el = scrollRef.value
  if (!el) return
  const overflow = el.scrollHeight - el.clientHeight
  if (overflow <= 8) {
    el.scrollTop = 0
    return
  }
  autoScrollTimer = window.setInterval(() => {
    const node = scrollRef.value
    if (!node || autoScrollPaused.value) return
    const max = node.scrollHeight - node.clientHeight
    if (max <= 8) return
    if (node.scrollTop >= max - 1) autoScrollDirection = -1
    else if (node.scrollTop <= 0) autoScrollDirection = 1
    node.scrollTop += autoScrollDirection
  }, 60)
}

const pauseAutoScroll = () => {
  autoScrollPaused.value = true
}

const resumeAutoScroll = () => {
  autoScrollPaused.value = false
  startAutoScroll()
}

const weekdayText = computed(() => formatWeekdayId(now.value))
const dateText = computed(() => {
  const date = now.value
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}-${month}-${date.getFullYear()}`
})
const timeText = computed(() => formatTimeId(now.value))
const lastUpdatedText = computed(() => (lastUpdatedAt.value ? formatTimeId(lastUpdatedAt.value) : ''))

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
  window.setTimeout(startAutoScroll, 200)
}

const toggleSound = () => {
  soundEnabled.value = !soundEnabled.value
}

const enableSoundFromBanner = () => {
  soundEnabled.value = true
  resumeSound()
}

const handleVisibilityChange = () => {
  if (document.hidden) {
    autoScrollPaused.value = true
  } else {
    autoScrollPaused.value = false
    startAutoScroll()
  }
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
  document.addEventListener('visibilitychange', handleVisibilityChange)
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotion.value = mq.matches
    mq.addEventListener('change', (e) => {
      prefersReducedMotion.value = e.matches
      if (e.matches) stopAutoScroll()
      else startAutoScroll()
    })
  }
  window.setTimeout(startAutoScroll, 400)
})

onUnmounted(() => {
  if (pollTimer) window.clearInterval(pollTimer)
  if (clockTimer) window.clearInterval(clockTimer)
  stopAutoScroll()
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

watch(sortedEntries, () => {
  window.setTimeout(startAutoScroll, 150)
})

watch(soundEnabled, (value) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(soundPreferenceKey, value ? '1' : '0')
})

const showSoundBanner = computed(() => soundEnabled.value && ttsSupported && soundBlocked.value)
</script>

<template>
  <div class="board">
    <!-- HEADER -->
    <header class="board__header">
      <div class="board__brand">
        <span class="board__eyebrow">PT. SANKYU INDONESIA · CIKARANG LOGISTIC CENTER</span>
        <h1 class="board__title">Antrian Delivery &amp; Receiving</h1>
      </div>

      <div class="board__controls">
        <span class="board__live" title="Data diperbarui otomatis setiap 12 detik">
          <span class="board__live-dot" aria-hidden="true"></span>
          LIVE
        </span>

        <div class="board__clock">
          <span class="board__clock-day">{{ weekdayText }}, {{ dateText }}</span>
          <span class="board__clock-time">{{ timeText }}</span>
        </div>

        <button
          type="button"
          class="board__btn"
          :aria-pressed="soundEnabled"
          :aria-label="soundEnabled ? 'Matikan suara paging' : 'Aktifkan suara paging'"
          @click="toggleSound"
        >
          <Volume2 v-if="soundEnabled" class="board__btn-icon" aria-hidden="true" />
          <VolumeX v-else class="board__btn-icon" aria-hidden="true" />
          <span>{{ soundEnabled ? 'Suara Aktif' : 'Suara Mati' }}</span>
        </button>

        <button
          type="button"
          class="board__btn"
          :aria-label="isFullscreen ? 'Keluar layar penuh' : 'Masuk layar penuh'"
          @click="toggleFullscreen"
        >
          <Minimize v-if="isFullscreen" class="board__btn-icon" aria-hidden="true" />
          <Maximize v-else class="board__btn-icon" aria-hidden="true" />
          <span>{{ isFullscreen ? 'Keluar' : 'Layar Penuh' }}</span>
        </button>
      </div>
    </header>

    <!-- BANNERS -->
    <div v-if="error" class="board__alert board__alert--error" role="alert">
      <AlertTriangle class="board__alert-icon" aria-hidden="true" />
      <strong>Gagal memuat data</strong>
      <span class="board__alert-text">{{ error }}</span>
      <button type="button" class="board__alert-action" @click="fetchDisplay">Coba lagi</button>
    </div>
    <div v-if="showSoundBanner" class="board__alert board__alert--info" @click="enableSoundFromBanner">
      <strong>Suara paging diblokir browser</strong>
      <span class="board__alert-text">Klik untuk mengaktifkan suara.</span>
    </div>
    <div v-if="overRows.length" class="board__alert board__alert--error">
      <strong>Lewat batas waktu ({{ overRows.length }})</strong>
      <span class="board__alert-list">
        <span v-for="entry in overRows.slice(0, 6)" :key="entry.id">
          {{ entry.truckNumber || '-' }} · {{ remainingLabel(entry) }}
        </span>
      </span>
    </div>
    <div v-if="warningRows.length" class="board__alert board__alert--warn">
      <strong>Hampir lewat (&lt; 15 menit) ({{ warningRows.length }})</strong>
      <span class="board__alert-list">
        <span v-for="entry in warningRows.slice(0, 6)" :key="entry.id">
          {{ entry.truckNumber || '-' }} · {{ remainingLabel(entry) }}
        </span>
      </span>
    </div>

    <!-- TABLE -->
    <section class="board__panel">
      <div class="board__panel-head">
        <div class="board__panel-title">
          <Truck class="board__panel-icon" aria-hidden="true" />
          <span>Daftar Antrian Hari Ini</span>
        </div>
        <div class="board__panel-meta">
          <span>{{ sortedEntries.length }} transaksi</span>
          <span v-if="batalCount">· {{ batalCount }} batal</span>
          <span v-if="lastUpdatedText" class="board__panel-updated">Diperbarui {{ lastUpdatedText }}</span>
        </div>
      </div>

      <div
        ref="scrollRef"
        class="board__scroll"
        @pointerenter="pauseAutoScroll"
        @pointerleave="resumeAutoScroll"
      >
        <table class="board__table">
          <caption class="sr-only">
            Daftar antrian truk hari ini beserta status dan sisa waktu SLA
          </caption>
          <thead>
            <tr>
              <th scope="col" class="col-no">No</th>
              <th scope="col" class="col-cat">Kategori</th>
              <th scope="col" class="col-driver">Driver</th>
              <th scope="col" class="col-truck">No. Truk</th>
              <th scope="col" class="col-container">No. Kontainer</th>
              <th scope="col" class="col-transporter">Transporter</th>
              <th scope="col" class="col-gate">Gate</th>
              <th scope="col" class="col-customer">Customer</th>
              <th scope="col" class="col-register">Jam Daftar</th>
              <th scope="col" class="col-sla">Sisa Waktu</th>
              <th scope="col" class="col-status">Status</th>
            </tr>
          </thead>
          <tbody>
            <template v-if="loading && !entries.length">
              <tr v-for="n in 8" :key="`skeleton-${n}`" class="row row--skeleton">
                <td class="col-no"><span class="skel skel--xs"></span></td>
                <td class="col-cat"><span class="skel skel--sm"></span></td>
                <td class="col-driver"><span class="skel skel--md"></span></td>
                <td class="col-truck"><span class="skel skel--md"></span></td>
                <td class="col-container"><span class="skel skel--sm"></span></td>
                <td class="col-transporter"><span class="skel skel--sm"></span></td>
                <td class="col-gate"><span class="skel skel--md"></span></td>
                <td class="col-customer"><span class="skel skel--md"></span></td>
                <td class="col-register"><span class="skel skel--sm"></span></td>
                <td class="col-sla"><span class="skel skel--sm"></span></td>
                <td class="col-status"><span class="skel skel--md"></span></td>
              </tr>
            </template>

            <tr v-else-if="!sortedEntries.length" class="row row--empty">
              <td colspan="11">
                <span class="empty__title">Belum ada transaksi hari ini</span>
                <span class="empty__sub">Data antrian akan muncul otomatis setelah transaksi terdaftar.</span>
              </td>
            </tr>

            <tr v-for="(entry, index) in sortedEntries" :key="entry.id" :class="rowClass(entry)">
              <td class="col-no cell-no">{{ padNo(index) }}</td>
              <td class="col-cat">
                <span class="badge badge--cat" :data-cat="entry.category || 'NONE'">
                  {{ categoryLabel(entry.category) }}
                </span>
              </td>
              <td class="col-driver cell-strong" :title="entry.driverName">{{ entry.driverName || '-' }}</td>
              <td class="col-truck cell-truck">{{ entry.truckNumber || '-' }}</td>
              <td class="col-container cell-muted" :title="entry.containerNumber || ''">
                {{ entry.containerNumber || '-' }}
              </td>
              <td class="col-transporter cell-muted" :title="entry.transporter || ''">
                {{ entry.transporter || '-' }}
              </td>
              <td class="col-gate">
                <span class="gate__no">{{ entry.gate?.gateNo || '-' }}</span>
                <span
                  v-if="entry.gate?.warehouse || formatGateArea(entry.gate)"
                  class="gate__sub"
                >
                  {{ [entry.gate?.warehouse, formatGateArea(entry.gate)].filter(Boolean).join(' · ') }}
                </span>
              </td>
              <td class="col-customer" :title="entry.customer?.name || ''">
                {{ entry.customer?.name || '-' }}
              </td>
              <td class="col-register cell-time">{{ formatTime(entry.registerTime) }}</td>
              <td class="col-sla">
                <span class="sla" :data-tone="slaTone(entry)">
                  <span class="sla__full">{{ remainingLabel(entry) }}</span>
                  <span class="sla__compact">{{ remainingLabelCompact(entry) }}</span>
                </span>
              </td>
              <td class="col-status">
                <span class="badge badge--status" :data-status="entry.status">
                  {{ statusLabel(entry.status) }}
                </span>
                <span class="status__meta">
                  <span class="status__sla sla" :data-tone="slaTone(entry)">
                    {{ remainingLabelCompact(entry) }}
                  </span>
                  <span class="status__time">{{ formatStatusTime(getStatusTime(entry)) }}</span>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- SUMMARY -->
    <footer class="board__summary">
      <div class="sum sum--total">
        <span class="sum__value">{{ summary.total }}</span>
        <span class="sum__label">Total</span>
      </div>
      <div class="sum sum--delivery">
        <span class="sum__value">{{ summary.delivery }}</span>
        <span class="sum__label">Delivery</span>
      </div>
      <div class="sum sum--receiving">
        <span class="sum__value">{{ summary.receiving }}</span>
        <span class="sum__label">Receiving</span>
      </div>
      <div class="sum sum--waiting">
        <span class="sum__value">{{ summary.menunggu }}</span>
        <span class="sum__label">Menunggu</span>
      </div>
      <div class="sum sum--process">
        <span class="sum__value">{{ summary.proses }}</span>
        <span class="sum__label">Diproses</span>
      </div>
      <div class="sum sum--done">
        <span class="sum__value">{{ doneCount }}</span>
        <span class="sum__label">Selesai</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.board {
  --surface: hsl(var(--card));
  --surface-soft: hsl(var(--muted) / 0.5);
  --surface-head: hsl(var(--muted) / 0.65);
  --ink: hsl(var(--foreground));
  --ink-soft: hsl(var(--muted-foreground));
  --line: hsl(var(--border));
  --line-soft: hsl(var(--border) / 0.6);
  --brand: hsl(var(--primary));
  --zebra: hsl(var(--muted) / 0.28);

  --over-bg: hsl(0 86% 97%);
  --over-line: hsl(0 72% 52%);
  --over-ink: hsl(0 68% 36%);
  --warn-bg: hsl(43 96% 95%);
  --warn-line: hsl(35 92% 50%);
  --warn-ink: hsl(30 88% 32%);
  --active-bg: hsl(199 92% 96%);
  --active-line: hsl(199 89% 48%);
  --active-ink: hsl(199 82% 28%);

  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1vh, 16px);
  height: 100dvh;
  padding: clamp(12px, 1.6vw, 32px);
  background: hsl(var(--background));
  color: var(--ink);
  font-family: inherit;
  overflow: hidden;
}

.dark .board {
  --over-bg: hsl(0 46% 17%);
  --over-line: hsl(0 72% 58%);
  --over-ink: hsl(0 92% 84%);
  --warn-bg: hsl(38 46% 16%);
  --warn-line: hsl(38 92% 55%);
  --warn-ink: hsl(43 96% 78%);
  --active-bg: hsl(199 55% 16%);
  --active-line: hsl(199 89% 55%);
  --active-ink: hsl(199 92% 82%);
}

/* ---------- HEADER ---------- */
.board__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(12px, 1.4vw, 24px);
  padding-bottom: clamp(8px, 1vh, 14px);
  border-bottom: 1px solid var(--line);
}
.board__brand {
  min-width: 0;
}
.board__eyebrow {
  display: block;
  font-size: clamp(10px, 0.72vw, 14px);
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.board__title {
  margin-top: 2px;
  font-size: clamp(20px, 1.9vw, 36px);
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.1;
}
.board__controls {
  display: flex;
  align-items: center;
  gap: clamp(8px, 0.8vw, 14px);
  flex-shrink: 0;
}
.board__live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink-soft);
  font-size: clamp(9px, 0.68vw, 12px);
  font-weight: 700;
  letter-spacing: 0.12em;
}
.board__live-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: hsl(152 70% 42%);
  box-shadow: 0 0 0 0 hsl(152 70% 42% / 0.5);
  animation: livePulse 2s ease-out infinite;
}
.board__clock {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding-left: clamp(8px, 0.8vw, 14px);
  border-left: 1px solid var(--line);
}
.board__clock-day {
  font-size: clamp(10px, 0.78vw, 14px);
  color: var(--ink-soft);
  text-transform: capitalize;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.board__clock-time {
  font-size: clamp(22px, 2vw, 40px);
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.board__btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 40px;
  padding: 0 clamp(10px, 0.9vw, 16px);
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  font-family: inherit;
  font-size: clamp(11px, 0.8vw, 14px);
  font-weight: 600;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
}
.board__btn:hover {
  background: var(--surface-soft);
  border-color: var(--brand);
}
.board__btn:active {
  transform: scale(0.98);
}
.board__btn:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
.board__btn-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* ---------- ALERTS ---------- */
.board__alert {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 12px;
  padding: clamp(6px, 0.75vh, 10px) clamp(12px, 1vw, 18px);
  border-radius: 10px;
  border: 1px solid transparent;
  border-left-width: 4px;
  font-size: clamp(11px, 0.86vw, 15px);
}
.board__alert strong {
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.board__alert-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}
.board__alert-text {
  opacity: 0.9;
}
.board__alert-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-variant-numeric: tabular-nums;
}
.board__alert-action {
  margin-left: auto;
  border: 1px solid currentColor;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: inherit;
  font-weight: 600;
  padding: 2px 10px;
  cursor: pointer;
}
.board__alert--error {
  background: var(--over-bg);
  border-color: var(--over-line);
  color: var(--over-ink);
}
.board__alert--warn {
  background: var(--warn-bg);
  border-color: var(--warn-line);
  color: var(--warn-ink);
}
.board__alert--info {
  background: var(--active-bg);
  border-color: var(--active-line);
  color: var(--active-ink);
  cursor: pointer;
}

/* ---------- TABLE PANEL ---------- */
.board__panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 2px hsl(var(--foreground) / 0.04);
}
.board__panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: clamp(8px, 1vh, 14px) clamp(12px, 1.1vw, 20px);
  border-bottom: 1px solid var(--line);
  background: var(--surface-head);
}
.board__panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: clamp(12px, 1vw, 17px);
  font-weight: 700;
  letter-spacing: 0.01em;
}
.board__panel-icon {
  width: 16px;
  height: 16px;
  color: var(--brand);
}
.board__panel-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: clamp(10px, 0.78vw, 13px);
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.board__panel-updated {
  padding-left: 8px;
  border-left: 1px solid var(--line);
}

.board__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--line) transparent;
}
.board__scroll::-webkit-scrollbar {
  width: 8px;
}
.board__scroll::-webkit-scrollbar-thumb {
  background: var(--line);
  border-radius: 999px;
}

.board__table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: clamp(12px, 0.92vw, 18px);
}

.board__table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: clamp(7px, 0.8vh, 12px) clamp(6px, 0.6vw, 14px);
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  box-shadow: 0 1px 0 var(--line);
  color: var(--ink-soft);
  font-size: clamp(9px, 0.68vw, 12px);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-align: left;
  white-space: nowrap;
}

.col-no { width: 3.5%; }
.col-cat { width: 8.5%; }
.col-driver { width: 12.5%; }
.col-truck { width: 10.5%; }
.col-container { width: 9%; }
.col-transporter { width: 9%; }
.col-gate { width: 10%; }
.col-customer { width: 13%; }
.col-register { width: 7%; }
.col-sla { width: 10%; }
.col-status { width: 7%; }

.board__table tbody td {
  padding: clamp(7px, 0.85vh, 13px) clamp(6px, 0.6vw, 14px);
  border-bottom: 1px solid var(--line-soft);
  vertical-align: middle;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- ROWS ---------- */
.row {
  background: var(--surface);
  transition: background 150ms ease;
}
.row:nth-child(even) {
  background: var(--zebra);
}
.row:hover {
  box-shadow: inset 0 0 0 9999px hsl(var(--accent) / 0.35);
}
.row--over {
  background: var(--over-bg);
  box-shadow: inset 4px 0 0 var(--over-line);
}
.row--warning {
  background: var(--warn-bg);
  box-shadow: inset 4px 0 0 var(--warn-line);
}
.row--active {
  background: var(--active-bg);
  box-shadow: inset 4px 0 0 var(--active-line);
}
.row--done {
  color: var(--ink-soft);
}
.row--done .cell-strong,
.row--done .cell-truck {
  color: var(--ink-soft);
  font-weight: 600;
}
.row--cancel {
  background: var(--surface-soft);
  color: var(--ink-soft);
}
.row--cancel .cell-strong,
.row--cancel .cell-truck,
.row--cancel .cell-muted,
.row--cancel .cell-time,
.row--cancel .gate__no,
.row--cancel .gate__sub {
  text-decoration: line-through;
  opacity: 0.7;
}
.row--cancel .badge {
  opacity: 0.7;
}

.cell-no {
  color: var(--ink-soft);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
.cell-strong {
  font-weight: 600;
}
.cell-truck {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
}
.cell-muted {
  color: var(--ink-soft);
}
.cell-time {
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}

.gate__no {
  display: block;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gate__sub {
  display: block;
  font-size: 0.78em;
  color: var(--ink-soft);
  letter-spacing: 0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- BADGES ---------- */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: clamp(9px, 0.7vw, 13px);
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.6;
  white-space: nowrap;
}
.badge--cat[data-cat='DELIVERY'] {
  background: hsl(152 60% 92%);
  color: hsl(155 72% 24%);
}
.badge--cat[data-cat='RECEIVING'] {
  background: hsl(199 90% 92%);
  color: hsl(201 84% 28%);
}
.badge--cat[data-cat='NONE'] {
  background: var(--surface-soft);
  color: var(--ink-soft);
}
.dark .badge--cat[data-cat='DELIVERY'] {
  background: hsl(155 55% 18%);
  color: hsl(152 70% 78%);
}
.dark .badge--cat[data-cat='RECEIVING'] {
  background: hsl(201 60% 18%);
  color: hsl(199 90% 80%);
}

.badge--status {
  border: 1px solid transparent;
}
.badge--status[data-status='MENUNGGU'] {
  background: hsl(43 96% 91%);
  color: hsl(30 88% 28%);
  border-color: hsl(38 92% 78%);
}
.badge--status[data-status='IN_WH'] {
  background: hsl(199 92% 92%);
  color: hsl(199 84% 26%);
  border-color: hsl(199 90% 78%);
}
.badge--status[data-status='IN_WH']::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
  animation: livePulse 1.6s ease-out infinite;
}
.badge--status[data-status='PROSES'] {
  background: hsl(258 92% 95%);
  color: hsl(258 62% 40%);
  border-color: hsl(258 80% 86%);
}
.badge--status[data-status='SELESAI'] {
  background: hsl(152 60% 92%);
  color: hsl(155 72% 24%);
  border-color: hsl(152 55% 78%);
}
.badge--status[data-status='BATAL'] {
  background: var(--surface-soft);
  color: var(--ink-soft);
  border-color: var(--line);
}
.dark .badge--status[data-status='MENUNGGU'] {
  background: hsl(38 55% 18%);
  color: hsl(43 96% 76%);
  border-color: hsl(38 60% 30%);
}
.dark .badge--status[data-status='IN_WH'] {
  background: hsl(199 60% 18%);
  color: hsl(199 92% 80%);
  border-color: hsl(199 60% 30%);
}
.dark .badge--status[data-status='PROSES'] {
  background: hsl(258 45% 22%);
  color: hsl(258 90% 85%);
  border-color: hsl(258 45% 34%);
}
.dark .badge--status[data-status='SELESAI'] {
  background: hsl(155 45% 18%);
  color: hsl(152 70% 78%);
  border-color: hsl(155 45% 28%);
}

.status__meta {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 2px;
  font-size: 0.72em;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}
.status__sla {
  display: none;
  font-weight: 700;
}
.status__time {
  display: inline;
}

.sla {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ink-soft);
}
.sla[data-tone='over'] {
  color: var(--over-ink);
}
.sla[data-tone='warning'] {
  color: var(--warn-ink);
}
.sla__compact {
  display: none;
}

/* ---------- EMPTY & SKELETON ---------- */
.row--empty td {
  padding: clamp(32px, 8vh, 80px) 16px;
  text-align: center;
  white-space: normal;
}
.empty__title {
  display: block;
  font-size: clamp(15px, 1.3vw, 22px);
  font-weight: 700;
  color: var(--ink);
}
.empty__sub {
  display: block;
  margin-top: 4px;
  font-size: clamp(11px, 0.86vw, 15px);
  color: var(--ink-soft);
}
.row--skeleton:hover {
  box-shadow: none;
}
.skel {
  display: block;
  height: 0.85em;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--surface-soft) 25%, hsl(var(--muted) / 0.85) 37%, var(--surface-soft) 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
.skel--xs { width: 40%; }
.skel--sm { width: 60%; }
.skel--md { width: 82%; }

/* ---------- SUMMARY ---------- */
.board__summary {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: clamp(6px, 0.7vw, 14px);
}
.sum {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: clamp(6px, 0.9vh, 12px) 8px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  overflow: hidden;
}
.sum::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  background: var(--sum-accent, var(--brand));
}
.sum--total { --sum-accent: hsl(var(--primary)); }
.sum--delivery { --sum-accent: hsl(152 62% 40%); }
.sum--receiving { --sum-accent: hsl(199 89% 48%); }
.sum--waiting { --sum-accent: hsl(38 92% 50%); }
.sum--process { --sum-accent: hsl(258 62% 58%); }
.sum--done { --sum-accent: hsl(172 60% 40%); }
.sum__value {
  font-size: clamp(22px, 1.9vw, 38px);
  font-weight: 700;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
}
.sum__label {
  font-size: clamp(9px, 0.68vw, 12px);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

/* ---------- MOTION ---------- */
@keyframes livePulse {
  0% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
  70% { box-shadow: 0 0 0 5px transparent; opacity: 0.75; }
  100% { box-shadow: 0 0 0 0 transparent; opacity: 1; }
}
@keyframes shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}

@media (prefers-reduced-motion: reduce) {
  .board__live-dot,
  .badge--status[data-status='IN_WH']::before {
    animation: none;
  }
  .skel {
    animation: none;
  }
  .row,
  .board__btn {
    transition: none;
  }
}

/* ---------- RESPONSIVE ---------- */
@media (max-width: 1400px) {
  .col-transporter { display: none; }
  .col-no { width: 4%; }
  .col-cat { width: 9%; }
  .col-driver { width: 14%; }
  .col-truck { width: 12%; }
  .col-container { width: 9%; }
  .col-gate { width: 10%; }
  .col-customer { width: 14%; }
  .col-register { width: 8%; }
  .col-sla { width: 11%; }
  .col-status { width: 9%; }
}
@media (max-width: 1200px) {
  .col-container { display: none; }
  .col-no { width: 4%; }
  .col-cat { width: 10%; }
  .col-driver { width: 15%; }
  .col-truck { width: 13%; }
  .col-gate { width: 11%; }
  .col-customer { width: 15%; }
  .col-register { width: 8%; }
  .col-sla { width: 13%; }
  .col-status { width: 11%; }
}
@media (max-width: 1024px) {
  .col-customer { display: none; }
  .col-no { width: 5%; }
  .col-cat { width: 11%; }
  .col-driver { width: 18%; }
  .col-truck { width: 16%; }
  .col-gate { width: 13%; }
  .col-register { width: 10%; }
  .col-sla { width: 15%; }
  .col-status { width: 12%; }
}
@media (max-width: 900px) {
  .col-register { display: none; }
  .sla__full { display: none; }
  .sla__compact { display: inline; }
  .col-no { width: 6%; }
  .col-cat { width: 12%; }
  .col-driver { width: 20%; }
  .col-truck { width: 18%; }
  .col-gate { width: 14%; }
  .col-sla { width: 16%; }
  .col-status { width: 14%; }
}
@media (max-width: 720px) {
  .col-gate { display: none; }
  .board {
    height: auto;
    min-height: 100dvh;
    overflow: visible;
  }
  .board__panel {
    flex: none;
  }
  .board__scroll {
    flex: none;
    overflow: visible;
  }
  .board__header {
    flex-direction: column;
    align-items: flex-start;
  }
  .board__controls {
    width: 100%;
    flex-wrap: wrap;
  }
  .board__clock {
    align-items: flex-start;
    border-left: none;
    padding-left: 0;
  }
  .board__summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .col-no { width: 7%; }
  .col-cat { width: 13%; }
  .col-driver { width: 24%; }
  .col-truck { width: 22%; }
  .col-sla { width: 18%; }
  .col-status { width: 16%; }
}
@media (max-width: 560px) {
  .col-cat,
  .col-sla { display: none; }
  .status__sla { display: inline; }
  .board__summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .board__btn span {
    display: none;
  }
  .board__btn {
    min-width: 44px;
    min-height: 44px;
    justify-content: center;
    padding: 0;
  }
  .col-no { width: 8%; }
  .col-driver { width: 28%; }
  .col-truck { width: 26%; }
  .col-status { width: 38%; }
}
</style>

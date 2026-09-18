<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
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

const formatGateShort = (gate?: DisplayEntry['gate'] | null) => {
  if (!gate?.gateNo) return '-'
  const gateNo = gate.gateNo.trim()
  if (!gate.warehouse) return gateNo
  return `${gateNo} - ${gate.warehouse}`
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
  if (mins <= 0) return `Lewat ${Math.abs(mins)} menit`
  return `Sisa ${mins} menit`
}

const warningRows = computed(() => entries.value.filter((entry) => getSlaState(entry) === 'warning'))
const overRows = computed(() => entries.value.filter((entry) => getSlaState(entry) === 'over'))

// --- Redesign: pemisahan truk aktif (hero) vs antrian menunggu ---
const activeEntries = computed(() => entries.value.filter((e) => e.status === 'MENUNGGU' || e.status === 'IN_WH' || e.status === 'PROSES'))
const servingEntries = computed(() => entries.value.filter((e) => e.status === 'IN_WH' || e.status === 'PROSES'))
const waitingEntries = computed(() => entries.value.filter((e) => e.status === 'MENUNGGU'))
const doneCount = computed(() => summary.total - activeEntries.value.length)

const getSlaTone = (entry: DisplayEntry): 'over' | 'warning' | 'normal' => {
  const state = getSlaState(entry)
  if (state === 'over') return 'over'
  if (state === 'warning') return 'warning'
  return 'normal'
}

const getRemainingLabel = (entry: DisplayEntry) => {
  const remaining = getEffectiveRemainingMinutes(entry)
  return formatRemaining(remaining)
}

const rowAccentClass = (entry: DisplayEntry) => {
  const tone = getSlaTone(entry)
  if (tone === 'over') return 'queue-row--over'
  if (tone === 'warning') return 'queue-row--warning'
  return 'queue-row--normal'
}

const heroAccentClass = (entry: DisplayEntry) => {
  const tone = getSlaTone(entry)
  if (tone === 'over') return 'hero-card--over'
  if (tone === 'warning') return 'hero-card--warning'
  return 'hero-card--normal'
}

// Auto-scroll halus daftar menunggu bila melebihi tinggi area
const waitingScrollRef = ref<HTMLElement | null>(null)
let autoScrollTimer: number | undefined
const prefersReducedMotion = ref(false)

const stopAutoScroll = () => {
  if (autoScrollTimer) {
    window.clearInterval(autoScrollTimer)
    autoScrollTimer = undefined
  }
}

const startAutoScroll = () => {
  stopAutoScroll()
  if (prefersReducedMotion.value) return
  const el = waitingScrollRef.value
  if (!el) return
  const overflow = el.scrollHeight - el.clientHeight
  if (overflow <= 8) {
    el.scrollTop = 0
    return
  }
  let direction = 1
  autoScrollTimer = window.setInterval(() => {
    const node = waitingScrollRef.value
    if (!node) return
    const max = node.scrollHeight - node.clientHeight
    if (max <= 8) return
    if (node.scrollTop >= max - 1) direction = -1
    else if (node.scrollTop <= 0) direction = 1
    node.scrollTop += direction * 1
  }, 60)
}

watch(waitingEntries, () => {
  window.setTimeout(startAutoScroll, 60)
})

const formatDisplayDateTime = (date: Date) => {
  const weekday = formatWeekdayId(date)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const datePart = `${day}-${month}-${year}`
  const timePart = formatTimeId(date)
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

const toggleSound = () => {
  soundEnabled.value = !soundEnabled.value
}

const enableSoundFromBanner = () => {
  soundEnabled.value = true
  resumeSound()
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
        <div class="board__clock">
          <span class="board__clock-day">{{ nowText.split(',')[0] }}</span>
          <span class="board__clock-time">{{ nowText.split(',')[1]?.trim() }}</span>
        </div>
        <button type="button" class="board__btn" @click="toggleSound">
          {{ soundEnabled ? '🔊 SUARA: AKTIF' : '🔇 SUARA: MATI' }}
        </button>
        <button type="button" class="board__btn" @click="toggleFullscreen">
          {{ isFullscreen ? '⤢ KELUAR' : '⤢ LAYAR PENUH' }}
        </button>
      </div>
    </header>

    <!-- BANNERS -->
    <div v-if="error" class="board__alert board__alert--error">{{ error }}</div>
    <div v-if="showSoundBanner" class="board__alert board__alert--info" @click="enableSoundFromBanner">
      Klik untuk mengaktifkan suara.
    </div>
    <div v-if="overRows.length" class="board__alert board__alert--error">
      <strong>LEWAT BATAS WAKTU ({{ overRows.length }})</strong>
      <span class="board__alert-list">
        <span v-for="entry in overRows.slice(0, 6)" :key="entry.id">
          {{ entry.truckNumber || '-' }} ({{ formatRemaining(getEffectiveRemainingMinutes(entry)) }})
        </span>
      </span>
    </div>
    <div v-if="warningRows.length" class="board__alert board__alert--warn">
      <strong>HAMPIR LEWAT (&lt; 15 MENIT) ({{ warningRows.length }})</strong>
      <span class="board__alert-list">
        <span v-for="entry in warningRows.slice(0, 6)" :key="entry.id">
          {{ entry.truckNumber || '-' }} ({{ formatRemaining(getEffectiveRemainingMinutes(entry)) }})
        </span>
      </span>
    </div>

    <!-- MAIN -->
    <div class="board__main">
      <!-- HERO: NOW SERVING -->
      <section class="board__hero">
        <div class="board__hero-head">
          <span class="board__hero-label">SEDANG DIPROSES</span>
          <span class="board__hero-count">{{ servingEntries.length }}</span>
        </div>

        <div v-if="servingEntries.length" class="hero-grid">
          <div
            v-for="entry in servingEntries"
            :key="entry.id"
            class="hero-card"
            :class="heroAccentClass(entry)"
          >
            <div class="hero-card__plate">{{ entry.truckNumber || '-' }}</div>
            <div class="hero-card__gate">
              <span class="hero-card__gate-no">{{ entry.gate?.gateNo || '-' }}</span>
              <span class="hero-card__gate-wh">{{ entry.gate?.warehouse || '-' }}</span>
            </div>
            <div class="hero-card__meta">
              <span class="hero-card__driver">{{ entry.driverName || '-' }}</span>
              <span class="hero-card__status">{{ statusLabel(entry.status) }}</span>
            </div>
            <div class="hero-card__foot">
              <span>{{ categoryLabel(entry.category) }} · {{ entry.customer?.name || '-' }}</span>
              <span class="hero-card__remain">{{ getRemainingLabel(entry) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="hero-empty">
          <span class="hero-empty__big">Tidak ada truk di area</span>
          <span class="hero-empty__sub">Belum ada truk yang sedang diproses saat ini</span>
        </div>
      </section>

      <!-- WAITING LIST -->
      <section class="board__queue">
        <div class="board__queue-head">
          <span class="board__queue-label">ANTRIAN MENUNGGU</span>
          <span class="board__queue-count">{{ waitingEntries.length }}</span>
        </div>
        <div ref="waitingScrollRef" class="queue-scroll">
          <ol v-if="waitingEntries.length" class="queue-list">
            <li
              v-for="(entry, index) in waitingEntries"
              :key="entry.id"
              class="queue-row"
              :class="rowAccentClass(entry)"
            >
              <span class="queue-row__no">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="queue-row__cat" :data-cat="entry.category || ''">
                {{ entry.category === 'RECEIVING' ? 'RCV' : entry.category === 'DELIVERY' ? 'DLV' : '—' }}
              </span>
              <span class="queue-row__plate">{{ entry.truckNumber || '-' }}</span>
              <span class="queue-row__driver">{{ entry.driverName || '-' }}</span>
              <span class="queue-row__gate">{{ formatGateShort(entry.gate) }}</span>
              <span class="queue-row__time">{{ formatTime(entry.registerTime) }}</span>
              <span class="queue-row__remain" :class="rowAccentClass(entry)">{{ getRemainingLabel(entry) }}</span>
            </li>
          </ol>
          <div v-else-if="loading" class="queue-empty">Memuat data…</div>
          <div v-else class="queue-empty">
            <span class="queue-empty__big">Tidak ada antrian menunggu</span>
            <span class="queue-empty__sub">Semua truk sudah ditangani</span>
          </div>
        </div>
      </section>
    </div>

    <!-- SUMMARY STRIP -->
    <footer class="board__summary">
      <div class="sum">
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
/* Font condensed industrial hanya untuk halaman ini */
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600;700&display=swap');

.board {
  --bg: #0b1220;
  --panel: #111c2e;
  --panel-2: #16233a;
  --line: #24344f;
  --text: #eaf1fb;
  --muted: #8ea3c2;
  --amber: #f5b301;
  --amber-dim: #6b5214;
  --emerald: #22c55e;
  --emerald-dim: #14532d;
  --red: #ef4444;
  --red-dim: #7f1d1d;
  --cyan: #38bdf8;
  --blue: #3b82f6;

  display: flex;
  flex-direction: column;
  gap: clamp(12px, 1.4vh, 24px);
  min-height: 100vh;
  padding: clamp(16px, 2.2vw, 44px);
  background:
    radial-gradient(circle at 12% 0%, rgba(56, 189, 248, 0.10), transparent 42%),
    radial-gradient(circle at 100% 100%, rgba(34, 197, 94, 0.08), transparent 40%),
    linear-gradient(180deg, #0c1524 0%, #0b1220 60%, #080e19 100%);
  color: var(--text);
  font-family: 'Barlow', system-ui, -apple-system, 'Segoe UI', sans-serif;
}

/* ---------- HEADER ---------- */
.board__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: clamp(10px, 1.2vh, 18px);
  border-bottom: 2px solid var(--line);
}
.board__eyebrow {
  display: block;
  font-size: clamp(12px, 1vw, 18px);
  letter-spacing: 0.28em;
  color: var(--muted);
  text-transform: uppercase;
}
.board__title {
  font-family: 'Barlow Condensed', 'Barlow', sans-serif;
  font-weight: 700;
  font-size: clamp(30px, 3.4vw, 60px);
  line-height: 1;
  letter-spacing: 0.01em;
  margin-top: 4px;
}
.board__controls {
  display: flex;
  align-items: center;
  gap: 12px;
}
.board__clock {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 6px 16px;
  border-left: 2px solid var(--line);
}
.board__clock-day {
  font-size: clamp(12px, 1vw, 18px);
  color: var(--muted);
  text-transform: capitalize;
  letter-spacing: 0.06em;
}
.board__clock-time {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: clamp(28px, 2.8vw, 52px);
  line-height: 1;
  color: var(--amber);
  font-variant-numeric: tabular-nums;
}
.board__btn {
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--text);
  padding: clamp(8px, 0.9vh, 12px) clamp(12px, 1vw, 20px);
  border-radius: 10px;
  font-size: clamp(12px, 1vw, 17px);
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.board__btn:hover {
  background: var(--panel-2);
  border-color: var(--cyan);
}

/* ---------- ALERTS ---------- */
.board__alert {
  display: flex;
  align-items: baseline;
  gap: 14px;
  padding: clamp(8px, 1vh, 14px) clamp(14px, 1.2vw, 22px);
  border-radius: 12px;
  border-left: 6px solid;
  font-size: clamp(13px, 1.05vw, 19px);
}
.board__alert strong {
  letter-spacing: 0.05em;
  white-space: nowrap;
}
.board__alert-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  color: inherit;
  opacity: 0.95;
}
.board__alert--error {
  background: rgba(127, 29, 29, 0.45);
  border-color: var(--red);
  color: #fecaca;
}
.board__alert--warn {
  background: rgba(107, 82, 20, 0.42);
  border-color: var(--amber);
  color: #fde68a;
}
.board__alert--info {
  background: rgba(30, 64, 122, 0.45);
  border-color: var(--blue);
  color: #bfdbfe;
  cursor: pointer;
}

/* ---------- MAIN GRID ---------- */
.board__main {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(320px, 1.05fr) 1.35fr;
  gap: clamp(14px, 1.4vw, 26px);
  min-height: 0;
}

.board__hero,
.board__queue {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 18px;
  overflow: hidden;
}
.board__hero-head,
.board__queue-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: clamp(10px, 1.1vh, 16px) clamp(16px, 1.3vw, 24px);
  background: linear-gradient(90deg, rgba(56, 189, 248, 0.14), rgba(56, 189, 248, 0));
  border-bottom: 1px solid var(--line);
}
.board__queue-head {
  background: linear-gradient(90deg, rgba(245, 179, 1, 0.14), rgba(245, 179, 1, 0));
}
.board__hero-label,
.board__queue-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: clamp(16px, 1.5vw, 26px);
  letter-spacing: 0.16em;
}
.board__hero-count,
.board__queue-count {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: clamp(22px, 2vw, 34px);
  padding: 2px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--line);
  font-variant-numeric: tabular-nums;
}

/* ---------- HERO CARDS ---------- */
.hero-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  gap: clamp(10px, 1vh, 18px);
  padding: clamp(12px, 1.1vw, 20px);
  grid-template-columns: 1fr;
}
.hero-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.8vh, 12px);
  padding: clamp(14px, 1.4vw, 26px);
  border-radius: 14px;
  background: linear-gradient(180deg, var(--panel-2), #0f1a2b);
  border: 1px solid var(--line);
  border-left: 8px solid var(--cyan);
}
.hero-card--normal { border-left-color: var(--emerald); }
.hero-card--warning { border-left-color: var(--amber); }
.hero-card--over {
  border-left-color: var(--red);
  animation: heroPulse 1.8s ease-in-out infinite;
}
.hero-card__plate {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: clamp(38px, 4.2vw, 78px);
  line-height: 0.95;
  letter-spacing: 0.03em;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.hero-card__gate {
  display: flex;
  align-items: baseline;
  gap: 14px;
}
.hero-card__gate-no {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: clamp(26px, 2.4vw, 44px);
  color: var(--amber);
  line-height: 1;
}
.hero-card__gate-wh {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: clamp(18px, 1.6vw, 30px);
  padding: 2px 12px;
  border-radius: 8px;
  background: rgba(245, 179, 1, 0.14);
  color: var(--amber);
}
.hero-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.hero-card__driver {
  font-size: clamp(16px, 1.4vw, 26px);
  font-weight: 600;
}
.hero-card__status {
  font-size: clamp(12px, 1vw, 17px);
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 3px 12px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.16);
  color: var(--cyan);
}
.hero-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: clamp(12px, 1vw, 17px);
  color: var(--muted);
  border-top: 1px dashed var(--line);
  padding-top: clamp(6px, 0.7vh, 10px);
}
.hero-card__remain {
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.hero-card--over .hero-card__remain { color: #fca5a5; }
.hero-card--warning .hero-card__remain { color: #fcd34d; }

.hero-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--muted);
  text-align: center;
  padding: 24px;
}
.hero-empty__big {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: clamp(24px, 2.2vw, 40px);
  color: var(--text);
}
.hero-empty__sub { font-size: clamp(13px, 1.1vw, 19px); }

/* ---------- WAITING LIST ---------- */
.queue-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--line) transparent;
}
.queue-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.queue-row {
  display: grid;
  grid-template-columns: clamp(40px, 3vw, 64px) 64px 1.25fr 1fr 0.9fr 0.7fr 1fr;
  align-items: center;
  gap: clamp(8px, 1vw, 18px);
  padding: clamp(10px, 1.15vh, 18px) clamp(14px, 1.3vw, 24px);
  border-bottom: 1px solid var(--line);
  border-left: 6px solid transparent;
}
.queue-row--over { border-left-color: var(--red); background: rgba(127, 29, 29, 0.22); }
.queue-row--warning { border-left-color: var(--amber); background: rgba(107, 82, 20, 0.18); }
.queue-row--normal { border-left-color: transparent; }
.queue-row__no {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: clamp(20px, 1.8vw, 34px);
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.queue-row__cat {
  justify-self: center;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: clamp(12px, 1vw, 18px);
  letter-spacing: 0.08em;
  padding: 3px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.07);
  color: var(--muted);
}
.queue-row__cat[data-cat='DELIVERY'] { background: rgba(59, 130, 246, 0.18); color: #93c5fd; }
.queue-row__cat[data-cat='RECEIVING'] { background: rgba(34, 197, 94, 0.16); color: #86efac; }
.queue-row__plate {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: clamp(22px, 2vw, 40px);
  line-height: 1;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}
.queue-row__driver {
  font-size: clamp(15px, 1.3vw, 24px);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.queue-row__gate {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: clamp(15px, 1.2vw, 22px);
  color: var(--amber);
  white-space: nowrap;
}
.queue-row__time {
  font-size: clamp(14px, 1.2vw, 22px);
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.queue-row__remain {
  justify-self: end;
  font-weight: 700;
  font-size: clamp(14px, 1.2vw, 22px);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.queue-row__remain.queue-row--over { color: #fca5a5; }
.queue-row__remain.queue-row--warning { color: #fcd34d; }

.queue-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--muted);
  text-align: center;
  padding: 24px;
}
.queue-empty__big {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: clamp(24px, 2.2vw, 40px);
  color: var(--text);
}
.queue-empty__sub { font-size: clamp(13px, 1.1vw, 19px); }

/* ---------- SUMMARY STRIP ---------- */
.board__summary {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: clamp(10px, 1vw, 18px);
  padding-top: clamp(10px, 1.2vh, 18px);
  border-top: 2px solid var(--line);
}
.sum {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: clamp(8px, 1vh, 16px) 8px;
  border-radius: 12px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-top: 4px solid var(--cyan);
}
.sum--delivery { border-top-color: var(--blue); }
.sum--receiving { border-top-color: var(--emerald); }
.sum--waiting { border-top-color: var(--amber); }
.sum--process { border-top-color: var(--cyan); }
.sum--done { border-top-color: var(--emerald); }
.sum__value {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: clamp(28px, 2.6vw, 50px);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.sum__label {
  font-size: clamp(11px, 0.95vw, 16px);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}

/* ---------- MOTION ---------- */
@keyframes heroPulse {
  0%, 100% { box-shadow: inset 0 0 0 rgba(239, 68, 68, 0); }
  50% { box-shadow: inset 0 0 40px rgba(239, 68, 68, 0.28); }
}

@media (prefers-reduced-motion: reduce) {
  .hero-card--over { animation: none; }
}

/* ---------- RESPONSIVE ---------- */
@media (max-width: 1100px) {
  .board__main { grid-template-columns: 1fr; }
  .board__summary { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 640px) {
  .board__header { flex-direction: column; align-items: flex-start; }
  .board__summary { grid-template-columns: repeat(2, 1fr); }
  .queue-row { grid-template-columns: 40px 56px 1.3fr 1fr; }
  .queue-row__gate,
  .queue-row__time { display: none; }
}
</style>

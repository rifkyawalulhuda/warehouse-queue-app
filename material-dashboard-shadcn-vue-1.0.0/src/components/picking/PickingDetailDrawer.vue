<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import { useAuth } from '@/composables/useAuth'
import { updatePickingWhNotes, type PickingProgressEntry } from '@/services/pickingProgressApi'

const props = defineProps<{
  open: boolean
  entry: PickingProgressEntry | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'wh-notes-saved', id: string): void
}>()

const { user } = useAuth()
const isWarehouse = computed(() => user.value?.role === 'WAREHOUSE')
const isWhNotesLocked = computed(
  () => props.entry?.status === 'SELESAI' || props.entry?.status === 'BATAL'
)

const nowTick = ref(Date.now())
let tickTimer: number | undefined

onMounted(() => {
  tickTimer = window.setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (tickTimer) window.clearInterval(tickTimer)
})

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

const formatMinutes = (value?: number | null) => {
  if (value === null || value === undefined) return '-'
  return `${value.toFixed(1)} menit`
}

const currentRemainingSeconds = computed(() => {
  const deadline = props.entry?.deadlineTime
  if (!deadline || props.entry?.status !== 'ON_PROCESS') return null
  const deadlineMs = new Date(deadline).getTime()
  if (Number.isNaN(deadlineMs)) return null
  return Math.floor((deadlineMs - nowTick.value) / 1000)
})

const remainingText = computed(() => {
  const seconds = currentRemainingSeconds.value
  if (seconds === null) return '-'
  const abs = Math.abs(seconds)
  const mins = Math.floor(abs / 60)
  const secs = abs % 60
  const text = `${mins}m ${String(secs).padStart(2, '0')}s`
  if (seconds < 0) return `Over SLA ${text}`
  return text
})

const statusClass = (status?: PickingProgressEntry['status']) => {
  if (status === 'MENUNGGU') return 'bg-yellow-100 text-yellow-800'
  if (status === 'ON_PROCESS') return 'bg-blue-100 text-blue-800'
  if (status === 'SELESAI') return 'bg-green-100 text-green-800'
  if (status === 'BATAL') return 'bg-red-100 text-red-800'
  return 'bg-muted text-muted-foreground'
}

const formatProgressPercent = (value?: number | null) => {
  const num = Number(value ?? 0)
  if (!Number.isFinite(num)) return '0%'
  return `${num.toFixed(2).replace(/\.?0+$/, '')}%`
}

const latestCancelLog = computed(() => {
  const logs = props.entry?.logs || []
  return [...logs]
    .reverse()
    .find(
      (log) =>
        log.toStatus === 'BATAL' &&
        (log.action === 'CANCEL' || (typeof log.note === 'string' && log.note.trim().length > 0))
    )
})

const statusTimelineSteps = [
  { key: 'MENUNGGU', label: 'Menunggu' },
  { key: 'ON_PROCESS', label: 'Proses' },
  { key: 'SELESAI', label: 'Finish' },
] as const

type TimelineStatus = (typeof statusTimelineSteps)[number]['key']
type TimelineState = 'completed' | 'active' | 'cancelled' | 'upcoming'

const normalizeTimelineStatus = (value?: string | null): TimelineStatus => {
  if (value === 'MENUNGGU' || value === 'ON_PROCESS' || value === 'SELESAI') return value
  return 'MENUNGGU'
}

const isTimelineCancelled = computed(() => props.entry?.status === 'BATAL')

const timelineCurrentStatus = computed<TimelineStatus>(() => {
  if (!props.entry) return 'MENUNGGU'
  if (props.entry.status === 'BATAL') {
    return normalizeTimelineStatus(latestCancelLog.value?.fromStatus || 'MENUNGGU')
  }
  return normalizeTimelineStatus(props.entry.status)
})

const timelineCurrentIndex = computed(() =>
  statusTimelineSteps.findIndex((step) => step.key === timelineCurrentStatus.value)
)

const timelineCancelledLabel = computed(() => {
  const step = statusTimelineSteps.find((item) => item.key === timelineCurrentStatus.value)
  return step?.label || 'Menunggu'
})

const getTimelineStepState = (status: TimelineStatus): TimelineState => {
  const stepIndex = statusTimelineSteps.findIndex((item) => item.key === status)
  const currentIndex = timelineCurrentIndex.value

  if (stepIndex < 0 || currentIndex < 0) return 'upcoming'
  if (isTimelineCancelled.value) {
    if (stepIndex < currentIndex) return 'completed'
    if (stepIndex === currentIndex) return 'cancelled'
    return 'upcoming'
  }

  if (stepIndex < currentIndex) return 'completed'
  if (timelineCurrentStatus.value === 'SELESAI' && stepIndex === currentIndex) return 'completed'
  if (stepIndex === currentIndex) return 'active'
  return 'upcoming'
}

const getTimelineDotClass = (status: TimelineStatus) => {
  const state = getTimelineStepState(status)
  if (state === 'completed') return 'border-emerald-600 bg-emerald-600 text-white'
  if (state === 'active') return 'border-blue-600 bg-blue-600 text-white'
  if (state === 'cancelled') return 'border-red-600 bg-red-600 text-white'
  return 'border-border bg-background text-muted-foreground'
}

const getTimelineLabelClass = (status: TimelineStatus) => {
  const state = getTimelineStepState(status)
  if (state === 'completed') return 'text-emerald-700'
  if (state === 'active') return 'text-blue-700'
  if (state === 'cancelled') return 'text-red-700'
  return 'text-muted-foreground'
}

const getTimelineConnectorClass = (stepIndex: number) => {
  const currentIndex = timelineCurrentIndex.value
  if (stepIndex < currentIndex) return 'bg-emerald-500'
  return 'bg-border'
}

const whNotesInput = ref('')
const whNotesSubmitting = ref(false)
const whNotesError = ref('')
const whNotesSuccess = ref('')

watch(
  () => [props.open, props.entry?.id],
  () => {
    whNotesInput.value = props.entry?.notesFromWh || ''
    whNotesError.value = ''
    whNotesSuccess.value = ''
  },
  { immediate: true }
)

watch(
  () => props.entry?.notesFromWh,
  () => {
    whNotesInput.value = props.entry?.notesFromWh || ''
  }
)

const saveWhNotes = async () => {
  if (!props.entry) return
  if (isWhNotesLocked.value) {
    whNotesError.value = 'Notes from WH tidak bisa diubah saat status SELESAI atau BATAL'
    return
  }
  whNotesSubmitting.value = true
  whNotesError.value = ''
  whNotesSuccess.value = ''
  try {
    await updatePickingWhNotes(props.entry.id, String(whNotesInput.value || ''))
    whNotesSuccess.value = 'Notes from WH berhasil disimpan'
    emit('wh-notes-saved', props.entry.id)
  } catch (err: any) {
    whNotesError.value =
      err?.response?.data?.message || err?.message || 'Gagal menyimpan Notes from WH'
  } finally {
    whNotesSubmitting.value = false
  }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/40" @click="emit('close')"></div>
    <aside class="absolute right-0 top-0 h-full w-full max-w-lg bg-card shadow-xl border-l overflow-y-auto">
      <div class="p-4 border-b flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold">Detail Picking Progress</h3>
          <p class="text-sm text-muted-foreground">ID: {{ entry?.id }}</p>
        </div>
        <Button variant="outline" size="sm" @click="emit('close')">Tutup</Button>
      </div>

      <div class="p-4 space-y-4 text-sm">
        <div class="rounded-md border bg-muted/20 px-3 py-3">
          <p class="text-xs font-medium text-muted-foreground">Timeline Status</p>
          <div class="mt-3 grid grid-cols-3">
            <div
              v-for="(step, index) in statusTimelineSteps"
              :key="step.key"
              class="relative flex flex-col items-center px-1"
            >
              <div
                v-if="index < statusTimelineSteps.length - 1"
                :class="['absolute left-1/2 top-3 h-0.5 w-full', getTimelineConnectorClass(index)]"
              ></div>
              <div
                :class="[
                  'relative z-10 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold',
                  getTimelineDotClass(step.key),
                ]"
              >
                {{ index + 1 }}
              </div>
              <span :class="['mt-1 text-[11px] font-medium', getTimelineLabelClass(step.key)]">
                {{ step.label }}
              </span>
            </div>
          </div>
          <p v-if="isTimelineCancelled" class="mt-2 text-xs text-red-700">
            Transaksi dibatalkan pada tahap {{ timelineCancelledLabel }}.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <p class="text-muted-foreground">Customer Name</p>
            <p class="font-medium">{{ entry?.customer?.name || '-' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Date</p>
            <p class="font-medium">{{ formatDateTime(entry?.date) }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">DO Number</p>
            <p class="font-medium">{{ entry?.doNumber || '-' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Destination</p>
            <p class="font-medium">{{ entry?.destination || '-' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Volume (CBM)</p>
            <p class="font-medium">{{ entry?.volumeCbm ?? '-' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">PL Time Release</p>
            <p class="font-medium">{{ formatDateTime(entry?.plTimeRelease || entry?.startTime) }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Picking Qty</p>
            <p class="font-medium">{{ entry?.pickingQty ?? '-' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Picked Qty</p>
            <p class="font-medium">{{ entry?.pickedQty ?? '-' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Remain</p>
            <p class="font-medium">{{ entry?.remainQty ?? '-' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Picking Progress</p>
            <p class="font-medium">{{ formatProgressPercent(entry?.pickingProgressPercent) }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Nama Karyawan</p>
            <p class="font-medium">{{ entry?.pickerEmployee?.name || '-' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Start Time</p>
            <p class="font-medium">{{ formatDateTime(entry?.startTime) }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Finish Time</p>
            <p class="font-medium">{{ formatDateTime(entry?.finishTime) }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">SLA / Barcode</p>
            <p class="font-medium">{{ formatMinutes(entry?.slaPerBarcodeMinutes) }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">SLA Total</p>
            <p class="font-medium">{{ formatMinutes(entry?.slaTotalMinutes) }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Deadline</p>
            <p class="font-medium">{{ formatDateTime(entry?.deadlineTime) }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Time Remaining</p>
            <p class="font-medium">{{ remainingText }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">PIC Created By</p>
            <p class="font-medium">{{ entry?.createdBy?.name || '-' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">PIC Last Updated By</p>
            <p class="font-medium">{{ entry?.updatedBy?.name || '-' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Status</p>
            <span :class="['inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', statusClass(entry?.status)]">
              {{ entry?.status || '-' }}
            </span>
          </div>
          <div class="col-span-2">
            <p class="text-muted-foreground">Notes from WH :</p>
            <div v-if="isWarehouse" class="mt-1 space-y-2">
              <textarea
                v-model="whNotesInput"
                rows="3"
                class="w-full rounded-md border bg-transparent px-2 py-2 text-sm"
                placeholder="Input catatan dari warehouse..."
                :disabled="isWhNotesLocked"
              ></textarea>
              <div class="flex items-center justify-end">
                <Button size="sm" :disabled="whNotesSubmitting || isWhNotesLocked" @click="saveWhNotes">
                  {{ whNotesSubmitting ? 'Menyimpan...' : 'Simpan Notes WH' }}
                </Button>
              </div>
              <div
                v-if="isWhNotesLocked"
                class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700"
              >
                Notes from WH terkunci karena status transaksi sudah SELESAI atau BATAL.
              </div>
              <div
                v-if="whNotesSuccess"
                class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              >
                {{ whNotesSuccess }}
              </div>
              <div
                v-if="whNotesError"
                class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {{ whNotesError }}
              </div>
            </div>
            <p v-else class="font-medium">{{ entry?.notesFromWh || '-' }}</p>
          </div>
        </div>

        <div class="border-t pt-4">
          <h4 class="text-sm font-semibold mb-2">Logs</h4>
          <div v-if="entry?.logs?.length" class="space-y-2">
            <div v-for="log in entry.logs" :key="log.id" class="rounded-md border p-2">
              <div class="flex items-center justify-between">
                <span class="font-medium">{{ log.action }}</span>
                <span class="text-muted-foreground">{{ formatDateTime(log.createdAt) }}</span>
              </div>
              <div class="text-muted-foreground">
                oleh: {{ log.user?.name || '-' }}
                <span v-if="log.fromStatus || log.toStatus">
                  | {{ log.fromStatus || '-' }} -> {{ log.toStatus || '-' }}
                </span>
              </div>
              <div v-if="log.note" class="text-xs text-muted-foreground mt-1">{{ log.note }}</div>
            </div>
          </div>
          <div v-else class="text-sm text-muted-foreground">Belum ada log.</div>
        </div>
      </div>
    </aside>
  </div>
</template>

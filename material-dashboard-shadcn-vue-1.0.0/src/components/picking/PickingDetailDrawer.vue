<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import type { PickingProgressEntry } from '@/services/pickingProgressApi'

const props = defineProps<{
  open: boolean
  entry: PickingProgressEntry | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

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
            <p class="font-medium">{{ entry?.doNumber || entry?.noContainer || '-' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Destination</p>
            <p class="font-medium">{{ entry?.destination || entry?.noDock || '-' }}</p>
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
            <p class="font-medium">{{ entry?.pickingProgressPercent?.toFixed(2) ?? '0.00' }}%</p>
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

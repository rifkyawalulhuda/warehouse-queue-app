<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import type { PickingProgressEntry } from '@/services/pickingProgressApi'

defineProps<{
  entries: PickingProgressEntry[]
  loading: boolean
  page: number
  limit: number
}>()

const emit = defineEmits<{
  (e: 'start', entry: PickingProgressEntry): void
  (e: 'adjust-picked', entry: PickingProgressEntry, delta: number): void
  (e: 'finish', entry: PickingProgressEntry): void
  (e: 'cancel', entry: PickingProgressEntry): void
  (e: 'detail', entry: PickingProgressEntry): void
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

const formatTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

const getCurrentRemainingSeconds = (entry: PickingProgressEntry) => {
  if (entry.status !== 'ON_PROCESS') return null
  if (!entry.deadlineTime) return null
  const deadlineMs = new Date(entry.deadlineTime).getTime()
  if (Number.isNaN(deadlineMs)) return null
  return Math.floor((deadlineMs - nowTick.value) / 1000)
}

const formatRemaining = (seconds: number | null) => {
  if (seconds === null) return '-'
  const abs = Math.abs(seconds)
  const mins = Math.floor(abs / 60)
  const secs = abs % 60
  const timeText = `${mins}m ${String(secs).padStart(2, '0')}s`
  if (seconds < 0) return `Over SLA ${timeText}`
  return timeText
}

const isOverSlaNow = (entry: PickingProgressEntry) => {
  const remaining = getCurrentRemainingSeconds(entry)
  return entry.status === 'ON_PROCESS' && remaining !== null && remaining < 0
}

const isNearSlaNow = (entry: PickingProgressEntry) => {
  const remaining = getCurrentRemainingSeconds(entry)
  return entry.status === 'ON_PROCESS' && remaining !== null && remaining >= 0 && remaining < 900
}

const rowClass = (entry: PickingProgressEntry) => {
  if (entry.status === 'BATAL') return 'bg-red-50 hover:bg-red-100'
  if (isOverSlaNow(entry)) return 'bg-red-100 hover:bg-red-200'
  if (isNearSlaNow(entry)) return 'bg-yellow-100 hover:bg-yellow-200'
  return 'hover:bg-gray-50'
}

const statusClass = (status: PickingProgressEntry['status']) => {
  if (status === 'MENUNGGU') return 'bg-yellow-100 text-yellow-800'
  if (status === 'ON_PROCESS') return 'bg-yellow-200 text-yellow-900'
  if (status === 'SELESAI') return 'bg-green-100 text-green-800'
  return 'bg-red-100 text-red-800'
}

const displayDoNumber = (entry: PickingProgressEntry) => entry.doNumber || entry.noContainer || '-'
const displayDestination = (entry: PickingProgressEntry) => entry.destination || entry.noDock || '-'
const displayVolumeCbm = (entry: PickingProgressEntry) => {
  if (entry.volumeCbm === null || entry.volumeCbm === undefined) return '-'
  return Number(entry.volumeCbm).toString()
}
const displayPlTimeRelease = (entry: PickingProgressEntry) => {
  return formatTime(entry.plTimeRelease || entry.startTime)
}
const displayRemainQty = (entry: PickingProgressEntry) => {
  if (entry.remainQty !== undefined && entry.remainQty !== null) return entry.remainQty
  return Math.max(0, entry.pickingQty - entry.pickedQty)
}
const displayProgressPercent = (entry: PickingProgressEntry) => {
  if (entry.pickingProgressPercent !== undefined && entry.pickingProgressPercent !== null) {
    return `${entry.pickingProgressPercent.toFixed(2)}%`
  }
  if (entry.pickingQty <= 0) return '0.00%'
  const percent = (entry.pickedQty / entry.pickingQty) * 100
  return `${percent.toFixed(2)}%`
}
</script>

<template>
  <div class="overflow-x-auto border rounded-lg">
    <table class="min-w-full text-sm">
      <thead class="bg-muted/60 text-muted-foreground">
        <tr>
          <th class="px-3 py-2 text-left font-medium">No</th>
          <th class="px-3 py-2 text-left font-medium">Nama Customer</th>
          <th class="px-3 py-2 text-left font-medium">DO Number</th>
          <th class="px-3 py-2 text-left font-medium">Destination</th>
          <th class="px-3 py-2 text-right font-medium">Volume (CBM)</th>
          <th class="px-3 py-2 text-left font-medium">PL Time Release</th>
          <th class="px-3 py-2 text-right font-medium">Picking Qty (Barcode)</th>
          <th class="px-3 py-2 text-right font-medium">Picked Qty</th>
          <th class="px-3 py-2 text-right font-medium">Remain</th>
          <th class="px-3 py-2 text-right font-medium">Picking Progress</th>
          <th class="px-3 py-2 text-left font-medium">Time Remaining</th>
          <th class="px-3 py-2 text-left font-medium">Status</th>
          <th class="px-3 py-2 text-left font-medium">Aksi</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td colspan="13" class="px-3 py-6 text-center text-muted-foreground">Loading...</td>
        </tr>
        <tr v-else-if="entries.length === 0">
          <td colspan="13" class="px-3 py-6 text-center text-muted-foreground">Data kosong.</td>
        </tr>
        <tr
          v-for="(entry, index) in entries"
          :key="entry.id"
          :class="['border-t transition-colors', rowClass(entry)]"
        >
          <td class="px-3 py-2">{{ (page - 1) * limit + index + 1 }}</td>
          <td class="px-3 py-2">{{ entry.customer?.name || '-' }}</td>
          <td class="px-3 py-2">{{ displayDoNumber(entry) }}</td>
          <td class="px-3 py-2">{{ displayDestination(entry) }}</td>
          <td class="px-3 py-2 text-right">{{ displayVolumeCbm(entry) }}</td>
          <td class="px-3 py-2">{{ displayPlTimeRelease(entry) }}</td>
          <td class="px-3 py-2 text-right">{{ entry.pickingQty }}</td>
          <td class="px-3 py-2 text-right font-semibold">
            {{ entry.pickedQty }}
          </td>
          <td class="px-3 py-2 text-right">{{ displayRemainQty(entry) }}</td>
          <td class="px-3 py-2 text-right">{{ displayProgressPercent(entry) }}</td>
          <td class="px-3 py-2">
            <span v-if="entry.status === 'ON_PROCESS'"
              :class="isOverSlaNow(entry) ? 'text-red-700 font-semibold' : isNearSlaNow(entry) ? 'text-yellow-800 font-semibold' : 'text-muted-foreground'"
            >
              {{ formatRemaining(getCurrentRemainingSeconds(entry)) }}
            </span>
            <span v-else class="text-muted-foreground">-</span>
          </td>
          <td class="px-3 py-2">
            <span :class="['inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', statusClass(entry.status)]">
              {{ entry.status }}
            </span>
          </td>
          <td class="px-3 py-2">
            <div class="flex flex-wrap items-center gap-2">
              <Button
                v-if="entry.status === 'MENUNGGU'"
                size="sm"
                variant="outline"
                @click="emit('start', entry)"
              >
                Start
              </Button>
              <template v-if="entry.status === 'ON_PROCESS'">
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="entry.pickedQty <= 0"
                  @click="emit('adjust-picked', entry, -1)"
                >
                  -
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="entry.pickedQty >= entry.pickingQty"
                  @click="emit('adjust-picked', entry, 1)"
                >
                  +
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  class="border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
                  @click="emit('finish', entry)"
                >
                  Finish
                </Button>
              </template>
              <Button
                v-if="entry.status === 'MENUNGGU' || entry.status === 'ON_PROCESS'"
                size="sm"
                variant="outline"
                class="border-red-200 bg-red-600 text-white hover:bg-red-700 hover:text-white"
                @click="emit('cancel', entry)"
              >
                Cancel
              </Button>
              <Button size="sm" variant="ghost" @click="emit('detail', entry)">
                Detail
              </Button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

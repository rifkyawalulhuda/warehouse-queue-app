<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import type { PickingProgressEntry, PickingSortField } from '@/services/pickingProgressApi'

defineProps<{
  entries: PickingProgressEntry[]
  loading: boolean
  page: number
  limit: number
  sortBy: PickingSortField
  sortDir: 'asc' | 'desc'
  canCancel: boolean
  canEdit: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-sort', column: PickingSortField): void
  (e: 'edit', entry: PickingProgressEntry): void
  (e: 'start', entry: PickingProgressEntry): void
  (e: 'input-picked', entry: PickingProgressEntry): void
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

const getRowClass = (entry: PickingProgressEntry) => {
  if (entry.status === 'BATAL') {
    return 'bg-red-50 text-red-950 hover:bg-red-100 dark:bg-[rgba(120,24,38,0.28)] dark:text-red-50 dark:hover:bg-[rgba(136,28,43,0.34)]'
  }
  if (isOverSlaNow(entry)) {
    return 'bg-red-50 text-red-950 hover:bg-red-100 dark:bg-[rgba(120,24,38,0.34)] dark:text-red-50 dark:hover:bg-[rgba(136,28,43,0.42)]'
  }
  if (isNearSlaNow(entry)) {
    return 'bg-amber-50 text-amber-950 hover:bg-amber-100 dark:bg-[rgba(120,88,18,0.28)] dark:text-amber-50 dark:hover:bg-[rgba(146,104,24,0.36)]'
  }
  return 'hover:bg-muted/45'
}

const rowClass = (entry: PickingProgressEntry) => {
  return getRowClass(entry)
}

const statusClass = (status: PickingProgressEntry['status']) => {
  if (status === 'MENUNGGU') return 'bg-yellow-100 text-yellow-800'
  if (status === 'ON_PROCESS') return 'bg-blue-100 text-blue-800'
  if (status === 'SELESAI') return 'bg-green-100 text-green-800'
  return 'bg-red-100 text-red-800'
}

const displayDoNumber = (entry: PickingProgressEntry) => entry.doNumber || '-'
const displayDestination = (entry: PickingProgressEntry) => entry.destination || '-'
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
  const toPercentLabel = (value: number) => `${value.toFixed(2).replace(/\.?0+$/, '')}%`

  if (entry.pickingProgressPercent !== undefined && entry.pickingProgressPercent !== null) {
    return toPercentLabel(Number(entry.pickingProgressPercent))
  }
  if (entry.pickingQty <= 0) return '0%'
  const percent = (entry.pickedQty / entry.pickingQty) * 100
  return toPercentLabel(percent)
}

const sortIcon = (column: PickingSortField, sortBy: PickingSortField, sortDir: 'asc' | 'desc') => {
  if (column !== sortBy) return '↕'
  return sortDir === 'asc' ? '↑' : '↓'
}
</script>

<template>
  <div class="overflow-x-auto border rounded-lg">
    <table class="min-w-full text-sm">
      <thead class="bg-muted/60 text-muted-foreground">
        <tr>
          <th class="px-3 py-2 text-left font-medium">
            <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="emit('toggle-sort', 'createdAt')">
              No
              <span class="text-xs">{{ sortIcon('createdAt', sortBy, sortDir) }}</span>
            </button>
          </th>
          <th class="px-3 py-2 text-left font-medium">
            <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="emit('toggle-sort', 'customerName')">
              Nama Customer
              <span class="text-xs">{{ sortIcon('customerName', sortBy, sortDir) }}</span>
            </button>
          </th>
          <th class="px-3 py-2 text-left font-medium">
            <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="emit('toggle-sort', 'doNumber')">
              DO Number
              <span class="text-xs">{{ sortIcon('doNumber', sortBy, sortDir) }}</span>
            </button>
          </th>
          <th class="px-3 py-2 text-left font-medium">
            <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="emit('toggle-sort', 'destination')">
              Destination
              <span class="text-xs">{{ sortIcon('destination', sortBy, sortDir) }}</span>
            </button>
          </th>
          <th class="px-3 py-2 text-right font-medium">
            <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="emit('toggle-sort', 'volumeCbm')">
              Volume (CBM)
              <span class="text-xs">{{ sortIcon('volumeCbm', sortBy, sortDir) }}</span>
            </button>
          </th>
          <th class="px-3 py-2 text-left font-medium">
            <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="emit('toggle-sort', 'plTimeRelease')">
              PL Time Release
              <span class="text-xs">{{ sortIcon('plTimeRelease', sortBy, sortDir) }}</span>
            </button>
          </th>
          <th class="px-3 py-2 text-right font-medium">
            <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="emit('toggle-sort', 'pickingQty')">
              Picking Qty (Barcode)
              <span class="text-xs">{{ sortIcon('pickingQty', sortBy, sortDir) }}</span>
            </button>
          </th>
          <th class="px-3 py-2 text-right font-medium">
            <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="emit('toggle-sort', 'pickedQty')">
              Picked Qty
              <span class="text-xs">{{ sortIcon('pickedQty', sortBy, sortDir) }}</span>
            </button>
          </th>
          <th class="px-3 py-2 text-right font-medium">Remain</th>
          <th class="px-3 py-2 text-right font-medium">Picking Progress</th>
          <th class="px-3 py-2 text-left font-medium">
            <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="emit('toggle-sort', 'pickerEmployeeName')">
              Nama Karyawan
              <span class="text-xs">{{ sortIcon('pickerEmployeeName', sortBy, sortDir) }}</span>
            </button>
          </th>
          <th class="px-3 py-2 text-left font-medium">Time Remaining</th>
          <th class="px-3 py-2 text-left font-medium">
            <button type="button" class="inline-flex items-center gap-1 hover:text-foreground" @click="emit('toggle-sort', 'status')">
              Status
              <span class="text-xs">{{ sortIcon('status', sortBy, sortDir) }}</span>
            </button>
          </th>
          <th class="px-3 py-2 text-left font-medium">Aksi</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td colspan="14" class="px-3 py-6 text-center text-muted-foreground">Loading...</td>
        </tr>
        <tr v-else-if="entries.length === 0">
          <td colspan="14" class="px-3 py-6 text-center text-muted-foreground">Data kosong.</td>
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
          <td class="px-3 py-2">{{ entry.pickerEmployee?.name || '-' }}</td>
          <td class="px-3 py-2">
            <span v-if="entry.status === 'ON_PROCESS'"
              :class="isOverSlaNow(entry) ? 'font-semibold text-red-700 dark:text-red-100' : isNearSlaNow(entry) ? 'font-semibold text-amber-800 dark:text-amber-100' : 'text-muted-foreground'"
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
                v-if="canEdit && entry.status === 'MENUNGGU'"
                size="sm"
                variant="outline"
                @click="emit('edit', entry)"
              >
                Edit
              </Button>
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
                  @click="emit('input-picked', entry)"
                >
                  Input Qty
                </Button>
                <Button
                  v-if="entry.pickedQty === entry.pickingQty"
                  size="sm"
                  variant="outline"
                  class="border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
                  @click="emit('finish', entry)"
                >
                  Finish
                </Button>
              </template>
              <Button
                v-if="canCancel && (entry.status === 'MENUNGGU' || entry.status === 'ON_PROCESS')"
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

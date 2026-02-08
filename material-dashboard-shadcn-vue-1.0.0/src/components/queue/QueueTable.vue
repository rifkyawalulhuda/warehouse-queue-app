<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import QueueStatusBadge from './QueueStatusBadge.vue'

type QueueEntry = {
  id: string
  category: 'RECEIVING' | 'DELIVERY'
  customerId?: string | null
  customer?: { id: string; name: string } | null
  driverName: string
  truckNumber: string
  containerNumber?: string | null
  registerTime: string
  inWhTime?: string | null
  startTime?: string | null
  finishTime?: string | null
  status: 'MENUNGGU' | 'IN_WH' | 'PROSES' | 'SELESAI' | 'BATAL'
}

const props = defineProps<{
  entries: QueueEntry[]
  loading: boolean
  sortBy: string
  sortDir: 'asc' | 'desc'
}>()

const emit = defineEmits<{
  (e: 'change-status', entry: QueueEntry, newStatus: QueueEntry['status']): void
  (e: 'view-detail', entry: QueueEntry): void
  (e: 'toggle-sort', column: string): void
}>()

const nowTick = ref(Date.now())
let tickTimer: number | undefined

onMounted(() => {
  tickTimer = window.setInterval(() => {
    nowTick.value = Date.now()
  }, 60000)
})

onUnmounted(() => {
  if (tickTimer) window.clearInterval(tickTimer)
})

const formatTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const categoryLabel = (category?: string | null) => {
  if (category === 'RECEIVING') return 'Receiving'
  if (category === 'DELIVERY') return 'Delivery'
  return null
}

const categoryBadgeClass = (category?: string | null) => {
  if (category === 'RECEIVING') return 'bg-blue-100 text-blue-700'
  if (category === 'DELIVERY') return 'bg-purple-100 text-purple-700'
  return 'bg-muted text-muted-foreground'
}

const getSlaMinutes = (entry: QueueEntry) => {
  if (entry.status === 'MENUNGGU' || entry.status === 'IN_WH') return 30
  if (entry.status === 'PROSES') return entry.category === 'RECEIVING' ? 120 : 90
  return null
}

const getElapsedMinutes = (entry: QueueEntry) => {
  let start: string | null | undefined = null
  if (entry.status === 'MENUNGGU' || entry.status === 'IN_WH') start = entry.registerTime
  if (entry.status === 'PROSES') start = entry.startTime
  if (!start) return null
  const diffMs = nowTick.value - new Date(start).getTime()
  return Math.floor(diffMs / 60000)
}

const getTimeRemaining = (entry: QueueEntry) => {
  const sla = getSlaMinutes(entry)
  const elapsed = getElapsedMinutes(entry)
  if (sla === null || elapsed === null) return null
  return sla - elapsed
}

const isOverdue = (entry: QueueEntry) => {
  const remaining = getTimeRemaining(entry)
  return remaining !== null && remaining <= 0
}

const sortIndicator = (column: string) => {
  if (props.sortBy !== column) return ''
  return props.sortDir === 'asc' ? '▲' : '▼'
}
</script>

<template>
  <div class="overflow-x-auto border rounded-lg">
    <table class="min-w-full text-sm">
      <thead class="bg-muted/60 text-muted-foreground">
        <tr>
          <th class="px-3 py-2 text-left font-medium">No</th>
          <th
            class="px-3 py-2 text-left font-medium cursor-pointer select-none"
            @click="emit('toggle-sort', 'customerName')"
          >
            Customer Name <span class="ml-1 text-xs">{{ sortIndicator('customerName') }}</span>
          </th>
          <th
            class="px-3 py-2 text-left font-medium cursor-pointer select-none"
            @click="emit('toggle-sort', 'driverName')"
          >
            Driver Name <span class="ml-1 text-xs">{{ sortIndicator('driverName') }}</span>
          </th>
          <th
            class="px-3 py-2 text-left font-medium cursor-pointer select-none"
            @click="emit('toggle-sort', 'truckNumber')"
          >
            No Truck <span class="ml-1 text-xs">{{ sortIndicator('truckNumber') }}</span>
          </th>
          <th class="px-3 py-2 text-left font-medium">No Container</th>
          <th
            class="px-3 py-2 text-left font-medium cursor-pointer select-none"
            @click="emit('toggle-sort', 'registerTime')"
          >
            Register Time <span class="ml-1 text-xs">{{ sortIndicator('registerTime') }}</span>
          </th>
          <th
            class="px-3 py-2 text-left font-medium cursor-pointer select-none"
            @click="emit('toggle-sort', 'inWhTime')"
          >
            In WH - Time <span class="ml-1 text-xs">{{ sortIndicator('inWhTime') }}</span>
          </th>
          <th
            class="px-3 py-2 text-left font-medium cursor-pointer select-none"
            @click="emit('toggle-sort', 'startTime')"
          >
            Start <span class="ml-1 text-xs">{{ sortIndicator('startTime') }}</span>
          </th>
          <th
            class="px-3 py-2 text-left font-medium cursor-pointer select-none"
            @click="emit('toggle-sort', 'finishTime')"
          >
            Finish <span class="ml-1 text-xs">{{ sortIndicator('finishTime') }}</span>
          </th>
          <th class="px-3 py-2 text-left font-medium">Time Remaining</th>
          <th
            class="px-3 py-2 text-left font-medium cursor-pointer select-none"
            @click="emit('toggle-sort', 'status')"
          >
            Status <span class="ml-1 text-xs">{{ sortIndicator('status') }}</span>
          </th>
          <th class="px-3 py-2 text-left font-medium">Aksi</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td colspan="12" class="px-3 py-6 text-center text-muted-foreground">Loading...</td>
        </tr>
        <tr v-else-if="props.entries.length === 0">
          <td colspan="12" class="px-3 py-6 text-center text-muted-foreground">Data kosong.</td>
        </tr>
        <tr
          v-for="(entry, index) in props.entries"
          :key="entry.id"
          :class="[
            'border-t',
            isOverdue(entry) ? 'bg-red-50' : 'bg-background'
          ]"
        >
          <td class="px-3 py-2">{{ index + 1 }}</td>
          <td class="px-3 py-2">
            <div class="flex flex-col gap-1">
              <span>{{ entry.customer?.name || '-' }}</span>
              <span
                v-if="categoryLabel(entry.category)"
                :class="['inline-flex w-fit items-center rounded px-2 py-1 text-xs font-medium', categoryBadgeClass(entry.category)]"
              >
                {{ categoryLabel(entry.category) }}
              </span>
            </div>
          </td>
          <td class="px-3 py-2">{{ entry.driverName }}</td>
          <td class="px-3 py-2">{{ entry.truckNumber }}</td>
          <td class="px-3 py-2">{{ entry.containerNumber || '-' }}</td>
          <td class="px-3 py-2">{{ formatTime(entry.registerTime) }}</td>
          <td class="px-3 py-2">{{ formatTime(entry.inWhTime) }}</td>
          <td class="px-3 py-2">{{ formatTime(entry.startTime) }}</td>
          <td class="px-3 py-2">{{ formatTime(entry.finishTime) }}</td>
          <td class="px-3 py-2">
            <span
              v-if="getTimeRemaining(entry) !== null"
              :class="isOverdue(entry) ? 'text-red-600 font-semibold' : 'text-muted-foreground'"
            >
              {{ getTimeRemaining(entry) }} menit
            </span>
            <span v-else class="text-muted-foreground">-</span>
          </td>
          <td class="px-3 py-2">
            <QueueStatusBadge :status="entry.status" />
          </td>
          <td class="px-3 py-2">
            <div class="flex items-center gap-2">
              <Button
                v-if="entry.status === 'MENUNGGU'"
                size="sm"
                variant="outline"
                @click="emit('change-status', entry, 'IN_WH')"
              >
                Set IN_WH
              </Button>
              <Button
                v-if="entry.status === 'MENUNGGU' || entry.status === 'IN_WH'"
                size="sm"
                variant="outline"
                @click="emit('change-status', entry, 'BATAL')"
              >
                Batal
              </Button>
              <Button
                v-if="entry.status === 'IN_WH'"
                size="sm"
                variant="outline"
                @click="emit('change-status', entry, 'PROSES')"
              >
                Mulai PROSES
              </Button>
              <Button
                v-if="entry.status === 'PROSES'"
                size="sm"
                variant="outline"
                @click="emit('change-status', entry, 'SELESAI')"
              >
                Selesai
              </Button>
              <Button
                v-if="entry.status === 'IN_WH'"
                size="sm"
                variant="ghost"
                @click="emit('change-status', entry, 'MENUNGGU')"
              >
                Kembali
              </Button>
              <Button
                v-if="entry.status === 'PROSES'"
                size="sm"
                variant="ghost"
                @click="emit('change-status', entry, 'IN_WH')"
              >
                Kembali
              </Button>
              <Button size="sm" variant="ghost" @click="emit('view-detail', entry)">
                Detail
              </Button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

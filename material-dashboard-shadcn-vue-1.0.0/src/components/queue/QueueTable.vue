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
}>()

const emit = defineEmits<{
  (e: 'change-status', entry: QueueEntry, newStatus: QueueEntry['status']): void
  (e: 'view-detail', entry: QueueEntry): void
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

const categoryLabel = (category: string) => {
  if (category === 'RECEIVING') return 'Receiving'
  if (category === 'DELIVERY') return 'Delivery'
  return category
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
</script>

<template>
  <div class="overflow-x-auto border rounded-lg">
    <table class="min-w-full text-sm">
      <thead class="bg-muted/60 text-muted-foreground">
        <tr>
          <th class="px-3 py-2 text-left font-medium">No</th>
          <th class="px-3 py-2 text-left font-medium">Customer Name</th>
          <th class="px-3 py-2 text-left font-medium">Driver Name</th>
          <th class="px-3 py-2 text-left font-medium">No Truck</th>
          <th class="px-3 py-2 text-left font-medium">No Container</th>
          <th class="px-3 py-2 text-left font-medium">Register Time</th>
          <th class="px-3 py-2 text-left font-medium">In WH - Time</th>
          <th class="px-3 py-2 text-left font-medium">Start</th>
          <th class="px-3 py-2 text-left font-medium">Finish</th>
          <th class="px-3 py-2 text-left font-medium">Time Remaining</th>
          <th class="px-3 py-2 text-left font-medium">Status</th>
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
          <td class="px-3 py-2">{{ entry.customer?.name || '-' }}</td>
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

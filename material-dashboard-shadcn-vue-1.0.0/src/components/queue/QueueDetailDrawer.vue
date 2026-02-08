<script setup lang="ts">
import { computed } from 'vue'
import QueueStatusBadge from './QueueStatusBadge.vue'
import Button from '@/components/ui/Button.vue'

type QueueLog = {
  id: string
  action: string
  oldStatus?: string | null
  newStatus?: string | null
  userName: string
  createdAt: string
}

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
  notes?: string | null
  logs?: QueueLog[]
}

const props = defineProps<{
  open: boolean
  entry: QueueEntry | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const parseDate = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

const formatDurationHuman = (ms?: number | null) => {
  if (ms === null || ms === undefined || ms < 0) return '-'
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) return `${hours} jam ${minutes} menit`
  if (hours > 0 && minutes === 0) return `${hours} jam`
  if (hours === 0 && minutes > 0) return `${minutes} menit`
  return 'kurang dari 1 menit'
}

const totalDurationHuman = computed(() => {
  const start = parseDate(props.entry?.registerTime)
  const finish = parseDate(props.entry?.finishTime)
  if (!start || !finish) return '-'
  return formatDurationHuman(finish.getTime() - start.getTime())
})

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  return date.toLocaleString()
}

const formatCategoryLabel = (category?: string | null) => {
  if (category === 'RECEIVING') return 'Receiving'
  if (category === 'DELIVERY') return 'Delivery'
  return null
}

const getCategoryBadgeClass = (category?: string | null) => {
  if (category === 'RECEIVING') return 'bg-blue-100 text-blue-700'
  if (category === 'DELIVERY') return 'bg-purple-100 text-purple-700'
  return 'bg-muted text-muted-foreground'
}

const categoryLabel = (category?: string) => {
  if (category === 'RECEIVING') return 'Receiving'
  if (category === 'DELIVERY') return 'Delivery'
  return '-'
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/40" @click="emit('close')"></div>
    <aside class="absolute right-0 top-0 h-full w-full max-w-lg bg-card shadow-xl border-l overflow-y-auto">
      <div class="p-4 border-b flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold">Detail Antrian</h3>
          <p class="text-sm text-muted-foreground">ID: {{ entry?.id }}</p>
          <span
            v-if="formatCategoryLabel(entry?.category)"
            :class="['mt-2 inline-flex w-fit items-center rounded px-2 py-1 text-xs font-medium', getCategoryBadgeClass(entry?.category)]"
          >
            {{ formatCategoryLabel(entry?.category) }}
          </span>
        </div>
        <Button variant="outline" size="sm" @click="emit('close')">Tutup</Button>
      </div>

      <div class="p-4 space-y-4">
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p class="text-muted-foreground">Customer Name</p>
            <p class="font-medium">{{ entry?.customer?.name || '-' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Driver Name</p>
            <p class="font-medium">{{ entry?.driverName || '-' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">No Truck</p>
            <p class="font-medium">{{ entry?.truckNumber || '-' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">No Container</p>
            <p class="font-medium">{{ entry?.containerNumber || '-' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Category</p>
            <p class="font-medium">{{ categoryLabel(entry?.category) }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Status</p>
            <QueueStatusBadge v-if="entry" :status="entry.status" />
          </div>
          <div>
            <p class="text-muted-foreground">Register Time</p>
            <p class="font-medium">{{ formatDateTime(entry?.registerTime) }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">In WH Time</p>
            <p class="font-medium">{{ formatDateTime(entry?.inWhTime) }}</p>
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
            <p class="text-muted-foreground">Total Waktu (Register → Finish)</p>
            <p class="font-medium">{{ totalDurationHuman }}</p>
          </div>
          <div class="col-span-2">
            <p class="text-muted-foreground">Notes</p>
            <p class="font-medium">{{ entry?.notes || '-' }}</p>
          </div>
        </div>

        <div class="border-t pt-4">
          <h4 class="text-sm font-semibold mb-2">Logs</h4>
          <div v-if="entry?.logs?.length" class="space-y-2 text-sm">
            <div v-for="log in entry.logs" :key="log.id" class="rounded-md border p-2">
              <div class="flex items-center justify-between">
                <span class="font-medium">{{ log.action }}</span>
                <span class="text-muted-foreground">{{ formatDateTime(log.createdAt) }}</span>
              </div>
              <div class="text-muted-foreground">
                {{ log.userName }} | {{ log.oldStatus || '-' }} -> {{ log.newStatus || '-' }}
              </div>
            </div>
          </div>
          <div v-else class="text-sm text-muted-foreground">Belum ada log.</div>
        </div>
      </div>
    </aside>
  </div>
</template>

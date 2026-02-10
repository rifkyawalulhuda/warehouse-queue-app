<script setup lang="ts">
import { computed, ref } from 'vue'
import QueueStatusBadge from './QueueStatusBadge.vue'
import Button from '@/components/ui/Button.vue'
import { useAuth } from '@/composables/useAuth'
import { useTtsQueue } from '@/composables/useTtsQueue'

type QueueLog = {
  id: string
  type: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE'
  fromStatus?: string | null
  toStatus?: string | null
  userName?: string | null
  actorUser?: { id: string; name: string; username: string; role: string } | null
  createdAt: string
}

type QueueEntry = {
  id: string
  category: 'RECEIVING' | 'DELIVERY'
  customerId?: string | null
  customer?: { id: string; name: string } | null
  gateId?: string | null
  gate?: { id: string; gateNo: string; area: string; warehouse: 'WH1' | 'WH2' | 'DG' } | null
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

const { user } = useAuth()
const isAdmin = computed(() => user.value?.role === 'ADMIN')
const soundEnabled = ref(true)
const { enqueue, supported: ttsSupported } = useTtsQueue({ enabled: soundEnabled, lang: 'id-ID' })

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

const resolveAreaType = (category?: QueueEntry['category']) => {
  if (category === 'DELIVERY') return 'Loading'
  if (category === 'RECEIVING') return 'Unloading'
  return 'Loading'
}

const formatTruckSpeech = (value?: string | null) => {
  if (!value) return '-'
  let text = value.trim()
  if (!text) return '-'
  text = text.replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/(\d)([A-Za-z])/g, '$1 $2')
  text = text.replace(/\d+/g, (match) => match.split('').join(' '))
  return text.replace(/\s+/g, ' ').trim()
}

const formatGateSpeech = (gate?: QueueEntry['gate'] | null) => {
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

const buildAnnouncement = (entry: QueueEntry) => {
  const driverName = entry.driverName || '-'
  const truckNumber = formatTruckSpeech(entry.truckNumber)
  const gateNo = formatGateSpeech(entry.gate)
  const areaType = resolveAreaType(entry.category)
  return `Perhatian. Driver ${driverName}, truk ${truckNumber}. Silakan menuju ${gateNo}. Anda sudah diperbolehkan masuk area ${areaType}.`
}

const handleAnnounce = () => {
  if (!props.entry) return
  enqueue(buildAnnouncement(props.entry))
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
        <div class="flex items-center gap-2">
          <Button
            v-if="isAdmin"
            variant="outline"
            size="sm"
            class="border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
            :disabled="!entry?.gate?.gateNo || !ttsSupported || entry?.status !== 'IN_WH'"
            @click="handleAnnounce"
          >
            Paging
          </Button>
          <Button variant="outline" size="sm" @click="emit('close')">Tutup</Button>
        </div>
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
            <p class="text-muted-foreground">Gate No</p>
            <p class="font-medium">{{ entry?.gate?.gateNo || '-' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Area</p>
            <p class="font-medium">{{ entry?.gate?.area || '-' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Warehouse</p>
            <p class="font-medium">{{ entry?.gate?.warehouse || '-' }}</p>
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
                <span class="font-medium">{{ log.type }}</span>
                <span class="text-muted-foreground">{{ formatDateTime(log.createdAt) }}</span>
              </div>
              <div class="text-muted-foreground">
                oleh: {{ log.actorUser?.name || log.userName || '-' }}
                <span v-if="log.fromStatus || log.toStatus">
                  — {{ log.fromStatus || '-' }} -> {{ log.toStatus || '-' }}
                </span>
                <span v-if="log.toStatus === 'IN_WH' && entry?.gate?.gateNo">
                  (Gate: {{ entry.gate.gateNo }})
                </span>
              </div>
            </div>
          </div>
          <div v-else class="text-sm text-muted-foreground">Belum ada log.</div>
        </div>
      </div>
    </aside>
  </div>
</template>

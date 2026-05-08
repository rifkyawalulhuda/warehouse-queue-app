<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Eye } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import QueueStatusBadge from './QueueStatusBadge.vue'
import { useAuth } from '@/composables/useAuth'

type QueueEntry = {
  id: string
  category: 'RECEIVING' | 'DELIVERY'
  customer?: { id: string; name: string } | null
  gate?: { id: string; gateNo: string; area: string; warehouse: 'WH1' | 'WH2' | 'DG' } | null
  driverName: string
  truckNumber: string
  containerNumber?: string | null
  transporter?: string | null
  registerTime: string
  inWhTime?: string | null
  startTime?: string | null
  finishTime?: string | null
  slaWaitingMinutes: number
  slaInWhProcessMinutes: number
  status: 'MENUNGGU' | 'IN_WH' | 'PROSES' | 'SELESAI' | 'BATAL'
}

defineProps<{
  entries: QueueEntry[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'change-status', entry: QueueEntry, newStatus: QueueEntry['status']): void
  (e: 'view-detail', entry: QueueEntry): void
}>()

const { user } = useAuth()
const isAdmin = computed(() => user.value?.role === 'ADMIN')

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

const formatCategory = (category?: string | null) => {
  if (category === 'RECEIVING') return 'Receiving'
  if (category === 'DELIVERY') return 'Delivery'
  return '-'
}

const getSlaMinutes = (entry: QueueEntry) => {
  if (entry.status === 'MENUNGGU') return entry.slaWaitingMinutes
  if (entry.status === 'IN_WH' || entry.status === 'PROSES') return entry.slaInWhProcessMinutes
  return null
}

const getElapsedMinutes = (entry: QueueEntry) => {
  let start: string | null | undefined = null
  if (entry.status === 'MENUNGGU') start = entry.registerTime
  if (entry.status === 'IN_WH' || entry.status === 'PROSES') start = entry.inWhTime || entry.startTime
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

const isNearOverdue = (entry: QueueEntry) => {
  const remaining = getTimeRemaining(entry)
  return remaining !== null && remaining > 0 && remaining <= 15
}

const timeRemainingLabel = (entry: QueueEntry) => {
  const remaining = getTimeRemaining(entry)
  if (remaining === null) return '-'
  if (remaining < 0) return `Over SLA ${Math.abs(remaining)} menit`
  return `${remaining} menit`
}

const getActionSet = (entry: QueueEntry) => {
  const actions: Array<{ label: string; status: QueueEntry['status']; variant: 'default' | 'outline'; danger?: boolean }> = []
  if (entry.status === 'MENUNGGU') {
    actions.push({ label: 'Set IN_WH', status: 'IN_WH', variant: 'default' })
  } else if (entry.status === 'IN_WH') {
    actions.push({ label: 'Mulai PROSES', status: 'PROSES', variant: 'default' })
  } else if (entry.status === 'PROSES') {
    actions.push({ label: 'Selesai', status: 'SELESAI', variant: 'default' })
  }

  if (entry.status === 'IN_WH') {
    actions.push({ label: 'Kembali', status: 'MENUNGGU', variant: 'outline' })
  }
  if (entry.status === 'PROSES') {
    actions.push({ label: 'Kembali', status: 'IN_WH', variant: 'outline' })
  }
  if (isAdmin.value && (entry.status === 'MENUNGGU' || entry.status === 'IN_WH')) {
    actions.push({ label: 'Batal', status: 'BATAL', variant: 'outline', danger: true })
  }
  return actions
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="loading" class="rounded-xl border bg-card px-4 py-6 text-center text-muted-foreground">
      Loading...
    </div>
    <div v-else-if="entries.length === 0" class="rounded-xl border bg-card px-4 py-6 text-center text-muted-foreground">
      Data kosong.
    </div>
    <article
      v-for="entry in entries"
      :key="entry.id"
      class="rounded-2xl border bg-card p-4 shadow-sm"
      :class="[
        isOverdue(entry)
          ? 'border-red-200 bg-red-50/60'
          : isNearOverdue(entry)
            ? 'border-amber-200 bg-amber-50/60'
            : 'border-border/70'
      ]"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold leading-tight">{{ entry.customer?.name || '-' }}</p>
          <p class="mt-0.5 text-xs text-muted-foreground">{{ entry.driverName }} - {{ entry.truckNumber }}</p>
        </div>
        <QueueStatusBadge :status="entry.status" />
      </div>

      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div class="rounded-xl bg-muted/40 px-3 py-2">
          <p class="text-muted-foreground">Kategori</p>
          <p class="font-medium">{{ formatCategory(entry.category) }}</p>
        </div>
        <div class="rounded-xl bg-muted/40 px-3 py-2">
          <p class="text-muted-foreground">Gate</p>
          <p class="font-medium">{{ entry.gate?.gateNo || '-' }}</p>
        </div>
        <div class="rounded-xl bg-muted/40 px-3 py-2">
          <p class="text-muted-foreground">Register</p>
          <p class="font-medium">{{ formatTime(entry.registerTime) }}</p>
        </div>
        <div class="rounded-xl bg-muted/40 px-3 py-2">
          <p class="text-muted-foreground">Time Left</p>
          <p class="font-medium">{{ timeRemainingLabel(entry) }}</p>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span v-if="entry.containerNumber" class="rounded-full bg-muted/40 px-2 py-1">Container: {{ entry.containerNumber }}</span>
        <span v-if="entry.transporter" class="rounded-full bg-muted/40 px-2 py-1">Transporter: {{ entry.transporter }}</span>
      </div>

      <div class="mt-4 grid gap-2">
        <Button
          v-for="action in getActionSet(entry)"
          :key="`${entry.id}-${action.status}`"
          :variant="action.variant"
          class="h-11 w-full rounded-xl text-sm"
          :class="action.danger ? 'border-red-200 bg-red-600 text-white hover:bg-red-700 hover:text-white' : ''"
          @click="emit('change-status', entry, action.status)"
        >
          {{ action.label }}
        </Button>
        <Button
          variant="outline"
          class="h-11 w-full rounded-xl text-sm"
          @click="emit('view-detail', entry)"
        >
          <Eye class="mr-2 h-4 w-4" />
          Detail
        </Button>
      </div>
    </article>
  </div>
</template>

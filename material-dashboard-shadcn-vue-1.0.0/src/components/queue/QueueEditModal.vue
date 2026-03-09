<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import Combobox from '@/components/ui/Combobox.vue'

type QueueEntry = {
  id: string
  customerId?: string | null
  category: 'RECEIVING' | 'DELIVERY'
  driverName: string
  truckNumber: string
  containerNumber?: string | null
  slaWaitingMinutes?: number | null
  slaInWhProcessMinutes?: number | null
  notes?: string | null
  registerTime?: string | null
}

type FormState = {
  customerId: string
  category: 'RECEIVING' | 'DELIVERY'
  driverName: string
  truckNumber: string
  containerNumber: string
  slaWaitingMinutes: number
  slaInWhProcessMinutes: number
  notes: string
  registerTime: string
}

type DraftFormState = Omit<FormState, 'slaWaitingMinutes' | 'slaInWhProcessMinutes'> & {
  slaWaitingMinutes: number | ''
  slaInWhProcessMinutes: number | ''
}

const props = defineProps<{
  open: boolean
  submitting: boolean
  customers: { id: string; name: string }[]
  entry: QueueEntry | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: FormState): void
}>()

const form = reactive<DraftFormState>({
  customerId: '',
  category: 'RECEIVING',
  driverName: '',
  truckNumber: '',
  containerNumber: '',
  slaWaitingMinutes: '',
  slaInWhProcessMinutes: '',
  notes: '',
  registerTime: '',
})

const errors = reactive({
  customerId: '',
  driverName: '',
  truckNumber: '',
  slaWaitingMinutes: '',
  slaInWhProcessMinutes: '',
})

const formatSlaLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours > 0 && remainingMinutes > 0) return `${hours} jam ${remainingMinutes} menit`
  if (hours > 0 && remainingMinutes === 0) return `${hours} jam`
  return `${minutes} menit`
}

const customerOptions = computed(() =>
  props.customers.map((customer) => ({
    value: customer.id,
    label: customer.name,
  }))
)

const slaOptions = computed(() =>
  Array.from({ length: 96 }, (_, index) => {
    const value = (index + 1) * 15
    return {
      value,
      label: formatSlaLabel(value),
    }
  })
)

const toDatetimeLocal = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (num: number) => String(num).padStart(2, '0')
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const mi = pad(date.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

const syncFormFromEntry = () => {
  form.customerId = props.entry?.customerId || ''
  form.category = props.entry?.category || 'RECEIVING'
  form.driverName = props.entry?.driverName || ''
  form.truckNumber = props.entry?.truckNumber || ''
  form.containerNumber = props.entry?.containerNumber || ''
  form.slaWaitingMinutes = props.entry?.slaWaitingMinutes ?? ''
  form.slaInWhProcessMinutes = props.entry?.slaInWhProcessMinutes ?? ''
  form.notes = props.entry?.notes || ''
  form.registerTime = toDatetimeLocal(props.entry?.registerTime)
  errors.customerId = ''
  errors.driverName = ''
  errors.truckNumber = ''
  errors.slaWaitingMinutes = ''
  errors.slaInWhProcessMinutes = ''
}

watch(
  () => [props.open, props.entry?.id],
  () => {
    if (!props.open) return
    syncFormFromEntry()
  },
  { immediate: true }
)

const validate = () => {
  errors.customerId = form.customerId ? '' : 'Customer wajib'
  errors.driverName = form.driverName.trim() ? '' : 'Driver Name wajib'
  errors.truckNumber = form.truckNumber.trim() ? '' : 'No Truck wajib'
  errors.slaWaitingMinutes =
    typeof form.slaWaitingMinutes === 'number' ? '' : 'SLA Menunggu wajib dipilih'
  errors.slaInWhProcessMinutes =
    typeof form.slaInWhProcessMinutes === 'number'
      ? ''
      : 'SLA IN_WH + Proses wajib dipilih'
  return (
    !errors.customerId &&
    !errors.driverName &&
    !errors.truckNumber &&
    !errors.slaWaitingMinutes &&
    !errors.slaInWhProcessMinutes
  )
}

const handleSubmit = () => {
  if (!validate()) return
  emit('submit', {
    ...form,
    slaWaitingMinutes: Number(form.slaWaitingMinutes),
    slaInWhProcessMinutes: Number(form.slaInWhProcessMinutes),
  })
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/40" @click="emit('close')"></div>
    <div class="absolute left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
      <div class="p-4 border-b flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold">Edit Transaksi</h3>
          <p class="text-sm text-muted-foreground">Ubah data antrian truk</p>
        </div>
        <Button variant="outline" size="sm" @click="emit('close')">Tutup</Button>
      </div>

      <div class="p-4 space-y-4 text-sm">
        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="text-muted-foreground">Kategori</label>
            <div class="mt-2 flex items-center gap-4">
              <label class="inline-flex items-center gap-2 text-sm">
                <input v-model="form.category" type="radio" value="RECEIVING" class="h-4 w-4" />
                Receiving
              </label>
              <label class="inline-flex items-center gap-2 text-sm">
                <input v-model="form.category" type="radio" value="DELIVERY" class="h-4 w-4" />
                Delivery
              </label>
            </div>
          </div>
          <div>
            <label class="text-muted-foreground">Register Time (opsional)</label>
            <input
              v-model="form.registerTime"
              type="datetime-local"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
            />
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="text-muted-foreground">Customer Name</label>
            <div class="mt-1">
              <Combobox
                v-model="form.customerId"
                :options="customerOptions"
                placeholder="Pilih customer..."
                search-placeholder="Cari customer..."
                empty-text="Tidak ada customer"
              />
            </div>
            <p v-if="errors.customerId" class="mt-1 text-xs text-red-600">{{ errors.customerId }}</p>
          </div>
          <div>
            <label class="text-muted-foreground">Driver Name</label>
            <input v-model="form.driverName" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
            <p v-if="errors.driverName" class="mt-1 text-xs text-red-600">{{ errors.driverName }}</p>
          </div>
          <div>
            <label class="text-muted-foreground">No Truck</label>
            <input v-model="form.truckNumber" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
            <p v-if="errors.truckNumber" class="mt-1 text-xs text-red-600">{{ errors.truckNumber }}</p>
          </div>
          <div>
            <label class="text-muted-foreground">No Container</label>
            <input v-model="form.containerNumber" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="text-muted-foreground">SLA Status Menunggu</label>
            <select
              v-model.number="form.slaWaitingMinutes"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
            >
              <option value="">Pilih SLA Menunggu...</option>
              <option v-for="option in slaOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <p v-if="errors.slaWaitingMinutes" class="mt-1 text-xs text-red-600">
              {{ errors.slaWaitingMinutes }}
            </p>
          </div>
          <div v-if="form.slaWaitingMinutes !== ''">
            <label class="text-muted-foreground">SLA Status IN_WH + Proses</label>
            <select
              v-model.number="form.slaInWhProcessMinutes"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
            >
              <option value="">Pilih SLA IN_WH + Proses...</option>
              <option v-for="option in slaOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <p v-if="errors.slaInWhProcessMinutes" class="mt-1 text-xs text-red-600">
              {{ errors.slaInWhProcessMinutes }}
            </p>
          </div>
        </div>

        <div>
          <label class="text-muted-foreground">Notes</label>
          <textarea v-model="form.notes" rows="3" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"></textarea>
        </div>
      </div>

      <div class="p-4 border-t flex items-center justify-end gap-2">
        <Button variant="ghost" @click="emit('close')">Batal</Button>
        <Button :disabled="submitting" @click="handleSubmit">
          {{ submitting ? 'Menyimpan...' : 'Simpan Perubahan' }}
        </Button>
      </div>
    </div>
  </div>
</template>

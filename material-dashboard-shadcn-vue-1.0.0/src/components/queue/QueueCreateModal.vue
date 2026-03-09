<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import Combobox from '@/components/ui/Combobox.vue'

type FormState = {
  customerId: string
  category: 'RECEIVING' | 'DELIVERY'
  driverName: string
  truckNumber: string
  containerNumber: string
  slaWaitingMinutes?: number
  slaInWhProcessMinutes?: number
  notes: string
  registerTime: string
}

type DraftFormState = Omit<FormState, 'slaWaitingMinutes' | 'slaInWhProcessMinutes'> & {
  slaWaitingMinutes: string
  slaInWhProcessMinutes: string
}

const props = defineProps<{
  open: boolean
  submitting: boolean
  customers: { id: string; name: string }[]
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
  registerTime: ''
})

const errors = reactive({
  customerId: '',
  driverName: '',
  truckNumber: '',
  slaWaitingMinutes: '',
  slaInWhProcessMinutes: ''
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
      value: String(value),
      label: formatSlaLabel(value),
    }
  })
)

const resetForm = () => {
  form.customerId = ''
  form.category = 'RECEIVING'
  form.driverName = ''
  form.truckNumber = ''
  form.containerNumber = ''
  form.slaWaitingMinutes = ''
  form.slaInWhProcessMinutes = ''
  form.notes = ''
  form.registerTime = ''
  errors.customerId = ''
  errors.driverName = ''
  errors.truckNumber = ''
  errors.slaWaitingMinutes = ''
  errors.slaInWhProcessMinutes = ''
}

const validate = () => {
  errors.customerId = form.customerId ? '' : 'Customer wajib'
  errors.driverName = form.driverName.trim() ? '' : 'Driver Name wajib'
  errors.truckNumber = form.truckNumber.trim() ? '' : 'No Truck wajib'
  errors.slaWaitingMinutes = ''
  errors.slaInWhProcessMinutes = ''
  if (form.slaWaitingMinutes && !form.slaInWhProcessMinutes) {
    errors.slaInWhProcessMinutes = 'SLA IN_WH + Proses wajib dipilih jika SLA Menunggu diisi'
  }
  return (
    !errors.customerId &&
    !errors.driverName &&
    !errors.truckNumber &&
    !errors.slaInWhProcessMinutes
  )
}

const handleSubmit = () => {
  if (!validate()) return
  const payload: FormState = {
    customerId: form.customerId,
    category: form.category,
    driverName: form.driverName,
    truckNumber: form.truckNumber,
    containerNumber: form.containerNumber,
    notes: form.notes,
    registerTime: form.registerTime,
  }
  if (form.slaWaitingMinutes) {
    payload.slaWaitingMinutes = Number(form.slaWaitingMinutes)
    payload.slaInWhProcessMinutes = Number(form.slaInWhProcessMinutes)
  }
  emit('submit', payload)
}

watch(
  () => form.slaWaitingMinutes,
  (value) => {
    errors.slaWaitingMinutes = ''
    if (!value) {
      form.slaInWhProcessMinutes = ''
      errors.slaInWhProcessMinutes = ''
    }
  }
)

watch(
  () => props.open,
  (val) => {
    if (!val) resetForm()
  }
)
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/40" @click="emit('close')"></div>
    <div class="absolute left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
      <div class="p-4 border-b flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold">Tambah Transaksi</h3>
          <p class="text-sm text-muted-foreground">Input data antrian truk</p>
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
            <input v-model="form.registerTime" type="datetime-local" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
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
            <div class="mt-1">
              <Combobox
                v-model="form.slaWaitingMinutes"
                :options="slaOptions"
                placeholder="Pilih SLA Menunggu..."
                search-placeholder="Cari SLA Menunggu..."
                empty-text="Tidak ada pilihan SLA"
              />
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              Default: Menunggu 30 menit, IN_WH + Proses Receiving 120 menit / Delivery 90 menit.
            </p>
          </div>
          <div v-if="form.slaWaitingMinutes !== ''">
            <label class="text-muted-foreground">SLA Status IN_WH + Proses</label>
            <div class="mt-1">
              <Combobox
                v-model="form.slaInWhProcessMinutes"
                :options="slaOptions"
                placeholder="Pilih SLA IN_WH + Proses..."
                search-placeholder="Cari SLA IN_WH + Proses..."
                empty-text="Tidak ada pilihan SLA"
              />
            </div>
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
          {{ submitting ? 'Menyimpan...' : 'Simpan' }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import Combobox from '@/components/ui/Combobox.vue'

type FormState = {
  date: string
  customerId: string
  doNumber: string
  destination: string
  volumeCbm: number
  plTimeRelease: string
  pickingQty: number
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

const todayString = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

const currentDateTimeLocal = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}`
}

const extractTimeFromDateTimeLocal = (value: string) => {
  const match = value.match(/T(\d{2}:\d{2})/)
  return match?.[1] || ''
}

const syncPlTimeReleaseDateWithTransactionDate = () => {
  if (!form.date) return
  const fallbackTime = extractTimeFromDateTimeLocal(currentDateTimeLocal())
  const selectedTime = extractTimeFromDateTimeLocal(form.plTimeRelease)
  const time = selectedTime || fallbackTime
  form.plTimeRelease = `${form.date}T${time}`
}

const form = reactive<FormState>({
  date: todayString(),
  customerId: '',
  doNumber: '',
  destination: '',
  volumeCbm: 0,
  plTimeRelease: currentDateTimeLocal(),
  pickingQty: 1,
})

const errors = reactive({
  date: '',
  customerId: '',
  doNumber: '',
  destination: '',
  volumeCbm: '',
  plTimeRelease: '',
  pickingQty: '',
})

const customerOptions = computed(() =>
  props.customers.map((customer) => ({
    value: customer.id,
    label: customer.name,
  }))
)

const resetForm = () => {
  form.date = todayString()
  form.customerId = ''
  form.doNumber = ''
  form.destination = ''
  form.volumeCbm = 0
  form.plTimeRelease = currentDateTimeLocal()
  form.pickingQty = 1
  errors.date = ''
  errors.customerId = ''
  errors.doNumber = ''
  errors.destination = ''
  errors.volumeCbm = ''
  errors.plTimeRelease = ''
  errors.pickingQty = ''
}

const validate = () => {
  errors.date = form.date ? '' : 'Tanggal wajib'
  errors.customerId = form.customerId ? '' : 'Customer wajib'
  errors.doNumber = form.doNumber.trim() ? '' : 'DO Number wajib'
  errors.destination = form.destination.trim() ? '' : 'Destination wajib'
  errors.volumeCbm = Number.isFinite(Number(form.volumeCbm)) && Number(form.volumeCbm) >= 0 ? '' : 'Volume (CBM) harus angka'
  errors.plTimeRelease = ''
  errors.pickingQty = Number.isInteger(form.pickingQty) && form.pickingQty > 0 ? '' : 'Picking Qty minimal 1'
  return (
    !errors.date &&
    !errors.customerId &&
    !errors.doNumber &&
    !errors.destination &&
    !errors.volumeCbm &&
    !errors.pickingQty
  )
}

const handleSubmit = () => {
  syncPlTimeReleaseDateWithTransactionDate()
  if (!validate()) return
  emit('submit', {
    date: form.date,
    customerId: form.customerId,
    doNumber: form.doNumber.trim(),
    destination: form.destination.trim(),
    volumeCbm: Number(form.volumeCbm),
    plTimeRelease: form.plTimeRelease,
    pickingQty: Number(form.pickingQty),
  })
}

watch(
  () => props.open,
  (value) => {
    if (!value) {
      resetForm()
      return
    }
    if (!form.plTimeRelease) {
      form.plTimeRelease = currentDateTimeLocal()
    }
    syncPlTimeReleaseDateWithTransactionDate()
  }
)

watch(
  () => form.date,
  () => {
    syncPlTimeReleaseDateWithTransactionDate()
  }
)
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/40" @click="emit('close')"></div>
    <div class="absolute left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
      <div class="p-4 border-b flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold">Tambah Picking Progress</h3>
          <p class="text-sm text-muted-foreground">Input transaksi picking baru</p>
        </div>
        <Button variant="outline" size="sm" @click="emit('close')">Tutup</Button>
      </div>

      <div class="p-4 space-y-4 text-sm">
        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="text-muted-foreground">Tanggal</label>
            <input v-model="form.date" type="date" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
            <p v-if="errors.date" class="mt-1 text-xs text-red-600">{{ errors.date }}</p>
          </div>
          <div>
            <label class="text-muted-foreground">Picking Qty (Barcode)</label>
            <input
              v-model.number="form.pickingQty"
              type="number"
              min="1"
              step="1"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
            />
            <p v-if="errors.pickingQty" class="mt-1 text-xs text-red-600">{{ errors.pickingQty }}</p>
          </div>
        </div>

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

        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="text-muted-foreground">DO Number</label>
            <input v-model="form.doNumber" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
            <p v-if="errors.doNumber" class="mt-1 text-xs text-red-600">{{ errors.doNumber }}</p>
          </div>
          <div>
            <label class="text-muted-foreground">Destination</label>
            <input v-model="form.destination" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
            <p v-if="errors.destination" class="mt-1 text-xs text-red-600">{{ errors.destination }}</p>
          </div>
          <div>
            <label class="text-muted-foreground">Volume (CBM)</label>
            <input v-model.number="form.volumeCbm" type="number" min="0" step="0.01" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
            <p v-if="errors.volumeCbm" class="mt-1 text-xs text-red-600">{{ errors.volumeCbm }}</p>
          </div>
          <div>
            <label class="text-muted-foreground">PL Time Release</label>
            <input v-model="form.plTimeRelease" type="datetime-local" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
            <p v-if="errors.plTimeRelease" class="mt-1 text-xs text-red-600">{{ errors.plTimeRelease }}</p>
          </div>
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

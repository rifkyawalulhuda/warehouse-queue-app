<script setup lang="ts">
import { reactive, watch } from 'vue'
import Button from '@/components/ui/Button.vue'

type FormState = {
  category: 'RECEIVING' | 'DELIVERY'
  customerName: string
  driverName: string
  truckNumber: string
  containerNumber: string
  notes: string
  registerTime: string
}

const props = defineProps<{
  open: boolean
  submitting: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: FormState): void
}>()

const form = reactive<FormState>({
  category: 'RECEIVING',
  customerName: '',
  driverName: '',
  truckNumber: '',
  containerNumber: '',
  notes: '',
  registerTime: ''
})

const errors = reactive({
  customerName: '',
  driverName: '',
  truckNumber: ''
})

const resetForm = () => {
  form.category = 'RECEIVING'
  form.customerName = ''
  form.driverName = ''
  form.truckNumber = ''
  form.containerNumber = ''
  form.notes = ''
  form.registerTime = ''
  errors.customerName = ''
  errors.driverName = ''
  errors.truckNumber = ''
}

const validate = () => {
  errors.customerName = form.customerName.trim() ? '' : 'Customer Name wajib'
  errors.driverName = form.driverName.trim() ? '' : 'Driver Name wajib'
  errors.truckNumber = form.truckNumber.trim() ? '' : 'No Truck wajib'
  return !errors.customerName && !errors.driverName && !errors.truckNumber
}

const handleSubmit = () => {
  if (!validate()) return
  emit('submit', { ...form })
}

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
            <select v-model="form.category" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm">
              <option value="RECEIVING">Receiving</option>
              <option value="DELIVERY">Delivery</option>
            </select>
          </div>
          <div>
            <label class="text-muted-foreground">Register Time (opsional)</label>
            <input v-model="form.registerTime" type="datetime-local" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="text-muted-foreground">Customer Name</label>
            <input v-model="form.customerName" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
            <p v-if="errors.customerName" class="mt-1 text-xs text-red-600">{{ errors.customerName }}</p>
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

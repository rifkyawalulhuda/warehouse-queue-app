<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'

type FormState = {
  customerId: string
  category: 'RECEIVING' | 'DELIVERY'
  driverName: string
  truckNumber: string
  containerNumber: string
  notes: string
  registerTime: string
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

const form = reactive<FormState>({
  customerId: '',
  category: 'RECEIVING',
  driverName: '',
  truckNumber: '',
  containerNumber: '',
  notes: '',
  registerTime: ''
})

const customerQuery = ref('')
const customerOpen = ref(false)

const errors = reactive({
  customerId: '',
  driverName: '',
  truckNumber: ''
})

const resetForm = () => {
  form.customerId = ''
  form.category = 'RECEIVING'
  form.driverName = ''
  form.truckNumber = ''
  form.containerNumber = ''
  form.notes = ''
  form.registerTime = ''
  customerQuery.value = ''
  customerOpen.value = false
  errors.customerId = ''
  errors.driverName = ''
  errors.truckNumber = ''
}

const filteredCustomers = computed(() => {
  const q = customerQuery.value.trim().toLowerCase()
  if (!q) return props.customers
  return props.customers.filter((c) => c.name.toLowerCase().includes(q))
})

const selectCustomer = (id: string) => {
  form.customerId = id
  const selected = props.customers.find((c) => c.id === id)
  customerQuery.value = selected ? selected.name : ''
  customerOpen.value = false
}

const handleCustomerBlur = () => {
  window.setTimeout(() => {
    customerOpen.value = false
  }, 120)
}

const validate = () => {
  errors.customerId = form.customerId ? '' : 'Customer wajib'
  errors.driverName = form.driverName.trim() ? '' : 'Driver Name wajib'
  errors.truckNumber = form.truckNumber.trim() ? '' : 'No Truck wajib'
  return !errors.customerId && !errors.driverName && !errors.truckNumber
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
            <div class="relative mt-1">
              <input
                v-model="customerQuery"
                type="text"
                placeholder="Cari customer..."
                class="w-full bg-transparent border rounded-md px-2 py-2 text-sm"
                @focus="customerOpen = true"
                @blur="handleCustomerBlur"
                @input="customerOpen = true"
              />
              <div
                v-if="customerOpen"
                class="absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded-md border bg-card shadow-lg"
              >
                <button
                  v-for="cust in filteredCustomers"
                  :key="cust.id"
                  type="button"
                  class="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  @click="selectCustomer(cust.id)"
                >
                  {{ cust.name }}
                </button>
                <div v-if="filteredCustomers.length === 0" class="px-3 py-2 text-sm text-muted-foreground">
                  Tidak ada customer
                </div>
              </div>
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

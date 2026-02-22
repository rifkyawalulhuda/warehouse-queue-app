<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import type { PickingProgressEntry } from '@/services/pickingProgressApi'

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
  entry: PickingProgressEntry | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: FormState): void
}>()

const toDateInput = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const toDatetimeLocalInput = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}`
}

const form = reactive<FormState>({
  date: '',
  customerId: '',
  doNumber: '',
  destination: '',
  volumeCbm: 0,
  plTimeRelease: '',
  pickingQty: 1,
})

const customerQuery = ref('')
const customerOpen = ref(false)

const errors = reactive({
  date: '',
  customerId: '',
  doNumber: '',
  destination: '',
  volumeCbm: '',
  plTimeRelease: '',
  pickingQty: '',
})

const syncFormFromEntry = () => {
  const entry = props.entry
  if (!entry) return
  form.date = toDateInput(entry.date)
  form.customerId = entry.customerId || ''
  form.doNumber = entry.doNumber || entry.noContainer || ''
  form.destination = entry.destination || entry.noDock || ''
  form.volumeCbm = Number(entry.volumeCbm ?? 0)
  form.plTimeRelease = toDatetimeLocalInput(entry.plTimeRelease)
  form.pickingQty = Number(entry.pickingQty || 1)

  const selected = props.customers.find((customer) => customer.id === form.customerId)
  customerQuery.value = selected ? selected.name : ''
  customerOpen.value = false
  errors.date = ''
  errors.customerId = ''
  errors.doNumber = ''
  errors.destination = ''
  errors.volumeCbm = ''
  errors.plTimeRelease = ''
  errors.pickingQty = ''
}

const filteredCustomers = computed(() => {
  const q = customerQuery.value.trim().toLowerCase()
  if (!q) return props.customers
  return props.customers.filter((customer) => customer.name.toLowerCase().includes(q))
})

const selectCustomer = (id: string) => {
  form.customerId = id
  const selected = props.customers.find((customer) => customer.id === id)
  customerQuery.value = selected ? selected.name : ''
  customerOpen.value = false
}

const handleCustomerBlur = () => {
  window.setTimeout(() => {
    customerOpen.value = false
  }, 120)
}

const validate = () => {
  errors.date = form.date ? '' : 'Tanggal wajib'
  errors.customerId = form.customerId ? '' : 'Customer wajib'
  errors.doNumber = form.doNumber.trim() ? '' : 'DO Number wajib'
  errors.destination = form.destination.trim() ? '' : 'Destination wajib'
  errors.volumeCbm = Number.isFinite(Number(form.volumeCbm)) && Number(form.volumeCbm) >= 0 ? '' : 'Volume (CBM) harus angka'
  errors.plTimeRelease = form.plTimeRelease ? '' : 'PL Time Release wajib'
  errors.pickingQty = Number.isInteger(form.pickingQty) && form.pickingQty > 0 ? '' : 'Picking Qty minimal 1'
  return (
    !errors.date &&
    !errors.customerId &&
    !errors.doNumber &&
    !errors.destination &&
    !errors.volumeCbm &&
    !errors.plTimeRelease &&
    !errors.pickingQty
  )
}

const handleSubmit = () => {
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
  () => [props.open, props.entry?.id, props.customers.length],
  ([isOpen]) => {
    if (!isOpen) return
    syncFormFromEntry()
  }
)
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/40" @click="emit('close')"></div>
    <div class="absolute left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
      <div class="p-4 border-b flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold">Edit Picking Progress</h3>
          <p class="text-sm text-muted-foreground">Ubah transaksi picking</p>
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
                v-for="customer in filteredCustomers"
                :key="customer.id"
                type="button"
                class="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                @click="selectCustomer(customer.id)"
              >
                {{ customer.name }}
              </button>
              <div v-if="filteredCustomers.length === 0" class="px-3 py-2 text-sm text-muted-foreground">
                Tidak ada customer
              </div>
            </div>
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
          {{ submitting ? 'Menyimpan...' : 'Update' }}
        </Button>
      </div>
    </div>
  </div>
</template>

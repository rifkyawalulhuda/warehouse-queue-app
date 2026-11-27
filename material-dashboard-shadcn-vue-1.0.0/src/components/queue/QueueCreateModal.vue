<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import Combobox from '@/components/ui/Combobox.vue'
import { isValidOptionalPhone, sanitizePhoneInput, MIN_PHONE_DIGITS, MAX_PHONE_DIGITS } from '@/lib/phone'
import {
  getAvailableScheduleItems,
  getTransporters,
  type ScheduleAvailableItem,
  type Transporter,
} from '@/services/scheduleApi'

export type QueueCreatePayload = {
  scheduleItemId?: string
  customerId: string
  category: 'RECEIVING' | 'DELIVERY'
  driverName: string
  driverPhone?: string
  truckNumber: string
  truckType?: string
  containerNumbers: string[]
  transporter: string
  transporterId?: string
  slaWaitingMinutes?: number
  slaInWhProcessMinutes?: number
  notes: string
  registerTime: string
}

type FormState = {
  scheduleItemId: string
  customerId: string
  category: 'RECEIVING' | 'DELIVERY'
  driverName: string
  driverPhone: string
  truckNumber: string
  truckType: string
  containerNumbers: string[]
  transporterId: string
  transporter: string
  slaWaitingMinutes: string
  slaInWhProcessMinutes: string
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
  (e: 'submit', payload: QueueCreatePayload): void
}>()

const form = reactive<FormState>({
  scheduleItemId: '',
  customerId: '',
  category: 'RECEIVING',
  driverName: '',
  driverPhone: '',
  truckNumber: '',
  truckType: '',
  containerNumbers: [''],
  transporterId: '',
  transporter: '',
  slaWaitingMinutes: '',
  slaInWhProcessMinutes: '',
  notes: '',
  registerTime: '',
})

const errors = reactive({
  customerId: '',
  driverName: '',
  driverPhone: '',
  truckNumber: '',
  slaWaitingMinutes: '',
  slaInWhProcessMinutes: '',
})

const scheduleItems = ref<ScheduleAvailableItem[]>([])
const scheduleLoading = ref(false)
const scheduleError = ref('')
const transporters = ref<Transporter[]>([])
const transporterLoading = ref(false)

const isLinked = computed(() => Boolean(form.scheduleItemId))
const selectedItem = computed(
  () => scheduleItems.value.find((item) => item.id === form.scheduleItemId) || null
)
// Plat hanya terkunci kalau plan benar-benar punya plat. Item jadwal lama bisa
// belum punya plat, dan mengunci field kosong akan membuat form buntu.
const isPlateLocked = computed(() => isLinked.value && Boolean(selectedItem.value?.plateNumber))

const formatSlaLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours > 0 && remainingMinutes > 0) return `${hours} jam ${remainingMinutes} menit`
  if (hours > 0 && remainingMinutes === 0) return `${hours} jam`
  return `${minutes} menit`
}

const formatDateTime = (value: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${date.getFullYear()} ${hours}:${minutes}`
}

const customerOptions = computed(() =>
  props.customers.map((customer) => ({ value: customer.id, label: customer.name }))
)

const transporterOptions = computed(() => {
  const options = transporters.value.map((item) => ({ value: item.id, label: item.name }))
  // Jaga pilihan tetap terlihat walau hasil pencarian sudah berganti,
  // supaya Combobox tidak kembali menampilkan placeholder setelah dipilih.
  if (form.transporterId && !options.some((option) => option.value === form.transporterId)) {
    options.unshift({ value: form.transporterId, label: form.transporter || 'Transporter terpilih' })
  }
  return options
})

const scheduleOptions = computed(() =>
  scheduleItems.value.map((item) => {
    const time = item.plannedStart ? formatDateTime(item.plannedStart).split(' ')[1] : '--:--'
    const categoryLabel = item.category === 'RECEIVING' ? 'Receiving' : 'Delivery'
    return {
      value: item.id,
      label: `${item.plateNumber || '(tanpa plat)'} · ${item.customerName || '-'} · ${time} · ${categoryLabel}`,
    }
  })
)

const slaOptions = computed(() =>
  Array.from({ length: 96 }, (_, index) => {
    const value = (index + 1) * 15
    return { value: String(value), label: formatSlaLabel(value) }
  })
)

const resetForm = () => {
  form.scheduleItemId = ''
  form.customerId = ''
  form.category = 'RECEIVING'
  form.driverName = ''
  form.driverPhone = ''
  form.truckNumber = ''
  form.truckType = ''
  form.containerNumbers = ['']
  form.transporterId = ''
  form.transporter = ''
  form.slaWaitingMinutes = ''
  form.slaInWhProcessMinutes = ''
  form.notes = ''
  form.registerTime = ''
  scheduleError.value = ''
  Object.keys(errors).forEach((key) => {
    ;(errors as Record<string, string>)[key] = ''
  })
}

const loadScheduleItems = async () => {
  scheduleLoading.value = true
  scheduleError.value = ''
  try {
    const { data } = await getAvailableScheduleItems({ limit: 200 })
    scheduleItems.value = data.data || []
  } catch (err: any) {
    scheduleError.value = err?.response?.data?.message || 'Gagal memuat jadwal'
  } finally {
    scheduleLoading.value = false
  }
}

const loadTransporters = async (search = '') => {
  transporterLoading.value = true
  try {
    const { data } = await getTransporters({ activeOnly: true, limit: 500, search } as any)
    transporters.value = data.data || []
  } catch {
    transporters.value = []
  } finally {
    transporterLoading.value = false
  }
}

// Cari transporter di server supaya daftar besar (hasil import bulk) tetap
// terjangkau; debounce agar tidak membanjiri API saat mengetik.
let transporterSearchTimer: ReturnType<typeof setTimeout> | undefined
const handleTransporterSearch = (keyword: string) => {
  if (transporterSearchTimer) clearTimeout(transporterSearchTimer)
  transporterSearchTimer = setTimeout(() => {
    loadTransporters(keyword.trim())
  }, 300)
}

const applyScheduleItem = (item: ScheduleAvailableItem | null) => {
  if (!item) {
    // Override / input manual: semua field kembali bebas.
    form.scheduleItemId = ''
    form.truckNumber = ''
    form.truckType = ''
    form.containerNumbers = ['']
    form.transporterId = ''
    form.transporter = ''
    return
  }

  form.scheduleItemId = item.id
  form.category = item.category
  // Customer mengikuti jadwal (dikunci), jadi selalu ditimpa dari plan.
  form.customerId = item.customerId || ''
  if (item.driverName) form.driverName = item.driverName
  form.truckNumber = item.plateNumber || ''
  form.truckType = item.truckType || ''
  form.containerNumbers = item.containerNumbers.length > 0 ? [...item.containerNumbers] : ['']
  form.transporterId = item.transporterId || ''
  form.transporter = item.transporterName || ''
}

const handleScheduleSelect = (value: string) => {
  const item = scheduleItems.value.find((row) => row.id === value) || null
  applyScheduleItem(item)
}

const handleCategoryChange = () => {
  // Kategori mengikuti jadwal yang dipilih; kalau tidak terhubung, user bebas.
  if (isLinked.value && selectedItem.value && selectedItem.value.category !== form.category) {
    form.category = selectedItem.value.category
  }
}

const handleTransporterSelect = (value: string) => {
  form.transporterId = value
  const found = transporters.value.find((item) => item.id === value)
  form.transporter = found?.name || ''
}

const addContainerField = () => {
  form.containerNumbers.push('')
}

const removeContainerField = (index: number) => {
  form.containerNumbers.splice(index, 1)
  if (form.containerNumbers.length === 0) form.containerNumbers.push('')
}

const validate = () => {
  errors.customerId = form.customerId ? '' : 'Customer wajib'
  // Driver boleh kosong kalau jadwal sudah menyediakan driver.
  errors.driverName =
    form.driverName.trim() || (isLinked.value && selectedItem.value?.driverName)
      ? ''
      : 'Driver Name wajib'
  errors.driverPhone = isValidOptionalPhone(form.driverPhone)
    ? ''
    : `Driver Phone hanya angka, +, -, spasi; jumlah digit ${MIN_PHONE_DIGITS}-${MAX_PHONE_DIGITS}`
  errors.truckNumber = form.truckNumber.trim() ? '' : 'No Truck wajib'
  errors.slaWaitingMinutes = ''
  errors.slaInWhProcessMinutes = ''
  if (form.slaWaitingMinutes && !form.slaInWhProcessMinutes) {
    errors.slaInWhProcessMinutes = 'SLA IN_WH + Proses wajib dipilih jika SLA Menunggu diisi'
  }
  return (
    !errors.customerId &&
    !errors.driverName &&
    !errors.driverPhone &&
    !errors.truckNumber &&
    !errors.slaInWhProcessMinutes
  )
}

const handleDriverPhoneInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const sanitized = sanitizePhoneInput(target.value)
  form.driverPhone = sanitized
  target.value = sanitized
}

const handleSubmit = () => {
  if (!validate()) return
  const payload: QueueCreatePayload = {
    customerId: form.customerId,
    category: form.category,
    driverName: form.driverName.trim(),
    driverPhone: form.driverPhone.trim(),
    truckNumber: form.truckNumber.trim(),
    containerNumbers: form.containerNumbers.map((value) => value.trim()).filter(Boolean),
    transporter: form.transporter.trim(),
    notes: form.notes,
    registerTime: form.registerTime,
  }
  if (form.scheduleItemId) payload.scheduleItemId = form.scheduleItemId
  if (form.truckType) payload.truckType = form.truckType
  if (form.transporterId) payload.transporterId = form.transporterId
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
  () => form.category,
  () => handleCategoryChange()
)

watch(
  () => props.open,
  async (val) => {
    if (val) {
      await Promise.all([loadScheduleItems(), loadTransporters()])
    } else {
      resetForm()
      scheduleItems.value = []
    }
  }
)
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/40" @click="emit('close')"></div>
    <div
      class="absolute left-1/2 top-1/2 max-h-[92vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-card shadow-xl"
    >
      <div class="flex items-center justify-between border-b p-4">
        <div>
          <h3 class="text-lg font-semibold">Tambah Transaksi</h3>
          <p class="text-sm text-muted-foreground">
            Pilih truk dari Schedule Pengiriman, atau input manual.
          </p>
        </div>
        <Button variant="outline" size="sm" @click="emit('close')">Tutup</Button>
      </div>

      <div class="space-y-4 p-4 text-sm">
        <!-- Pilih jadwal -->
        <div class="rounded-lg border bg-muted/30 p-3">
          <div class="flex items-center justify-between gap-2">
            <label class="font-medium">Ambil dari Schedule Pengiriman</label>
            <span v-if="scheduleLoading" class="text-xs text-muted-foreground">Memuat...</span>
          </div>
          <div class="mt-2">
            <Combobox
              :model-value="form.scheduleItemId"
              :options="scheduleOptions"
              placeholder="Cari No Truck / customer di jadwal..."
              search-placeholder="Ketik plat, customer, atau transporter..."
              empty-text="Tidak ada jadwal truk yang tersedia"
              @update:model-value="handleScheduleSelect"
            />
          </div>
          <p v-if="scheduleError" class="mt-1 text-xs text-red-600">{{ scheduleError }}</p>

          <div v-if="selectedItem" class="mt-3 rounded-md border bg-background p-3 text-xs">
            <div class="grid gap-2 sm:grid-cols-2">
              <div>
                <span class="text-muted-foreground">Estimasi Start</span>
                <div class="font-medium">{{ formatDateTime(selectedItem.plannedStart) }}</div>
              </div>
              <div>
                <span class="text-muted-foreground">Estimasi Finish</span>
                <div class="font-medium">{{ formatDateTime(selectedItem.plannedFinish) }}</div>
              </div>
              <div>
                <span class="text-muted-foreground">Customer Plan</span>
                <div class="font-medium">{{ selectedItem.customerName || '-' }}</div>
              </div>
              <div>
                <span class="text-muted-foreground">Transporter Plan</span>
                <div class="font-medium">{{ selectedItem.transporterName || '-' }}</div>
              </div>
            </div>
            <p class="mt-2 text-muted-foreground">
              Data di bawah sudah terisi dari jadwal. Customer dan Plat Nomor mengikuti jadwal;
              field lain boleh dioverride.
            </p>
            <Button variant="ghost" size="sm" class="mt-2" @click="applyScheduleItem(null)">
              Lepas jadwal &amp; input manual
            </Button>
          </div>
          <p v-else class="mt-2 text-xs text-muted-foreground">
            Tanpa jadwal, transaksi tercatat sebagai walk-in dan tidak masuk perbandingan plan vs
            aktual.
          </p>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="text-muted-foreground">Kategori</label>
            <div class="mt-2 flex items-center gap-4">
              <label class="inline-flex items-center gap-2 text-sm">
                <input
                  v-model="form.category"
                  type="radio"
                  value="RECEIVING"
                  class="h-4 w-4"
                  :disabled="isLinked"
                />
                Receiving
              </label>
              <label class="inline-flex items-center gap-2 text-sm">
                <input
                  v-model="form.category"
                  type="radio"
                  value="DELIVERY"
                  class="h-4 w-4"
                  :disabled="isLinked"
                />
                Delivery
              </label>
            </div>
            <p v-if="isLinked" class="mt-1 text-xs text-muted-foreground">
              Mengikuti jadwal yang dipilih.
            </p>
          </div>
          <div>
            <label class="text-muted-foreground">Register Time (opsional)</label>
            <input
              v-model="form.registerTime"
              type="datetime-local"
              class="mt-1 w-full rounded-md border bg-transparent px-2 py-2 text-sm"
            />
            <p class="mt-1 text-xs text-muted-foreground">
              Jam truk tiba. Maksimal 7 hari ke belakang.
            </p>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="text-muted-foreground">Customer Name</label>
            <div class="mt-1">
              <Combobox
                v-model="form.customerId"
                :options="customerOptions"
                :disabled="isLinked"
                placeholder="Pilih customer..."
                search-placeholder="Cari customer..."
                empty-text="Tidak ada customer"
              />
            </div>
            <p v-if="errors.customerId" class="mt-1 text-xs text-red-600">
              {{ errors.customerId }}
            </p>
            <p v-else-if="isLinked" class="mt-1 text-xs text-muted-foreground">
              Mengikuti jadwal yang dipilih.
            </p>
          </div>
          <div>
            <label class="text-muted-foreground">Driver Name</label>
            <input
              v-model="form.driverName"
              type="text"
              class="mt-1 w-full rounded-md border bg-transparent px-2 py-2 text-sm"
            />
            <p v-if="errors.driverName" class="mt-1 text-xs text-red-600">
              {{ errors.driverName }}
            </p>
          </div>
          <div>
            <label class="text-muted-foreground">Driver Phone (opsional)</label>
            <input
              :value="form.driverPhone"
              type="tel"
              inputmode="tel"
              placeholder="08xxxxxxxxxx"
              class="mt-1 w-full rounded-md border bg-transparent px-2 py-2 text-sm"
              @input="handleDriverPhoneInput"
            />
            <p v-if="errors.driverPhone" class="mt-1 text-xs text-red-600">
              {{ errors.driverPhone }}
            </p>
          </div>
          <div>
            <label class="text-muted-foreground">No Truck (Plat Nomor)</label>
            <input
              v-model="form.truckNumber"
              type="text"
              :readonly="isPlateLocked"
              :class="[
                'mt-1 w-full rounded-md border bg-transparent px-2 py-2 text-sm',
                isPlateLocked ? 'cursor-not-allowed bg-muted/50 text-muted-foreground' : '',
              ]"
            />
            <p v-if="errors.truckNumber" class="mt-1 text-xs text-red-600">
              {{ errors.truckNumber }}
            </p>
            <p v-else-if="isPlateLocked" class="mt-1 text-xs text-muted-foreground">
              Terkunci mengikuti jadwal.
            </p>
          </div>
        </div>

        <!-- Container -->
        <div>
          <div class="flex items-center justify-between">
            <label class="text-muted-foreground">No Container (opsional)</label>
            <Button variant="ghost" size="sm" @click="addContainerField">Tambah</Button>
          </div>
          <div class="mt-1 space-y-2">
            <div
              v-for="(_, index) in form.containerNumbers"
              :key="index"
              class="flex items-center gap-2"
            >
              <input
                v-model="form.containerNumbers[index]"
                type="text"
                placeholder="Contoh: TCLU1234567"
                class="w-full rounded-md border bg-transparent px-2 py-2 text-sm uppercase"
              />
              <Button
                v-if="form.containerNumbers.length > 1"
                variant="ghost"
                size="sm"
                @click="removeContainerField(index)"
              >
                Hapus
              </Button>
            </div>
          </div>
        </div>

        <!-- Transporter -->
        <div>
          <label class="text-muted-foreground">Transporter</label>
          <div class="mt-1">
            <Combobox
              :model-value="form.transporterId"
              :options="transporterOptions"
              :placeholder="transporterLoading ? 'Memuat transporter...' : 'Pilih transporter...'"
              search-placeholder="Cari transporter..."
              empty-text="Transporter belum terdaftar"
              @update:model-value="handleTransporterSelect"
              @search="handleTransporterSearch"
            />
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
          <textarea
            v-model="form.notes"
            rows="3"
            class="mt-1 w-full rounded-md border bg-transparent px-2 py-2 text-sm"
          ></textarea>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 border-t p-4">
        <Button variant="ghost" @click="emit('close')">Batal</Button>
        <Button :disabled="submitting" @click="handleSubmit">
          {{ submitting ? 'Menyimpan...' : 'Simpan' }}
        </Button>
      </div>
    </div>
  </div>
</template>

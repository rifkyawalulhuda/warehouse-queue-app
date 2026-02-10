<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import { CalendarDays, RefreshCw, Search } from 'lucide-vue-next'
import api from '@/services/api'

type StoreType = 'STORE_IN' | 'STORE_OUT'
type TruckType = 'CDD' | 'CDE' | 'FUSO' | 'WB' | 'FT20' | 'FT40' | 'OTHER'

type Customer = {
  id: string
  name: string
}

type ScheduleListItem = {
  id: string
  scheduleDate: string
  storeType: StoreType
  customer: Customer | null
  totalTypes: number
  totalQty: number
  createdAt: string
  updatedAt: string
}

type ScheduleItem = {
  id: string
  scheduleId: string
  truckType: TruckType
  truckTypeOther?: string | null
  qty: number
  createdAt: string
}

type ScheduleDetail = {
  id: string
  scheduleDate: string
  storeType: StoreType
  customerId: string
  customer: Customer | null
  items: ScheduleItem[]
  createdAt: string
  updatedAt: string
}

type FormItem = {
  key: number
  truckType: TruckType | ''
  truckTypeOther: string
  qty: number | ''
}

const storeTypeOptions: Array<{ label: string; value: '' | StoreType }> = [
  { label: 'Semua', value: '' },
  { label: 'Store In', value: 'STORE_IN' },
  { label: 'Store Out', value: 'STORE_OUT' }
]

const truckTypeOptions: Array<{ label: string; value: TruckType }> = [
  { label: 'CDD', value: 'CDD' },
  { label: 'CDE', value: 'CDE' },
  { label: 'FUSO', value: 'FUSO' },
  { label: 'W/B', value: 'WB' },
  { label: '20 ft', value: 'FT20' },
  { label: '40 ft', value: 'FT40' },
  { label: 'Other', value: 'OTHER' }
]

const schedules = ref<ScheduleListItem[]>([])
const customers = ref<Customer[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const page = ref(1)
const limit = ref(15)
const totalPages = ref(1)
const totalItems = ref(0)
const sortBy = ref<'scheduleDate' | 'createdAt'>('createdAt')
const sortDir = ref<'asc' | 'desc'>('desc')
const submitting = ref(false)
const deleting = ref(false)
const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<string | null>(null)
const formError = ref<string | null>(null)
const detailOpen = ref(false)
const detailLoading = ref(false)
const detailData = ref<ScheduleDetail | null>(null)
const confirmOpen = ref(false)
const confirmData = ref<ScheduleListItem | null>(null)
const exportOpen = ref(false)
const exporting = ref(false)
const exportError = ref<string | null>(null)
const filterDateInputRef = ref<HTMLInputElement | null>(null)
const customerDropdownOpen = ref(false)
const customerSearch = ref('')
const route = useRoute()
const { user } = useAuth()
const canManageSchedule = computed(() => user.value?.role === 'ADMIN' || user.value?.role === 'CS')

const filters = reactive({
  date: '',
  storeType: '' as '' | StoreType,
  search: ''
})

let itemKey = 1
const createEmptyItem = (): FormItem => ({
  key: itemKey++,
  truckType: '',
  truckTypeOther: '',
  qty: 1
})

const form = reactive({
  scheduleDate: '',
  storeType: 'STORE_IN' as StoreType,
  customerId: '',
  items: [createEmptyItem()] as FormItem[]
})

const exportForm = reactive({
  dateFrom: '',
  dateTo: ''
})

const todayString = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const tomorrowString = () => {
  const now = new Date()
  now.setDate(now.getDate() + 1)
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const toDateInput = (value?: string | null) => {
  if (!value) return ''
  const raw = value.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const raw = toDateInput(value)
  if (!raw) return '-'
  const [y, m, d] = raw.split('-')
  return `${d}/${m}/${y}`
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

const storeTypeLabel = (value?: string | null) => {
  if (value === 'STORE_IN') return 'Store In'
  if (value === 'STORE_OUT') return 'Store Out'
  return '-'
}

const truckTypeLabel = (item: Pick<ScheduleItem, 'truckType' | 'truckTypeOther'>) => {
  if (item.truckType === 'OTHER') {
    return item.truckTypeOther?.trim() ? `Other - ${item.truckTypeOther}` : 'Other'
  }
  const found = truckTypeOptions.find((opt) => opt.value === item.truckType)
  return found?.label || item.truckType
}

const buildExportFileName = () => {
  if (exportForm.dateFrom && exportForm.dateTo) {
    return `schedule_pengiriman_${exportForm.dateFrom}_sampai_${exportForm.dateTo}.xlsx`
  }
  return 'schedule_pengiriman.xlsx'
}

const getErrorMessage = (err: any, fallback: string) => {
  return err?.response?.data?.message || err?.message || fallback
}

const selectedCustomerLabel = computed(() => {
  if (!form.customerId) return ''
  return customers.value.find((item) => item.id === form.customerId)?.name || ''
})

const filteredCustomers = computed(() => {
  const keyword = customerSearch.value.trim().toLowerCase()
  if (!keyword) return customers.value
  return customers.value.filter((item) => item.name.toLowerCase().includes(keyword))
})

const handleCustomerSearchInput = () => {
  form.customerId = ''
  customerDropdownOpen.value = true
}

const handleCustomerInputFocus = () => {
  customerDropdownOpen.value = true
}

const handleCustomerInputBlur = () => {
  window.setTimeout(() => {
    customerDropdownOpen.value = false
    if (!form.customerId) {
      customerSearch.value = ''
      return
    }
    if (selectedCustomerLabel.value) {
      customerSearch.value = selectedCustomerLabel.value
    }
  }, 120)
}

const selectCustomer = (customer: Customer) => {
  form.customerId = customer.id
  customerSearch.value = customer.name
  customerDropdownOpen.value = false
}

const parseStoreTypeQuery = (value: unknown): '' | StoreType => {
  if (value === 'STORE_IN' || value === 'STORE_OUT') return value
  return ''
}

const applyFiltersFromRoute = () => {
  const queryDate = typeof route.query.date === 'string' ? toDateInput(route.query.date) : ''
  const queryType = parseStoreTypeQuery(route.query.type)

  filters.date = queryDate || todayString()
  filters.storeType = queryType
}

const queryString = computed(() => {
  const params = new URLSearchParams()
  if (filters.date) params.set('date', filters.date)
  if (filters.storeType) params.set('storeType', filters.storeType)
  if (filters.search.trim()) params.set('search', filters.search.trim())
  params.set('page', String(page.value))
  params.set('limit', String(limit.value))
  params.set('sortBy', sortBy.value)
  params.set('sortDir', sortDir.value)
  return params.toString()
})

const paginationItems = computed(() => {
  const total = totalPages.value
  const current = page.value
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const items: Array<number | string> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) items.push('...')
  for (let i = start; i <= end; i++) items.push(i)
  if (end < total - 1) items.push('...')
  items.push(total)
  return items
})

const fetchCustomers = async () => {
  try {
    const response = await api.get('/customers')
    customers.value = response.data?.data || []
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal mengambil customer')
  }
}

const fetchList = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await api.get(`/schedules?${queryString.value}`)
    schedules.value = response.data?.data || []
    totalPages.value = response.data?.meta?.totalPages || 1
    totalItems.value = response.data?.meta?.total || response.data?.meta?.totalItems || 0
    page.value = response.data?.meta?.page || page.value
    limit.value = response.data?.meta?.limit || limit.value
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal mengambil schedule pengiriman')
  } finally {
    loading.value = false
  }
}

const fetchDetail = async (id: string) => {
  detailLoading.value = true
  try {
    const response = await api.get(`/schedules/${id}`)
    detailData.value = response.data?.data || null
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal mengambil detail schedule')
  } finally {
    detailLoading.value = false
  }
}

const openDetail = async (row: ScheduleListItem) => {
  detailOpen.value = true
  await fetchDetail(row.id)
}

const closeDetail = () => {
  detailOpen.value = false
  detailData.value = null
}

const resetForm = () => {
  form.scheduleDate = ''
  form.storeType = 'STORE_IN'
  form.customerId = ''
  form.items = [createEmptyItem()]
  customerSearch.value = ''
  customerDropdownOpen.value = false
  formError.value = null
}

const openCreate = () => {
  if (!canManageSchedule.value) return
  formMode.value = 'create'
  editingId.value = null
  resetForm()
  if (!form.scheduleDate) {
    form.scheduleDate = tomorrowString()
  }
  formOpen.value = true
}

const openEdit = async (row: ScheduleListItem) => {
  if (!canManageSchedule.value) return
  formMode.value = 'edit'
  editingId.value = row.id
  formError.value = null
  submitting.value = false

  try {
    const response = await api.get(`/schedules/${row.id}`)
    const data: ScheduleDetail | null = response.data?.data || null
    if (!data) {
      formError.value = 'Data schedule tidak ditemukan'
      return
    }
    form.scheduleDate = toDateInput(data.scheduleDate)
    form.storeType = data.storeType
    form.customerId = data.customerId
    customerSearch.value = data.customer?.name || ''
    form.items = (data.items || []).map((item) => ({
      key: itemKey++,
      truckType: item.truckType,
      truckTypeOther: item.truckTypeOther || '',
      qty: item.qty
    }))
    if (form.items.length === 0) {
      form.items = [createEmptyItem()]
    }
    formOpen.value = true
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal mengambil data untuk edit')
  }
}

const closeForm = () => {
  formOpen.value = false
  editingId.value = null
  customerDropdownOpen.value = false
  formError.value = null
}

const addItem = () => {
  form.items.push(createEmptyItem())
}

const removeItem = (index: number) => {
  if (form.items.length <= 1) return
  form.items.splice(index, 1)
}

const onTruckTypeChange = (item: FormItem) => {
  if (item.truckType !== 'OTHER') {
    item.truckTypeOther = ''
  }
}

const validateForm = () => {
  if (!form.scheduleDate) return 'Tanggal wajib diisi'
  if (!form.storeType) return 'Store Type wajib dipilih'
  if (!form.customerId) return 'Customer wajib dipilih'
  if (form.items.length === 0) return 'Minimal ada 1 item jenis truk'

  for (let i = 0; i < form.items.length; i += 1) {
    const item = form.items[i]
    const row = i + 1
    if (!item.truckType) return `Jenis Truck baris ${row} wajib dipilih`
    const qty = Number(item.qty)
    if (!Number.isInteger(qty) || qty < 1) return `Qty baris ${row} wajib minimal 1`
    if (item.truckType === 'OTHER' && !item.truckTypeOther.trim()) {
      return `Jenis Truck Lainnya baris ${row} wajib diisi`
    }
  }

  return null
}

const buildPayload = () => {
  return {
    scheduleDate: form.scheduleDate,
    storeType: form.storeType,
    customerId: form.customerId,
    items: form.items.map((item) => ({
      truckType: item.truckType,
      truckTypeOther: item.truckType === 'OTHER' ? item.truckTypeOther.trim() : undefined,
      qty: Number(item.qty)
    }))
  }
}

const submitForm = async () => {
  if (!canManageSchedule.value) return
  const validationError = validateForm()
  if (validationError) {
    formError.value = validationError
    return
  }

  submitting.value = true
  formError.value = null
  try {
    const payload = buildPayload()
    if (formMode.value === 'create') {
      await api.post('/schedules', payload)
      success.value = 'Schedule berhasil ditambahkan'
      // Default tanggal form adalah H+1, jadi set filter ke tanggal schedule baru
      // agar data yang baru dibuat langsung terlihat di tabel.
      filters.date = payload.scheduleDate
    } else if (editingId.value) {
      await api.put(`/schedules/${editingId.value}`, payload)
      success.value = 'Schedule berhasil diupdate'
      if (detailOpen.value && detailData.value?.id === editingId.value) {
        await fetchDetail(editingId.value)
      }
    }
    closeForm()
    await fetchList()
  } catch (err: any) {
    formError.value = getErrorMessage(err, 'Gagal menyimpan schedule')
  } finally {
    submitting.value = false
  }
}

const openConfirmDelete = (row: ScheduleListItem) => {
  if (!canManageSchedule.value) return
  confirmData.value = row
  confirmOpen.value = true
}

const closeConfirmDelete = () => {
  confirmOpen.value = false
  confirmData.value = null
}

const confirmDelete = async () => {
  if (!canManageSchedule.value || !confirmData.value) return
  deleting.value = true
  try {
    await api.delete(`/schedules/${confirmData.value.id}`)
    if (detailOpen.value && detailData.value?.id === confirmData.value.id) {
      closeDetail()
    }
    await fetchList()
    success.value = 'Schedule berhasil dihapus'
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal menghapus schedule')
  } finally {
    deleting.value = false
    closeConfirmDelete()
  }
}

const toggleSort = (column: 'scheduleDate' | 'createdAt') => {
  if (sortBy.value !== column) {
    sortBy.value = column
    sortDir.value = 'desc'
  } else {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  }
  page.value = 1
  fetchList()
}

const sortIndicator = (column: 'scheduleDate' | 'createdAt') => {
  if (sortBy.value !== column) return ''
  return sortDir.value === 'asc' ? '^' : 'v'
}

const goToPage = (target: number) => {
  if (target < 1 || target > totalPages.value || target === page.value) return
  page.value = target
  fetchList()
}

const handleExportDownload = async () => {
  exportError.value = null
  const hasFrom = Boolean(exportForm.dateFrom)
  const hasTo = Boolean(exportForm.dateTo)
  if (hasFrom !== hasTo) {
    exportError.value = 'Tanggal Dari & Sampai harus diisi bersama'
    return
  }

  exporting.value = true
  try {
    const params = new URLSearchParams()
    if (hasFrom && hasTo) {
      params.set('dateFrom', exportForm.dateFrom)
      params.set('dateTo', exportForm.dateTo)
    }
    const url = params.toString() ? `/schedules/export?${params.toString()}` : '/schedules/export'
    const response = await api.get(url, { responseType: 'blob' })
    const downloadUrl = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = buildExportFileName()
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)

    exportOpen.value = false
    exportForm.dateFrom = ''
    exportForm.dateTo = ''
  } catch (err: any) {
    exportError.value = getErrorMessage(err, 'Gagal export excel')
  } finally {
    exporting.value = false
  }
}

const openFilterDatePicker = () => {
  const input = filterDateInputRef.value
  if (!input) return
  const pickerInput = input as HTMLInputElement & { showPicker?: () => void }
  if (typeof pickerInput.showPicker === 'function') {
    pickerInput.showPicker()
  } else {
    input.focus()
  }
}

const closeExport = () => {
  exportOpen.value = false
  exportError.value = null
}

let searchTimer: number | undefined

watch(
  () => [filters.date, filters.storeType],
  () => {
    page.value = 1
    fetchList()
  }
)

watch(
  () => filters.search,
  () => {
    if (searchTimer) window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => {
      page.value = 1
      fetchList()
    }, 400)
  }
)

watch(
  () => limit.value,
  () => {
    page.value = 1
    fetchList()
  }
)

onMounted(() => {
  applyFiltersFromRoute()
  if (canManageSchedule.value) {
    fetchCustomers()
  }
  fetchList()
})

watch(
  () => [route.query.date, route.query.type],
  () => {
    applyFiltersFromRoute()
  }
)

watch(
  () => canManageSchedule.value,
  (allowed) => {
    if (allowed && customers.value.length === 0) {
      fetchCustomers()
    }
  }
)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Schedule Delivery & Receiving</h1>
        <p class="text-muted-foreground">Monitoring Jadwal Delivery & Receiving</p>
      </div>
      <div class="flex items-center gap-2">
        <Button size="sm" variant="outline" @click="exportOpen = true">Export Excel</Button>
        <Button v-if="canManageSchedule" size="sm" @click="openCreate">Tambah Jadwal</Button>
        <Button size="sm" variant="outline" @click="fetchList">
          <RefreshCw class="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
    </div>

    <Card>
      <CardHeader>
        <div class="grid gap-3 md:grid-cols-3">
          <div class="flex items-center gap-2">
            <Search class="h-4 w-4 text-muted-foreground" />
            <input
              v-model="filters.search"
              type="text"
              placeholder="Search customer / jenis truck"
              class="flex-1 bg-transparent border-none outline-none text-sm"
            />
          </div>
          <div>
            <select v-model="filters.storeType" class="w-full bg-transparent border rounded-md px-2 py-2 text-sm">
              <option v-for="opt in storeTypeOptions" :key="opt.label" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div>
            <div class="relative">
              <input
                ref="filterDateInputRef"
                v-model="filters.date"
                type="date"
                class="w-full appearance-none bg-transparent border rounded-md px-2 py-2 pr-10 text-sm"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 inline-flex items-center px-3 text-muted-foreground hover:text-foreground"
                @click="openFilterDatePicker"
                aria-label="Pilih tanggal"
              >
                <CalendarDays class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div v-if="error" class="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ error }}
        </div>
        <div v-if="success" class="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {{ success }}
        </div>
        <div class="overflow-x-auto border rounded-lg">
          <table class="min-w-full text-sm">
            <thead class="bg-muted/60 text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left font-medium">No</th>
                <th class="px-3 py-2 text-left font-medium">
                  <button type="button" class="inline-flex items-center gap-1" @click="toggleSort('scheduleDate')">
                    Tanggal <span>{{ sortIndicator('scheduleDate') }}</span>
                  </button>
                </th>
                <th class="px-3 py-2 text-left font-medium">Store Type</th>
                <th class="px-3 py-2 text-left font-medium">Customer Name</th>
                <th class="px-3 py-2 text-left font-medium">Total Jenis Truck</th>
                <th class="px-3 py-2 text-left font-medium">Total Qty</th>
                <th class="px-3 py-2 text-left font-medium">
                  <button type="button" class="inline-flex items-center gap-1" @click="toggleSort('createdAt')">
                    Created At <span>{{ sortIndicator('createdAt') }}</span>
                  </button>
                </th>
                <th class="px-3 py-2 text-left font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="8" class="px-3 py-6 text-center text-muted-foreground">Loading...</td>
              </tr>
              <tr v-else-if="schedules.length === 0">
                <td colspan="8" class="px-3 py-6 text-center text-muted-foreground">Data kosong.</td>
              </tr>
              <tr v-for="(row, index) in schedules" :key="row.id" class="border-t">
                <td class="px-3 py-2">{{ (page - 1) * limit + index + 1 }}</td>
                <td class="px-3 py-2">{{ formatDate(row.scheduleDate) }}</td>
                <td class="px-3 py-2">
                  <span
                    class="inline-flex rounded-full border px-2 py-0.5 text-xs"
                    :class="
                      row.storeType === 'STORE_IN'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-blue-300 bg-blue-50 text-blue-700'
                    "
                  >
                    {{ storeTypeLabel(row.storeType) }}
                  </span>
                </td>
                <td class="px-3 py-2">{{ row.customer?.name || '-' }}</td>
                <td class="px-3 py-2">{{ row.totalTypes }}</td>
                <td class="px-3 py-2">{{ row.totalQty }}</td>
                <td class="px-3 py-2">{{ formatDateTime(row.createdAt) }}</td>
                <td class="px-3 py-2">
                  <div class="flex items-center gap-2">
                    <Button size="sm" variant="outline" @click="openDetail(row)">Detail</Button>
                    <Button v-if="canManageSchedule" size="sm" variant="outline" @click="openEdit(row)">Edit</Button>
                    <Button v-if="canManageSchedule" size="sm" variant="outline" @click="openConfirmDelete(row)">Hapus</Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="flex items-center gap-2 text-sm">
            <span class="text-muted-foreground">Rows:</span>
            <select v-model.number="limit" class="bg-transparent border rounded-md px-2 py-1 text-sm">
              <option :value="15">15</option>
              <option :value="30">30</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
            <span class="text-muted-foreground">Total: {{ totalItems }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-1">
            <Button size="sm" variant="outline" :disabled="page === 1" @click="goToPage(page - 1)">
              Prev
            </Button>
            <template v-for="(item, idx) in paginationItems" :key="`${item}-${idx}`">
              <span v-if="item === '...'" class="px-2 text-muted-foreground">...</span>
              <Button
                v-else
                size="sm"
                :variant="item === page ? 'default' : 'ghost'"
                @click="goToPage(Number(item))"
              >
                {{ item }}
              </Button>
            </template>
            <Button size="sm" variant="outline" :disabled="page === totalPages" @click="goToPage(page + 1)">
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <div v-if="formOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeForm"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold">
              {{ formMode === 'create' ? 'Tambah Jadwal' : 'Edit Jadwal' }}
            </h3>
            <p class="text-sm text-muted-foreground">Input jadwal pengiriman (Store In / Store Out)</p>
          </div>
          <Button variant="outline" size="sm" @click="closeForm">Tutup</Button>
        </div>

        <div class="max-h-[70vh] overflow-y-auto p-4 space-y-4 text-sm">
          <div class="grid gap-3 md:grid-cols-3">
            <div>
              <label class="text-muted-foreground">Tanggal</label>
              <input
                v-model="form.scheduleDate"
                type="date"
                class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
              />
            </div>
            <div class="md:col-span-2">
              <label class="text-muted-foreground">Store Type</label>
              <div class="mt-2 flex flex-wrap items-center gap-4">
                <label class="inline-flex items-center gap-2">
                  <input v-model="form.storeType" type="radio" value="STORE_IN" class="h-4 w-4" />
                  Store In
                </label>
                <label class="inline-flex items-center gap-2">
                  <input v-model="form.storeType" type="radio" value="STORE_OUT" class="h-4 w-4" />
                  Store Out
                </label>
              </div>
            </div>
          </div>

          <div>
            <label class="text-muted-foreground">Customer</label>
            <div class="relative mt-1">
              <input
                v-model="customerSearch"
                type="text"
                placeholder="Cari customer..."
                class="w-full bg-transparent border rounded-md px-2 py-2 text-sm"
                @focus="handleCustomerInputFocus"
                @input="handleCustomerSearchInput"
                @blur="handleCustomerInputBlur"
              />
              <div
                v-if="customerDropdownOpen"
                class="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-background shadow-sm"
              >
                <button
                  v-for="customer in filteredCustomers"
                  :key="customer.id"
                  type="button"
                  class="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  @click="selectCustomer(customer)"
                >
                  {{ customer.name }}
                </button>
                <div v-if="filteredCustomers.length === 0" class="px-3 py-2 text-sm text-muted-foreground">
                  Customer tidak ditemukan.
                </div>
              </div>
            </div>
            <p v-if="form.customerId" class="mt-1 text-xs text-muted-foreground">
              Terpilih: {{ selectedCustomerLabel || '-' }}
            </p>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-muted-foreground">Detail Jenis Truk</label>
              <Button size="sm" variant="outline" @click="addItem">+ Tambah Jenis Truk</Button>
            </div>

            <div
              v-for="(item, idx) in form.items"
              :key="item.key"
              class="rounded-md border p-3"
            >
              <div class="grid gap-3 md:grid-cols-12">
                <div class="md:col-span-4">
                  <label class="text-xs text-muted-foreground">Jenis Truck</label>
                  <select
                    v-model="item.truckType"
                    class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
                    @change="onTruckTypeChange(item)"
                  >
                    <option value="" disabled>Pilih jenis truck</option>
                    <option v-for="opt in truckTypeOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>

                <div v-if="item.truckType === 'OTHER'" class="md:col-span-4">
                  <label class="text-xs text-muted-foreground">Jenis Truck Lainnya</label>
                  <input
                    v-model="item.truckTypeOther"
                    type="text"
                    class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
                    placeholder="Isi jenis truck lainnya"
                  />
                </div>

                <div :class="item.truckType === 'OTHER' ? 'md:col-span-2' : 'md:col-span-4'">
                  <label class="text-xs text-muted-foreground">Jumlah</label>
                  <input
                    v-model.number="item.qty"
                    type="number"
                    min="1"
                    class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
                  />
                </div>

                <div :class="item.truckType === 'OTHER' ? 'md:col-span-2' : 'md:col-span-4'" class="flex items-end">
                  <Button
                    size="sm"
                    variant="outline"
                    :disabled="form.items.length === 1"
                    @click="removeItem(idx)"
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <p v-if="formError" class="text-xs text-red-600">{{ formError }}</p>
        </div>

        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeForm">Batal</Button>
          <Button :disabled="submitting" @click="submitForm">
            {{ submitting ? 'Menyimpan...' : formMode === 'create' ? 'Simpan' : 'Update' }}
          </Button>
        </div>
      </div>
    </div>

    <div v-if="detailOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeDetail"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b flex items-center justify-between">
          <h3 class="text-lg font-semibold">Detail Schedule Pengiriman</h3>
          <Button variant="outline" size="sm" @click="closeDetail">Tutup</Button>
        </div>
        <div class="max-h-[70vh] overflow-y-auto p-4 space-y-4 text-sm">
          <div v-if="detailLoading" class="text-muted-foreground">Loading detail...</div>
          <template v-else-if="detailData">
            <div class="grid gap-3 md:grid-cols-2">
              <div>
                <p class="text-xs text-muted-foreground">Tanggal</p>
                <p class="font-medium">{{ formatDate(detailData.scheduleDate) }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Store Type</p>
                <p class="font-medium">{{ storeTypeLabel(detailData.storeType) }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Customer</p>
                <p class="font-medium">{{ detailData.customer?.name || '-' }}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Created At</p>
                <p class="font-medium">{{ formatDateTime(detailData.createdAt) }}</p>
              </div>
            </div>

            <div class="overflow-x-auto border rounded-lg">
              <table class="min-w-full text-sm">
                <thead class="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium">No</th>
                    <th class="px-3 py-2 text-left font-medium">Jenis Truck</th>
                    <th class="px-3 py-2 text-left font-medium">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="detailData.items.length === 0">
                    <td colspan="3" class="px-3 py-4 text-center text-muted-foreground">Tidak ada item.</td>
                  </tr>
                  <tr v-for="(item, idx) in detailData.items" :key="item.id" class="border-t">
                    <td class="px-3 py-2">{{ idx + 1 }}</td>
                    <td class="px-3 py-2">{{ truckTypeLabel(item) }}</td>
                    <td class="px-3 py-2">{{ item.qty }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div v-if="confirmOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeConfirmDelete"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Konfirmasi Hapus</h3>
        </div>
        <div class="p-4 text-sm">
          <p>
            Hapus schedule
            <span class="font-semibold">{{ confirmData?.customer?.name || '-' }}</span>
            pada tanggal
            <span class="font-semibold">{{ formatDate(confirmData?.scheduleDate) }}</span>
            ?
          </p>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeConfirmDelete">Batal</Button>
          <Button :disabled="deleting" @click="confirmDelete">
            {{ deleting ? 'Menghapus...' : 'Ya, Hapus' }}
          </Button>
        </div>
      </div>
    </div>

    <div v-if="exportOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeExport"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Export Excel</h3>
        </div>
        <div class="p-4 space-y-3 text-sm">
          <div>
            <label class="text-sm text-muted-foreground">Tanggal Dari</label>
            <input
              v-model="exportForm.dateFrom"
              type="date"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
            />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Tanggal Sampai</label>
            <input
              v-model="exportForm.dateTo"
              type="date"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
            />
          </div>
          <p class="text-xs text-muted-foreground">Kosongkan tanggal untuk export semua data.</p>
          <p v-if="exportError" class="text-xs text-red-600">{{ exportError }}</p>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeExport">Batal</Button>
          <Button :disabled="exporting" @click="handleExportDownload">
            {{ exporting ? 'Downloading...' : 'Download' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

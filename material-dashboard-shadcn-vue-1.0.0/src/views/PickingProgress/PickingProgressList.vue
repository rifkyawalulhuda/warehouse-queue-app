<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import PickingCreateModal from '@/components/picking/PickingCreateModal.vue'
import PickingDetailDrawer from '@/components/picking/PickingDetailDrawer.vue'
import PickingTable from '@/components/picking/PickingTable.vue'
import { RefreshCw, Search } from 'lucide-vue-next'
import api from '@/services/api'
import { useAuth } from '@/composables/useAuth'
import { listEmployees, type Employee } from '@/services/employeeApi'
import {
  cancelPickingProgress,
  createPickingProgress,
  finishPickingProgress,
  getPickingProgressById,
  listPickingProgress,
  startPickingProgress,
  updatePickingPickedQty,
  type PickingProgressEntry,
} from '@/services/pickingProgressApi'

type Customer = {
  id: string
  name: string
}

const route = useRoute()
const router = useRouter()
const { user, initFromStorage } = useAuth()
initFromStorage()
const isWarehouse = computed(() => user.value?.role === 'WAREHOUSE')

const entries = ref<PickingProgressEntry[]>([])
const customers = ref<Customer[]>([])
const employees = ref<Employee[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

const createOpen = ref(false)
const createSubmitting = ref(false)
const drawerOpen = ref(false)
const selectedEntry = ref<PickingProgressEntry | null>(null)
const actionLoading = ref<Record<string, boolean>>({})

const page = ref(1)
const limit = ref(15)
const totalItems = ref(0)
const totalPages = ref(1)

const finishConfirmOpen = ref(false)
const cancelConfirmOpen = ref(false)
const pendingFinishEntry = ref<PickingProgressEntry | null>(null)
const pendingCancelEntry = ref<PickingProgressEntry | null>(null)
const cancelReason = ref('')
const cancelReasonError = ref('')
const startConfirmOpen = ref(false)
const pendingStartEntry = ref<PickingProgressEntry | null>(null)
const selectedPickerEmployeeId = ref('')
const pickedQtyModalOpen = ref(false)
const pendingPickedQtyEntry = ref<PickingProgressEntry | null>(null)
const pickedQtyInput = ref<string | number>('')
const pickedQtySubmitting = ref(false)
const pickedQtySubmitError = ref('')

const todayString = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

const parseSearchQuery = (value: unknown) => {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

const filters = reactive({
  date: todayString(),
  status: 'ALL',
  search: parseSearchQuery(route.query.search),
})

const getErrorMessage = (err: any, fallback: string) => {
  return err?.response?.data?.message || err?.message || fallback
}

let successTimer: number | undefined
const showSuccess = (message: string) => {
  success.value = message
  if (successTimer) window.clearTimeout(successTimer)
  successTimer = window.setTimeout(() => {
    success.value = null
  }, 3000)
}

const parsePositiveInt = (value: unknown, fallback: number) => {
  const asNumber =
    typeof value === 'string'
      ? Number(value)
      : Array.isArray(value) && value.length > 0
        ? Number(value[0])
        : Number(value)
  if (!Number.isFinite(asNumber) || asNumber < 1) return fallback
  return Math.floor(asNumber)
}

const applyInitialRouteQuery = () => {
  if (typeof route.query.date === 'string' && route.query.date) {
    filters.date = route.query.date
  }
  if (typeof route.query.status === 'string' && route.query.status) {
    filters.status = route.query.status
  }
  filters.search = parseSearchQuery(route.query.search)
  page.value = parsePositiveInt(route.query.page, 1)
  const nextLimit = parsePositiveInt(route.query.limit, 15)
  limit.value = [15, 30, 50, 100].includes(nextLimit) ? nextLimit : 15
}

const syncQueryToRoute = () => {
  const nextQuery: Record<string, string> = {}
  if (filters.date) nextQuery.date = filters.date
  if (filters.status && filters.status !== 'ALL') nextQuery.status = filters.status
  if (filters.search) nextQuery.search = filters.search
  nextQuery.page = String(page.value)
  nextQuery.limit = String(limit.value)
  router.replace({ path: '/picking-progress', query: nextQuery })
}

const fetchList = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await listPickingProgress({
      date: filters.date,
      status: filters.status as any,
      search: filters.search || undefined,
      page: page.value,
      limit: limit.value,
      sort: 'createdAt',
      sortDir: 'desc',
    })
    entries.value = response.data?.items || []
    totalItems.value = response.data?.meta?.total || 0
    totalPages.value = response.data?.meta?.totalPages || 1
    page.value = response.data?.meta?.page || page.value
    limit.value = response.data?.meta?.limit || limit.value
    syncQueryToRoute()
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal memuat picking progress')
  } finally {
    loading.value = false
  }
}

const fetchCustomers = async () => {
  try {
    const response = await api.get('/customers')
    customers.value = response.data?.data || []
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal mengambil customer')
  }
}

const fetchEmployees = async () => {
  try {
    const response = await listEmployees()
    employees.value = response.data?.data || []
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal mengambil data karyawan')
  }
}

const openDetailById = async (id: string) => {
  drawerOpen.value = true
  try {
    const response = await getPickingProgressById(id)
    selectedEntry.value = response.data?.data || null
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal mengambil detail')
  }
}

const handleCreate = async (payload: {
  date: string
  customerId: string
  doNumber: string
  destination: string
  volumeCbm: number
  plTimeRelease: string
  pickingQty: number
}) => {
  createSubmitting.value = true
  error.value = null
  try {
    await createPickingProgress(payload)
    createOpen.value = false
    await fetchList()
    showSuccess('Transaksi picking berhasil ditambahkan')
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal menambah transaksi picking')
  } finally {
    createSubmitting.value = false
  }
}

const openPickedQtyModal = (entry: PickingProgressEntry) => {
  pendingPickedQtyEntry.value = entry
  pickedQtyInput.value = String(entry.pickedQty)
  pickedQtySubmitError.value = ''
  pickedQtyModalOpen.value = true
}

const closePickedQtyModal = () => {
  pickedQtyModalOpen.value = false
  pendingPickedQtyEntry.value = null
  pickedQtyInput.value = ''
  pickedQtySubmitting.value = false
  pickedQtySubmitError.value = ''
}

const getPickedQtyInputText = () => {
  const value = pickedQtyInput.value
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const pickedQtyValidationError = computed(() => {
  if (!pickedQtyModalOpen.value) return ''
  const entry = pendingPickedQtyEntry.value
  if (!entry) return 'Data picking tidak ditemukan'
  const rawValue = getPickedQtyInputText()
  if (!rawValue) return 'Jumlah picked qty wajib diisi'
  if (!/^\d+$/.test(rawValue)) return 'Input hanya angka'

  const value = Number(rawValue)
  if (!Number.isInteger(value) || value < 0) return 'Input hanya angka'
  if (value > entry.pickingQty) {
    return 'Jumlah yang dimasukan melebihi Jumlah Barcode yang di Picking'
  }
  return ''
})

const withActionLoading = async (id: string, fn: () => Promise<void>) => {
  actionLoading.value[id] = true
  try {
    await fn()
  } finally {
    actionLoading.value[id] = false
  }
}

const refreshDetailIfOpen = async (id: string) => {
  if (!drawerOpen.value || selectedEntry.value?.id !== id) return
  await openDetailById(id)
}

const requestStart = (entry: PickingProgressEntry) => {
  pendingStartEntry.value = entry
  selectedPickerEmployeeId.value = ''
  startConfirmOpen.value = true
}

const executeStart = async () => {
  const entry = pendingStartEntry.value
  if (!entry) return
  if (!selectedPickerEmployeeId.value) {
    error.value = 'Nama karyawan wajib dipilih sebelum start'
    return
  }

  await withActionLoading(entry.id, async () => {
    try {
      await startPickingProgress(entry.id, selectedPickerEmployeeId.value)
      closeStartConfirm()
      await fetchList()
      await refreshDetailIfOpen(entry.id)
      showSuccess('Picking berhasil dimulai')
    } catch (err: any) {
      error.value = getErrorMessage(err, 'Gagal start picking')
    }
  })
}

const closeStartConfirm = () => {
  startConfirmOpen.value = false
  pendingStartEntry.value = null
  selectedPickerEmployeeId.value = ''
}

const submitPickedQty = async () => {
  const entry = pendingPickedQtyEntry.value
  if (!entry) {
    pickedQtySubmitError.value = 'Data picking tidak ditemukan'
    return
  }
  pickedQtySubmitError.value = ''
  if (pickedQtyValidationError.value) {
    pickedQtySubmitError.value = pickedQtyValidationError.value
    return
  }

  const nextPickedQty = Number(getPickedQtyInputText())
  const latestEntry = entries.value.find((item) => item.id === entry.id) || entry
  const delta = nextPickedQty - latestEntry.pickedQty
  if (delta === 0) {
    closePickedQtyModal()
    showSuccess('Tidak ada perubahan pada Picked Qty')
    return
  }

  pickedQtySubmitting.value = true
  await withActionLoading(entry.id, async () => {
    try {
      await updatePickingPickedQty(entry.id, delta)
      closePickedQtyModal()
      await fetchList()
      await refreshDetailIfOpen(entry.id)
      showSuccess('Picked Qty berhasil diperbarui')
    } catch (err: any) {
      const message = getErrorMessage(err, 'Gagal update picked qty')
      error.value = message
      pickedQtySubmitError.value = message
    } finally {
      pickedQtySubmitting.value = false
    }
  })
}

const handlePickedQtySaveClick = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  submitPickedQty()
}

const executeFinish = async (entry: PickingProgressEntry) => {
  await withActionLoading(entry.id, async () => {
    try {
      await finishPickingProgress(entry.id)
      closeFinishConfirm()
      await fetchList()
      await refreshDetailIfOpen(entry.id)
      showSuccess('Picking selesai')
    } catch (err: any) {
      error.value = getErrorMessage(err, 'Gagal finish picking')
    }
  })
}

const requestFinish = (entry: PickingProgressEntry) => {
  if (entry.pickedQty !== entry.pickingQty) {
    error.value = 'Picked Qty harus sama dengan Picking Qty sebelum Finish'
    return
  }
  pendingFinishEntry.value = entry
  finishConfirmOpen.value = true
}

const closeFinishConfirm = () => {
  finishConfirmOpen.value = false
  pendingFinishEntry.value = null
}

const getCancelReasonText = () => {
  return String(cancelReason.value || '').trim()
}

const closeCancelConfirm = () => {
  cancelConfirmOpen.value = false
  pendingCancelEntry.value = null
  cancelReason.value = ''
  cancelReasonError.value = ''
}

const executeCancel = async (entry: PickingProgressEntry) => {
  const reason = getCancelReasonText()
  if (!reason) {
    cancelReasonError.value = 'Alasan cancel wajib diisi'
    return
  }

  await withActionLoading(entry.id, async () => {
    try {
      await cancelPickingProgress(entry.id, reason)
      closeCancelConfirm()
      await fetchList()
      await refreshDetailIfOpen(entry.id)
      showSuccess('Transaksi picking dibatalkan')
    } catch (err: any) {
      const message = getErrorMessage(err, 'Gagal cancel picking')
      error.value = message
      cancelReasonError.value = message
    }
  })
}

const requestCancel = (entry: PickingProgressEntry) => {
  pendingCancelEntry.value = entry
  cancelReason.value = ''
  cancelReasonError.value = ''
  cancelConfirmOpen.value = true
}

const closeDrawer = () => {
  drawerOpen.value = false
  selectedEntry.value = null
}

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

const goToPage = (target: number) => {
  if (target < 1 || target > totalPages.value || target === page.value) return
  page.value = target
  fetchList()
}

let searchTimer: number | undefined
watch(
  () => [filters.date, filters.status],
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

watch(
  () => route.query.search,
  (value) => {
    const nextSearch = parseSearchQuery(value)
    if (filters.search !== nextSearch) {
      filters.search = nextSearch
    }
  }
)

let refreshTimer: number | undefined
onMounted(() => {
  applyInitialRouteQuery()
  fetchCustomers()
  fetchEmployees()
  fetchList()
  refreshTimer = window.setInterval(() => {
    fetchList()
  }, 30000)
})

onUnmounted(() => {
  if (searchTimer) window.clearTimeout(searchTimer)
  if (successTimer) window.clearTimeout(successTimer)
  if (refreshTimer) window.clearInterval(refreshTimer)
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Picking Progress</h1>
        <p class="text-muted-foreground">Monitoring progress picking</p>
      </div>
      <div class="flex items-center gap-2">
        <Button v-if="!isWarehouse" size="sm" @click="createOpen = true">Tambah Transaksi</Button>
        <Button size="sm" variant="outline" @click="fetchList">
          <RefreshCw class="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
    </div>

    <Card>
      <CardHeader>
        <div class="grid gap-3 md:grid-cols-4">
          <div class="flex items-center gap-2">
            <Search class="h-4 w-4 text-muted-foreground" />
            <input
              v-model="filters.search"
              type="text"
              placeholder="Search customer/container/dock"
              class="flex-1 bg-transparent border-none outline-none text-sm"
            />
          </div>
          <div>
            <select v-model="filters.status" class="w-full bg-transparent border rounded-md px-2 py-2 text-sm">
              <option value="ALL">Semua</option>
              <option value="MENUNGGU">MENUNGGU</option>
              <option value="ON_PROCESS">ON_PROCESS</option>
              <option value="SELESAI">SELESAI</option>
              <option value="BATAL">BATAL</option>
            </select>
          </div>
          <div>
            <input v-model="filters.date" type="date" class="w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
          <div class="text-xs text-muted-foreground flex items-center">
            SLA per barcode: <span class="font-semibold ml-1">2.5 menit</span>
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

        <PickingTable
          :entries="entries"
          :loading="loading"
          :page="page"
          :limit="limit"
          :can-cancel="!isWarehouse"
          @start="requestStart"
          @input-picked="openPickedQtyModal"
          @finish="requestFinish"
          @cancel="requestCancel"
          @detail="openDetailById($event.id)"
        />

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

    <PickingCreateModal
      :open="createOpen"
      :submitting="createSubmitting"
      :customers="customers"
      @close="createOpen = false"
      @submit="handleCreate"
    />

    <PickingDetailDrawer :open="drawerOpen" :entry="selectedEntry" @close="closeDrawer" />

    <div v-if="pickedQtyModalOpen" class="fixed inset-0 z-[70] pointer-events-none">
      <div class="absolute inset-0 z-0 bg-black/40 pointer-events-auto" @click="closePickedQtyModal"></div>
      <form
        novalidate
        class="absolute left-1/2 top-1/2 z-10 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border pointer-events-auto"
        @submit.prevent="submitPickedQty"
      >
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Input Picked Qty</h3>
        </div>
        <div class="p-4 space-y-3 text-sm">
          <p>
            Masukkan jumlah yang sudah terpicking untuk DO
            <span class="font-semibold">{{ pendingPickedQtyEntry?.doNumber || pendingPickedQtyEntry?.noContainer }}</span>.
          </p>
          <p class="text-muted-foreground">
            Maksimal: <span class="font-semibold">{{ pendingPickedQtyEntry?.pickingQty ?? 0 }}</span>
          </p>
          <div>
            <label class="text-sm text-muted-foreground">Jumlah Picked Qty</label>
            <input
              v-model="pickedQtyInput"
              type="number"
              min="0"
              :max="pendingPickedQtyEntry?.pickingQty ?? 0"
              step="1"
              inputmode="numeric"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
              @input="pickedQtySubmitError = ''"
              @keydown.enter.prevent="submitPickedQty"
            />
            <p v-if="pickedQtyValidationError" class="mt-1 text-xs text-red-600">
              {{ pickedQtyValidationError }}
            </p>
            <p v-else-if="pickedQtySubmitError" class="mt-1 text-xs text-red-600">
              {{ pickedQtySubmitError }}
            </p>
          </div>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            @click="closePickedQtyModal"
          >
            Batal
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            :disabled="Boolean(pickedQtyValidationError) || !pendingPickedQtyEntry || pickedQtySubmitting"
            @click="handlePickedQtySaveClick"
            @mousedown.stop
          >
            {{ pickedQtySubmitting ? 'Menyimpan...' : 'Simpan' }}
          </button>
        </div>
      </form>
    </div>

    <div v-if="startConfirmOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeStartConfirm"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Start Picking</h3>
        </div>
        <div class="p-4 space-y-3 text-sm">
          <p>
            Pilih nama karyawan untuk transaksi
            <span class="font-semibold">{{ pendingStartEntry?.doNumber || pendingStartEntry?.noContainer }}</span>.
          </p>
          <div>
            <label class="text-sm text-muted-foreground">Nama Karyawan</label>
            <select v-model="selectedPickerEmployeeId" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm">
              <option value="">Pilih karyawan...</option>
              <option v-for="employee in employees" :key="employee.id" :value="employee.id">
                {{ employee.name }} ({{ employee.nik }})
              </option>
            </select>
          </div>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeStartConfirm">Batal</Button>
          <Button :disabled="!selectedPickerEmployeeId" @click="executeStart">Start</Button>
        </div>
      </div>
    </div>

    <div v-if="finishConfirmOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeFinishConfirm"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Konfirmasi Finish</h3>
        </div>
        <div class="p-4 text-sm">
          Selesaikan picking untuk DO
          <span class="font-semibold">{{ pendingFinishEntry?.doNumber || pendingFinishEntry?.noContainer }}</span>
          ?
          <div class="mt-1 text-muted-foreground">
            Picked Qty: {{ pendingFinishEntry?.pickedQty || 0 }}/{{ pendingFinishEntry?.pickingQty || 0 }}
          </div>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeFinishConfirm">Batal</Button>
          <Button :disabled="!pendingFinishEntry || actionLoading[pendingFinishEntry?.id || '']" @click="pendingFinishEntry && executeFinish(pendingFinishEntry)">
            {{ pendingFinishEntry && actionLoading[pendingFinishEntry.id] ? 'Memproses...' : 'Ya, Finish' }}
          </Button>
        </div>
      </div>
    </div>

    <div v-if="cancelConfirmOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeCancelConfirm"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Konfirmasi Cancel</h3>
        </div>
        <div class="p-4 space-y-3 text-sm">
          Batalkan transaksi picking untuk container
          <span class="font-semibold">{{ pendingCancelEntry?.doNumber || pendingCancelEntry?.noContainer }}</span>
          ?
          <div>
            <label class="text-sm text-muted-foreground">Alasan Cancel</label>
            <textarea
              v-model="cancelReason"
              rows="3"
              class="mt-1 w-full resize-none bg-transparent border rounded-md px-2 py-2 text-sm"
              placeholder="Tulis alasan pembatalan..."
              @input="cancelReasonError = ''"
            ></textarea>
            <p v-if="cancelReasonError" class="mt-1 text-xs text-red-600">{{ cancelReasonError }}</p>
          </div>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeCancelConfirm">Batal</Button>
          <Button
            variant="outline"
            class="border-red-200 bg-red-600 text-white hover:bg-red-700 hover:text-white"
            :disabled="!getCancelReasonText() || actionLoading[pendingCancelEntry?.id || '']"
            @click="pendingCancelEntry && executeCancel(pendingCancelEntry)"
          >
            {{ pendingCancelEntry && actionLoading[pendingCancelEntry.id] ? 'Memproses...' : 'Ya, Cancel' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

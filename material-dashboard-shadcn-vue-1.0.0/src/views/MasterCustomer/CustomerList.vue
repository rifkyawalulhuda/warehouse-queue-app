<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  Download,
  FileSpreadsheet,
  Plus,
  Upload,
  X
} from 'lucide-vue-next'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import ActionMenu from '@/components/ui/ActionMenu.vue'
import MasterTable from '@/components/master/MasterTable.vue'
import MasterSearch from '@/components/master/MasterSearch.vue'
import type { MasterColumn } from '@/components/master/types'
import api from '@/services/api'
import { formatDateTimeId } from '@/lib/datetime'
import { useDebouncedCallback, useTablePagination } from '@/composables/useTablePagination'

type Customer = {
  id: string
  name: string
  createdAt: string
}

const customers = ref<Customer[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const submitting = ref(false)
const importing = ref(false)
const exportLoading = ref(false)
const importFile = ref<File | null>(null)
const search = ref('')
const confirmOpen = ref(false)
const confirmCustomer = ref<Customer | null>(null)
const editOpen = ref(false)
const editCustomer = ref<Customer | null>(null)
const editError = ref<string | null>(null)
const updating = ref(false)
const showCreate = ref(false)
const showImport = ref(false)

const sortBy = ref('name')
const sortDir = ref<'asc' | 'desc'>('asc')

const columns: MasterColumn[] = [
  { key: 'name', label: 'Nama Customer', sortable: true, mobile: true, avatar: true, mobileTitle: true },
  { key: 'createdAt', label: 'Dibuat', sortable: true, hideBelow: 'md', mobile: true }
]

const { page, pageSize, total, totalPages, applyMeta, resetPage } =
  useTablePagination({ key: 'master-customer' })

const form = reactive({ name: '' })
const editForm = reactive({ name: '' })

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

const fetchCustomers = async () => {
  loading.value = true
  error.value = null
  try {
    const params: Record<string, string | number> = {
      page: page.value,
      pageSize: pageSize.value,
      sortBy: sortBy.value,
      sortDir: sortDir.value
    }
    if (search.value.trim()) params.search = search.value.trim()

    const response = await api.get('/customers', { params })
    customers.value = response.data?.data || []
    applyMeta(response.data?.meta)

    // Hapus baris terakhir di halaman terakhir: mundur satu halaman lalu ambil ulang.
    if (customers.value.length === 0 && page.value > 1) {
      page.value = Math.min(page.value - 1, totalPages.value)
      await fetchCustomers()
    }
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Terjadi kesalahan')
  } finally {
    loading.value = false
  }
}

/** Satu jalur reload: reset halaman dulu, lalu ambil data sekali saja. */
const reload = () => {
  page.value = 1
  fetchCustomers()
}

const debouncedFetch = useDebouncedCallback(() => {
  reload()
}, 300)

watch(search, () => debouncedFetch.run())

const goToPage = (value: number) => {
  if (value === page.value) return
  page.value = value
  fetchCustomers()
}

const changePageSize = (value: number) => {
  pageSize.value = value
  page.value = 1
  fetchCustomers()
}

const toggleSort = (field: string) => {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortDir.value = 'asc'
  }
  resetPage()
  fetchCustomers()
}

const handleSubmit = async () => {
  if (!form.name.trim()) {
    error.value = 'Nama Customer wajib diisi'
    return
  }
  submitting.value = true
  error.value = null
  try {
    await api.post('/customers', { name: form.name.trim() })
    form.name = ''
    showCreate.value = false
    resetPage()
    await fetchCustomers()
    showSuccess('Customer berhasil ditambahkan')
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal menambah customer')
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (id: string) => {
  try {
    await api.delete(`/customers/${id}`)
    await fetchCustomers()
    showSuccess('Customer berhasil dihapus')
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal menghapus customer')
  }
}

const openConfirm = (cust: Customer) => {
  confirmCustomer.value = cust
  confirmOpen.value = true
}

const closeConfirm = () => {
  confirmOpen.value = false
  confirmCustomer.value = null
}

const confirmDelete = async () => {
  if (!confirmCustomer.value) return
  await handleDelete(confirmCustomer.value.id)
  closeConfirm()
}

const openEdit = (cust: Customer) => {
  editCustomer.value = cust
  editForm.name = cust.name
  editError.value = null
  editOpen.value = true
}

const closeEdit = () => {
  editOpen.value = false
  editCustomer.value = null
  editForm.name = ''
  editError.value = null
}

const submitUpdate = async () => {
  if (!editForm.name.trim()) {
    editError.value = 'Nama Customer wajib diisi'
    return
  }
  if (!editCustomer.value) return
  updating.value = true
  editError.value = null
  try {
    await api.patch(`/customers/${editCustomer.value.id}`, { name: editForm.name.trim() })
    await fetchCustomers()
    closeEdit()
    showSuccess('Customer berhasil diperbarui')
  } catch (err: any) {
    editError.value = getErrorMessage(err, 'Gagal update customer')
  } finally {
    updating.value = false
  }
}

const onRowAction = (cust: Customer, key: string) => {
  if (key === 'edit') openEdit(cust)
  if (key === 'delete') openConfirm(cust)
}

const handleImport = async () => {
  if (!importFile.value) {
    error.value = 'File Excel wajib dipilih'
    return
  }
  importing.value = true
  error.value = null
  try {
    const formData = new FormData()
    formData.append('file', importFile.value)
    await api.post('/customers/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    importFile.value = null
    showImport.value = false
    resetPage()
    await fetchCustomers()
    showSuccess('Import customer selesai')
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal import customer')
  } finally {
    importing.value = false
  }
}

const handleDownloadTemplate = async () => {
  try {
    const response = await api.get('/customers/template', { responseType: 'blob' })
    const blob = new Blob([response.data], { type: response.headers['content-type'] })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'customer-import-template.xlsx'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal download template')
  }
}

const handleExport = async () => {
  exportLoading.value = true
  error.value = null
  try {
    const response = await api.get('/customers/export', { responseType: 'blob' })
    const blob = new Blob([response.data], { type: response.headers['content-type'] })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    link.download = `master-customer_${yyyy}-${mm}-${dd}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal export customer')
  } finally {
    exportLoading.value = false
  }
}

const isFiltering = computed(() => search.value.trim().length > 0)

onMounted(fetchCustomers)
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Master Customer</h1>
        <p class="text-sm text-muted-foreground">
          Daftar customer yang dipakai pada Schedule Pengiriman dan Antrian Truk.
        </p>
      </div>
      <Button size="sm" @click="showCreate = !showCreate">
        <Plus class="mr-1.5 h-4 w-4" aria-hidden="true" />
        Tambah Customer
      </Button>
    </div>

    <div
      v-if="error"
      class="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
      role="alert"
    >
      <span>{{ error }}</span>
      <button type="button" class="shrink-0 opacity-60 hover:opacity-100" aria-label="Tutup pesan" @click="error = null">
        <X class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
    <div
      v-if="success"
      class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
      role="status"
    >
      {{ success }}
    </div>

    <Card v-if="showCreate">
      <CardHeader>
        <div class="text-sm font-medium">Tambah customer baru</div>
        <p class="text-xs text-muted-foreground">Nama harus unik agar tidak dobel saat dipakai di schedule.</p>
      </CardHeader>
      <CardContent>
        <div class="flex flex-col gap-3 md:flex-row md:items-end">
          <div class="flex-1">
            <label for="customer-name" class="text-xs font-medium text-muted-foreground">
              Nama Customer <span class="text-red-500">*</span>
            </label>
            <Input
              id="customer-name"
              v-model="form.name"
              type="text"
              placeholder="Contoh: PT Sumber Makmur"
              class="mt-1"
              @keyup.enter="handleSubmit"
            />
          </div>
          <div class="flex items-center gap-2">
            <Button size="sm" variant="ghost" @click="showCreate = false">Batal</Button>
            <Button size="sm" :disabled="submitting" @click="handleSubmit">
              {{ submitting ? 'Menyimpan...' : 'Simpan' }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card v-if="showImport">
      <CardHeader>
        <div class="text-sm font-medium">Import Excel (.xlsx)</div>
        <p class="text-xs text-muted-foreground">Header kolom: "Nama Customer"</p>
      </CardHeader>
      <CardContent>
        <div class="flex flex-col gap-3 md:flex-row md:items-end">
          <div class="flex-1">
            <label for="customer-import" class="text-xs font-medium text-muted-foreground">File Excel</label>
            <input
              id="customer-import"
              type="file"
              accept=".xlsx"
              class="mt-1 w-full rounded-xl border border-input/80 bg-card/75 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium"
              @change="(e) => (importFile = (e.target as HTMLInputElement).files?.[0] || null)"
            />
          </div>
          <div class="flex items-center gap-2">
            <Button size="sm" variant="ghost" @click="showImport = false">Tutup</Button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
              @click="handleDownloadTemplate"
            >
              <Download class="h-3.5 w-3.5" aria-hidden="true" />
              Template
            </button>
            <Button size="sm" :disabled="importing || !importFile" @click="handleImport">
              {{ importing ? 'Importing...' : 'Import' }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <MasterTable
      :columns="columns"
      :rows="customers"
      table-label="Daftar customer"
      :loading="loading"
      :filtered="isFiltering"
      empty-title="Belum ada customer"
      empty-description="Tambahkan customer pertama supaya bisa dipilih saat membuat schedule pengiriman."
      :sort-by="sortBy"
      :sort-dir="sortDir"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :total-pages="totalPages"
      unit="customer"
      @sort="toggleSort"
      @page="goToPage"
      @page-size="changePageSize"
    >
      <template #toolbar>
        <MasterSearch v-model="search" placeholder="Cari nama customer..." label="Cari customer" />
      </template>

      <template #filters>
        <span class="rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
          {{ total }} customer
        </span>
        <Button size="sm" variant="outline" @click="showImport = !showImport">
          <Upload class="mr-1.5 h-4 w-4" aria-hidden="true" />
          Import
        </Button>
        <Button size="sm" variant="outline" :disabled="exportLoading" @click="handleExport">
          <FileSpreadsheet class="mr-1.5 h-4 w-4" aria-hidden="true" />
          {{ exportLoading ? 'Exporting...' : 'Export Excel' }}
        </Button>
      </template>

      <template #cell="{ row, column }">
        <span v-if="column.key === 'name'" class="font-medium">{{ row.name }}</span>
        <span v-else-if="column.key === 'createdAt'" class="text-muted-foreground">
          {{ formatDateTimeId(row.createdAt) }}
        </span>
      </template>

      <template #actions="{ row }">
        <ActionMenu
          :items="[
            { key: 'edit', label: 'Edit', icon: 'edit' },
            { key: 'delete', label: 'Hapus', icon: 'delete', danger: true }
          ]"
          :label="`Aksi untuk ${row.name}`"
          @select="(key) => onRowAction(row, key)"
        />
      </template>
    </MasterTable>

    <div v-if="confirmOpen" class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="confirm-customer-title">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px]" @click="closeConfirm"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card shadow-xl">
        <div class="border-b p-4">
          <h3 id="confirm-customer-title" class="text-base font-semibold">Konfirmasi Hapus</h3>
        </div>
        <div class="p-4 text-sm">
          <p>Hapus customer <span class="font-semibold">{{ confirmCustomer?.name }}</span>?</p>
          <p class="mt-1 text-xs text-muted-foreground">Tindakan ini tidak bisa dibatalkan.</p>
        </div>
        <div class="flex items-center justify-end gap-2 border-t p-4">
          <Button variant="ghost" @click="closeConfirm">Batal</Button>
          <Button class="bg-red-600 text-white hover:bg-red-700" @click="confirmDelete">Ya, Hapus</Button>
        </div>
      </div>
    </div>

    <div v-if="editOpen" class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="edit-customer-title">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px]" @click="closeEdit"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card shadow-xl">
        <div class="border-b p-4">
          <h3 id="edit-customer-title" class="text-base font-semibold">Edit Customer</h3>
        </div>
        <div class="space-y-3 p-4 text-sm">
          <div>
            <label for="edit-customer-name" class="text-xs font-medium text-muted-foreground">Nama Customer</label>
            <Input id="edit-customer-name" v-model="editForm.name" type="text" class="mt-1" />
          </div>
          <p v-if="editError" class="text-xs text-red-600" role="alert">{{ editError }}</p>
        </div>
        <div class="flex items-center justify-end gap-2 border-t p-4">
          <Button variant="ghost" @click="closeEdit">Batal</Button>
          <Button :disabled="updating" @click="submitUpdate">
            {{ updating ? 'Updating...' : 'Update' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

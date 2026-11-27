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
import FilterChips from '@/components/master/FilterChips.vue'
import type { MasterColumn } from '@/components/master/types'
import {
  createEmployee,
  deleteEmployee,
  downloadEmployeeTemplate,
  exportEmployeeExcel,
  importEmployeeExcel,
  listEmployees,
  updateEmployee,
  type Employee,
  type EmployeePosition
} from '@/services/employeeApi'
import { formatDateTimeId } from '@/lib/datetime'
import { useDebouncedCallback, useTablePagination } from '@/composables/useTablePagination'

const employees = ref<Employee[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const submitting = ref(false)
const importing = ref(false)
const importFile = ref<File | null>(null)
const exportLoading = ref(false)
const search = ref('')
const positionFilter = ref<'' | EmployeePosition>('')
const confirmOpen = ref(false)
const confirmEmployee = ref<Employee | null>(null)
const editOpen = ref(false)
const editEmployee = ref<Employee | null>(null)
const editError = ref<string | null>(null)
const updating = ref(false)
const showCreate = ref(false)
const showImport = ref(false)

const sortBy = ref('name')
const sortDir = ref<'asc' | 'desc'>('asc')

const { page, pageSize, total, totalPages, applyMeta, resetPage } =
  useTablePagination({ key: 'master-employee' })

const positionOptions: Array<{ value: EmployeePosition; label: string }> = [
  { value: 'FOREMAN', label: 'Foreman' },
  { value: 'TALLYMAN', label: 'Tallyman' },
  { value: 'OPR_FORKLIFT', label: 'Opr Forklift' }
]

const form = reactive<{
  nik: string
  name: string
  position: EmployeePosition
}>({
  nik: '',
  name: '',
  position: 'FOREMAN'
})

const editForm = reactive<{
  nik: string
  name: string
  position: EmployeePosition
}>({
  nik: '',
  name: '',
  position: 'FOREMAN'
})

const getErrorMessage = (err: any, fallback: string) => {
  const details = err?.response?.data?.details
  if (Array.isArray(details) && details.length) {
    return `${err?.response?.data?.message || fallback}: ${details.join(', ')}`
  }
  return err?.response?.data?.message || err?.message || fallback
}

const getPositionLabel = (position: EmployeePosition) => {
  return positionOptions.find((item) => item.value === position)?.label || position
}

let successTimer: number | undefined
const showSuccess = (message: string) => {
  success.value = message
  if (successTimer) window.clearTimeout(successTimer)
  successTimer = window.setTimeout(() => {
    success.value = null
  }, 3000)
}

const fetchEmployees = async () => {
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
    if (positionFilter.value) params.position = positionFilter.value

    const response = await listEmployees(params as any)
    employees.value = response.data?.data || []
    applyMeta(response.data?.meta)

    if (employees.value.length === 0 && totalPages.value < page.value) {
      page.value = totalPages.value
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
  fetchEmployees()
}

const debouncedFetch = useDebouncedCallback(() => {
  reload()
}, 300)

watch(search, () => debouncedFetch.run())
watch(positionFilter, () => reload())

const goToPage = (value: number) => {
  if (value === page.value) return
  page.value = value
  fetchEmployees()
}

const changePageSize = (value: number) => {
  pageSize.value = value
  page.value = 1
  fetchEmployees()
}

const toggleSort = (field: string) => {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortDir.value = 'asc'
  }
  resetPage()
  fetchEmployees()
}

const columns: MasterColumn[] = [
  { key: 'nik', label: 'NIK', sortable: true, mono: true, mobile: true },
  { key: 'name', label: 'Nama', sortable: true, mobile: true, avatar: true, mobileTitle: true },
  { key: 'position', label: 'Jabatan', sortable: true, mobile: true },
  { key: 'createdAt', label: 'Dibuat', sortable: true, hideBelow: 'md', mobile: true }
]

const validateForm = (data: { nik: string; name: string; position: EmployeePosition }) => {
  if (!data.nik.trim()) return 'NIK wajib diisi'
  if (data.nik.trim().length > 10) return 'NIK maksimal 10 karakter'
  if (!data.name.trim()) return 'Nama wajib diisi'
  if (!data.position) return 'Jabatan wajib dipilih'
  return null
}

const handleSubmit = async () => {
  const validationError = validateForm(form)
  if (validationError) {
    error.value = validationError
    return
  }

  submitting.value = true
  error.value = null
  try {
    await createEmployee({
      nik: form.nik.trim(),
      name: form.name.trim(),
      position: form.position
    })
    form.nik = ''
    form.name = ''
    form.position = 'FOREMAN'
    showCreate.value = false
    resetPage()
    await fetchEmployees()
    showSuccess('Karyawan berhasil ditambahkan')
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal menambah karyawan')
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (id: string) => {
  try {
    await deleteEmployee(id)
    await fetchEmployees()
    showSuccess('Karyawan berhasil dihapus')
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal menghapus karyawan')
  }
}

const openConfirm = (item: Employee) => {
  confirmEmployee.value = item
  confirmOpen.value = true
}

const closeConfirm = () => {
  confirmOpen.value = false
  confirmEmployee.value = null
}

const confirmDelete = async () => {
  if (!confirmEmployee.value) return
  await handleDelete(confirmEmployee.value.id)
  closeConfirm()
}

const openEdit = (item: Employee) => {
  editEmployee.value = item
  editForm.nik = item.nik
  editForm.name = item.name
  editForm.position = item.position
  editError.value = null
  editOpen.value = true
}

const closeEdit = () => {
  editOpen.value = false
  editEmployee.value = null
  editForm.nik = ''
  editForm.name = ''
  editForm.position = 'FOREMAN'
  editError.value = null
}

const submitUpdate = async () => {
  if (!editEmployee.value) return

  const validationError = validateForm(editForm)
  if (validationError) {
    editError.value = validationError
    return
  }

  updating.value = true
  editError.value = null
  try {
    await updateEmployee(editEmployee.value.id, {
      nik: editForm.nik.trim(),
      name: editForm.name.trim(),
      position: editForm.position
    })
    await fetchEmployees()
    closeEdit()
    showSuccess('Karyawan berhasil diperbarui')
  } catch (err: any) {
    editError.value = getErrorMessage(err, 'Gagal update karyawan')
  } finally {
    updating.value = false
  }
}

const onRowAction = (item: Employee, key: string) => {
  if (key === 'edit') openEdit(item)
  if (key === 'delete') openConfirm(item)
}

const handleImport = async () => {
  if (!importFile.value) {
    error.value = 'File Excel wajib dipilih'
    return
  }

  importing.value = true
  error.value = null
  try {
    await importEmployeeExcel(importFile.value)
    importFile.value = null
    showImport.value = false
    resetPage()
    await fetchEmployees()
    showSuccess('Import karyawan selesai')
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal import karyawan')
  } finally {
    importing.value = false
  }
}

const handleDownloadTemplate = async () => {
  try {
    const response = await downloadEmployeeTemplate()
    const blob = new Blob([response.data], { type: response.headers['content-type'] })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'employee-import-template.xlsx'
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
    const response = await exportEmployeeExcel()
    const blob = new Blob([response.data], { type: response.headers['content-type'] })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    link.download = `master-karyawan_${yyyy}-${mm}-${dd}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal export karyawan')
  } finally {
    exportLoading.value = false
  }
}

const positionTone = (position: EmployeePosition) => {
  if (position === 'FOREMAN') return 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300'
  if (position === 'TALLYMAN') return 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300'
  return 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300'
}

const isFiltering = computed(() => search.value.trim().length > 0 || positionFilter.value !== '')

onMounted(fetchEmployees)
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Master Karyawan</h1>
        <p class="text-sm text-muted-foreground">Data foreman, tallyman, dan operator forklift.</p>
      </div>
      <Button size="sm" @click="showCreate = !showCreate">
        <Plus class="mr-1.5 h-4 w-4" aria-hidden="true" />
        Tambah Karyawan
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
        <div class="text-sm font-medium">Tambah karyawan baru</div>
        <p class="text-xs text-muted-foreground">NIK dipakai sebagai identitas unik karyawan.</p>
      </CardHeader>
      <CardContent>
        <div class="grid gap-3 md:grid-cols-4 md:items-end">
          <div>
            <label for="employee-nik" class="text-xs font-medium text-muted-foreground">
              NIK <span class="text-red-500">*</span>
            </label>
            <Input id="employee-nik" v-model="form.nik" type="text" class="mt-1" placeholder="Maks 10 karakter" />
          </div>
          <div>
            <label for="employee-name" class="text-xs font-medium text-muted-foreground">
              Nama <span class="text-red-500">*</span>
            </label>
            <Input id="employee-name" v-model="form.name" type="text" class="mt-1" />
          </div>
          <div>
            <label for="employee-position" class="text-xs font-medium text-muted-foreground">
              Jabatan <span class="text-red-500">*</span>
            </label>
            <select
              id="employee-position"
              v-model="form.position"
              class="mt-1 flex h-11 w-full rounded-xl border border-input/80 bg-card/75 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option v-for="opt in positionOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
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
        <p class="text-xs text-muted-foreground">Header kolom: NIK, Nama, Jabatan</p>
      </CardHeader>
      <CardContent>
        <div class="flex flex-col gap-3 md:flex-row md:items-end">
          <div class="flex-1">
            <label for="employee-import" class="text-xs font-medium text-muted-foreground">File Excel</label>
            <input
              id="employee-import"
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
      :rows="employees"
      table-label="Daftar karyawan"
      :loading="loading"
      :filtered="isFiltering"
      empty-title="Belum ada karyawan"
      empty-description="Tambahkan karyawan supaya bisa dipilih pada transaksi pekerjaan."
      :sort-by="sortBy"
      :sort-dir="sortDir"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :total-pages="totalPages"
      unit="karyawan"
      @sort="toggleSort"
      @page="goToPage"
      @page-size="changePageSize"
    >
      <template #toolbar>
        <MasterSearch v-model="search" placeholder="Cari NIK atau nama..." label="Cari karyawan" />
      </template>

      <template #filters>
        <FilterChips
          :model-value="positionFilter"
          :options="positionOptions"
          aria-label="Filter jabatan"
          @update:model-value="(value) => (positionFilter = value as typeof positionFilter)"
        />
        <span class="rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
          {{ total }} karyawan
        </span>
        <Button size="sm" variant="outline" @click="showImport = !showImport">
          <Upload class="mr-1.5 h-4 w-4" aria-hidden="true" />
          Import
        </Button>
        <Button size="sm" variant="outline" :disabled="exportLoading" @click="handleExport">
          <FileSpreadsheet class="mr-1.5 h-4 w-4" aria-hidden="true" />
          {{ exportLoading ? 'Exporting...' : 'Export' }}
        </Button>
      </template>

      <template #cell="{ row, column }">
        <span v-if="column.key === 'nik'" class="font-mono text-xs tabular-nums">{{ row.nik }}</span>
        <span v-else-if="column.key === 'name'" class="font-medium">{{ row.name }}</span>
        <span
          v-else-if="column.key === 'position'"
          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
          :class="positionTone(row.position)"
        >
          {{ getPositionLabel(row.position) }}
        </span>
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

    <div v-if="confirmOpen" class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="confirm-employee-title">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px]" @click="closeConfirm"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card shadow-xl">
        <div class="border-b p-4">
          <h3 id="confirm-employee-title" class="text-base font-semibold">Konfirmasi Hapus</h3>
        </div>
        <div class="p-4 text-sm">
          <p>Hapus karyawan <span class="font-semibold">{{ confirmEmployee?.name }}</span>?</p>
          <p class="mt-1 text-xs text-muted-foreground">Tindakan ini tidak bisa dibatalkan.</p>
        </div>
        <div class="flex items-center justify-end gap-2 border-t p-4">
          <Button variant="ghost" @click="closeConfirm">Batal</Button>
          <Button class="bg-red-600 text-white hover:bg-red-700" @click="confirmDelete">Ya, Hapus</Button>
        </div>
      </div>
    </div>

    <div v-if="editOpen" class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="edit-employee-title">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px]" @click="closeEdit"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card shadow-xl">
        <div class="border-b p-4">
          <h3 id="edit-employee-title" class="text-base font-semibold">Edit Karyawan</h3>
        </div>
        <div class="space-y-3 p-4 text-sm">
          <div>
            <label for="edit-employee-nik" class="text-xs font-medium text-muted-foreground">NIK</label>
            <Input id="edit-employee-nik" v-model="editForm.nik" type="text" class="mt-1" />
          </div>
          <div>
            <label for="edit-employee-name" class="text-xs font-medium text-muted-foreground">Nama</label>
            <Input id="edit-employee-name" v-model="editForm.name" type="text" class="mt-1" />
          </div>
          <div>
            <label for="edit-employee-position" class="text-xs font-medium text-muted-foreground">Jabatan</label>
            <select
              id="edit-employee-position"
              v-model="editForm.position"
              class="mt-1 flex h-11 w-full rounded-xl border border-input/80 bg-card/75 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option v-for="opt in positionOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
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

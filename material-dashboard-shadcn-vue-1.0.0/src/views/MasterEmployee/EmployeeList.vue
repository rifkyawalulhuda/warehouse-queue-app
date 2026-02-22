<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
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

const employees = ref<Employee[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const submitting = ref(false)
const importing = ref(false)
const importFile = ref<File | null>(null)
const exportLoading = ref(false)
const search = ref('')
const confirmOpen = ref(false)
const confirmEmployee = ref<Employee | null>(null)
const editOpen = ref(false)
const editEmployee = ref<Employee | null>(null)
const editError = ref<string | null>(null)
const updating = ref(false)

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

const fetchEmployees = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await listEmployees()
    employees.value = response.data?.data || []
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Terjadi kesalahan')
  } finally {
    loading.value = false
  }
}

const filteredEmployees = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return employees.value
  return employees.value.filter((item) => {
    const positionLabel = getPositionLabel(item.position).toLowerCase()
    return (
      item.nik.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      positionLabel.includes(q)
    )
  })
})

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
    await fetchEmployees()
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
  } catch (err: any) {
    editError.value = getErrorMessage(err, 'Gagal update karyawan')
  } finally {
    updating.value = false
  }
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
    await fetchEmployees()
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
    link.download = 'master-karyawan-template.xlsx'
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

onMounted(() => {
  fetchEmployees()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold tracking-tight">Master Karyawan</h1>
      <p class="text-muted-foreground">Kelola daftar karyawan</p>
    </div>

    <Card>
      <CardHeader>
        <div class="text-sm text-muted-foreground">Tambah karyawan baru</div>
      </CardHeader>
      <CardContent>
        <div v-if="error" class="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ error }}
        </div>
        <div class="grid gap-3 md:grid-cols-4 md:items-end">
          <div>
            <label class="text-sm text-muted-foreground">NIK</label>
            <input
              v-model="form.nik"
              type="text"
              maxlength="10"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
            />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Nama</label>
            <input
              v-model="form.name"
              type="text"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
            />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Jabatan</label>
            <select v-model="form.position" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm">
              <option v-for="opt in positionOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="flex items-center justify-end md:justify-start">
            <Button size="sm" :disabled="submitting" @click="handleSubmit">
              {{ submitting ? 'Menyimpan...' : 'Simpan' }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <div class="text-sm text-muted-foreground">Import Excel (.xlsx)</div>
      </CardHeader>
      <CardContent>
        <div class="flex flex-col gap-3 md:flex-row md:items-end">
          <div class="flex-1">
            <label class="text-sm text-muted-foreground">File Excel</label>
            <input
              type="file"
              accept=".xlsx"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
              @change="(e) => (importFile = (e.target as HTMLInputElement).files?.[0] || null)"
            />
            <p class="mt-1 text-xs text-muted-foreground">Header kolom: NIK, Nama, Jabatan</p>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="text-sm text-primary underline-offset-4 hover:underline" @click="handleDownloadTemplate">
              Download Template
            </button>
            <Button size="sm" :disabled="importing" @click="handleImport">
              {{ importing ? 'Importing...' : 'Import' }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div class="text-sm text-muted-foreground">Daftar karyawan</div>
          <div class="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <input
              v-model="search"
              type="text"
              placeholder="Cari karyawan..."
              class="w-full md:w-64 bg-transparent border rounded-md px-2 py-2 text-sm"
            />
            <Button size="sm" variant="outline" :disabled="exportLoading" @click="handleExport">
              {{ exportLoading ? 'Exporting...' : 'Export Excel' }}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div class="overflow-x-auto border rounded-lg">
          <table class="min-w-full text-sm">
            <thead class="bg-muted/60 text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left font-medium">No</th>
                <th class="px-3 py-2 text-left font-medium">NIK</th>
                <th class="px-3 py-2 text-left font-medium">Nama</th>
                <th class="px-3 py-2 text-left font-medium">Jabatan</th>
                <th class="px-3 py-2 text-left font-medium">Created At</th>
                <th class="px-3 py-2 text-left font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="px-3 py-6 text-center text-muted-foreground">Loading...</td>
              </tr>
              <tr v-else-if="filteredEmployees.length === 0">
                <td colspan="6" class="px-3 py-6 text-center text-muted-foreground">Data kosong.</td>
              </tr>
              <tr v-for="(item, index) in filteredEmployees" :key="item.id" class="border-t">
                <td class="px-3 py-2">{{ index + 1 }}</td>
                <td class="px-3 py-2">{{ item.nik }}</td>
                <td class="px-3 py-2">{{ item.name }}</td>
                <td class="px-3 py-2">{{ getPositionLabel(item.position) }}</td>
                <td class="px-3 py-2">{{ new Date(item.createdAt).toLocaleString() }}</td>
                <td class="px-3 py-2">
                  <div class="flex items-center gap-2">
                    <Button size="sm" variant="outline" @click="openEdit(item)">Edit</Button>
                    <Button size="sm" variant="outline" @click="openConfirm(item)">Hapus</Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <div v-if="confirmOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeConfirm"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Konfirmasi Hapus</h3>
        </div>
        <div class="p-4 text-sm">
          <p>
            Hapus karyawan <span class="font-semibold">{{ confirmEmployee?.name }}</span>?
          </p>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeConfirm">Batal</Button>
          <Button @click="confirmDelete">Ya, Hapus</Button>
        </div>
      </div>
    </div>

    <div v-if="editOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeEdit"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Edit Karyawan</h3>
        </div>
        <div class="p-4 space-y-3 text-sm">
          <div>
            <label class="text-sm text-muted-foreground">NIK</label>
            <input v-model="editForm.nik" type="text" maxlength="10" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Nama</label>
            <input v-model="editForm.name" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Jabatan</label>
            <select v-model="editForm.position" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm">
              <option v-for="opt in positionOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <p v-if="editError" class="text-xs text-red-600">{{ editError }}</p>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeEdit">Batal</Button>
          <Button :disabled="updating" @click="submitUpdate">
            {{ updating ? 'Updating...' : 'Update' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

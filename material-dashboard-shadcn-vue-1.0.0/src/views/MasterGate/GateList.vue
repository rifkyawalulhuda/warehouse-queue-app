<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import { useAuth } from '@/composables/useAuth'
import {
  createGate,
  deleteGate,
  listGates,
  updateGate,
  downloadGateTemplate,
  importGateExcel,
  exportGateExcel,
  type Gate
} from '@/services/gateApi'

const { user } = useAuth()
const isAdmin = computed(() => user.value?.role === 'ADMIN')

const gates = ref<Gate[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const submitting = ref(false)
const importing = ref(false)
const exportLoading = ref(false)
const importFile = ref<File | null>(null)
const search = ref('')
const confirmOpen = ref(false)
const confirmGate = ref<Gate | null>(null)
const editOpen = ref(false)
const editGate = ref<Gate | null>(null)
const editError = ref<string | null>(null)
const updating = ref(false)

type ImportError = {
  rowNumber: number
  gateNo?: string
  warehouse?: string
  message: string
}

type ImportSummary = {
  totalRows: number
  successRows: number
  failedRows: number
  errors: ImportError[]
}

const importSummary = ref<ImportSummary | null>(null)

const form = reactive({
  gateNo: '',
  area: '',
  warehouse: 'WH1'
})

const editForm = reactive({
  gateNo: '',
  area: '',
  warehouse: 'WH1'
})

const warehouseOptions: Array<Gate['warehouse']> = ['WH1', 'WH2', 'DG']

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

const fetchGates = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await listGates({ sortBy: 'createdAt', sortDir: 'desc' })
    gates.value = response.data?.data || []
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Terjadi kesalahan')
  } finally {
    loading.value = false
  }
}

const filteredGates = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return gates.value
  return gates.value.filter(
    (g) => g.gateNo.toLowerCase().includes(q) || g.area.toLowerCase().includes(q)
  )
})

const handleSubmit = async () => {
  if (!isAdmin.value) return
  if (!form.gateNo.trim()) {
    error.value = 'Gate No wajib diisi'
    return
  }
  if (!form.area.trim()) {
    error.value = 'Area wajib diisi'
    return
  }
  if (!form.warehouse) {
    error.value = 'Warehouse wajib dipilih'
    return
  }
  submitting.value = true
  error.value = null
  try {
    await createGate({
      gateNo: form.gateNo.trim(),
      area: form.area.trim(),
      warehouse: form.warehouse
    })
    form.gateNo = ''
    form.area = ''
    form.warehouse = 'WH1'
    await fetchGates()
    showSuccess('Gate berhasil ditambahkan')
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal menambah gate')
  } finally {
    submitting.value = false
  }
}

const handleDownloadTemplate = async () => {
  if (!isAdmin.value) return
  try {
    const response = await downloadGateTemplate()
    const blob = new Blob([response.data], { type: response.headers['content-type'] })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'master-gate-template.xlsx'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal download template')
  }
}

const handleImport = async () => {
  if (!isAdmin.value || !importFile.value) return
  importing.value = true
  error.value = null
  importSummary.value = null
  try {
    const response = await importGateExcel(importFile.value)
    importSummary.value = response.data?.data || null
    importFile.value = null
    await fetchGates()
    showSuccess('Import gate selesai')
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal import gate')
  } finally {
    importing.value = false
  }
}

const handleExport = async () => {
  if (!isAdmin.value) return
  exportLoading.value = true
  error.value = null
  try {
    const response = await exportGateExcel()
    const blob = new Blob([response.data], { type: response.headers['content-type'] })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    link.download = `master-gate_${yyyy}-${mm}-${dd}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal export gate')
  } finally {
    exportLoading.value = false
  }
}

const handleDelete = async (id: string) => {
  try {
    await deleteGate(id)
    await fetchGates()
    showSuccess('Gate berhasil dihapus')
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal menghapus gate')
  }
}

const openConfirm = (gate: Gate) => {
  if (!isAdmin.value) return
  confirmGate.value = gate
  confirmOpen.value = true
}

const closeConfirm = () => {
  confirmOpen.value = false
  confirmGate.value = null
}

const confirmDelete = async () => {
  if (!confirmGate.value) return
  await handleDelete(confirmGate.value.id)
  closeConfirm()
}

const openEdit = (gate: Gate) => {
  if (!isAdmin.value) return
  editGate.value = gate
  editForm.gateNo = gate.gateNo
  editForm.area = gate.area
  editForm.warehouse = gate.warehouse
  editError.value = null
  editOpen.value = true
}

const closeEdit = () => {
  editOpen.value = false
  editGate.value = null
  editForm.gateNo = ''
  editForm.area = ''
  editForm.warehouse = 'WH1'
  editError.value = null
}

const submitUpdate = async () => {
  if (!isAdmin.value) return
  if (!editForm.gateNo.trim()) {
    editError.value = 'Gate No wajib diisi'
    return
  }
  if (!editForm.area.trim()) {
    editError.value = 'Area wajib diisi'
    return
  }
  if (!editForm.warehouse) {
    editError.value = 'Warehouse wajib dipilih'
    return
  }
  if (!editGate.value) return
  updating.value = true
  editError.value = null
  try {
    await updateGate(editGate.value.id, {
      gateNo: editForm.gateNo.trim(),
      area: editForm.area.trim(),
      warehouse: editForm.warehouse
    })
    await fetchGates()
    closeEdit()
    showSuccess('Gate berhasil diperbarui')
  } catch (err: any) {
    editError.value = getErrorMessage(err, 'Gagal update gate')
  } finally {
    updating.value = false
  }
}

onMounted(() => {
  fetchGates()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold tracking-tight">Master Gate</h1>
      <p class="text-muted-foreground">Kelola daftar gate</p>
    </div>

    <Card>
      <CardHeader>
        <div class="text-sm text-muted-foreground">Tambah gate baru</div>
      </CardHeader>
      <CardContent>
        <div v-if="error" class="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ error }}
        </div>
        <div v-if="success" class="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {{ success }}
        </div>
        <div class="grid gap-3 md:grid-cols-4 md:items-end">
          <div>
            <label class="text-sm text-muted-foreground">Gate No</label>
            <input
              v-model="form.gateNo"
              type="text"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
              :disabled="!isAdmin"
            />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Area</label>
            <input
              v-model="form.area"
              type="text"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
              :disabled="!isAdmin"
            />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Warehouse</label>
            <select
              v-model="form.warehouse"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
              :disabled="!isAdmin"
            >
              <option v-for="opt in warehouseOptions" :key="opt" :value="opt">
                {{ opt }}
              </option>
            </select>
          </div>
          <div class="flex items-center justify-end md:justify-start">
            <Button size="sm" :disabled="submitting || !isAdmin" @click="handleSubmit">
              {{ submitting ? 'Menyimpan...' : 'Simpan' }}
            </Button>
          </div>
        </div>
        <p v-if="!isAdmin" class="mt-2 text-xs text-muted-foreground">Role warehouse hanya bisa melihat data.</p>
      </CardContent>
    </Card>

    <Card v-if="isAdmin">
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
            <p class="mt-1 text-xs text-muted-foreground">Header kolom: Gate No, Area, Warehouse</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="text-sm text-primary underline-offset-4 hover:underline"
              @click="handleDownloadTemplate"
            >
              Download Template
            </button>
            <Button size="sm" :disabled="importing || !importFile" @click="handleImport">
              {{ importing ? 'Importing...' : 'Import' }}
            </Button>
          </div>
        </div>

        <div v-if="importSummary" class="mt-4 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <div class="flex flex-wrap gap-4">
            <div>Total: {{ importSummary.totalRows }}</div>
            <div>Success: {{ importSummary.successRows }}</div>
            <div>Failed: {{ importSummary.failedRows }}</div>
          </div>
        </div>

        <div v-if="importSummary?.errors?.length" class="mt-4">
          <div class="text-sm font-medium">Detail Error</div>
          <div class="mt-2 overflow-x-auto border rounded-lg">
            <table class="min-w-full text-sm">
              <thead class="bg-muted/60 text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">Row</th>
                  <th class="px-3 py-2 text-left font-medium">Gate No</th>
                  <th class="px-3 py-2 text-left font-medium">Warehouse</th>
                  <th class="px-3 py-2 text-left font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(errItem, idx) in importSummary.errors" :key="`${errItem.rowNumber}-${idx}`" class="border-t">
                  <td class="px-3 py-2">{{ errItem.rowNumber }}</td>
                  <td class="px-3 py-2">{{ errItem.gateNo || '-' }}</td>
                  <td class="px-3 py-2">{{ errItem.warehouse || '-' }}</td>
                  <td class="px-3 py-2">{{ errItem.message }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="text-sm text-muted-foreground">Daftar gate</div>
          <div class="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <input
              v-model="search"
              type="text"
              placeholder="Cari gate..."
              class="w-full md:w-64 bg-transparent border rounded-md px-2 py-2 text-sm"
            />
            <Button v-if="isAdmin" size="sm" variant="outline" :disabled="exportLoading" @click="handleExport">
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
                <th class="px-3 py-2 text-left font-medium">Gate No</th>
                <th class="px-3 py-2 text-left font-medium">Area</th>
                <th class="px-3 py-2 text-left font-medium">Warehouse</th>
                <th class="px-3 py-2 text-left font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="5" class="px-3 py-6 text-center text-muted-foreground">Loading...</td>
              </tr>
              <tr v-else-if="filteredGates.length === 0">
                <td colspan="5" class="px-3 py-6 text-center text-muted-foreground">Data kosong.</td>
              </tr>
              <tr v-for="(gate, index) in filteredGates" :key="gate.id" class="border-t">
                <td class="px-3 py-2">{{ index + 1 }}</td>
                <td class="px-3 py-2">{{ gate.gateNo }}</td>
                <td class="px-3 py-2">{{ gate.area }}</td>
                <td class="px-3 py-2">
                  <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
                    {{ gate.warehouse }}
                  </span>
                </td>
                <td class="px-3 py-2">
                  <div class="flex items-center gap-2">
                    <template v-if="isAdmin">
                      <Button size="sm" variant="outline" @click="openEdit(gate)">Edit</Button>
                      <Button size="sm" variant="outline" @click="openConfirm(gate)">Hapus</Button>
                    </template>
                    <span v-else class="text-xs text-muted-foreground">-</span>
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
            Hapus gate <span class="font-semibold">{{ confirmGate?.gateNo }}</span>?
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
          <h3 class="text-lg font-semibold">Edit Gate</h3>
        </div>
        <div class="p-4 space-y-3 text-sm">
          <div>
            <label class="text-sm text-muted-foreground">Gate No</label>
            <input v-model="editForm.gateNo" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Area</label>
            <input v-model="editForm.area" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Warehouse</label>
            <select v-model="editForm.warehouse" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm">
              <option v-for="opt in warehouseOptions" :key="opt" :value="opt">
                {{ opt }}
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

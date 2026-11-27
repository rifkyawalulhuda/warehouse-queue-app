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
import { useDebouncedCallback, useTablePagination } from '@/composables/useTablePagination'

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
const warehouseFilter = ref<'' | Gate['warehouse']>('')
const confirmOpen = ref(false)
const confirmGate = ref<Gate | null>(null)
const editOpen = ref(false)
const editGate = ref<Gate | null>(null)
const editError = ref<string | null>(null)
const updating = ref(false)
const showCreate = ref(false)
const showImport = ref(false)

const sortBy = ref('createdAt')
const sortDir = ref<'asc' | 'desc'>('desc')

const { page, pageSize, total, totalPages, applyMeta, resetPage } =
  useTablePagination({ key: 'master-gate' })

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

const form = reactive<{
  gateNo: string
  area: string
  warehouse: Gate['warehouse']
}>({
  gateNo: '',
  area: '',
  warehouse: 'WH1'
})

const editForm = reactive<{
  gateNo: string
  area: string
  warehouse: Gate['warehouse']
}>({
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
    const params: Record<string, string | number> = {
      page: page.value,
      pageSize: pageSize.value,
      sortBy: sortBy.value,
      sortDir: sortDir.value
    }
    if (search.value.trim()) params.search = search.value.trim()
    if (warehouseFilter.value) params.warehouse = warehouseFilter.value

    const response = await listGates(params as any)
    gates.value = response.data?.data || []
    applyMeta(response.data?.meta)

    if (gates.value.length === 0 && totalPages.value < page.value) {
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
  fetchGates()
}

const debouncedFetch = useDebouncedCallback(() => {
  reload()
}, 300)

watch(search, () => debouncedFetch.run())
watch(warehouseFilter, () => reload())

const goToPage = (value: number) => {
  if (value === page.value) return
  page.value = value
  fetchGates()
}

const changePageSize = (value: number) => {
  pageSize.value = value
  page.value = 1
  fetchGates()
}

const toggleSort = (field: string) => {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortDir.value = 'asc'
  }
  resetPage()
  fetchGates()
}

const columns: MasterColumn[] = [
  { key: 'gateNo', label: 'Gate No', sortable: true, mobile: true, mobileTitle: true },
  { key: 'area', label: 'Area', sortable: true, mobile: true },
  { key: 'warehouse', label: 'Warehouse', sortable: true, mobile: true }
]

const warehouseChips = computed(() =>
  warehouseOptions.map((value) => ({ value, label: value }))
)

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
    showCreate.value = false
    resetPage()
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
    resetPage()
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

const onRowAction = (gate: Gate, key: string) => {
  if (key === 'edit') openEdit(gate)
  if (key === 'delete') openConfirm(gate)
}

const warehouseTone = (warehouse: Gate['warehouse']) => {
  if (warehouse === 'WH1') return 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300'
  if (warehouse === 'WH2') return 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300'
  return 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300'
}

const isFiltering = computed(() => search.value.trim().length > 0 || warehouseFilter.value !== '')

onMounted(fetchGates)
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Master Gate</h1>
        <p class="text-sm text-muted-foreground">Gate per warehouse yang dipakai saat pencatatan antrian.</p>
      </div>
      <Button v-if="isAdmin" size="sm" @click="showCreate = !showCreate">
        <Plus class="mr-1.5 h-4 w-4" aria-hidden="true" />
        Tambah Gate
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

    <Card v-if="showCreate && isAdmin">
      <CardHeader>
        <div class="text-sm font-medium">Tambah gate baru</div>
        <p class="text-xs text-muted-foreground">Kombinasi Gate No + Warehouse harus unik.</p>
      </CardHeader>
      <CardContent>
        <div class="grid gap-3 md:grid-cols-4 md:items-end">
          <div>
            <label for="gate-no" class="text-xs font-medium text-muted-foreground">
              Gate No <span class="text-red-500">*</span>
            </label>
            <Input id="gate-no" v-model="form.gateNo" type="text" class="mt-1" placeholder="G1" />
          </div>
          <div>
            <label for="gate-area" class="text-xs font-medium text-muted-foreground">
              Area <span class="text-red-500">*</span>
            </label>
            <Input id="gate-area" v-model="form.area" type="text" class="mt-1" placeholder="Area A" />
          </div>
          <div>
            <label for="gate-warehouse" class="text-xs font-medium text-muted-foreground">
              Warehouse <span class="text-red-500">*</span>
            </label>
            <select
              id="gate-warehouse"
              v-model="form.warehouse"
              class="mt-1 flex h-11 w-full rounded-xl border border-input/80 bg-card/75 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option v-for="opt in warehouseOptions" :key="opt" :value="opt">{{ opt }}</option>
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

    <Card v-if="showImport && isAdmin">
      <CardHeader>
        <div class="text-sm font-medium">Import Excel (.xlsx)</div>
        <p class="text-xs text-muted-foreground">Header kolom: Gate No, Area, Warehouse</p>
      </CardHeader>
      <CardContent>
        <div class="flex flex-col gap-3 md:flex-row md:items-end">
          <div class="flex-1">
            <label for="gate-import" class="text-xs font-medium text-muted-foreground">File Excel</label>
            <input
              id="gate-import"
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

        <div v-if="importSummary" class="mt-4 grid gap-2 sm:grid-cols-3">
          <div class="rounded-xl border bg-muted/40 px-3 py-2">
            <div class="text-xs text-muted-foreground">Total baris</div>
            <div class="text-lg font-semibold tabular-nums">{{ importSummary.totalRows }}</div>
          </div>
          <div class="rounded-xl border bg-emerald-50/60 px-3 py-2 dark:bg-emerald-500/10">
            <div class="text-xs text-muted-foreground">Berhasil</div>
            <div class="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              {{ importSummary.successRows }}
            </div>
          </div>
          <div class="rounded-xl border bg-red-50/60 px-3 py-2 dark:bg-red-500/10">
            <div class="text-xs text-muted-foreground">Gagal</div>
            <div class="text-lg font-semibold tabular-nums text-red-700 dark:text-red-300">
              {{ importSummary.failedRows }}
            </div>
          </div>
        </div>

        <div v-if="importSummary?.errors?.length" class="mt-4">
          <div class="text-sm font-medium">Detail Error</div>
          <div class="mt-2 max-h-64 overflow-auto rounded-xl border">
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 bg-muted/70 text-muted-foreground backdrop-blur">
                <tr>
                  <th scope="col" class="px-3 py-2 text-left font-medium">Row</th>
                  <th scope="col" class="px-3 py-2 text-left font-medium">Gate No</th>
                  <th scope="col" class="px-3 py-2 text-left font-medium">Warehouse</th>
                  <th scope="col" class="px-3 py-2 text-left font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(errItem, idx) in importSummary.errors"
                  :key="`${errItem.rowNumber}-${idx}`"
                  class="border-t border-border/50"
                >
                  <td class="px-3 py-2 tabular-nums">{{ errItem.rowNumber }}</td>
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

    <MasterTable
      :columns="columns"
      :rows="gates"
      table-label="Daftar gate"
      :loading="loading"
      :filtered="isFiltering"
      empty-title="Belum ada gate"
      empty-description="Tambahkan gate supaya truk bisa dicatat per titik bongkar/muat."
      :sort-by="sortBy"
      :sort-dir="sortDir"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :total-pages="totalPages"
      unit="gate"
      @sort="toggleSort"
      @page="goToPage"
      @page-size="changePageSize"
    >
      <template #toolbar>
        <MasterSearch v-model="search" placeholder="Cari gate atau area..." label="Cari gate" />
      </template>

      <template #filters>
        <FilterChips
          :model-value="warehouseFilter"
          :options="warehouseChips"
          aria-label="Filter warehouse"
          @update:model-value="(value) => (warehouseFilter = value as typeof warehouseFilter)"
        />
        <span class="rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
          {{ total }} gate
        </span>
        <template v-if="isAdmin">
          <Button size="sm" variant="outline" @click="showImport = !showImport">
            <Upload class="mr-1.5 h-4 w-4" aria-hidden="true" />
            Import
          </Button>
          <Button size="sm" variant="outline" :disabled="exportLoading" @click="handleExport">
            <FileSpreadsheet class="mr-1.5 h-4 w-4" aria-hidden="true" />
            {{ exportLoading ? 'Exporting...' : 'Export' }}
          </Button>
        </template>
      </template>

      <template #cell="{ row, column }">
        <span v-if="column.key === 'gateNo'" class="font-semibold tabular-nums">{{ row.gateNo }}</span>
        <span v-else-if="column.key === 'area'">{{ row.area }}</span>
        <span
          v-else-if="column.key === 'warehouse'"
          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
          :class="warehouseTone(row.warehouse)"
        >
          {{ row.warehouse }}
        </span>
      </template>

      <template #actions="{ row }">
        <ActionMenu
          v-if="isAdmin"
          :items="[
            { key: 'edit', label: 'Edit', icon: 'edit' },
            { key: 'delete', label: 'Hapus', icon: 'delete', danger: true }
          ]"
          :label="`Aksi untuk gate ${row.gateNo}`"
          @select="(key) => onRowAction(row, key)"
        />
        <span v-else class="text-xs text-muted-foreground">—</span>
      </template>
    </MasterTable>

    <div v-if="confirmOpen" class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="confirm-gate-title">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px]" @click="closeConfirm"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card shadow-xl">
        <div class="border-b p-4">
          <h3 id="confirm-gate-title" class="text-base font-semibold">Konfirmasi Hapus</h3>
        </div>
        <div class="p-4 text-sm">
          <p>Hapus gate <span class="font-semibold">{{ confirmGate?.gateNo }}</span>?</p>
          <p class="mt-1 text-xs text-muted-foreground">Tindakan ini tidak bisa dibatalkan.</p>
        </div>
        <div class="flex items-center justify-end gap-2 border-t p-4">
          <Button variant="ghost" @click="closeConfirm">Batal</Button>
          <Button class="bg-red-600 text-white hover:bg-red-700" @click="confirmDelete">Ya, Hapus</Button>
        </div>
      </div>
    </div>

    <div v-if="editOpen" class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="edit-gate-title">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px]" @click="closeEdit"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card shadow-xl">
        <div class="border-b p-4">
          <h3 id="edit-gate-title" class="text-base font-semibold">Edit Gate</h3>
        </div>
        <div class="space-y-3 p-4 text-sm">
          <div>
            <label for="edit-gate-no" class="text-xs font-medium text-muted-foreground">Gate No</label>
            <Input id="edit-gate-no" v-model="editForm.gateNo" type="text" class="mt-1" />
          </div>
          <div>
            <label for="edit-gate-area" class="text-xs font-medium text-muted-foreground">Area</label>
            <Input id="edit-gate-area" v-model="editForm.area" type="text" class="mt-1" />
          </div>
          <div>
            <label for="edit-gate-warehouse" class="text-xs font-medium text-muted-foreground">Warehouse</label>
            <select
              id="edit-gate-warehouse"
              v-model="editForm.warehouse"
              class="mt-1 flex h-11 w-full rounded-xl border border-input/80 bg-card/75 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option v-for="opt in warehouseOptions" :key="opt" :value="opt">{{ opt }}</option>
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

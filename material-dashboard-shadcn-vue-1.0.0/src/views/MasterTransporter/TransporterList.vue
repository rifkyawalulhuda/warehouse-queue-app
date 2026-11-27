<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Plus, Upload, Download, X } from 'lucide-vue-next'
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
  getTransporters,
  createTransporter,
  importTransporterExcel,
  downloadTransporterTemplate,
  type Transporter
} from '@/services/scheduleApi'
import api from '@/services/api'
import { formatDateTimeId } from '@/lib/datetime'
import { useDebouncedCallback, useTablePagination } from '@/composables/useTablePagination'

const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const search = ref('')
const statusFilter = ref<'' | 'active' | 'inactive'>('')
const rows = ref<Transporter[]>([])
const newName = ref('')
const showCreate = ref(false)
const confirmOpen = ref(false)
const confirmRow = ref<Transporter | null>(null)

const showImport = ref(false)
const importing = ref(false)
const importFile = ref<File | null>(null)
const importResult = ref<{ created: number; skipped: number; total: number } | null>(null)
const importErrors = ref<string[]>([])

const sortBy = ref('name')
const sortDir = ref<'asc' | 'desc'>('asc')

const { page, pageSize, total, totalPages, applyMeta, resetPage } =
  useTablePagination({ key: 'master-transporter' })

let successTimer: number | undefined
const showSuccess = (message: string) => {
  success.value = message
  if (successTimer) window.clearTimeout(successTimer)
  successTimer = window.setTimeout(() => {
    success.value = null
  }, 3000)
}

const load = async () => {
  loading.value = true
  error.value = null
  try {
    const params: Record<string, string | number | boolean> = {
      page: page.value,
      pageSize: pageSize.value,
      sortBy: sortBy.value,
      sortDir: sortDir.value
    }
    if (search.value.trim()) params.search = search.value.trim()
    if (statusFilter.value) params.status = statusFilter.value

    const response = await getTransporters(params as any)
    rows.value = response.data?.data || []
    applyMeta(response.data?.meta)

    if (rows.value.length === 0 && totalPages.value < page.value) {
      page.value = totalPages.value
    }
  } catch (err: any) {
    error.value = err?.response?.data?.message || 'Gagal memuat transporter'
  } finally {
    loading.value = false
  }
}

/** Satu jalur reload: reset halaman dulu, lalu ambil data sekali saja. */
const reload = () => {
  page.value = 1
  load()
}

const debouncedLoad = useDebouncedCallback(() => {
  reload()
}, 300)

watch(search, () => debouncedLoad.run())
watch(statusFilter, () => reload())

const goToPage = (value: number) => {
  if (value === page.value) return
  page.value = value
  load()
}

const changePageSize = (value: number) => {
  pageSize.value = value
  page.value = 1
  load()
}

const toggleSort = (field: string) => {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortDir.value = 'asc'
  }
  resetPage()
  load()
}

const columns: MasterColumn[] = [
  { key: 'name', label: 'Nama Transporter', sortable: true, mobile: true, avatar: true, mobileTitle: true },
  { key: 'isActive', label: 'Status', sortable: true, mobile: true },
  { key: 'createdAt', label: 'Dibuat', sortable: true, hideBelow: 'md', mobile: true }
]

const statusOptions = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' }
]
const add = async () => {
  const name = newName.value.trim()
  if (!name) {
    error.value = 'Nama transporter wajib diisi'
    return
  }
  saving.value = true
  error.value = null
  try {
    await createTransporter(name)
    newName.value = ''
    showCreate.value = false
    resetPage()
    await load()
    showSuccess('Transporter berhasil ditambahkan')
  } catch (err: any) {
    error.value = err?.response?.data?.message || 'Gagal menambah transporter'
  } finally {
    saving.value = false
  }
}

const handleImport = async () => {
  if (!importFile.value) {
    error.value = 'File Excel wajib dipilih'
    return
  }

  importing.value = true
  error.value = null
  importErrors.value = []
  importResult.value = null
  try {
    const response = await importTransporterExcel(importFile.value)
    const result = response.data?.data
    importResult.value = result || null
    importFile.value = null
    resetPage()
    await load()
    showSuccess(
      result
        ? `Import selesai: ${result.created} ditambahkan, ${result.skipped} dilewati`
        : 'Import transporter selesai'
    )
  } catch (err: any) {
    const details = err?.response?.data?.details
    if (Array.isArray(details) && details.length > 0) {
      importErrors.value = details
      error.value = err?.response?.data?.message || 'Validasi import gagal'
    } else {
      error.value = err?.response?.data?.message || 'Gagal import transporter'
    }
  } finally {
    importing.value = false
  }
}

const handleDownloadTemplate = async () => {
  try {
    const response = await downloadTransporterTemplate()
    const blob = new Blob([response.data], { type: response.headers['content-type'] })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'master-transporter-template.xlsx'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  } catch (err: any) {
    error.value = err?.response?.data?.message || 'Gagal download template'
  }
}

const renameOpen = ref(false)
const renameRow = ref<Transporter | null>(null)
const renameValue = ref('')
const renameError = ref<string | null>(null)

const openRename = (row: Transporter) => {
  renameRow.value = row
  renameValue.value = row.name
  renameError.value = null
  renameOpen.value = true
}

const closeRename = () => {
  renameOpen.value = false
  renameRow.value = null
  renameValue.value = ''
  renameError.value = null
}

const submitRename = async () => {
  if (!renameRow.value) return
  const name = renameValue.value.trim()
  if (!name) {
    renameError.value = 'Nama transporter wajib diisi'
    return
  }
  if (name === renameRow.value.name) {
    closeRename()
    return
  }
  saving.value = true
  renameError.value = null
  try {
    await api.patch(`/transporters/${renameRow.value.id}`, { name })
    await load()
    closeRename()
    showSuccess('Transporter berhasil diubah')
  } catch (err: any) {
    renameError.value = err?.response?.data?.message || 'Gagal mengubah transporter'
  } finally {
    saving.value = false
  }
}

const toggleActive = async (row: Transporter) => {
  saving.value = true
  error.value = null
  try {
    await api.patch(`/transporters/${row.id}`, { isActive: !row.isActive })
    await load()
    showSuccess(row.isActive ? 'Transporter dinonaktifkan' : 'Transporter diaktifkan')
  } catch (err: any) {
    error.value = err?.response?.data?.message || 'Gagal mengubah status transporter'
  } finally {
    saving.value = false
  }
}

const openConfirm = (row: Transporter) => {
  confirmRow.value = row
  confirmOpen.value = true
}

const closeConfirm = () => {
  confirmOpen.value = false
  confirmRow.value = null
}

const confirmRemove = async () => {
  if (!confirmRow.value) return
  saving.value = true
  error.value = null
  try {
    await api.delete(`/transporters/${confirmRow.value.id}`)
    await load()
    showSuccess('Transporter berhasil dihapus')
  } catch (err: any) {
    error.value = err?.response?.data?.message || 'Gagal menghapus transporter'
  } finally {
    saving.value = false
    closeConfirm()
  }
}

const onRowAction = (row: Transporter, key: string) => {
  if (key === 'edit') openRename(row)
  if (key === 'toggle') toggleActive(row)
  if (key === 'delete') openConfirm(row)
}

const actionItems = (row: Transporter) => [
  { key: 'edit', label: 'Ubah nama', icon: 'edit' as const },
  {
    key: 'toggle',
    label: row.isActive ? 'Nonaktifkan' : 'Aktifkan',
    icon: row.isActive ? ('cancel' as const) : ('check' as const)
  },
  { key: 'delete', label: 'Hapus', icon: 'delete' as const, danger: true }
]

const isFiltering = computed(() => search.value.trim().length > 0 || statusFilter.value !== '')

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Master Transporter</h1>
        <p class="text-sm text-muted-foreground">
          Dipakai pada Schedule Pengiriman dan Antrian Truk. Nonaktifkan alih-alih menghapus agar
          histori tetap utuh.
        </p>
      </div>
      <Button size="sm" @click="showCreate = !showCreate">
        <Plus class="mr-1.5 h-4 w-4" aria-hidden="true" />
        Tambah Transporter
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

    <Card v-if="showImport">
      <CardHeader>
        <div class="text-sm font-medium">Import Excel (.xlsx)</div>
        <p class="text-xs text-muted-foreground">
          Header kolom: Nama Transporter, Status Aktif (opsional, AKTIF/NONAKTIF).
          Transporter yang sudah ada dilewati, tidak ditimpa.
        </p>
      </CardHeader>
      <CardContent>
        <div class="flex flex-col gap-3 md:flex-row md:items-end">
          <div class="min-w-0 flex-1">
            <label for="transporter-import" class="text-xs font-medium text-muted-foreground">File Excel</label>
            <input
              id="transporter-import"
              type="file"
              accept=".xlsx"
              class="mt-1 w-full min-w-0 max-w-full rounded-xl border border-input/80 bg-card/75 px-3 py-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium"
              @change="(e) => (importFile = (e.target as HTMLInputElement).files?.[0] || null)"
            />
          </div>
          <div class="flex flex-wrap items-center gap-2">
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
              {{ importing ? 'Mengimpor...' : 'Import' }}
            </Button>
          </div>
        </div>

        <div
          v-if="importResult"
          class="mt-3 rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          <span class="font-semibold">{{ importResult.created }}</span> transporter ditambahkan,
          <span class="font-semibold">{{ importResult.skipped }}</span> dilewati dari
          {{ importResult.total }} baris valid.
        </div>

        <div
          v-if="importErrors.length > 0"
          class="mt-3 rounded-xl border border-red-300/60 bg-red-50 px-3 py-2 dark:border-red-500/30 dark:bg-red-500/10"
        >
          <p class="text-xs font-semibold text-red-800 dark:text-red-300">
            Import dibatalkan. Perbaiki {{ importErrors.length }} baris berikut lalu unggah ulang:
          </p>
          <ul class="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs text-red-700 dark:text-red-300">
            <li v-for="(message, index) in importErrors" :key="index">{{ message }}</li>
          </ul>
        </div>
      </CardContent>
    </Card>

    <Card v-if="showCreate">
      <CardHeader>
        <div class="text-sm font-medium">Tambah transporter baru</div>
        <p class="text-xs text-muted-foreground">Nama yang sama (tanpa membedakan huruf besar/kecil) akan memakai data yang sudah ada.</p>
      </CardHeader>
      <CardContent>
        <div class="flex flex-col gap-3 md:flex-row md:items-end">
          <div class="flex-1">
            <label for="transporter-name" class="text-xs font-medium text-muted-foreground">
              Nama Transporter <span class="text-red-500">*</span>
            </label>
            <Input
              id="transporter-name"
              v-model="newName"
              type="text"
              placeholder="Contoh: PT Logistik Nusantara"
              class="mt-1"
              @keyup.enter="add"
            />
          </div>
          <div class="flex items-center gap-2">
            <Button size="sm" variant="ghost" @click="showCreate = false">Batal</Button>
            <Button size="sm" :disabled="saving || !newName.trim()" @click="add">
              {{ saving ? 'Menyimpan...' : 'Simpan' }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <MasterTable
      :columns="columns"
      :rows="rows"
      table-label="Daftar transporter"
      :loading="loading"
      :filtered="isFiltering"
      empty-title="Belum ada transporter"
      empty-description="Tambahkan transporter supaya bisa dipilih pada schedule pengiriman."
      :sort-by="sortBy"
      :sort-dir="sortDir"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :total-pages="totalPages"
      unit="transporter"
      @sort="toggleSort"
      @page="goToPage"
      @page-size="changePageSize"
    >
      <template #toolbar>
        <MasterSearch v-model="search" placeholder="Cari transporter..." label="Cari transporter" />
      </template>

      <template #filters>
        <FilterChips
          :model-value="statusFilter"
          :options="statusOptions"
          aria-label="Filter status transporter"
          @update:model-value="(value) => (statusFilter = value as typeof statusFilter)"
        />
        <span class="rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
          {{ total }} transporter
        </span>
        <Button size="sm" variant="outline" @click="showImport = !showImport">
          <Upload class="mr-1.5 h-4 w-4" aria-hidden="true" />
          Import
        </Button>
      </template>

      <template #cell="{ row, column }">
        <span v-if="column.key === 'name'" class="font-medium">{{ row.name }}</span>
        <span
          v-else-if="column.key === 'isActive'"
          class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
          :class="row.isActive
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300'"
        >
          <span
            class="h-1.5 w-1.5 rounded-full"
            :class="row.isActive ? 'bg-emerald-500' : 'bg-slate-400'"
            aria-hidden="true"
          />
          {{ row.isActive ? 'Aktif' : 'Nonaktif' }}
        </span>
        <span v-else-if="column.key === 'createdAt'" class="text-muted-foreground">
          {{ formatDateTimeId(row.createdAt) }}
        </span>
      </template>

      <template #actions="{ row }">
        <ActionMenu
          :items="actionItems(row)"
          :label="`Aksi untuk ${row.name}`"
          :disabled="saving"
          @select="(key) => onRowAction(row, key)"
        />
      </template>
    </MasterTable>

    <div v-if="renameOpen" class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="rename-transporter-title">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px]" @click="closeRename"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card shadow-xl">
        <div class="border-b p-4">
          <h3 id="rename-transporter-title" class="text-base font-semibold">Ubah Nama Transporter</h3>
        </div>
        <div class="space-y-3 p-4 text-sm">
          <div>
            <label for="rename-transporter" class="text-xs font-medium text-muted-foreground">Nama</label>
            <Input id="rename-transporter" v-model="renameValue" type="text" class="mt-1" @keyup.enter="submitRename" />
          </div>
          <p v-if="renameError" class="text-xs text-red-600" role="alert">{{ renameError }}</p>
        </div>
        <div class="flex items-center justify-end gap-2 border-t p-4">
          <Button variant="ghost" @click="closeRename">Batal</Button>
          <Button :disabled="saving" @click="submitRename">
            {{ saving ? 'Menyimpan...' : 'Simpan' }}
          </Button>
        </div>
      </div>
    </div>

    <div v-if="confirmOpen" class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="confirm-transporter-title">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px]" @click="closeConfirm"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card shadow-xl">
        <div class="border-b p-4">
          <h3 id="confirm-transporter-title" class="text-base font-semibold">Konfirmasi Hapus</h3>
        </div>
        <div class="p-4 text-sm">
          <p>Hapus transporter <span class="font-semibold">{{ confirmRow?.name }}</span>?</p>
          <p class="mt-1 text-xs text-muted-foreground">
            Kalau transporter sudah dipakai pada schedule, nonaktifkan saja agar histori tetap utuh.
          </p>
        </div>
        <div class="flex items-center justify-end gap-2 border-t p-4">
          <Button variant="ghost" @click="closeConfirm">Batal</Button>
          <Button class="bg-red-600 text-white hover:bg-red-700" :disabled="saving" @click="confirmRemove">
            Ya, Hapus
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

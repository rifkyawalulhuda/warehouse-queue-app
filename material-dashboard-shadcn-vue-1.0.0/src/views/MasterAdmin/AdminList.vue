<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  Plus,
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
import api from '@/services/api'
import { formatDateTimeId } from '@/lib/datetime'
import { useDebouncedCallback, useTablePagination } from '@/composables/useTablePagination'

type AdminUser = {
  id: string
  name: string
  position: string
  phone: string
  role: 'ADMIN' | 'WAREHOUSE' | 'CS'
  username: string
  createdAt: string
}

const admins = ref<AdminUser[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const submitting = ref(false)
const updating = ref(false)
const editError = ref<string | null>(null)
const search = ref('')
const roleFilter = ref<'' | AdminUser['role']>('')
const confirmOpen = ref(false)
const confirmAdmin = ref<AdminUser | null>(null)
const editOpen = ref(false)
const editAdmin = ref<AdminUser | null>(null)
const showCreate = ref(false)

const sortBy = ref('createdAt')
const sortDir = ref<'asc' | 'desc'>('desc')

const { page, pageSize, total, totalPages, applyMeta, resetPage } =
  useTablePagination({ key: 'master-admin' })

const form = reactive({
  name: '',
  position: '',
  phone: '',
  role: '',
  username: '',
  password: ''
})

const editForm = reactive({
  name: '',
  position: '',
  phone: '',
  role: '',
  username: '',
  password: ''
})

const roleOptions: Array<{ value: AdminUser['role']; label: string }> = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'WAREHOUSE', label: 'Warehouse' },
  { value: 'CS', label: 'CS' }
]

const formatRole = (role?: string | null) => {
  if (role === 'ADMIN') return 'admin'
  if (role === 'WAREHOUSE') return 'warehouse'
  if (role === 'CS') return 'cs'
  return '-'
}

const roleTone = (role?: string | null) => {
  if (role === 'ADMIN') return 'bg-primary/10 text-primary dark:bg-primary/20'
  if (role === 'WAREHOUSE') return 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300'
  return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
}

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

const fetchAdmins = async () => {
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
    if (roleFilter.value) params.role = roleFilter.value

    const response = await api.get('/admin-users', { params })
    admins.value = response.data?.data || []
    applyMeta(response.data?.meta)

    if (admins.value.length === 0 && totalPages.value < page.value) {
      page.value = totalPages.value
    }
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal mengambil data admin')
  } finally {
    loading.value = false
  }
}

/** Satu jalur reload: reset halaman dulu, lalu ambil data sekali saja. */
const reload = () => {
  page.value = 1
  fetchAdmins()
}

const debouncedFetch = useDebouncedCallback(() => {
  reload()
}, 300)

watch(search, () => debouncedFetch.run())
watch(roleFilter, () => reload())

const goToPage = (value: number) => {
  if (value === page.value) return
  page.value = value
  fetchAdmins()
}

const changePageSize = (value: number) => {
  pageSize.value = value
  page.value = 1
  fetchAdmins()
}

const toggleSort = (field: string) => {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortDir.value = 'asc'
  }
  resetPage()
  fetchAdmins()
}

const columns: MasterColumn[] = [
  { key: 'name', label: 'Nama', sortable: true, mobile: true, avatar: true, mobileTitle: true },
  { key: 'position', label: 'Jabatan', sortable: true, hideBelow: 'lg', mobile: true },
  { key: 'phone', label: 'Nomor Telp', hideBelow: 'xl', mono: true, mobile: true },
  { key: 'role', label: 'Role', sortable: true, mobile: true },
  { key: 'username', label: 'Username', sortable: true, mono: true, mobile: true },
  { key: 'createdAt', label: 'Dibuat', sortable: true, hideBelow: 'md', mobile: true }
]

const validateCreate = () => {
  if (!form.name.trim()) return 'Nama wajib diisi'
  if (!form.position.trim()) return 'Jabatan wajib diisi'
  if (!String(form.phone).trim()) return 'Nomor Telp wajib diisi'
  if (!form.role) return 'Role User wajib diisi'
  if (!form.username.trim()) return 'Username wajib diisi'
  if (!form.password.trim()) return 'Password wajib diisi'
  return null
}

const handleCreate = async () => {
  const validationError = validateCreate()
  if (validationError) {
    error.value = validationError
    return
  }
  submitting.value = true
  error.value = null
  try {
    await api.post('/admin-users', {
      name: form.name.trim(),
      position: form.position.trim(),
      phone: String(form.phone).trim(),
      role: form.role,
      username: form.username.trim(),
      password: form.password.trim()
    })
    form.name = ''
    form.position = ''
    form.phone = ''
    form.role = ''
    form.username = ''
    form.password = ''
    showCreate.value = false
    resetPage()
    await fetchAdmins()
    showSuccess('Admin berhasil ditambahkan')
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal menambah admin')
  } finally {
    submitting.value = false
  }
}

const openEdit = (admin: AdminUser) => {
  editAdmin.value = admin
  editForm.name = admin.name
  editForm.position = admin.position
  editForm.phone = admin.phone
  editForm.role = formatRole(admin.role)
  editForm.username = admin.username
  editForm.password = ''
  editError.value = null
  editOpen.value = true
}

const closeEdit = () => {
  editOpen.value = false
  editAdmin.value = null
  editForm.name = ''
  editForm.position = ''
  editForm.phone = ''
  editForm.role = ''
  editForm.username = ''
  editForm.password = ''
  editError.value = null
}

const validateEdit = () => {
  if (!editForm.name.trim()) return 'Nama wajib diisi'
  if (!editForm.position.trim()) return 'Jabatan wajib diisi'
  if (!String(editForm.phone).trim()) return 'Nomor Telp wajib diisi'
  if (!editForm.role) return 'Role User wajib diisi'
  if (!editForm.username.trim()) return 'Username wajib diisi'
  return null
}

const submitUpdate = async () => {
  const validationError = validateEdit()
  if (validationError) {
    editError.value = validationError
    return
  }
  if (!editAdmin.value) return
  updating.value = true
  editError.value = null
  try {
    const body: Record<string, string> = {
      name: editForm.name.trim(),
      position: editForm.position.trim(),
      phone: String(editForm.phone).trim(),
      role: editForm.role,
      username: editForm.username.trim()
    }
    if (editForm.password.trim()) {
      body.password = editForm.password.trim()
    }
    await api.patch(`/admin-users/${editAdmin.value.id}`, body)
    await fetchAdmins()
    closeEdit()
    showSuccess('Admin berhasil diperbarui')
  } catch (err: any) {
    editError.value = getErrorMessage(err, 'Gagal update admin')
  } finally {
    updating.value = false
  }
}

const openConfirm = (admin: AdminUser) => {
  confirmAdmin.value = admin
  confirmOpen.value = true
}

const closeConfirm = () => {
  confirmOpen.value = false
  confirmAdmin.value = null
}

const confirmDelete = async () => {
  if (!confirmAdmin.value) return
  try {
    await api.delete(`/admin-users/${confirmAdmin.value.id}`)
    await fetchAdmins()
    showSuccess('Admin berhasil dihapus')
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal menghapus admin')
  } finally {
    closeConfirm()
  }
}

const onRowAction = (admin: AdminUser, key: string) => {
  if (key === 'edit') openEdit(admin)
  if (key === 'delete') openConfirm(admin)
}

const isFiltering = computed(() => search.value.trim().length > 0 || roleFilter.value !== '')

onMounted(fetchAdmins)
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Master Admin</h1>
        <p class="text-sm text-muted-foreground">Akun pengguna beserta role aksesnya.</p>
      </div>
      <Button size="sm" @click="showCreate = !showCreate">
        <Plus class="mr-1.5 h-4 w-4" aria-hidden="true" />
        Tambah Admin
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
        <div class="text-sm font-medium">Tambah admin baru</div>
        <p class="text-xs text-muted-foreground">Role menentukan halaman dan aksi yang bisa diakses.</p>
      </CardHeader>
      <CardContent>
        <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label for="admin-name" class="text-xs font-medium text-muted-foreground">
              Nama <span class="text-red-500">*</span>
            </label>
            <Input id="admin-name" v-model="form.name" type="text" class="mt-1" />
          </div>
          <div>
            <label for="admin-position" class="text-xs font-medium text-muted-foreground">
              Jabatan <span class="text-red-500">*</span>
            </label>
            <Input id="admin-position" v-model="form.position" type="text" class="mt-1" />
          </div>
          <div>
            <label for="admin-phone" class="text-xs font-medium text-muted-foreground">
              Nomor Telp <span class="text-red-500">*</span>
            </label>
            <Input id="admin-phone" v-model="form.phone" type="tel" class="mt-1" />
          </div>
          <div>
            <label for="admin-role" class="text-xs font-medium text-muted-foreground">
              Role User <span class="text-red-500">*</span>
            </label>
            <select
              id="admin-role"
              v-model="form.role"
              class="mt-1 flex h-11 w-full rounded-xl border border-input/80 bg-card/75 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="" disabled>Pilih role</option>
              <option value="admin">admin</option>
              <option value="warehouse">warehouse</option>
              <option value="cs">cs</option>
            </select>
          </div>
          <div>
            <label for="admin-username" class="text-xs font-medium text-muted-foreground">
              Username <span class="text-red-500">*</span>
            </label>
            <Input id="admin-username" v-model="form.username" type="text" class="mt-1" autocomplete="off" />
          </div>
          <div>
            <label for="admin-password" class="text-xs font-medium text-muted-foreground">
              Password <span class="text-red-500">*</span>
            </label>
            <Input id="admin-password" v-model="form.password" type="password" class="mt-1" autocomplete="new-password" />
          </div>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="ghost" @click="showCreate = false">Batal</Button>
          <Button size="sm" :disabled="submitting" @click="handleCreate">
            {{ submitting ? 'Menyimpan...' : 'Simpan' }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <MasterTable
      :columns="columns"
      :rows="admins"
      table-label="Daftar akun admin"
      :loading="loading"
      :filtered="isFiltering"
      empty-title="Belum ada admin"
      empty-description="Tambahkan akun supaya tim bisa masuk ke aplikasi sesuai role-nya."
      :sort-by="sortBy"
      :sort-dir="sortDir"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :total-pages="totalPages"
      unit="akun"
      @sort="toggleSort"
      @page="goToPage"
      @page-size="changePageSize"
    >
      <template #toolbar>
        <MasterSearch v-model="search" placeholder="Cari nama, username, jabatan..." label="Cari admin" />
      </template>

      <template #filters>
        <FilterChips
          :model-value="roleFilter"
          :options="roleOptions"
          aria-label="Filter role"
          @update:model-value="(value) => (roleFilter = value as typeof roleFilter)"
        />
        <span class="rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
          {{ total }} akun
        </span>
      </template>

      <template #cell="{ row, column }">
        <span v-if="column.key === 'name'" class="font-medium">{{ row.name }}</span>
        <span v-else-if="column.key === 'position'">{{ row.position }}</span>
        <span v-else-if="column.key === 'phone'" class="font-mono text-xs tabular-nums">{{ row.phone }}</span>
        <span
          v-else-if="column.key === 'role'"
          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
          :class="roleTone(row.role)"
        >
          {{ formatRole(row.role) }}
        </span>
        <span v-else-if="column.key === 'username'" class="font-mono text-xs">{{ row.username }}</span>
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

    <div v-if="editOpen" class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="edit-admin-title">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px]" @click="closeEdit"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card shadow-xl">
        <div class="border-b p-4">
          <h3 id="edit-admin-title" class="text-base font-semibold">Edit Admin</h3>
        </div>
        <div class="space-y-3 p-4 text-sm">
          <div>
            <label for="edit-admin-name" class="text-xs font-medium text-muted-foreground">Nama</label>
            <Input id="edit-admin-name" v-model="editForm.name" type="text" class="mt-1" />
          </div>
          <div>
            <label for="edit-admin-position" class="text-xs font-medium text-muted-foreground">Jabatan</label>
            <Input id="edit-admin-position" v-model="editForm.position" type="text" class="mt-1" />
          </div>
          <div>
            <label for="edit-admin-phone" class="text-xs font-medium text-muted-foreground">Nomor Telp</label>
            <Input id="edit-admin-phone" v-model="editForm.phone" type="tel" class="mt-1" />
          </div>
          <div>
            <label for="edit-admin-role" class="text-xs font-medium text-muted-foreground">Role User</label>
            <select
              id="edit-admin-role"
              v-model="editForm.role"
              class="mt-1 flex h-11 w-full rounded-xl border border-input/80 bg-card/75 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="" disabled>Pilih role</option>
              <option value="admin">admin</option>
              <option value="warehouse">warehouse</option>
              <option value="cs">cs</option>
            </select>
          </div>
          <div>
            <label for="edit-admin-username" class="text-xs font-medium text-muted-foreground">Username</label>
            <Input id="edit-admin-username" v-model="editForm.username" type="text" class="mt-1" autocomplete="off" />
          </div>
          <div>
            <label for="edit-admin-password" class="text-xs font-medium text-muted-foreground">
              Password <span class="font-normal">(opsional)</span>
            </label>
            <Input id="edit-admin-password" v-model="editForm.password" type="password" class="mt-1" autocomplete="new-password" />
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

    <div v-if="confirmOpen" class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="confirm-admin-title">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px]" @click="closeConfirm"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card shadow-xl">
        <div class="border-b p-4">
          <h3 id="confirm-admin-title" class="text-base font-semibold">Konfirmasi Hapus</h3>
        </div>
        <div class="p-4 text-sm">
          <p>Hapus admin <span class="font-semibold">{{ confirmAdmin?.name }}</span>?</p>
          <p class="mt-1 text-xs text-muted-foreground">Akun yang dihapus tidak bisa masuk lagi.</p>
        </div>
        <div class="flex items-center justify-end gap-2 border-t p-4">
          <Button variant="ghost" @click="closeConfirm">Batal</Button>
          <Button class="bg-red-600 text-white hover:bg-red-700" @click="confirmDelete">Ya, Hapus</Button>
        </div>
      </div>
    </div>
  </div>
</template>

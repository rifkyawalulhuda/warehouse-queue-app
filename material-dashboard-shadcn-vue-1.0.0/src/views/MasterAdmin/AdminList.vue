<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import api from '@/services/api'

type AdminUser = {
  id: string
  name: string
  position: string
  phone: string
  role: 'ADMIN' | 'WAREHOUSE'
  username: string
  createdAt: string
}

const admins = ref<AdminUser[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const submitting = ref(false)
const updating = ref(false)
const editError = ref<string | null>(null)
const search = ref('')
const confirmOpen = ref(false)
const confirmAdmin = ref<AdminUser | null>(null)
const editOpen = ref(false)
const editAdmin = ref<AdminUser | null>(null)

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

const formatRole = (role?: string | null) => {
  if (role === 'ADMIN') return 'admin'
  if (role === 'WAREHOUSE') return 'warehouse'
  return '-'
}

const getErrorMessage = (err: any, fallback: string) => {
  return err?.response?.data?.message || err?.message || fallback
}

const fetchAdmins = async () => {
  loading.value = true
  error.value = null
  try {
    const params = new URLSearchParams()
    if (search.value.trim()) params.set('search', search.value.trim())
    const url = params.toString() ? `/admin-users?${params.toString()}` : '/admin-users'
    const response = await api.get(url)
    admins.value = response.data?.data || []
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal mengambil data admin')
  } finally {
    loading.value = false
  }
}

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
    await fetchAdmins()
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
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal menghapus admin')
  } finally {
    closeConfirm()
  }
}

let searchTimer: number | undefined

watch(
  () => search.value,
  () => {
    if (searchTimer) window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => {
      fetchAdmins()
    }, 300)
  }
)

onMounted(() => {
  fetchAdmins()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold tracking-tight">Master Admin</h1>
      <p class="text-muted-foreground">Kelola daftar admin</p>
    </div>

    <Card>
      <CardHeader>
        <div class="text-sm text-muted-foreground">Tambah admin baru</div>
      </CardHeader>
      <CardContent>
        <div v-if="error" class="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ error }}
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <label class="text-sm text-muted-foreground">Nama</label>
            <input v-model="form.name" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Jabatan</label>
            <input v-model="form.position" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Nomor Telp</label>
            <input v-model="form.phone" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Role User</label>
            <select v-model="form.role" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm">
              <option value="" disabled>Pilih role</option>
              <option value="admin">admin</option>
              <option value="warehouse">warehouse</option>
            </select>
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Username</label>
            <input v-model="form.username" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Password</label>
            <input v-model="form.password" type="password" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
        </div>
        <div class="mt-3 flex justify-end">
          <Button size="sm" :disabled="submitting" @click="handleCreate">
            {{ submitting ? 'Menyimpan...' : 'Simpan' }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div class="text-sm text-muted-foreground">Daftar admin</div>
          <input
            v-model="search"
            type="text"
            placeholder="Cari admin..."
            class="w-full md:w-64 bg-transparent border rounded-md px-2 py-2 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div class="overflow-x-auto border rounded-lg">
          <table class="min-w-full text-sm">
            <thead class="bg-muted/60 text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left font-medium">No</th>
                <th class="px-3 py-2 text-left font-medium">Nama</th>
                <th class="px-3 py-2 text-left font-medium">Jabatan</th>
                <th class="px-3 py-2 text-left font-medium">Nomor Telp</th>
                <th class="px-3 py-2 text-left font-medium">Role User</th>
                <th class="px-3 py-2 text-left font-medium">Username</th>
                <th class="px-3 py-2 text-left font-medium">Created At</th>
                <th class="px-3 py-2 text-left font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="8" class="px-3 py-6 text-center text-muted-foreground">Loading...</td>
              </tr>
              <tr v-else-if="admins.length === 0">
                <td colspan="8" class="px-3 py-6 text-center text-muted-foreground">Data kosong.</td>
              </tr>
              <tr v-for="(admin, index) in admins" :key="admin.id" class="border-t">
                <td class="px-3 py-2">{{ index + 1 }}</td>
                <td class="px-3 py-2">{{ admin.name }}</td>
                <td class="px-3 py-2">{{ admin.position }}</td>
                <td class="px-3 py-2">{{ admin.phone }}</td>
                <td class="px-3 py-2">{{ formatRole(admin.role) }}</td>
                <td class="px-3 py-2">{{ admin.username }}</td>
                <td class="px-3 py-2">{{ new Date(admin.createdAt).toLocaleString() }}</td>
                <td class="px-3 py-2">
                  <div class="flex items-center gap-2">
                    <Button size="sm" variant="outline" @click="openEdit(admin)">Edit</Button>
                    <Button size="sm" variant="outline" @click="openConfirm(admin)">Hapus</Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <div v-if="editOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeEdit"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Edit Admin</h3>
        </div>
        <div class="p-4 space-y-3 text-sm">
          <div>
            <label class="text-sm text-muted-foreground">Nama</label>
            <input v-model="editForm.name" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Jabatan</label>
            <input v-model="editForm.position" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Nomor Telp</label>
            <input v-model="editForm.phone" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Role User</label>
            <select v-model="editForm.role" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm">
              <option value="" disabled>Pilih role</option>
              <option value="admin">admin</option>
              <option value="warehouse">warehouse</option>
            </select>
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Username</label>
            <input v-model="editForm.username" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Password (opsional)</label>
            <input v-model="editForm.password" type="password" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
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

    <div v-if="confirmOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeConfirm"></div>
      <div class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold">Konfirmasi Hapus</h3>
        </div>
        <div class="p-4 text-sm">
          <p>Hapus admin <span class="font-semibold">{{ confirmAdmin?.name }}</span>?</p>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeConfirm">Batal</Button>
          <Button @click="confirmDelete">Ya, Hapus</Button>
        </div>
      </div>
    </div>
  </div>
</template>

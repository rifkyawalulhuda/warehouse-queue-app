<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'

type Customer = {
  id: string
  name: string
  createdAt: string
}

const customers = ref<Customer[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const submitting = ref(false)
const importing = ref(false)
const importFile = ref<File | null>(null)
const search = ref('')
const confirmOpen = ref(false)
const confirmCustomer = ref<Customer | null>(null)

const form = reactive({
  name: ''
})

const fetchCustomers = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await fetch(`/api/customers`)
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.message || 'Gagal mengambil data')
    }
    const payload = await response.json()
    customers.value = payload.data || []
  } catch (err: any) {
    error.value = err.message || 'Terjadi kesalahan'
  } finally {
    loading.value = false
  }
}

const filteredCustomers = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return customers.value
  return customers.value.filter((c) => c.name.toLowerCase().includes(q))
})

const handleSubmit = async () => {
  if (!form.name.trim()) {
    error.value = 'Nama Customer wajib diisi'
    return
  }
  submitting.value = true
  error.value = null
  try {
    const response = await fetch(`/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: form.name.trim() })
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.message || 'Gagal menambah customer')
    }
    form.name = ''
    await fetchCustomers()
  } catch (err: any) {
    error.value = err.message || 'Gagal menambah customer'
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (id: string) => {
  try {
    const response = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.message || 'Gagal menghapus customer')
    }
    await fetchCustomers()
  } catch (err: any) {
    error.value = err.message || 'Gagal menghapus customer'
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
    const response = await fetch(`/api/customers/import`, {
      method: 'POST',
      body: formData
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.message || 'Gagal import customer')
    }
    importFile.value = null
    await fetchCustomers()
  } catch (err: any) {
    error.value = err.message || 'Gagal import customer'
  } finally {
    importing.value = false
  }
}

onMounted(() => {
  fetchCustomers()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold tracking-tight">Master Customer</h1>
      <p class="text-muted-foreground">Kelola daftar customer</p>
    </div>

    <Card>
      <CardHeader>
        <div class="text-sm text-muted-foreground">Tambah customer baru</div>
      </CardHeader>
      <CardContent>
        <div v-if="error" class="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ error }}
        </div>
        <div class="flex flex-col gap-3 md:flex-row md:items-end">
          <div class="flex-1">
            <label class="text-sm text-muted-foreground">Nama Customer</label>
            <input v-model="form.name" type="text" class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm" />
          </div>
          <Button size="sm" :disabled="submitting" @click="handleSubmit">
            {{ submitting ? 'Menyimpan...' : 'Simpan' }}
          </Button>
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
            <p class="mt-1 text-xs text-muted-foreground">Header kolom: "Nama Customer"</p>
          </div>
          <div class="flex items-center gap-2">
            <a href="/api/customers/template" class="text-sm text-primary underline-offset-4 hover:underline">
              Download Template
            </a>
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
          <div class="text-sm text-muted-foreground">Daftar customer</div>
          <input
            v-model="search"
            type="text"
            placeholder="Cari customer..."
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
                <th class="px-3 py-2 text-left font-medium">Nama Customer</th>
                <th class="px-3 py-2 text-left font-medium">Created At</th>
                <th class="px-3 py-2 text-left font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="4" class="px-3 py-6 text-center text-muted-foreground">Loading...</td>
              </tr>
              <tr v-else-if="filteredCustomers.length === 0">
                <td colspan="4" class="px-3 py-6 text-center text-muted-foreground">Data kosong.</td>
              </tr>
              <tr v-for="(cust, index) in filteredCustomers" :key="cust.id" class="border-t">
                <td class="px-3 py-2">{{ index + 1 }}</td>
                <td class="px-3 py-2">{{ cust.name }}</td>
                <td class="px-3 py-2">{{ new Date(cust.createdAt).toLocaleString() }}</td>
                <td class="px-3 py-2">
                  <Button size="sm" variant="outline" @click="openConfirm(cust)">Hapus</Button>
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
          <p>Hapus customer <span class="font-semibold">{{ confirmCustomer?.name }}</span>?</p>
        </div>
        <div class="p-4 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" @click="closeConfirm">Batal</Button>
          <Button @click="confirmDelete">Ya, Hapus</Button>
        </div>
      </div>
    </div>
  </div>
</template>

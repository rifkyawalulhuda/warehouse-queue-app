<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'

type Customer = {
  id: string
  name: string
  createdAt: string
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const customers = ref<Customer[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const submitting = ref(false)

const form = reactive({
  name: ''
})

const fetchCustomers = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await fetch(`${apiBase}/api/customers`)
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

const handleSubmit = async () => {
  if (!form.name.trim()) {
    error.value = 'Nama Customer wajib diisi'
    return
  }
  submitting.value = true
  error.value = null
  try {
    const response = await fetch(`${apiBase}/api/customers`, {
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
        <div class="text-sm text-muted-foreground">Daftar customer</div>
      </CardHeader>
      <CardContent>
        <div class="overflow-x-auto border rounded-lg">
          <table class="min-w-full text-sm">
            <thead class="bg-muted/60 text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left font-medium">No</th>
                <th class="px-3 py-2 text-left font-medium">Nama Customer</th>
                <th class="px-3 py-2 text-left font-medium">Created At</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="3" class="px-3 py-6 text-center text-muted-foreground">Loading...</td>
              </tr>
              <tr v-else-if="customers.length === 0">
                <td colspan="3" class="px-3 py-6 text-center text-muted-foreground">Data kosong.</td>
              </tr>
              <tr v-for="(cust, index) in customers" :key="cust.id" class="border-t">
                <td class="px-3 py-2">{{ index + 1 }}</td>
                <td class="px-3 py-2">{{ cust.name }}</td>
                <td class="px-3 py-2">{{ new Date(cust.createdAt).toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

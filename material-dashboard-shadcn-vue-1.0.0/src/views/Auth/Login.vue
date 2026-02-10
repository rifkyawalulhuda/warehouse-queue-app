<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const route = useRoute()
const { login } = useAuth()

const form = reactive({
  username: '',
  password: ''
})

const loading = ref(false)
const error = ref<string | null>(null)

const handleSubmit = async () => {
  error.value = null
  if (!form.username.trim() || !form.password.trim()) {
    error.value = 'Username dan password wajib diisi'
    return
  }
  loading.value = true
  try {
    const user = await login(form.username.trim(), form.password.trim())
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    if (redirect) {
      router.replace(redirect)
    } else if (user.role === 'WAREHOUSE' || user.role === 'CS') {
      router.replace('/antrian-truk')
    } else {
      router.replace('/dashboard')
    }
  } catch (err: any) {
    error.value = err?.response?.data?.message || err.message || 'Login gagal'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background p-4">
    <Card class="w-full max-w-md">
      <CardHeader>
        <div>
          <h1 class="text-xl font-bold">Login</h1>
          <p class="text-muted-foreground text-sm">Masuk ke sistem antrian truk</p>
        </div>
      </CardHeader>
      <CardContent>
        <div v-if="error" class="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ error }}
        </div>
        <div class="space-y-3">
          <div>
            <label class="text-sm text-muted-foreground">Username</label>
            <input
              v-model="form.username"
              type="text"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
              autocomplete="username"
            />
          </div>
          <div>
            <label class="text-sm text-muted-foreground">Password</label>
            <input
              v-model="form.password"
              type="password"
              class="mt-1 w-full bg-transparent border rounded-md px-2 py-2 text-sm"
              autocomplete="current-password"
            />
          </div>
          <Button class="w-full" :disabled="loading" @click="handleSubmit">
            {{ loading ? 'Masuk...' : 'Login' }}
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

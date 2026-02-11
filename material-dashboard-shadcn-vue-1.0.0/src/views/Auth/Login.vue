<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import { useAuth } from '@/composables/useAuth'
import sankyuLogo from '../../../img/logo_sankyu.png'

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
  <div
    class="relative min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8"
    style="
      background-image:
        radial-gradient(circle at 8% 10%, rgba(34, 197, 94, 0.12), transparent 32%),
        radial-gradient(circle at 92% 92%, rgba(37, 99, 235, 0.08), transparent 35%);
    "
  >
    <div class="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <section class="order-2 lg:order-1">
        <div class="mx-auto w-full max-w-xl rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur-sm sm:p-8">
          <div class="flex items-center gap-4">
            <div class="shrink-0 rounded-xl bg-white p-2 shadow-sm ring-1 ring-border">
              <img :src="sankyuLogo" alt="PT. Sankyu Indonesia International" class="h-12 w-12 object-contain" />
            </div>
            <div>
              <h1 class="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                PT. Sankyu Indonesia International
              </h1>
              <p class="mt-1 text-sm text-muted-foreground sm:text-base">
                Sistem Aplikasi Distribusi Antrian &amp; Schedule Operational
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="order-1 lg:order-2">
        <Card class="mx-auto w-full max-w-md border-border/80 shadow-lg shadow-black/[0.04]">
          <CardHeader>
            <div>
              <h2 class="text-2xl font-bold tracking-tight">Login</h2>
              <p class="mt-1 text-sm text-muted-foreground">Masuk ke sistem operasional</p>
            </div>
          </CardHeader>
          <CardContent>
            <form class="space-y-4" @submit.prevent="handleSubmit">
              <div
                v-if="error"
                class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {{ error }}
              </div>

              <div>
                <label class="text-sm font-medium text-muted-foreground">Username</label>
                <input
                  v-model="form.username"
                  type="text"
                  class="mt-1 w-full rounded-md border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autocomplete="username"
                  placeholder="Masukkan username"
                />
              </div>

              <div>
                <label class="text-sm font-medium text-muted-foreground">Password</label>
                <input
                  v-model="form.password"
                  type="password"
                  class="mt-1 w-full rounded-md border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autocomplete="current-password"
                  placeholder="Masukkan password"
                />
              </div>

              <Button type="submit" class="w-full py-2.5 text-sm font-semibold" :disabled="loading">
                {{ loading ? 'Masuk...' : 'Login' }}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  </div>
</template>

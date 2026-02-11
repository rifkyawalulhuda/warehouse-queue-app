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
    class="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8"
    style="
      background-image:
        linear-gradient(180deg, rgba(15, 23, 42, 0.03) 0%, rgba(15, 23, 42, 0) 35%),
        radial-gradient(circle at 88% 14%, rgba(34, 197, 94, 0.07), transparent 28%);
    "
  >
    <div class="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
      <div class="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div class="h-1 bg-primary"></div>
        <div class="grid lg:grid-cols-[1.1fr_0.9fr]">
          <section class="order-2 border-t border-border/80 p-6 sm:p-8 lg:order-1 lg:border-r lg:border-t-0 lg:p-10">
            <p
              class="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary"
            >
              Operational Portal
            </p>

            <div class="mt-5 flex items-start gap-4">
              <div class="shrink-0 rounded-lg bg-white p-2 ring-1 ring-border">
                <img
                  :src="sankyuLogo"
                  alt="PT. Sankyu Indonesia International"
                  class="h-12 w-12 object-contain sm:h-14 sm:w-14"
                />
              </div>
              <div>
                <h1 class="text-xl font-bold tracking-tight text-foreground sm:text-3xl">
                  PT. Sankyu Indonesia International
                </h1>
                <p class="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Sistem Aplikasi Distribusi Antrian &amp; Schedule Operational
                </p>
              </div>
            </div>

            <div class="mt-8 space-y-3 text-sm text-muted-foreground">
              <p class="flex items-center gap-2">
                <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
                Monitoring antrian truk harian secara real-time
              </p>
              <p class="flex items-center gap-2">
                <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
                Pengelolaan schedule store in/out terintegrasi
              </p>
              <p class="flex items-center gap-2">
                <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
                Ringkasan dashboard operasional dan laporan bulanan
              </p>
            </div>
          </section>

          <section class="order-1 bg-muted/20 p-6 sm:p-8 lg:order-2 lg:p-10">
            <Card class="mx-auto w-full max-w-md border-border bg-card shadow-none">
              <CardHeader>
                <div>
                  <h2 class="text-2xl font-semibold tracking-tight">Login</h2>
                  <p class="mt-1 text-sm text-muted-foreground">Masuk ke akun operasional Anda</p>
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
                      class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      autocomplete="username"
                      placeholder="Masukkan username"
                    />
                  </div>

                  <div>
                    <label class="text-sm font-medium text-muted-foreground">Password</label>
                    <input
                      v-model="form.password"
                      type="password"
                      class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
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
    </div>
  </div>
</template>

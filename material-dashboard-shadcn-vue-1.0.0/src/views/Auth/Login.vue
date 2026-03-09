<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Card from '@/components/ui/Card.vue'
import CardHeader from '@/components/ui/CardHeader.vue'
import CardContent from '@/components/ui/CardContent.vue'
import Button from '@/components/ui/Button.vue'
import { useAuth } from '@/composables/useAuth'
import { useTheme } from '@/composables/useTheme'
import { MoonStar, SunMedium } from 'lucide-vue-next'
import sankyuLogo from '../../../img/logo_sankyu.png'

const router = useRouter()
const route = useRoute()
const { login } = useAuth()
const { isDark, toggleTheme } = useTheme()

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
  <div class="relative min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div class="absolute left-[-5rem] top-[-5rem] h-40 w-40 rounded-full bg-primary/12 blur-3xl"></div>
      <div class="absolute bottom-0 right-[-4rem] h-48 w-48 rounded-full bg-sky-500/12 blur-3xl"></div>
    </div>
    <div class="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
      <button
        type="button"
        class="inline-flex h-11 items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 text-sm font-medium shadow-sm backdrop-blur-sm hover:bg-accent/70"
        :aria-label="isDark ? 'Aktifkan light mode' : 'Aktifkan dark mode'"
        @click="toggleTheme"
      >
        <SunMedium v-if="isDark" :size="16" />
        <MoonStar v-else :size="16" />
        <span>{{ isDark ? 'Light' : 'Dark' }}</span>
      </button>
    </div>
    <div class="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
      <div class="w-full overflow-hidden rounded-[28px] border border-border/70 bg-card/90 shadow-[0_35px_70px_-40px_hsl(var(--foreground)/0.45)] backdrop-blur-xl">
        <div class="h-1 bg-primary"></div>
        <div class="grid lg:grid-cols-[1.1fr_0.9fr]">
          <section class="order-2 border-t border-border/80 p-6 sm:p-8 lg:order-1 lg:border-r lg:border-t-0 lg:p-10">
            <p
              class="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary"
            >
              Operational Portal
            </p>

            <div class="mt-5 flex items-start gap-4">
              <div class="shrink-0 rounded-2xl bg-card/90 p-2 ring-1 ring-border/70 shadow-sm backdrop-blur-sm">
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

          <section class="order-1 bg-muted/30 p-6 sm:p-8 lg:order-2 lg:p-10">
            <Card class="mx-auto w-full max-w-md border-border/70 bg-card/90 shadow-none backdrop-blur-sm">
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

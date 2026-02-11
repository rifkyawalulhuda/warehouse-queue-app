<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Menu, User, LogOut, ChevronDown } from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'
import Button from '@/components/ui/Button.vue'

defineProps<{
  onToggleSidebar: () => void
}>()

const router = useRouter()
const route = useRoute()
const { user, logout } = useAuth()
const searchQuery = ref('')
const accountDropdownOpen = ref(false)
const confirmLogoutOpen = ref(false)
const loggingOut = ref(false)
const displayUserName = computed(() => user.value?.name || 'Account')

const handleSearch = (e: Event) => {
  e.preventDefault()
  const query = searchQuery.value.trim()
  const currentPath = route.path
  const targetPath =
    currentPath === '/antrian-truk' || currentPath === '/schedule-pengiriman'
      ? currentPath
      : '/antrian-truk'

  const nextQuery: Record<string, any> = targetPath === currentPath ? { ...route.query } : {}
  if (query) {
    nextQuery.search = query
  } else {
    delete nextQuery.search
  }
  router.push({ path: targetPath, query: nextQuery })
}

const toggleAccountDropdown = () => {
  accountDropdownOpen.value = !accountDropdownOpen.value
}

const closeAccountDropdown = () => {
  accountDropdownOpen.value = false
}

const openLogoutConfirm = () => {
  confirmLogoutOpen.value = true
  closeAccountDropdown()
}

const closeLogoutConfirm = () => {
  if (loggingOut.value) return
  confirmLogoutOpen.value = false
}

const handleLogout = async () => {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await logout()
    confirmLogoutOpen.value = false
    await router.push('/login')
  } finally {
    loggingOut.value = false
  }
}

watch(
  () => route.query.search,
  (value) => {
    searchQuery.value = typeof value === 'string' ? value : ''
  },
  { immediate: true }
)
</script>

<template>
  <nav class="bg-card border-b sticky top-0 z-40">
    <div class="px-4 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-4">
          <button
            @click="onToggleSidebar"
            class="lg:hidden p-2 hover:bg-accent rounded-md"
            aria-label="Toggle menu"
          >
            <Menu :size="20" />
          </button>

          <form @submit="handleSearch" class="hidden md:block">
            <div class="relative">
              <Search :size="18" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                v-model="searchQuery"
                type="search"
                placeholder="Search..."
                class="pl-10 pr-4 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary w-64 lg:w-96"
              />
            </div>
          </form>
        </div>

        <div class="flex items-center gap-2">
          <button
            @click="onToggleSidebar"
            class="hidden lg:block p-2 hover:bg-accent rounded-md"
            aria-label="Toggle sidebar"
          >
            <Menu :size="20" />
          </button>

          <div class="relative">
            <button
              @click="toggleAccountDropdown"
              class="flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md"
              aria-label="Account menu"
            >
              <div class="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <User :size="18" />
              </div>
              <span class="hidden sm:block text-sm font-medium">{{ displayUserName }}</span>
              <ChevronDown :size="16" class="hidden sm:block" />
            </button>

            <div
              v-if="accountDropdownOpen"
              @click="closeAccountDropdown"
              class="fixed inset-0 z-40"
            ></div>

            <transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform opacity-0 scale-95"
              enter-to-class="transform opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform opacity-100 scale-100"
              leave-to-class="transform opacity-0 scale-95"
            >
              <div
                v-if="accountDropdownOpen"
                class="absolute right-0 mt-2 w-56 bg-card border rounded-md shadow-lg py-1 z-50"
              >
                <div class="px-4 py-3 border-b">
                  <p class="text-sm font-medium">{{ user?.name || 'User' }}</p>
                  <p class="text-xs text-muted-foreground">{{ user?.username || '-' }}</p>
                </div>

                <button
                  @click="openLogoutConfirm"
                  class="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent text-red-600"
                >
                  <LogOut :size="16" />
                  <span>Logout</span>
                </button>
              </div>
            </transition>
          </div>
        </div>
      </div>

      <div class="md:hidden pb-3">
        <form @submit="handleSearch">
          <div class="relative">
            <Search :size="18" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              v-model="searchQuery"
              type="search"
              placeholder="Search..."
              class="w-full pl-10 pr-4 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </form>
      </div>
    </div>
  </nav>

  <div v-if="confirmLogoutOpen" class="fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/40" @click="closeLogoutConfirm"></div>
    <div
      class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card shadow-xl border"
    >
      <div class="p-4 border-b">
        <h3 class="text-lg font-semibold">Konfirmasi Logout</h3>
        <p class="text-sm text-muted-foreground mt-1">
          Apakah Anda yakin ingin keluar dari akun ini?
        </p>
      </div>
      <div class="p-4 border-t flex items-center justify-end gap-2">
        <Button variant="ghost" :disabled="loggingOut" @click="closeLogoutConfirm">Batal</Button>
        <Button variant="outline" class="border-red-200 bg-red-600 text-white hover:bg-red-700 hover:text-white" :disabled="loggingOut" @click="handleLogout">
          {{ loggingOut ? 'Memproses...' : 'Ya, Logout' }}
        </Button>
      </div>
    </div>
  </div>
</template>

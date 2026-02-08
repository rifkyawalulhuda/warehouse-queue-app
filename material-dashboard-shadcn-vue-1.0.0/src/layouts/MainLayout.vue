<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import Navbar from '@/components/Navbar.vue'
import Footer from '@/components/Footer.vue'
import { useAuth } from '@/composables/useAuth'
import {
  LayoutDashboard,
  UserCog,
  UserPlus,
  Truck,
  ChevronLeft,
  ChevronRight
} from 'lucide-vue-next'

const route = useRoute()
const { user } = useAuth()
const sidebarOpen = ref(true)
const isMobile = ref(false)

const navigation = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'WAREHOUSE'] },
  { name: 'Master Customer', path: '/master-customer', icon: UserPlus, roles: ['ADMIN'] },
  { name: 'Master Admin', path: '/master-admin', icon: UserCog, roles: ['ADMIN'] },
  { name: 'Antrian Truk', path: '/antrian-truk', icon: Truck, roles: ['ADMIN', 'WAREHOUSE'] }
]

const filteredNavigation = computed(() => {
  if (!user.value?.role) return navigation
  return navigation.filter((item) => !item.roles || item.roles.includes(user.value?.role))
})

const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024
  if (isMobile.value) {
    sidebarOpen.value = false
  } else {
    sidebarOpen.value = true
  }
}

const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value
}

const closeSidebarOnMobile = () => {
  if (isMobile.value) {
    sidebarOpen.value = false
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<template>
  <div class="flex h-screen bg-background">
    <div v-if="sidebarOpen && isMobile" @click="closeSidebarOnMobile" class="fixed inset-0 bg-black/50 z-40 lg:hidden">
    </div>

    <aside :class="[
      'bg-card border-r transition-all duration-300 flex flex-col fixed lg:relative h-full z-50 overflow-hidden',
      isMobile ? (sidebarOpen ? 'w-64' : 'w-0') : (sidebarOpen ? 'w-64' : 'w-16'),
      isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'
    ]">
      <div class="p-4 border-b flex items-center justify-between">
        <h3 v-if="sidebarOpen" class="text-sm font-semibold">PT. SANKYU INDONESIA</h3>
        <button @click="toggleSidebar" class="p-2 hover:bg-accent rounded-md hidden lg:block"
          :class="{ 'mx-auto': !sidebarOpen }">
          <ChevronRight v-if="!sidebarOpen" :size="20" />
          <ChevronLeft v-else :size="20" />
        </button>
      </div>

      <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
        <router-link v-for="item in filteredNavigation" :key="item.path" :to="item.path" @click="closeSidebarOnMobile" :class="[
          'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm',
          route.path === item.path
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-accent hover:text-accent-foreground'
        ]">
          <component :is="item.icon" :size="20" />
          <span v-if="sidebarOpen">{{ item.name }}</span>
        </router-link>
      </nav>
    </aside>

    <div class="flex-1 flex flex-col overflow-hidden">
      <Navbar :on-toggle-sidebar="toggleSidebar" />

      <main class="flex-1 overflow-auto">
        <div class="p-4 md:p-8">
          <RouterView />
        </div>
      </main>

      <Footer />
    </div>
  </div>
</template>

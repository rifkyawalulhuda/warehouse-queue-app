<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import Navbar from '@/components/Navbar.vue'
import Footer from '@/components/Footer.vue'
import { useAuth } from '@/composables/useAuth'
import {
  LayoutDashboard,
  Database,
  Truck,
  Package,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-vue-next'

const route = useRoute()
const { user } = useAuth()
const sidebarOpen = ref(true)
const isMobile = ref(false)

type NavItem = {
  name: string
  path?: string
  icon?: any
  roles?: string[]
  children?: Array<{
    name: string
    path: string
    roles?: string[]
  }>
}

const navigation: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'WAREHOUSE', 'CS'] },
  {
    name: 'Master Data',
    icon: Database,
    roles: ['ADMIN'],
    children: [
      { name: 'Master Customer', path: '/master-customer', roles: ['ADMIN'] },
      { name: 'Master Gate', path: '/master-gate', roles: ['ADMIN', 'WAREHOUSE', 'CS'] },
      { name: 'Master Admin', path: '/master-admin', roles: ['ADMIN'] },
      { name: 'Master Karyawan', path: '/master-karyawan', roles: ['ADMIN'] }
    ]
  },
  { name: 'Antrian Truk', path: '/antrian-truk', icon: Truck, roles: ['ADMIN', 'WAREHOUSE', 'CS'] },
  { name: 'Picking Progress', path: '/picking-progress', icon: Package, roles: ['ADMIN', 'WAREHOUSE', 'CS'] },
  { name: 'Schedule Pengiriman', path: '/schedule-pengiriman', icon: CalendarDays, roles: ['ADMIN', 'WAREHOUSE', 'CS'] }
]

const filteredNavigation = computed(() => {
  if (!user.value?.role) return navigation
  const role = user.value.role
  return navigation
    .map((item) => {
      if (item.children) {
        if (item.roles && !item.roles.includes(role)) return null
        const children = item.children.filter((child) => !child.roles || child.roles.includes(role))
        if (children.length === 0) return null
        return { ...item, children }
      }
      if (!item.roles || item.roles.includes(role)) return item
      return null
    })
    .filter(Boolean) as NavItem[]
})

const openGroups = ref<Record<string, boolean>>({})

const isGroupActive = (item: NavItem) => {
  return Boolean(item.children?.some((child) => child.path === route.path))
}

const isGroupOpen = (item: NavItem) => {
  if (isGroupActive(item)) return true
  return Boolean(openGroups.value[item.name])
}

const toggleGroup = (item: NavItem) => {
  if (isGroupActive(item)) {
    openGroups.value[item.name] = true
    return
  }
  openGroups.value[item.name] = !isGroupOpen(item)
}

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

watch(
  () => route.path,
  () => {
    filteredNavigation.value.forEach((item) => {
      if (item.children && isGroupActive(item)) {
        openGroups.value[item.name] = true
      }
    })
  },
  { immediate: true }
)
</script>

<template>
  <div class="relative flex h-screen overflow-hidden bg-background text-foreground">
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute left-[-8rem] top-[-8rem] h-64 w-64 rounded-full bg-primary/10 blur-3xl"></div>
      <div class="absolute right-[-6rem] top-24 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl"></div>
      <div class="absolute bottom-[-8rem] left-1/3 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl"></div>
    </div>

    <div
      v-if="sidebarOpen && isMobile"
      @click="closeSidebarOnMobile"
      class="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
    >
    </div>

    <aside :class="[
      'fixed z-50 flex h-full flex-col overflow-hidden border-r border-border/70 bg-card/80 shadow-2xl shadow-black/10 backdrop-blur-xl transition-all duration-300 lg:relative',
      isMobile ? (sidebarOpen ? 'w-64' : 'w-0') : (sidebarOpen ? 'w-64' : 'w-16'),
      isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'
    ]">
      <div class="flex items-center justify-between border-b border-border/70 px-4 py-5">
        <div v-if="sidebarOpen" class="space-y-1">
          <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/80">Warehouse Hub</p>
          <h3 class="text-sm font-semibold tracking-tight">PT. SANKYU INDONESIA</h3>
        </div>
        <button @click="toggleSidebar" class="hidden rounded-xl border border-border/60 bg-background/60 p-2 hover:bg-accent lg:block"
          :class="{ 'mx-auto': !sidebarOpen }">
          <ChevronRight v-if="!sidebarOpen" :size="20" />
          <ChevronLeft v-else :size="20" />
        </button>
      </div>

      <nav class="flex-1 space-y-2 overflow-y-auto p-4">
        <template v-for="item in filteredNavigation" :key="item.name">
          <div v-if="item.children" class="space-y-1.5">
            <button
              type="button"
              @click="toggleGroup(item)"
              :class="[
                'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all',
                isGroupActive(item)
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'hover:bg-accent/70 hover:text-accent-foreground'
              ]"
            >
              <component :is="item.icon" :size="20" />
              <span v-if="sidebarOpen" class="flex-1 text-left">{{ item.name }}</span>
              <ChevronDown
                v-if="sidebarOpen"
                :size="16"
                :class="['transition-transform', isGroupOpen(item) ? 'rotate-180' : 'rotate-0']"
              />
            </button>
            <div v-if="sidebarOpen && isGroupOpen(item)" class="space-y-1.5 pl-4">
              <router-link
                v-for="child in item.children"
                :key="child.path"
                :to="child.path"
                @click="closeSidebarOnMobile"
                :class="[
                  'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-all',
                  route.path === child.path
                    ? 'bg-primary/12 text-primary ring-1 ring-primary/20'
                    : 'hover:bg-accent/55 hover:text-accent-foreground'
                ]"
              >
                <span>{{ child.name }}</span>
              </router-link>
            </div>
          </div>
          <router-link
            v-else-if="item.path"
            :key="item.path"
            :to="item.path"
            @click="closeSidebarOnMobile"
            :class="[
              'flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all',
              route.path === item.path
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'hover:bg-accent/70 hover:text-accent-foreground'
            ]"
          >
            <component :is="item.icon" :size="20" />
            <span v-if="sidebarOpen">{{ item.name }}</span>
          </router-link>
        </template>
      </nav>
    </aside>

    <div class="relative flex flex-1 flex-col overflow-hidden">
      <Navbar :on-toggle-sidebar="toggleSidebar" />

      <main class="relative flex-1 overflow-auto">
        <div class="mx-auto w-full max-w-[1600px] p-4 md:p-8">
          <RouterView />
        </div>
      </main>

      <Footer />
    </div>
  </div>
</template>

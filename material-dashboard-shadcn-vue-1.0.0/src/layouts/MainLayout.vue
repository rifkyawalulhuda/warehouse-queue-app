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
      { name: 'Master Admin', path: '/master-admin', roles: ['ADMIN'] }
    ]
  },
  { name: 'Antrian Truk', path: '/antrian-truk', icon: Truck, roles: ['ADMIN', 'WAREHOUSE', 'CS'] },
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
        <template v-for="item in filteredNavigation" :key="item.name">
          <div v-if="item.children" class="space-y-1">
            <button
              type="button"
              @click="toggleGroup(item)"
              :class="[
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm',
                isGroupActive(item)
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
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
            <div v-if="sidebarOpen && isGroupOpen(item)" class="space-y-1 pl-7">
              <router-link
                v-for="child in item.children"
                :key="child.path"
                :to="child.path"
                @click="closeSidebarOnMobile"
                :class="[
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm',
                  route.path === child.path
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
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
              'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm',
              route.path === item.path
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            ]"
          >
            <component :is="item.icon" :size="20" />
            <span v-if="sidebarOpen">{{ item.name }}</span>
          </router-link>
        </template>
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

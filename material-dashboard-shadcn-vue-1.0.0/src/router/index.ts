import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import { useAuth } from '@/composables/useAuth'

const router = createRouter({
  history: createWebHistory('/material-dashboard-shadcn-vue/'),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Auth/Login.vue'),
      meta: { public: true }
    },
    {
      path: '/display/antrian-truk',
      name: 'Display Antrian Truk',
      component: () => import('@/views/Display/DisplayAntrianTruk.vue'),
      meta: { public: true }
    },
    {
      path: '/',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/dashboard'
        },
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('@/views/Dashboard.vue')
        },
        {
          path: 'contacts',
          name: 'Contacts',
          component: () => import('@/views/Contacts.vue')
        },
        {
          path: 'companies',
          name: 'Companies',
          component: () => import('@/views/Companies.vue')
        },
        {
          path: 'deals',
          name: 'Deals',
          component: () => import('@/views/Deals.vue')
        },
        {
          path: 'tasks',
          name: 'Tasks',
          component: () => import('@/views/Tasks.vue')
        },
        {
          path: 'master-customers',
          name: 'Master Customer',
          component: () => import('@/views/MasterCustomer/CustomerList.vue'),
          meta: { roles: ['ADMIN'] }
        },
        {
          path: 'master-admins',
          name: 'Master Admin',
          component: () => import('@/views/MasterAdmin/AdminList.vue'),
          meta: { roles: ['ADMIN'] }
        },
        {
          path: 'queue',
          name: 'Antrian Truk',
          component: () => import('@/views/Queue/QueueList.vue'),
          meta: { roles: ['ADMIN', 'WAREHOUSE'] }
        },
        {
          path: 'reports',
          name: 'Reports',
          component: () => import('@/views/Reports.vue')
        },
        {
          path: 'billing',
          name: 'Billing',
          component: () => import('@/views/Billing.vue')
        },
        {
          path: 'settings',
          name: 'Settings',
          component: () => import('@/views/Settings.vue')
        },
        {
          path: 'docs',
          name: 'Docs',
          component: () => import('@/views/Docs.vue')
        }
      ]
    }
  ]
})

router.beforeEach((to) => {
  const { initFromStorage, isAuthenticated, user } = useAuth()
  initFromStorage()

  if (to.meta.public) {
    if (to.name === 'Login' && isAuthenticated.value) {
      return user.value?.role === 'WAREHOUSE' ? '/queue' : '/dashboard'
    }
    return true
  }

  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  if (!requiresAuth) return true

  if (!isAuthenticated.value || !user.value) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  const roles = to.meta.roles as string[] | undefined
  if (roles && !roles.includes(user.value.role)) {
    return user.value.role === 'WAREHOUSE' ? '/queue' : '/dashboard'
  }

  return true
})

export default router

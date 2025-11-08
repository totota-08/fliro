import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'
import SignUpPage from '@/pages/auth/SignUpPage.vue'
import LoginPage from '@/pages/auth/LoginPage.vue'
import AuthDebugPage from '@/pages/debug/AuthDebugPage.vue'
import DashboardDemoPage from '@/pages/demo/DashboardDemoPage.vue'
import MyTasksPage from '@/pages/demo/MyTasksPage.vue'
import TeamPage from '@/pages/demo/TeamPage.vue'
import NotFoundPage from '@/components/errorPage/404.vue'
import { useAuthStore, waitForAuthReady } from '@/store/auth'
import { ROUTE_NAMES } from '@/constants/routes'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: ROUTE_NAMES.home,
      component: HomePage,
      meta: { layout: 'full' },
    },
    {
      path: '/auth/signup',
      name: ROUTE_NAMES.signup,
      component: SignUpPage,
      meta: { layout: 'full' },
    },
    {
      path: '/auth/login',
      name: ROUTE_NAMES.login,
      component: LoginPage,
      meta: { layout: 'full' },
    },
    {
      path: '/debug/auth',
      name: ROUTE_NAMES.authDebug,
      component: AuthDebugPage,
      meta: { requiresAuth: true, layout: 'full' },
    },
    {
      path: '/demo/dashboard',
      name: 'demo.dashboard',
      component: DashboardDemoPage,
    },
    {
      path: '/demo/tasks',
      name: 'demo.tasks',
      component: MyTasksPage,
    },
    {
      path: '/demo/team',
      name: 'demo.team',
      component: TeamPage,
    },
    {
      path: '/:pathMatch(.*)*',
      name: ROUTE_NAMES.notFound,
      component: NotFoundPage,
      meta: { layout: 'full' },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await waitForAuthReady()

  if (to.meta.requiresAuth && !auth.isAuthenticated.value) {
    return {
      name: ROUTE_NAMES.login,
      query: { redirect: to.fullPath },
    }
  }

  const authRestricted = [String(ROUTE_NAMES.login), String(ROUTE_NAMES.signup)]

  if (to.name && authRestricted.includes(String(to.name)) && auth.isAuthenticated.value) {
    return { name: ROUTE_NAMES.authDebug }
  }
})

export default router

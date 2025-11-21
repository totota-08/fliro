import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'
import SignUpPage from '@/pages/auth/SignUpPage.vue'
import LoginPage from '@/pages/auth/LoginPage.vue'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage.vue'
import ResetPasswordConfirmPage from '@/pages/auth/ResetPasswordConfirmPage.vue'
import VerifyEmailPage from '@/pages/auth/VerifyEmailPage.vue'
import AuthDebugPage from '@/pages/debug/AuthDebugPage.vue'
import ProjectDebugPage from '@/pages/debug/ProjectDebugPage.vue'
import DashboardDemoPage from '@/pages/demo/DashboardDemoPage.vue'
import DemoMyTasksPage from '@/pages/demo/MyTasksPage.vue'
import TeamPage from '@/pages/demo/TeamPage.vue'
import NotFoundPage from '@/components/errorPage/404.vue'
import { useAuthStore, waitForAuthReady } from '@/store/auth'
import { ROUTE_NAMES } from '@/constants/routes'
import CreateProjectPage from '@/pages/projects/CreateProjectPage.vue'
import InviteAcceptPage from '@/pages/invite/InviteAcceptPage.vue'
import MyPage from '@/pages/account/MyPage.vue'
import SecretChatPage from '@/pages/secret/SecretChatPage.vue'
import SecretAccessPage from '@/pages/secret/SecretAccessPage.vue'
import ProjectDashboardPage from '@/pages/projects/ProjectDashboardPage.vue'
import ProjectChatPage from '@/pages/projects/ProjectChatPage.vue'
import ProjectMembersPage from '@/pages/projects/ProjectMembersPage.vue'
import MyTasksPage from '@/pages/tasks/MyTasksPage.vue'

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
      path: '/auth/reset/confirm',
      name: ROUTE_NAMES.passwordResetConfirm,
      component: ResetPasswordConfirmPage,
      meta: { layout: 'full' },
    },
    {
      path: '/auth/verify',
      name: ROUTE_NAMES.verifyEmail,
      component: VerifyEmailPage,
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
      path: '/auth/reset',
      name: ROUTE_NAMES.passwordReset,
      component: ResetPasswordPage,
      meta: { layout: 'full' },
    },
    {
      path: '/debug/auth',
      name: ROUTE_NAMES.authDebug,
      component: AuthDebugPage,
      meta: { requiresAuth: true, layout: 'full' },
    },
    {
      path: '/debug/projects/new',
      name: ROUTE_NAMES.projectCreate,
      component: CreateProjectPage,
      meta: { requiresAuth: true, layout: 'full' },
    },
    {
      path: '/debug/projects/:projectId',
      name: ROUTE_NAMES.projectDebug,
      component: ProjectDebugPage,
      meta: { requiresAuth: true, layout: 'full' },
    },
    {
      path: '/projects/:projectId/dashboard',
      name: ROUTE_NAMES.projectDashboard,
      component: ProjectDashboardPage,
      meta: { requiresAuth: true, section: 'dashboard' },
    },
    {
      path: '/projects/:projectId/chat',
      name: ROUTE_NAMES.projectChat,
      component: ProjectChatPage,
      meta: { requiresAuth: true, section: 'team' },
    },
    {
      path: '/projects/:projectId/members',
      name: ROUTE_NAMES.projectMembers,
      component: ProjectMembersPage,
      meta: { requiresAuth: true, section: 'members' },
    },
    {
      path: '/tasks',
      name: ROUTE_NAMES.myTasks,
      component: MyTasksPage,
      meta: { requiresAuth: true, section: 'tasks' },
    },
    {
      path: '/invite/:token',
      name: ROUTE_NAMES.inviteAccept,
      component: InviteAcceptPage,
      meta: { layout: 'full' },
    },
    {
      path: '/my',
      name: ROUTE_NAMES.myPage,
      component: MyPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/secret/chat',
      name: ROUTE_NAMES.secretChat,
      component: SecretChatPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/secret/access',
      name: ROUTE_NAMES.secretAccess,
      component: SecretAccessPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/demo/dashboard',
      name: 'demo.dashboard',
      component: DashboardDemoPage,
    },
    {
      path: '/demo/tasks',
      name: 'demo.tasks',
      component: DemoMyTasksPage,
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
    const needsSetup = Boolean(auth.profile.value && auth.profile.value.setUp === false)
    const goingToSignup = String(to.name) === String(ROUTE_NAMES.signup)
    const explicitlySetupFlow = String(to.query.setup) === 'false'

    if (goingToSignup && (needsSetup || explicitlySetupFlow)) {
      return true
    }

    return { name: ROUTE_NAMES.myPage }
  }
})

export default router

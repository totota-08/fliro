import ErrorPage from "@/components/errorPage/ErrorPage.vue";
import NotFoundPage from "@/components/errorPage/404.vue";
import { ROUTE_REQUIRED_PERMISSIONS } from "@/constants/permissions";
import { ROUTE_NAMES } from "@/constants/routes";
import { fetchProjectAccess } from "@/composables/useProjectAccess";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.router");
import HomePage from "@/pages/HomePage.vue";
import MyPage from "@/pages/account/MyPage.vue";
import AccountSettingsPage from "@/pages/account/AccountSettingsPage.vue";
import LoginPage from "@/pages/auth/LoginPage.vue";
import ResetPasswordConfirmPage from "@/pages/auth/ResetPasswordConfirmPage.vue";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage.vue";
import SignUpPage from "@/pages/auth/SignUpPage.vue";
import VerifyEmailPage from "@/pages/auth/VerifyEmailPage.vue";
import AuthDebugPage from "@/pages/debug/AuthDebugPage.vue";
import ProjectDebugPage from "@/pages/debug/ProjectDebugPage.vue";
import DashboardDemoPage from "@/pages/demo/DashboardDemoPage.vue";
import DemoMyTasksPage from "@/pages/demo/MyTasksPage.vue";
import TeamPage from "@/pages/demo/TeamPage.vue";
import InviteAcceptPage from "@/pages/invite/InviteAcceptPage.vue";
import CreateProjectPage from "@/pages/projects/CreateProjectPage.vue";
import ProjectActivityLogPage from "@/pages/projects/ProjectActivityLogPage.vue";
import ProjectCategoriesPage from "@/pages/projects/ProjectCategoriesPage.vue";
import ProjectChatPage from "@/pages/projects/ProjectChatPage.vue";
import ProjectDashboardPage from "@/pages/projects/ProjectDashboardPage.vue";
import ProjectInvitesPage from "@/pages/projects/ProjectInvitesPage.vue";
import ProjectMembersPage from "@/pages/projects/ProjectMembersPage.vue";
import ProjectNotificationsPage from "@/pages/projects/ProjectNotificationsPage.vue";
import ProjectRolesPage from "@/pages/projects/ProjectRolesPage.vue";
import ProjectSettingsPage from "@/pages/projects/ProjectSettingsPage.vue";
import SecretAccessPage from "@/pages/secret/SecretAccessPage.vue";
import SecretChatPage from "@/pages/secret/SecretChatPage.vue";
import MyTasksPage from "@/pages/tasks/MyTasksPage.vue";
import TaskProgressPage from "@/pages/tasks/TaskProgressPage.vue";
import { useAuthStore, waitForAuthReady } from "@/store/auth";
import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: ROUTE_NAMES.home,
      component: HomePage,
      meta: { layout: "full" },
    },
    {
      path: "/auth/reset/confirm",
      name: ROUTE_NAMES.passwordResetConfirm,
      component: ResetPasswordConfirmPage,
      meta: { layout: "full" },
    },
    {
      path: "/auth/verify",
      name: ROUTE_NAMES.verifyEmail,
      component: VerifyEmailPage,
      meta: { layout: "full" },
    },
    {
      path: "/auth/signup",
      name: ROUTE_NAMES.signup,
      component: SignUpPage,
      meta: { layout: "full" },
    },
    {
      path: "/auth/login",
      name: ROUTE_NAMES.login,
      component: LoginPage,
      meta: { layout: "full" },
    },
    {
      path: "/auth/reset",
      name: ROUTE_NAMES.passwordReset,
      component: ResetPasswordPage,
      meta: { layout: "full" },
    },
    {
      path: "/debug/auth",
      name: ROUTE_NAMES.authDebug,
      component: AuthDebugPage,
      meta: { requiresAuth: true, layout: "full" },
    },
    {
      path: "/debug/projects/new",
      name: ROUTE_NAMES.projectCreate,
      component: CreateProjectPage,
      meta: { requiresAuth: true, layout: "full" },
    },
    {
      path: "/debug/projects/:projectId",
      name: ROUTE_NAMES.projectDebug,
      component: ProjectDebugPage,
      meta: { requiresAuth: true, layout: "full" },
    },
    {
      path: "/projects/:projectId/dashboard",
      name: ROUTE_NAMES.projectDashboard,
      component: ProjectDashboardPage,
      meta: { requiresAuth: true, section: "dashboard" },
    },
    {
      path: "/projects/:projectId/threads",
      name: ROUTE_NAMES.projectThreads,
      component: ProjectChatPage,
      meta: { requiresAuth: true, section: "team" },
    },
    {
      path: "/projects/:projectId/members",
      name: ROUTE_NAMES.projectMembers,
      component: ProjectMembersPage,
      meta: { requiresAuth: true, section: "members" },
    },
    {
      path: "/projects/:projectId/invites",
      name: ROUTE_NAMES.projectInvites,
      component: ProjectInvitesPage,
      meta: { requiresAuth: true, section: "invites" },
    },
    {
      path: "/projects/:projectId/roles",
      name: ROUTE_NAMES.projectRoles,
      component: ProjectRolesPage,
      meta: { requiresAuth: true, section: "members" },
    },
    {
      path: "/projects/:projectId/categories",
      name: ROUTE_NAMES.projectCategories,
      component: ProjectCategoriesPage,
      meta: { requiresAuth: true, section: "settings" },
    },
    {
      path: "/projects/:projectId/activity",
      name: ROUTE_NAMES.projectActivity,
      component: ProjectActivityLogPage,
      meta: { requiresAuth: true, section: "timeline" },
    },
    {
      path: "/projects/:projectId/settings",
      name: ROUTE_NAMES.projectSettings,
      component: ProjectSettingsPage,
      meta: { requiresAuth: true, section: "settings" },
    },
    {
      path: "/projects/:projectId/notifications",
      name: ROUTE_NAMES.projectNotifications,
      component: ProjectNotificationsPage,
      meta: { requiresAuth: true, section: "notifications" },
    },
    {
      path: "/projects/:projectId/tasks/:taskId",
      name: ROUTE_NAMES.projectTaskDetail,
      redirect: (to) => ({
        name: ROUTE_NAMES.projectDashboard,
        params: { projectId: to.params.projectId },
        query: { taskId: to.params.taskId },
      }),
    },
    {
      path: "/projects/:projectId/scores",
      name: ROUTE_NAMES.projectScores,
      component: () => import("@/pages/projects/ProjectScoresPage.vue"),
      meta: { requiresAuth: true, section: "scores" },
    },
    {
      path: "/tasks",
      name: ROUTE_NAMES.myTasks,
      component: MyTasksPage,
      meta: { requiresAuth: true, section: "tasks" },
    },
    {
      path: "/tasks/progress",
      name: ROUTE_NAMES.taskProgress,
      component: TaskProgressPage,
      meta: { requiresAuth: true, section: "tasks" },
    },
    {
      path: "/invite/:token",
      name: ROUTE_NAMES.inviteAccept,
      component: InviteAcceptPage,
      meta: { layout: "full" },
    },
    {
      path: "/my",
      name: ROUTE_NAMES.myPage,
      component: MyPage,
      meta: { requiresAuth: true },
    },
    {
      path: "/my/settings",
      name: ROUTE_NAMES.accountSettings,
      component: AccountSettingsPage,
      meta: { requiresAuth: true },
    },
    {
      path: "/secret/chat",
      name: ROUTE_NAMES.secretChat,
      component: SecretChatPage,
      meta: { requiresAuth: true },
    },
    {
      path: "/secret/access",
      name: ROUTE_NAMES.secretAccess,
      component: SecretAccessPage,
      meta: { requiresAuth: true },
    },
    {
      path: "/demo/dashboard",
      name: "demo.dashboard",
      component: DashboardDemoPage,
    },
    {
      path: "/demo/tasks",
      name: "demo.tasks",
      component: DemoMyTasksPage,
    },
    {
      path: "/demo/team",
      name: "demo.team",
      component: TeamPage,
    },
    {
      path: "/error",
      name: ROUTE_NAMES.error,
      component: ErrorPage,
      meta: { layout: "full" },
    },
    {
      path: "/forbidden",
      name: ROUTE_NAMES.forbidden,
      redirect: (to) => ({
        name: ROUTE_NAMES.error,
        query: { ...to.query, errorType: "forbidden" },
      }),
    },
    {
      path: "/:pathMatch(.*)*",
      name: ROUTE_NAMES.notFound,
      component: NotFoundPage,
      meta: { layout: "full" },
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  const requiresAuth = to.matched.some(
    (record) => record.meta.requiresAuth === true,
  );
  const authRestricted = [
    String(ROUTE_NAMES.login),
    String(ROUTE_NAMES.signup),
  ];
  const needsAuthCheck =
    requiresAuth || (to.name && authRestricted.includes(String(to.name)));

  if (!needsAuthCheck) {
    return true;
  }

  await waitForAuthReady();

  let user = null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    logger.error`Auth check failed: ${error}`;
    return { name: ROUTE_NAMES.login };
  }

  if (requiresAuth && !user) {
    return {
      name: ROUTE_NAMES.login,
      query: { redirect: to.fullPath },
    };
  }

  if (to.name && authRestricted.includes(String(to.name)) && user) {
    const needsSetup = Boolean(
      auth.profile.value && auth.profile.value.setUp === false,
    );
    const goingToSignup = String(to.name) === String(ROUTE_NAMES.signup);
    const explicitlySetupFlow = String(to.query.setup) === "false";

    if (goingToSignup && (needsSetup || explicitlySetupFlow)) {
      return true;
    }

    return { name: ROUTE_NAMES.myPage };
  }

  // プロジェクト権限チェック
  const projectId = to.params.projectId as string | undefined;
  const routeName = to.name as
    | (typeof ROUTE_NAMES)[keyof typeof ROUTE_NAMES]
    | undefined;

  if (projectId && routeName && user) {
    const requiredPermission = ROUTE_REQUIRED_PERMISSIONS[routeName];

    // undefined = 権限チェック不要, null = 認証のみ必要
    if (requiredPermission !== undefined && requiredPermission !== null) {
      const access = await fetchProjectAccess(projectId, user.uid);

      // ネットワークエラーの場合
      if (access.error === "network") {
        logger.error`Network error during permission check for project ${projectId}`;
        return {
          name: ROUTE_NAMES.error,
          query: {
            projectId,
            errorType: "network",
            reason: "サーバーとの通信中にエラーが発生しました。",
          },
        };
      }

      // プロジェクトが存在しない場合
      if (access.error === "not_found") {
        logger.warn`Project not found: ${projectId}`;
        return {
          name: ROUTE_NAMES.error,
          query: {
            projectId,
            errorType: "not_found",
            reason: "指定されたプロジェクトは存在しません。",
          },
        };
      }

      // プロジェクトにアクセス権がない場合
      if (!access.hasAccess) {
        return {
          name: ROUTE_NAMES.error,
          query: {
            projectId,
            errorType: "forbidden",
            reason: "このプロジェクトのメンバーではありません。",
          },
        };
      }

      // owner/adminは全権限を持つ（fetchProjectAccessで既に判定済み）
      // ロールベースの権限チェック（Firestoreから取得した権限を使用）
      const hasPermission = access.permissions.includes(requiredPermission);

      if (!hasPermission) {
        logger.warn`Permission denied: ${access.role} does not have ${requiredPermission}`;
        return {
          name: ROUTE_NAMES.error,
          query: {
            projectId,
            errorType: "forbidden",
            reason: "このページにアクセスする権限がありません。",
          },
        };
      }
    }
  }

  return true;
});

export default router;

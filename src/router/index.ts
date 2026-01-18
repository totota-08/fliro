import ErrorPage from "@/components/errorPage/ErrorPage.vue";
import { ROUTE_REQUIRED_PERMISSIONS } from "@/constants/permissions";
import { ROUTE_NAMES } from "@/constants/routes";
import { fetchProjectAccess } from "@/composables/useProjectAccess";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.router");

// 初回アクセスで必要なページのみ静的インポート
import HomePage from "@/pages/HomePage.vue";
import LoginPage from "@/pages/auth/LoginPage.vue";
import ProjectLayout from "@/layouts/ProjectLayout.vue";

import { useAuthStore, waitForAuthReady } from "@/store/auth";
import { createRouter, createWebHistory } from "vue-router";

// 動的インポート関数（コード分割用）
const MyPage = () => import("@/pages/account/MyPage.vue");
const AccountSettingsPage = () =>
  import("@/pages/account/AccountSettingsPage.vue");
const ResetPasswordConfirmPage = () =>
  import("@/pages/auth/ResetPasswordConfirmPage.vue");
const ResetPasswordPage = () => import("@/pages/auth/ResetPasswordPage.vue");
const SignUpPage = () => import("@/pages/auth/SignUpPage.vue");
const VerifyEmailPage = () => import("@/pages/auth/VerifyEmailPage.vue");
const AuthDebugPage = () => import("@/pages/debug/AuthDebugPage.vue");
const ProjectDebugPage = () => import("@/pages/debug/ProjectDebugPage.vue");
const DashboardDemoPage = () => import("@/pages/demo/DashboardDemoPage.vue");
const DemoMyTasksPage = () => import("@/pages/demo/MyTasksPage.vue");
const TeamPage = () => import("@/pages/demo/TeamPage.vue");
const InviteAcceptPage = () => import("@/pages/invite/InviteAcceptPage.vue");
const CreateProjectPage = () =>
  import("@/pages/projects/CreateProjectPage.vue");
const ProjectActivityLogPage = () =>
  import("@/pages/projects/ProjectActivityLogPage.vue");
const ProjectCategoriesPage = () =>
  import("@/pages/projects/ProjectCategoriesPage.vue");
const ProjectChatPage = () => import("@/pages/projects/ProjectChatPage.vue");
const ProjectDashboardPage = () =>
  import("@/pages/projects/ProjectDashboardPage.vue");
const ProjectInvitesPage = () =>
  import("@/pages/projects/ProjectInvitesPage.vue");
const ProjectMembersPage = () =>
  import("@/pages/projects/ProjectMembersPage.vue");
const ProjectNotificationsPage = () =>
  import("@/pages/projects/ProjectNotificationsPage.vue");
const ProjectRolesPage = () => import("@/pages/projects/ProjectRolesPage.vue");
const ProjectSettingsPage = () =>
  import("@/pages/projects/ProjectSettingsPage.vue");
const SecretAccessPage = () => import("@/pages/secret/SecretAccessPage.vue");
const SecretChatPage = () => import("@/pages/secret/SecretChatPage.vue");
const MyTasksPage = () => import("@/pages/tasks/MyTasksPage.vue");
const TaskProgressPage = () => import("@/pages/tasks/TaskProgressPage.vue");

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, from, savedPosition) {
    // ブラウザの戻る/進むボタンで保存された位置に戻る
    if (savedPosition) {
      return savedPosition;
    }

    // 同じパスでクエリパラメータのみが変更された場合（TaskDrawerの開閉など）
    // スクロール位置を維持する
    if (to.path === from.path) {
      return false; // スクロール位置を変更しない
    }

    // 新しいページへの遷移時はトップへスクロール
    return { top: 0 };
  },
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
      path: "/projects/new",
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
      path: "/projects/:projectId",
      component: ProjectLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: "dashboard",
          name: ROUTE_NAMES.projectDashboard,
          component: ProjectDashboardPage,
          meta: { section: "dashboard" },
        },
        {
          path: "threads",
          name: ROUTE_NAMES.projectThreads,
          component: ProjectChatPage,
          meta: { section: "team" },
        },
        {
          path: "members",
          name: ROUTE_NAMES.projectMembers,
          component: ProjectMembersPage,
          meta: { section: "members" },
        },
        {
          path: "invites",
          name: ROUTE_NAMES.projectInvites,
          component: ProjectInvitesPage,
          meta: { section: "invites" },
        },
        {
          path: "roles",
          name: ROUTE_NAMES.projectRoles,
          component: ProjectRolesPage,
          meta: { section: "members" },
        },
        {
          path: "categories",
          name: ROUTE_NAMES.projectCategories,
          component: ProjectCategoriesPage,
          meta: { section: "settings" },
        },
        {
          path: "activity",
          name: ROUTE_NAMES.projectActivity,
          component: ProjectActivityLogPage,
          meta: { section: "timeline" },
        },
        {
          path: "settings",
          name: ROUTE_NAMES.projectSettings,
          component: ProjectSettingsPage,
          meta: { section: "settings" },
        },
        {
          path: "notifications",
          name: ROUTE_NAMES.projectNotifications,
          component: ProjectNotificationsPage,
          meta: { section: "notifications" },
        },
        {
          path: "tasks/:taskId",
          name: ROUTE_NAMES.projectTaskDetail,
          redirect: (to) => ({
            name: ROUTE_NAMES.projectDashboard,
            params: { projectId: to.params.projectId },
            query: { taskId: to.params.taskId },
          }),
        },
        {
          path: "scores",
          name: ROUTE_NAMES.projectScores,
          component: () => import("@/pages/projects/ProjectScoresPage.vue"),
          meta: { section: "scores" },
        },
        {
          path: "tasks",
          name: ROUTE_NAMES.myTasks,
          component: MyTasksPage,
          meta: { section: "tasks" },
        },
      ],
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
      redirect: (to) => ({
        name: ROUTE_NAMES.error,
        query: { errorType: "path_not_found", path: to.fullPath },
      }),
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

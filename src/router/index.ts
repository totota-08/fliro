import ErrorPage from "@/components/errorPage/ErrorPage.vue";
import { fetchProjectAccess } from "@/composables/useProjectAccess";
import { ROUTE_TO_GUEST_PAGE } from "@/constants/guestPages";
import { ROUTE_REQUIRED_PERMISSIONS } from "@/constants/permissions";
import { ROUTE_NAMES } from "@/constants/routes";
import { db } from "@/lib/firebase";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getLogger } from "@logtape/logtape";
import { doc, getDoc } from "firebase/firestore";

const logger = getLogger("app.router");

// メンテナンスモードキャッシュ（30秒間有効）
interface MaintenanceCache {
  enabled: boolean;
  fetchedAt: number;
}
let maintenanceCache: MaintenanceCache | null = null;
const MAINTENANCE_CACHE_TTL = 30 * 1000; // 30秒

/**
 * メンテナンスモードの状態を取得する（キャッシュ付き）
 */
async function fetchMaintenanceStatus(): Promise<boolean> {
  const now = Date.now();

  // キャッシュが有効な場合はキャッシュを返す
  if (
    maintenanceCache &&
    now - maintenanceCache.fetchedAt < MAINTENANCE_CACHE_TTL
  ) {
    return maintenanceCache.enabled;
  }

  try {
    const docRef = doc(db, "appConfig", "maintenance");
    const docSnap = await getDoc(docRef);

    const enabled = docSnap.exists() ? docSnap.data()?.enabled === true : false;

    // キャッシュを更新
    maintenanceCache = {
      enabled,
      fetchedAt: now,
    };

    return enabled;
  } catch (error) {
    logger.error`Failed to fetch maintenance status: ${error}`;
    // エラー時はメンテナンスモードでないとみなす（サービス継続優先）
    return false;
  }
}

/**
 * ユーザーが管理者かどうかをチェックする
 */
async function isAdmin(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const idTokenResult = await user.getIdTokenResult();
    return idTokenResult.claims.admin === true;
  } catch (error) {
    logger.error`Failed to check admin status: ${error}`;
    return false;
  }
}

// 初回アクセスで必要なページのみ静的インポート
import HomePage from "@/pages/HomePage.vue";
import LoginPage from "@/pages/auth/LoginPage.vue";

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
const ChatDemoPage = () => import("@/pages/demo/ChatDemoPage.vue");
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
const AdminDashboardPage = () =>
  import("@/features/admin/pages/AdminDashboardPage.vue");
const MaintenancePage = () => import("@/pages/MaintenancePage.vue");

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
      component: () => import("@/layouts/ProjectLayout.vue"),
      meta: { requiresAuth: true, allowGuestAccess: true },
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
      path: "/demo/chat",
      name: "demo.chat",
      component: ChatDemoPage,
    },
    {
      path: "/admin",
      name: ROUTE_NAMES.admin,
      component: AdminDashboardPage,
      meta: { requiresAuth: true, requiresAdmin: true, layout: "full" },
    },
    {
      path: "/maintenance",
      name: ROUTE_NAMES.maintenance,
      component: MaintenancePage,
      meta: { layout: "full" },
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

  // ===========================================
  // 1. メンテナンスモードチェック（最初に実行）
  // ===========================================
  // メンテナンスページと管理者ページは除外
  const isMaintenancePage = to.name === ROUTE_NAMES.maintenance;
  const isAdminPage = to.name === ROUTE_NAMES.admin;

  if (!isMaintenancePage && !isAdminPage) {
    const isMaintenanceMode = await fetchMaintenanceStatus();

    if (isMaintenanceMode) {
      // 管理者はメンテナンスモードでもアクセス可能
      const userIsAdmin = await isAdmin();

      if (!userIsAdmin) {
        logger.info`Maintenance mode active, redirecting to maintenance page`;
        return { name: ROUTE_NAMES.maintenance };
      }
    }
  }

  // ===========================================
  // 2. 管理者ルートチェック
  // ===========================================
  const requiresAdmin = to.matched.some(
    (record) => record.meta.requiresAdmin === true,
  );

  if (requiresAdmin) {
    const userIsAdmin = await isAdmin();

    if (!userIsAdmin) {
      logger.warn`Admin access denied: user is not an admin`;
      return { name: ROUTE_NAMES.home };
    }
  }

  // ===========================================
  // 3. 既存の認証チェック
  // ===========================================
  const requiresAuth = to.matched.some(
    (record) => record.meta.requiresAuth === true,
  );
  const allowGuestAccess = to.matched.some(
    (record) => record.meta.allowGuestAccess === true,
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
    // ゲストアクセス可能なルートの場合はログインにリダイレクトしない
    if (!allowGuestAccess) {
      return { name: ROUTE_NAMES.login };
    }
  }

  // プロジェクト関連のルートでゲストアクセスが許可されている場合
  const projectId = to.params.projectId as string | undefined;
  const routeName = to.name as
    (typeof ROUTE_NAMES)[keyof typeof ROUTE_NAMES] | undefined;

  // 未認証ユーザーでプロジェクトIDがあり、ゲストアクセスが許可されている場合
  if (requiresAuth && !user && allowGuestAccess && projectId) {
    // プロジェクトのゲスト閲覧設定を確認
    const access = await fetchProjectAccess(projectId, null);

    // ネットワークエラーの場合
    if (access.error === "network") {
      logger.error`Network error during guest access check for project ${projectId}`;
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

    // ゲスト閲覧が許可されている場合
    if (access.allowGuestView && access.hasAccess) {
      // アクセスしようとしているページがゲストに許可されているかチェック
      const guestPageKey = routeName
        ? ROUTE_TO_GUEST_PAGE[routeName]
        : undefined;

      // ゲスト設定対象外のページ（設定など）へのアクセスは禁止
      if (guestPageKey === null) {
        logger.warn`Guest access denied to restricted page: ${String(routeName)}`;
        return {
          name: ROUTE_NAMES.error,
          query: {
            projectId,
            errorType: "forbidden",
            reason: "このページはゲストには公開されていません。",
          },
        };
      }

      // ページが許可リストに含まれているかチェック
      if (guestPageKey && access.guestAllowedPages) {
        if (!access.guestAllowedPages.includes(guestPageKey)) {
          logger.warn`Guest access denied to page not in allowed list: ${guestPageKey}`;
          return {
            name: ROUTE_NAMES.error,
            query: {
              projectId,
              errorType: "forbidden",
              reason: "このページはゲストには公開されていません。",
            },
          };
        }
      }

      logger.info`Guest access granted for project ${projectId}`;
      return true;
    }

    // ゲスト閲覧が許可されていない場合はログインページへ
    return {
      name: ROUTE_NAMES.login,
      query: { redirect: to.fullPath },
    };
  }

  if (requiresAuth && !user) {
    return {
      name: ROUTE_NAMES.login,
      query: { redirect: to.fullPath },
    };
  }

  if (to.name && authRestricted.includes(String(to.name)) && user) {
    // プロフィールがない、またはsetUp=falseの場合はセットアップが必要
    const needsSetup =
      !auth.profile.value || auth.profile.value.setUp === false;
    const goingToSignup = String(to.name) === String(ROUTE_NAMES.signup);
    const explicitlySetupFlow = String(to.query.setup) === "false";

    if (goingToSignup && (needsSetup || explicitlySetupFlow)) {
      return true;
    }

    // プロフィールがセットアップ済みの場合のみマイページへリダイレクト
    if (auth.profile.value && auth.profile.value.setUp === true) {
      return { name: ROUTE_NAMES.myPage };
    }

    // プロフィールがまだロードされていない場合は一旦許可
    // （onMountedで再度チェックする）
    return true;
  }

  // プロジェクト権限チェック（認証済みユーザー）
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

      // 公開プロジェクトを閲覧する非メンバー（認証済みゲスト）には、
      // 未認証ゲストと同じページ許可リストを適用する
      if (access.isGuest) {
        const guestPageKey = ROUTE_TO_GUEST_PAGE[routeName];
        if (
          guestPageKey === null ||
          (guestPageKey &&
            access.guestAllowedPages &&
            !access.guestAllowedPages.includes(guestPageKey))
        ) {
          logger.warn`Guest access denied to page: ${String(routeName)}`;
          return {
            name: ROUTE_NAMES.error,
            query: {
              projectId,
              errorType: "forbidden",
              reason: "このページはゲストには公開されていません。",
            },
          };
        }
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

import { ROUTE_NAMES } from "@/constants/routes";
import type {
  DashboardNavItem,
  DashboardNavKey,
} from "@/types/projectDashboard";

/**
 * プロジェクト権限のキー定義
 * Discord風の細かい権限制御を想定
 */
export const ProjectPermission = {
  /** ダッシュボード閲覧 */
  VIEW_DASHBOARD: "viewDashboard",
  /** タスク閲覧 */
  VIEW_TASKS: "viewTasks",
  /** タスク作成・編集 */
  MANAGE_TASKS: "manageTasks",
  /** タスク削除 */
  DELETE_TASKS: "deleteTasks",
  /** スレッド閲覧 */
  VIEW_THREADS: "viewThreads",
  /** スレッド投稿 */
  POST_THREADS: "postThreads",
  /** アクティビティログ閲覧 */
  VIEW_ACTIVITY: "viewActivity",
  /** メンバー一覧閲覧 */
  VIEW_MEMBERS: "viewMembers",
  /** メンバー招待 */
  INVITE_MEMBERS: "inviteMembers",
  /** メンバー管理（キック等） */
  MANAGE_MEMBERS: "manageMembers",
  /** カテゴリ閲覧 */
  VIEW_CATEGORIES: "viewCategories",
  /** カテゴリ管理 */
  MANAGE_CATEGORIES: "manageCategories",
  /** 招待リンク閲覧 */
  VIEW_INVITES: "viewInvites",
  /** 招待リンク管理 */
  MANAGE_INVITES: "manageInvites",
  /** プロジェクト設定閲覧 */
  VIEW_SETTINGS: "viewSettings",
  /** プロジェクト設定変更 */
  MANAGE_SETTINGS: "manageSettings",
  /** ロール閲覧 */
  VIEW_ROLES: "viewRoles",
  /** ロール管理 */
  MANAGE_ROLES: "manageRoles",
  /** 通知設定閲覧 */
  VIEW_NOTIFICATIONS: "viewNotifications",
  /** 通知設定変更 */
  MANAGE_NOTIFICATIONS: "manageNotifications",
} as const;

export type ProjectPermissionKey =
  (typeof ProjectPermission)[keyof typeof ProjectPermission];

/**
 * ロール別のデフォルト権限マッピング
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, ProjectPermissionKey[]> =
  {
    owner: Object.values(ProjectPermission),
    admin: Object.values(ProjectPermission),
    member: [
      ProjectPermission.VIEW_DASHBOARD,
      ProjectPermission.VIEW_TASKS,
      ProjectPermission.MANAGE_TASKS,
      ProjectPermission.VIEW_THREADS,
      ProjectPermission.POST_THREADS,
      ProjectPermission.VIEW_ACTIVITY,
      ProjectPermission.VIEW_MEMBERS,
      ProjectPermission.VIEW_CATEGORIES,
      ProjectPermission.VIEW_INVITES,
      ProjectPermission.VIEW_SETTINGS,
      ProjectPermission.VIEW_ROLES,
      ProjectPermission.VIEW_NOTIFICATIONS,
    ],
    viewer: [
      ProjectPermission.VIEW_DASHBOARD,
      ProjectPermission.VIEW_TASKS,
      ProjectPermission.VIEW_THREADS,
      ProjectPermission.VIEW_ACTIVITY,
      ProjectPermission.VIEW_MEMBERS,
      ProjectPermission.VIEW_CATEGORIES,
      ProjectPermission.VIEW_SETTINGS,
      ProjectPermission.VIEW_ROLES,
    ],
  };

/**
 * ルートごとに必要な権限のマッピング
 * null = 認証のみ必要（プロジェクト権限不要）
 * undefined = 権限チェック不要（公開ページ）
 */
export const ROUTE_REQUIRED_PERMISSIONS: Partial<
  Record<
    (typeof ROUTE_NAMES)[keyof typeof ROUTE_NAMES],
    ProjectPermissionKey | null
  >
> = {
  // プロジェクト系ルート
  [ROUTE_NAMES.projectDashboard]: ProjectPermission.VIEW_DASHBOARD,
  [ROUTE_NAMES.projectThreads]: ProjectPermission.VIEW_THREADS,
  [ROUTE_NAMES.projectMembers]: ProjectPermission.VIEW_MEMBERS,
  [ROUTE_NAMES.projectRoles]: ProjectPermission.VIEW_ROLES,
  [ROUTE_NAMES.projectCategories]: ProjectPermission.VIEW_CATEGORIES,
  [ROUTE_NAMES.projectInvites]: ProjectPermission.VIEW_INVITES,
  [ROUTE_NAMES.projectSettings]: ProjectPermission.VIEW_SETTINGS,
  [ROUTE_NAMES.projectActivity]: ProjectPermission.VIEW_ACTIVITY,
  [ROUTE_NAMES.projectNotifications]: ProjectPermission.VIEW_NOTIFICATIONS,
  [ROUTE_NAMES.projectTaskDetail]: ProjectPermission.VIEW_TASKS,

  // 認証のみ必要（プロジェクト権限不要）
  [ROUTE_NAMES.myPage]: null,
  [ROUTE_NAMES.myTasks]: null,
  [ROUTE_NAMES.projectCreate]: null,

  // 権限チェック不要（認証系）
  [ROUTE_NAMES.login]: undefined,
  [ROUTE_NAMES.signup]: undefined,
  [ROUTE_NAMES.passwordReset]: undefined,
  [ROUTE_NAMES.passwordResetConfirm]: undefined,
  [ROUTE_NAMES.verifyEmail]: undefined,
  [ROUTE_NAMES.inviteAccept]: undefined,
};

/**
 * サイドバーナビゲーション項目の設定
 * プロジェクト粒度で固定表示
 */
export interface SidebarNavItemConfig {
  key: DashboardNavKey;
  label: string;
  icon: DashboardNavKey;
  routeName: (typeof ROUTE_NAMES)[keyof typeof ROUTE_NAMES];
  /** この項目を表示するために必要な権限。nullならログインのみで表示 */
  requiredPermission: ProjectPermissionKey | null;
  /** プロジェクトIDをパラメータとして必要とするか */
  requiresProjectId: boolean;
}

/**
 * プロジェクトコンテキストのサイドバー固定メニュー
 * 全ページで同じ項目・順序で表示
 */
export const PROJECT_SIDEBAR_NAV_CONFIG: SidebarNavItemConfig[] = [
  {
    key: "dashboard",
    label: "ダッシュボード",
    icon: "dashboard",
    routeName: ROUTE_NAMES.projectDashboard,
    requiredPermission: ProjectPermission.VIEW_DASHBOARD,
    requiresProjectId: true,
  },
  {
    key: "tasks",
    label: "マイタスク",
    icon: "tasks",
    routeName: ROUTE_NAMES.myTasks,
    requiredPermission: null,
    requiresProjectId: false,
  },
  {
    key: "team",
    label: "スレッド",
    icon: "team",
    routeName: ROUTE_NAMES.projectThreads,
    requiredPermission: ProjectPermission.VIEW_THREADS,
    requiresProjectId: true,
  },
  {
    key: "activity",
    label: "ログ",
    icon: "tasks",
    routeName: ROUTE_NAMES.projectActivity,
    requiredPermission: ProjectPermission.VIEW_ACTIVITY,
    requiresProjectId: true,
  },
  {
    key: "members",
    label: "メンバー",
    icon: "members",
    routeName: ROUTE_NAMES.projectMembers,
    requiredPermission: ProjectPermission.VIEW_MEMBERS,
    requiresProjectId: true,
  },
  {
    key: "categories",
    label: "カテゴリ",
    icon: "settings",
    routeName: ROUTE_NAMES.projectCategories,
    requiredPermission: ProjectPermission.VIEW_CATEGORIES,
    requiresProjectId: true,
  },
  {
    key: "invites",
    label: "招待リンク",
    icon: "invites",
    routeName: ROUTE_NAMES.projectInvites,
    requiredPermission: ProjectPermission.VIEW_INVITES,
    requiresProjectId: true,
  },
  {
    key: "settings",
    label: "設定",
    icon: "settings",
    routeName: ROUTE_NAMES.projectSettings,
    requiredPermission: ProjectPermission.VIEW_SETTINGS,
    requiresProjectId: true,
  },
  {
    key: "roles",
    label: "ロール",
    icon: "members",
    routeName: ROUTE_NAMES.projectRoles,
    requiredPermission: ProjectPermission.VIEW_ROLES,
    requiresProjectId: true,
  },
  {
    key: "notifications",
    label: "通知",
    icon: "tasks",
    routeName: ROUTE_NAMES.projectNotifications,
    requiredPermission: ProjectPermission.VIEW_NOTIFICATIONS,
    requiresProjectId: true,
  },
];

/**
 * サイドバー設定からDashboardNavItem[]を生成
 * 権限に応じてフィルタリングも行う
 */
export function buildProjectNavItemsFromConfig(
  projectId: string,
  hasPermission: (permission: ProjectPermissionKey | null) => boolean,
): DashboardNavItem[] {
  return PROJECT_SIDEBAR_NAV_CONFIG.filter((config) =>
    hasPermission(config.requiredPermission),
  ).map((config) => ({
    key: config.key,
    label: config.label,
    icon: config.icon,
    to: {
      name: config.routeName,
      params: config.requiresProjectId ? { projectId } : undefined,
    },
  }));
}

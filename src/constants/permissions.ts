import { ROUTE_NAMES } from "@/constants/routes";

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
  /** 週次スコア閲覧（Admin専用） */
  VIEW_SCORES: "viewScores",
  /** 自分に割り当てられたタスクの進捗率のみ変更 */
  UPDATE_OWN_PROGRESS: "updateOwnProgress",
} as const;

export type ProjectPermissionKey =
  (typeof ProjectPermission)[keyof typeof ProjectPermission];

/**
 * ロール別のデフォルト権限マッピング
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, ProjectPermissionKey[]> =
  {
    owner: Object.values(ProjectPermission),
    admin: Object.values(ProjectPermission), // admin も全権限（VIEW_SCORES含む）
    member: [
      ProjectPermission.VIEW_DASHBOARD,
      ProjectPermission.VIEW_TASKS,
      ProjectPermission.UPDATE_OWN_PROGRESS, // 自分担当タスクの進捗のみ変更可
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
  [ROUTE_NAMES.projectRoles]: ProjectPermission.MANAGE_ROLES,
  [ROUTE_NAMES.projectCategories]: ProjectPermission.MANAGE_CATEGORIES,
  [ROUTE_NAMES.projectInvites]: ProjectPermission.MANAGE_INVITES,
  [ROUTE_NAMES.projectSettings]: ProjectPermission.VIEW_SETTINGS,
  [ROUTE_NAMES.projectActivity]: ProjectPermission.VIEW_ACTIVITY,
  [ROUTE_NAMES.projectNotifications]: ProjectPermission.MANAGE_NOTIFICATIONS,
  [ROUTE_NAMES.projectTaskDetail]: ProjectPermission.VIEW_TASKS,
  [ROUTE_NAMES.projectScores]: ProjectPermission.VIEW_SCORES,

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

// ナビゲーション設定は src/constants/navigation.ts に移動

export type RoleKey =
  | "admin"
  | "manager"
  | "pm"
  | "member"
  | "viewer"
  | "observer";

export type RolePermissions = {
  canEditProject: boolean;
  canDeleteTasks: boolean;
  canInviteMembers: boolean;
  canManageSettings: boolean;
  canEditRoles: boolean;
  canManageTasks: boolean;
  canManageMembers: boolean;
  canViewOnly: boolean;
};

const defaultPermissions: RolePermissions = {
  canEditProject: false,
  canDeleteTasks: false,
  canInviteMembers: false,
  canManageSettings: false,
  canEditRoles: false,
  canManageTasks: false,
  canManageMembers: false,
  canViewOnly: true,
};

/**
 * ロール定義
 * - admin: 全権限（オーナー相当）
 * - manager: タスク管理・招待可能、設定・ロール編集不可
 * - pm: プロジェクトマネージャー（タスク管理のみ）
 * - member: タスク操作可能
 * - viewer: 閲覧のみ
 * - observer: 閲覧のみ（viewerと同等）
 */
export function buildPermissionsFromRoles(
  roles: string[] = [],
): RolePermissions {
  const normalized = roles.map((role) => role.toLowerCase());
  const isAdmin = normalized.includes("admin") || normalized.includes("owner");
  const isManager = normalized.includes("manager");
  const isPM = normalized.includes("pm");
  const isMember = normalized.includes("member");
  const isViewerOrObserver =
    normalized.includes("viewer") || normalized.includes("observer");

  // 権限の優先度: admin > manager > pm > member > viewer/observer
  return {
    ...defaultPermissions,
    canEditProject: isAdmin,
    canDeleteTasks: isAdmin || isManager,
    canInviteMembers: isAdmin || isManager,
    canManageSettings: isAdmin,
    canEditRoles: isAdmin,
    canManageTasks: isAdmin || isManager || isPM || isMember,
    canManageMembers: isAdmin,
    canViewOnly:
      !isAdmin && !isManager && !isPM && !isMember && isViewerOrObserver,
  };
}

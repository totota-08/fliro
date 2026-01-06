import { buildPermissionsFromRoles } from "@/constants/roles";
import type { ProjectMember } from "@/services/projectMembers";
import { computed, type ComputedRef, type Ref } from "vue";

export interface ProjectAccessResult {
  isOwner: ComputedRef<boolean>;
  isAdmin: ComputedRef<boolean>;
  isMember: ComputedRef<boolean>;
  isGuest: ComputedRef<boolean>;
  can: (
    permissionKey: keyof ReturnType<typeof buildPermissionsFromRoles>,
  ) => boolean;
  role: ComputedRef<ProjectMember["role"] | null>;
}

/**
 * プロジェクトアクセス権限を判定するComposable
 *
 * @param currentUserId - 現在のユーザーID
 * @param members - プロジェクトメンバーのリスト
 * @returns 権限判定の結果オブジェクト
 *
 * @example
 * const { isOwner, isAdmin, can } = useProjectAccess(user.value?.uid, members);
 * if (can('canManageSettings')) {
 *   // 設定を管理できる
 * }
 */
export function useProjectAccess(
  currentUserId: Ref<string | undefined | null>,
  members: Ref<ProjectMember[]>,
): ProjectAccessResult {
  const currentMember = computed(() => {
    if (!currentUserId.value) return null;
    return members.value.find((m) => m.userId === currentUserId.value) || null;
  });

  const role = computed(() => {
    return currentMember.value?.role || null;
  });

  const isOwner = computed(() => {
    if (!currentMember.value) return false;
    // projectRole が owner または role が owner の場合
    return (
      currentMember.value.projectRole === "owner" ||
      currentMember.value.role === "owner"
    );
  });

  const isAdmin = computed(() => {
    if (!currentMember.value) return false;
    // owner は admin 権限も持つ
    return (
      isOwner.value ||
      currentMember.value.role === "admin" ||
      currentMember.value.projectRole === "owner"
    );
  });

  const isMember = computed(() => {
    if (!currentMember.value) return false;
    // owner/admin も member に含まれる
    return (
      isOwner.value || isAdmin.value || currentMember.value.role === "member"
    );
  });

  const isGuest = computed(() => {
    if (!currentMember.value) return false;
    return (
      currentMember.value.role === "viewer" && !isOwner.value && !isAdmin.value
    );
  });

  /**
   * 特定の権限を持っているか判定
   */
  const can = (
    permissionKey: keyof ReturnType<typeof buildPermissionsFromRoles>,
  ): boolean => {
    if (!currentMember.value) return false;

    // permissions オブジェクトが存在する場合はそれを使用
    if (currentMember.value.permissions) {
      return currentMember.value.permissions[permissionKey] || false;
    }

    // permissions がない場合は roles から計算
    const roles = currentMember.value.roles || [
      currentMember.value.role || "member",
    ];
    const permissions = buildPermissionsFromRoles(roles);
    return permissions[permissionKey] || false;
  };

  return {
    isOwner,
    isAdmin,
    isMember,
    isGuest,
    can,
    role,
  };
}

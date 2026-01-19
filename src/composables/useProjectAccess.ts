import {
  ROLE_DEFAULT_PERMISSIONS,
  type ProjectPermissionKey,
} from "@/constants/permissions";
import { DEFAULT_GUEST_ALLOWED_PAGES } from "@/constants/guestPages";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/store/auth";
import type { GuestAllowedPage, ProjectDoc } from "@/types/project";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue";

/**
 * プロジェクトへのアクセス権限を判定するComposable
 *
 * @param projectId - プロジェクトID (ref)
 * @returns 権限判定用のcomputed
 */
export function useProjectAccess(projectId: Ref<string>) {
  const { user } = useAuthStore();

  const memberData = ref<{
    role: string;
    roles: string[];
    projectRole: string;
    permissions: Record<string, boolean>;
  } | null>(null);

  const project = ref<ProjectDoc | null>(null);
  const loading = ref(true);

  let stopMemberListener: (() => void) | null = null;
  let stopProjectListener: (() => void) | null = null;

  function startListeners() {
    stopListeners();
    loading.value = true;

    if (!user.value || !projectId.value) {
      memberData.value = null;
      project.value = null;
      loading.value = false;
      return;
    }

    // プロジェクト情報の購読
    stopProjectListener = onSnapshot(
      doc(db, "projects", projectId.value),
      (snapshot) => {
        if (snapshot.exists()) {
          project.value = snapshot.data() as ProjectDoc;
        } else {
          project.value = null;
        }
      },
    );

    // メンバー情報の購読
    stopMemberListener = onSnapshot(
      doc(db, "projects", projectId.value, "members", user.value.uid),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          memberData.value = {
            role: data.role || "member",
            roles: data.roles || [data.role || "member"],
            projectRole: data.projectRole || data.role || "member",
            permissions: data.permissions || {},
          };
        } else {
          memberData.value = null;
        }
        loading.value = false;
      },
    );
  }

  function stopListeners() {
    stopMemberListener?.();
    stopProjectListener?.();
    stopMemberListener = null;
    stopProjectListener = null;
  }

  watch(
    [projectId, () => user.value?.uid],
    () => {
      startListeners();
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    stopListeners();
  });

  // --- 権限判定 computed ---

  /** プロジェクトのオーナーかどうか */
  const isOwner = computed(() => {
    if (!user.value) return false;
    // プロジェクトのownerUserIdと一致するか
    if (project.value?.ownerUserId === user.value.uid) return true;
    // memberDataのroleがownerか
    const role = memberData.value?.projectRole || memberData.value?.role || "";
    return role.toLowerCase() === "owner";
  });

  /** 管理者（owner または admin）かどうか */
  const isAdmin = computed(() => {
    if (isOwner.value) return true;
    const role = memberData.value?.projectRole || memberData.value?.role || "";
    return role.toLowerCase() === "admin";
  });

  /** メンバー（owner, admin, member）かどうか */
  const isMember = computed(() => {
    if (isAdmin.value) return true;
    const role = memberData.value?.projectRole || memberData.value?.role || "";
    return role.toLowerCase() === "member";
  });

  /** ゲスト（viewer）かどうか */
  const isGuest = computed(() => {
    if (!memberData.value) return true;
    const role = memberData.value?.projectRole || memberData.value?.role || "";
    return role.toLowerCase() === "viewer";
  });

  /** プロジェクトにアクセス可能かどうか（メンバーに含まれている） */
  const hasAccess = computed(() => memberData.value !== null);

  /**
   * 現在のロールを取得
   */
  const currentRole = computed(() => {
    const role = memberData.value?.projectRole || memberData.value?.role || "";
    return role.toLowerCase();
  });

  /**
   * 特定の権限を持っているかを判定
   * @param permissionKey - permissions オブジェクトのキー (ProjectPermissionKey or null)
   *                        nullの場合はログインのみで許可
   */
  function can(permissionKey: ProjectPermissionKey | string | null): boolean {
    // nullの場合はログインしていればOK
    if (permissionKey === null) return !!user.value;

    // プロジェクトメンバーでなければfalse
    if (!hasAccess.value) return false;

    // owner は全権限を持つ
    if (isOwner.value) return true;

    // admin も基本的に全権限を持つ
    if (isAdmin.value) return true;

    // 明示的なpermissionsがあればそれを参照
    if (memberData.value?.permissions?.[permissionKey]) return true;

    // ロールベースのデフォルト権限を確認
    const role = currentRole.value;
    const rolePermissions = ROLE_DEFAULT_PERMISSIONS[role];
    if (rolePermissions?.includes(permissionKey as ProjectPermissionKey)) {
      return true;
    }

    return false;
  }

  /**
   * 特定の権限を持っているかをcomputedで返す
   */
  function canRef(permissionKey: string) {
    return computed(() => can(permissionKey));
  }

  return {
    loading,
    memberData,
    project,
    currentRole,
    isOwner,
    isAdmin,
    isMember,
    isGuest,
    hasAccess,
    can,
    canRef,
  };
}

/**
 * プロジェクトアクセス権取得時のエラー種別
 */
export type ProjectAccessError = "network" | "not_found" | "permission";

/**
 * プロジェクトアクセス権取得の結果
 */
export interface ProjectAccessResult {
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isGuest: boolean;
  hasAccess: boolean;
  role: string;
  /** ロールに紐づく権限配列（Firestoreから取得） */
  permissions: ProjectPermissionKey[];
  error?: ProjectAccessError;
  /** プロジェクトがゲスト閲覧を許可しているか */
  allowGuestView?: boolean;
  /** ゲストがアクセス可能なページ一覧 */
  guestAllowedPages?: GuestAllowedPage[];
  /** 未認証ユーザーとしてゲストアクセスしているか */
  isAnonymousGuest?: boolean;
}

/**
 * 権限を一度だけ取得する（非リアクティブ）
 * オーナーはメンバードキュメントが存在しなくてもアクセス可能
 * userId が null の場合は未認証ユーザーとして処理
 */
export async function fetchProjectAccess(
  projectId: string,
  userId: string | null,
): Promise<ProjectAccessResult> {
  try {
    // 未認証ユーザーの場合はプロジェクト情報のみ取得
    const projectSnap = await getDoc(doc(db, "projects", projectId));
    const project = projectSnap.exists() ? projectSnap.data() : null;

    // プロジェクトが存在しない場合
    if (!project) {
      return {
        isOwner: false,
        isAdmin: false,
        isMember: false,
        isGuest: true,
        hasAccess: false,
        role: "",
        permissions: [],
        error: "not_found",
      };
    }

    // 公開プロジェクト設定（isPublicがtrueならゲスト閲覧可能）
    const isPublic = Boolean(project.settings?.isPublic);
    // ゲスト許可ページ（設定がない場合はデフォルト値を使用）
    const guestAllowedPages: GuestAllowedPage[] =
      project.settings?.guestAllowedPages ?? DEFAULT_GUEST_ALLOWED_PAGES;

    // 未認証ユーザーの場合
    if (!userId) {
      // 公開プロジェクトならアクセス可能
      if (isPublic) {
        return {
          isOwner: false,
          isAdmin: false,
          isMember: false,
          isGuest: true,
          hasAccess: true,
          role: "anonymous_guest",
          permissions: ROLE_DEFAULT_PERMISSIONS.viewer || [],
          allowGuestView: true,
          guestAllowedPages,
          isAnonymousGuest: true,
        };
      }

      return {
        isOwner: false,
        isAdmin: false,
        isMember: false,
        isGuest: true,
        hasAccess: false,
        role: "",
        permissions: [],
        error: "permission",
        allowGuestView: false,
      };
    }

    // 認証済みユーザーの場合、メンバー情報も取得
    const memberSnap = await getDoc(
      doc(db, "projects", projectId, "members", userId),
    );
    const member = memberSnap.exists() ? memberSnap.data() : null;

    // オーナー判定を優先（メンバードキュメントがなくてもオーナーならアクセス可能）
    const isOwnerByProject = project.ownerUserId === userId;

    if (!member) {
      // メンバードキュメントがなくても、オーナーならアクセス可能
      if (isOwnerByProject) {
        return {
          isOwner: true,
          isAdmin: true,
          isMember: true,
          isGuest: false,
          hasAccess: true,
          role: "owner",
          permissions: ROLE_DEFAULT_PERMISSIONS.owner || [],
          allowGuestView: isPublic,
        };
      }

      // 公開プロジェクトなら、認証済みだがメンバーでないユーザーもアクセス可能
      if (isPublic) {
        return {
          isOwner: false,
          isAdmin: false,
          isMember: false,
          isGuest: true,
          hasAccess: true,
          role: "guest",
          permissions: ROLE_DEFAULT_PERMISSIONS.viewer || [],
          allowGuestView: true,
          guestAllowedPages,
        };
      }

      return {
        isOwner: false,
        isAdmin: false,
        isMember: false,
        isGuest: true,
        hasAccess: false,
        role: "",
        permissions: [],
        error: "permission",
        allowGuestView: false,
      };
    }

    const role = (member.projectRole || member.role || "member").toLowerCase();
    const isOwner = isOwnerByProject || role === "owner";
    const isAdmin = isOwner || role === "admin";
    const isMember = isAdmin || role === "member";
    const isGuest = role === "viewer";

    // owner/adminは全権限を持つ
    if (isOwner || isAdmin) {
      return {
        isOwner,
        isAdmin,
        isMember,
        isGuest,
        hasAccess: true,
        role,
        permissions: ROLE_DEFAULT_PERMISSIONS.owner || [],
        allowGuestView: isPublic,
      };
    }

    // Firestoreからロールの権限を取得
    let permissions: ProjectPermissionKey[] = [];
    try {
      const roleSnap = await getDoc(
        doc(db, "projects", projectId, "roles", role),
      );
      if (roleSnap.exists()) {
        const roleData = roleSnap.data();
        permissions = (roleData.permissions || []) as ProjectPermissionKey[];
      } else {
        // ロールドキュメントがない場合はデフォルト権限を使用
        permissions = ROLE_DEFAULT_PERMISSIONS[role] || [];
      }
    } catch {
      // ロール取得に失敗した場合はデフォルト権限を使用
      permissions = ROLE_DEFAULT_PERMISSIONS[role] || [];
    }

    return {
      isOwner,
      isAdmin,
      isMember,
      isGuest,
      hasAccess: true,
      role,
      permissions,
      allowGuestView: isPublic,
    };
  } catch (error) {
    // ネットワークエラーやFirebaseエラーの場合
    return {
      isOwner: false,
      isAdmin: false,
      isMember: false,
      isGuest: true,
      hasAccess: false,
      role: "",
      permissions: [],
      error: "network",
    };
  }
}

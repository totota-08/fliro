import {
  type ProjectPermissionKey,
  ROLE_DEFAULT_PERMISSIONS,
} from "@/constants/permissions";
import { db } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

/**
 * プロジェクトロールの型定義
 */
export interface ProjectRole {
  id: string;
  name: string;
  color: string;
  permissions: ProjectPermissionKey[];
  position: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * デフォルトロールの定義
 */
export const DEFAULT_PROJECT_ROLES: Omit<
  ProjectRole,
  "id" | "createdAt" | "updatedAt"
>[] = [
  {
    name: "admin",
    color: "#4f7c82",
    permissions: ROLE_DEFAULT_PERMISSIONS.admin ?? [],
    position: 1,
    isDefault: true,
  },
  {
    name: "member",
    color: "#64748b",
    permissions: ROLE_DEFAULT_PERMISSIONS.member ?? [],
    position: 2,
    isDefault: true,
  },
  {
    name: "viewer",
    color: "#94a3b8",
    permissions: ROLE_DEFAULT_PERMISSIONS.viewer ?? [],
    position: 3,
    isDefault: true,
  },
];

/**
 * プロジェクトにデフォルトロールを作成
 * プロジェクト作成時に呼び出す
 */
export async function ensureDefaultRoles(projectId: string): Promise<void> {
  const rolesRef = collection(db, "projects", projectId, "roles");
  const existingRoles = await getDocs(rolesRef);

  // 既にロールが存在する場合はスキップ
  if (!existingRoles.empty) return;

  const now = serverTimestamp();

  await Promise.all(
    DEFAULT_PROJECT_ROLES.map((role) =>
      setDoc(doc(rolesRef, role.name), {
        name: role.name,
        color: role.color,
        permissions: role.permissions,
        position: role.position,
        isDefault: role.isDefault,
        createdAt: now,
        updatedAt: now,
      }),
    ),
  );
}

/**
 * プロジェクトのロール一覧を購読
 */
export function listenProjectRoles(
  projectId: string,
  callback: (roles: ProjectRole[]) => void,
): () => void {
  const rolesRef = collection(db, "projects", projectId, "roles");

  return onSnapshot(rolesRef, (snapshot) => {
    const roles = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name || docSnap.id,
        color: data.color || "#64748b",
        permissions: data.permissions || [],
        position: data.position ?? 99,
        isDefault: data.isDefault ?? false,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as ProjectRole;
    });

    // position順でソート
    roles.sort((a, b) => a.position - b.position);
    callback(roles);
  });
}

/**
 * 新しいロールを追加
 */
export async function addRole(
  projectId: string,
  roleKey: string,
  options: {
    name?: string;
    color?: string;
    permissions?: ProjectPermissionKey[];
    position?: number;
  } = {},
): Promise<void> {
  const roleId = roleKey.toLowerCase().replace(/\s+/g, "-");
  const rolesRef = collection(db, "projects", projectId, "roles");

  // 既存のロール数を取得してposition決定
  const existingRoles = await getDocs(rolesRef);
  const maxPosition = existingRoles.docs.reduce((max, d) => {
    const pos = d.data().position ?? 0;
    return pos > max ? pos : max;
  }, 0);

  const now = serverTimestamp();
  await setDoc(doc(rolesRef, roleId), {
    name: options.name || roleKey,
    color: options.color || "#64748b",
    permissions: options.permissions || ROLE_DEFAULT_PERMISSIONS.viewer || [],
    position: options.position ?? maxPosition + 1,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * ロールを削除
 * デフォルトロールは削除不可
 */
export async function removeRole(
  projectId: string,
  roleKey: string,
): Promise<{ success: boolean; error?: string }> {
  const roleRef = doc(db, "projects", projectId, "roles", roleKey);
  const roleSnap = await getDoc(roleRef);

  if (!roleSnap.exists()) {
    return { success: false, error: "ロールが見つかりません" };
  }

  const roleData = roleSnap.data();
  if (roleData.isDefault) {
    return { success: false, error: "デフォルトロールは削除できません" };
  }

  // このロールを持つメンバーがいないか確認
  const membersRef = collection(db, "projects", projectId, "members");

  // roles配列でのチェック
  const rolesArrayQuery = query(
    membersRef,
    where("roles", "array-contains", roleKey),
    limit(1),
  );
  const rolesArraySnap = await getDocs(rolesArrayQuery);

  if (!rolesArraySnap.empty) {
    return {
      success: false,
      error: "このロールは使用中のため削除できません",
    };
  }

  // レガシーのroleフィールド（単一値）でのチェック
  const legacyRoleQuery = query(
    membersRef,
    where("role", "==", roleKey),
    limit(1),
  );
  const legacyRoleSnap = await getDocs(legacyRoleQuery);

  if (!legacyRoleSnap.empty) {
    return {
      success: false,
      error: "このロールは使用中のため削除できません",
    };
  }

  await deleteDoc(roleRef);
  return { success: true };
}

/**
 * ロールの権限を更新
 */
export async function updateRolePermissions(
  projectId: string,
  roleKey: string,
  permissions: ProjectPermissionKey[],
): Promise<void> {
  const roleRef = doc(db, "projects", projectId, "roles", roleKey);
  await updateDoc(roleRef, {
    permissions,
    updatedAt: serverTimestamp(),
  });
}

/**
 * ロールのメタデータを更新（名前、色など）
 */
export async function updateRole(
  projectId: string,
  roleKey: string,
  updates: {
    name?: string;
    color?: string;
    position?: number;
  },
): Promise<void> {
  const roleRef = doc(db, "projects", projectId, "roles", roleKey);
  await updateDoc(roleRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

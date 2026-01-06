import {
  type ProjectPermissionKey,
  PROJECT_SIDEBAR_NAV_CONFIG,
  buildProjectNavItemsFromConfig,
} from "@/constants/permissions";
import type { DashboardNavItem } from "@/types/projectDashboard";

/**
 * プロジェクトIDからナビゲーション項目を構築（権限フィルタリングなし）
 * 後方互換性のために残しつつ、内部では PROJECT_SIDEBAR_NAV_CONFIG を使用
 */
export function buildProjectNavItems(projectId: string): DashboardNavItem[] {
  // 全権限を持つとしてビルド（フィルタリングなし）
  return buildProjectNavItemsFromConfig(projectId, () => true);
}

/**
 * 権限に応じてフィルタリングされたナビゲーション項目を構築
 * @param projectId - プロジェクトID
 * @param hasPermission - 権限チェック関数
 */
export function buildFilteredProjectNavItems(
  projectId: string,
  hasPermission: (permission: ProjectPermissionKey | null) => boolean,
): DashboardNavItem[] {
  return buildProjectNavItemsFromConfig(projectId, hasPermission);
}

// 設定をエクスポート（他のモジュールから参照可能に）
export { PROJECT_SIDEBAR_NAV_CONFIG };

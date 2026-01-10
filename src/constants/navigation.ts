/**
 * ナビゲーション設定を一元管理するファイル
 * サイドバーに表示するナビゲーション項目を定義
 */

import { ROUTE_NAMES } from "@/constants/routes";
import {
  ProjectPermission,
  type ProjectPermissionKey,
} from "@/constants/permissions";
import type {
  DashboardNavItem,
  DashboardNavKey,
} from "@/types/projectDashboard";

/**
 * サイドバーナビゲーション項目の設定
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
 * 表示項目: ダッシュボード、マイタスク、スレッド、ログ、メンバー、設定
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
    key: "settings",
    label: "設定",
    icon: "settings",
    routeName: ROUTE_NAMES.projectSettings,
    requiredPermission: ProjectPermission.VIEW_SETTINGS,
    requiresProjectId: true,
  },
  {
    key: "scores",
    label: "週次スコア",
    icon: "scores",
    routeName: ROUTE_NAMES.projectScores,
    requiredPermission: ProjectPermission.VIEW_SCORES,
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

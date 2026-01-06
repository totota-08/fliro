import { ROUTE_NAMES } from "@/constants/routes";
import type { DashboardNavItem } from "@/types/projectDashboard";

export function buildProjectNavItems(projectId: string): DashboardNavItem[] {
  const projectParams = { projectId };

  return [
    {
      key: "dashboard",
      label: "ダッシュボード",
      to: { name: ROUTE_NAMES.projectDashboard, params: projectParams },
      icon: "dashboard",
    },
    {
      key: "tasks",
      label: "マイタスク",
      to: { name: ROUTE_NAMES.myTasks },
      icon: "tasks",
    },
    {
      key: "team",
      label: "スレッド",
      to: { name: ROUTE_NAMES.projectThreads, params: projectParams },
      icon: "team",
    },
    {
      key: "timeline",
      label: "ログ",
      to: { name: ROUTE_NAMES.projectActivity, params: projectParams },
      icon: "tasks",
    },
    {
      key: "members",
      label: "メンバー",
      to: { name: ROUTE_NAMES.projectMembers, params: projectParams },
      icon: "members",
    },
    {
      key: "categories",
      label: "カテゴリ",
      to: { name: ROUTE_NAMES.projectCategories, params: projectParams },
      icon: "settings",
    },
    {
      key: "invites",
      label: "招待リンク",
      to: { name: ROUTE_NAMES.projectInvites, params: projectParams },
      icon: "invites",
    },
    {
      key: "settings",
      label: "設定",
      to: { name: ROUTE_NAMES.projectSettings, params: projectParams },
      icon: "settings",
    },
    {
      key: "roles",
      label: "ロール",
      to: { name: ROUTE_NAMES.projectRoles, params: projectParams },
      icon: "members",
    },
    {
      key: "notifications",
      label: "通知",
      to: { name: ROUTE_NAMES.projectNotifications, params: projectParams },
      icon: "tasks",
    },
  ];
}

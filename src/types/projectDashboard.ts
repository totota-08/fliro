import type { RouteLocationRaw } from "vue-router";

export type DashboardNavKey =
  | "dashboard"
  | "tasks"
  | "team"
  | "members"
  | "invites"
  | "settings"
  | "debug"
  | "activity"
  | "categories"
  | "timeline"
  | "notifications"
  | "roles"
  | "scores";

export type DashboardNavItem = {
  key: DashboardNavKey;
  label: string;
  to?: RouteLocationRaw;
  icon: DashboardNavKey;
  disabled?: boolean;
  tooltip?: string;
  requiredPermission?: string; // 表示に必要な権限キー
};

import type { ReactionSummary } from "@/services/projectChat";

export interface PreviewChatMessage {
  id: string;
  author: string;
  time: string;
  message: string;
  reactions?: ReactionSummary[];
  senderId?: string;
  linkedTaskId?: string | null;
  isTask?: boolean;
}

export type DashboardProjectItem = {
  key: string;
  label: string;
  accent?: "primary" | "secondary" | "accent";
  /** プロジェクトのテーマカラー（設定時は accent より優先して表示） */
  color?: string;
  /** プロジェクトアイコン画像URL（設定時はドットの代わりに表示） */
  iconUrl?: string;
  to?: RouteLocationRaw;
};

export type DashboardProfileInfo = {
  name: string;
  email: string;
  avatar?: string;
};

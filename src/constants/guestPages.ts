/**
 * ゲスト閲覧可能なページの定義
 */
import type { GuestAllowedPage } from "@/types/project";
import { ROUTE_NAMES } from "@/constants/routes";

/**
 * ゲスト閲覧設定可能なページ一覧
 */
export const GUEST_CONFIGURABLE_PAGES: {
  key: GuestAllowedPage;
  label: string;
  description: string;
}[] = [
  {
    key: "dashboard",
    label: "ダッシュボード",
    description: "プロジェクトの概要とサマリーを表示",
  },
  {
    key: "tasks",
    label: "タスク",
    description: "タスク一覧と詳細を閲覧",
  },
  {
    key: "threads",
    label: "スレッド",
    description: "チャットスレッドを閲覧",
  },
  {
    key: "activity",
    label: "アクティビティログ",
    description: "プロジェクトの活動履歴を閲覧",
  },
  {
    key: "members",
    label: "メンバー",
    description: "プロジェクトメンバー一覧を閲覧",
  },
];

/**
 * ゲスト閲覧のデフォルト許可ページ
 * allowGuestView を ON にした時の初期値
 */
export const DEFAULT_GUEST_ALLOWED_PAGES: GuestAllowedPage[] = [
  "dashboard",
  "tasks",
  "threads",
  "activity",
  "members",
];

/**
 * ルート名からページキーへのマッピング（逆引き）
 */
export const ROUTE_TO_GUEST_PAGE: Partial<
  Record<
    (typeof ROUTE_NAMES)[keyof typeof ROUTE_NAMES],
    GuestAllowedPage | null
  >
> = {
  [ROUTE_NAMES.projectDashboard]: "dashboard",
  [ROUTE_NAMES.myTasks]: "tasks",
  [ROUTE_NAMES.projectTaskDetail]: "tasks",
  [ROUTE_NAMES.projectThreads]: "threads",
  [ROUTE_NAMES.projectActivity]: "activity",
  [ROUTE_NAMES.projectMembers]: "members",
  // 設定系はゲストには許可しない
  [ROUTE_NAMES.projectSettings]: null,
  [ROUTE_NAMES.projectRoles]: null,
  [ROUTE_NAMES.projectCategories]: null,
  [ROUTE_NAMES.projectInvites]: null,
  [ROUTE_NAMES.projectNotifications]: null,
  [ROUTE_NAMES.projectScores]: null,
};

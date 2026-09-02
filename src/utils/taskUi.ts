import type { TaskStatus, TaskDoc } from "@/services/taskService";

/**
 * タスクUIに関するユーティリティ関数
 * ステータスラベル、期限判定、フォーマットなど
 */

export type DisplayStatus = "完了" | "進行中" | "未着手";
export type DisplayPriority = "高" | "中" | "低";

/**
 * タスクステータスの日本語ラベルを取得
 */
export function getStatusLabel(status: TaskStatus): DisplayStatus {
  switch (status) {
    case "done":
      return "完了";
    case "in-progress":
      return "進行中";
    case "todo":
    default:
      return "未着手";
  }
}

/**
 * ステータスに応じたBadge variantを取得
 */
export function getStatusBadgeVariant(
  status: TaskStatus,
): "success" | "primary" | "default" {
  switch (status) {
    case "done":
      return "success";
    case "in-progress":
      return "primary";
    default:
      return "default";
  }
}

/**
 * 優先度の日本語ラベルを取得
 */
export function getPriorityLabel(priority?: string): DisplayPriority {
  switch (priority) {
    case "high":
      return "高";
    case "low":
      return "低";
    case "medium":
    default:
      return "中";
  }
}

/**
 * 優先度に応じたBadge variantを取得
 */
export function getPriorityBadgeVariant(
  priority?: string,
): "danger" | "warning" | "default" {
  switch (priority) {
    case "high":
      return "danger";
    case "medium":
      return "warning";
    default:
      return "default";
  }
}

/**
 * 期限までの残り日数（暦日差）を計算する。
 * 期限は "YYYY-MM-DD" を UTC 深夜として保存しているため、そのまま現在時刻と
 * 比較すると JST では期限日当日の朝9時に「期限切れ」になってしまう。
 * UTC のカレンダー日付を取り出し、ローカルの今日との暦日差で判定する。
 */
function calendarDaysUntil(seconds: number): number {
  const due = new Date(seconds * 1000);
  const dueDay = new Date(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate(),
  );
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round(
    (dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

/**
 * 期限切れかどうかを判定（期限日当日はまだ期限切れではない）
 */
export function isTaskOverdue(task: TaskDoc): boolean {
  if (!task.dueDate?.seconds) return false;
  return calendarDaysUntil(task.dueDate.seconds) < 0 && task.status !== "done";
}

/**
 * 期限までの日数を計算（暦日差）
 */
export function getDaysUntilDue(dueDate?: {
  seconds: number;
  nanoseconds: number;
}): number | null {
  if (!dueDate?.seconds) return null;
  return calendarDaysUntil(dueDate.seconds);
}

/**
 * 期限のメッセージを取得
 */
export function getDueMessage(task: TaskDoc): string {
  if (!task.dueDate?.seconds) return "期限未設定";
  const days = getDaysUntilDue(task.dueDate);
  if (days === null) return "期限未設定";
  if (days < 0) return `${Math.abs(days)}日遅れ`;
  if (days === 0) return "今日が期限";
  return `あと${days}日`;
}

/**
 * 期限の表示用クラスを取得
 */
export function getDueClass(task: TaskDoc): "" | "due-over" | "due-soon" {
  if (!task.dueDate?.seconds) return "";
  const days = getDaysUntilDue(task.dueDate);
  if (days === null) return "";
  if (days < 0) return "due-over";
  if (days <= 3) return "due-soon";
  return "";
}

/**
 * 期限の日付をフォーマット
 */
export function formatDueDate(dueDate?: {
  seconds: number;
  nanoseconds: number;
}): string {
  if (!dueDate?.seconds) return "未設定";
  // UTC 深夜として保存された暦日をタイムゾーンに関わらずそのまま表示する
  return new Date(dueDate.seconds * 1000).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * 期限の日付をISO形式でフォーマット（input用）
 */
export function formatDueDateISO(dueDate?: {
  seconds: number;
  nanoseconds: number;
}): string {
  if (!dueDate?.seconds) return "";
  return new Date(dueDate.seconds * 1000).toISOString().slice(0, 10);
}

/**
 * 日時を読みやすい形式でフォーマット
 */
export function formatDateTime(
  timestamp?: { seconds: number; nanoseconds: number } | Date | null,
): string {
  if (!timestamp) return "";
  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if ("seconds" in timestamp) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    return "";
  }
  return date.toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 進捗を25%刻みに正規化
 */
export function normalizeProgress(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  const clamped = Math.min(100, Math.max(0, value));
  return Math.round(clamped / 25) * 25;
}

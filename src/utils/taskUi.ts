import type { TaskStatus, TaskDoc } from "@/services/taskService";

/**
 * タスクUIに関するユーティリティ関数
 * ステータスラベル、期限判定、フォーマットなど
 */

export type DisplayStatus = "完了" | "進行中" | "レビュー待ち" | "未着手";
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
    case "review":
      return "レビュー待ち";
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
): "success" | "primary" | "info" | "default" {
  switch (status) {
    case "done":
      return "success";
    case "in-progress":
      return "primary";
    case "review":
      return "info";
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
 * 期限切れかどうかを判定
 */
export function isTaskOverdue(task: TaskDoc): boolean {
  if (!task.dueDate?.seconds) return false;
  const dueTime = task.dueDate.seconds * 1000;
  return dueTime < Date.now() && task.status !== "done";
}

/**
 * 期限が近いかどうかを判定（3日以内）
 */
export function isTaskDueSoon(task: TaskDoc): boolean {
  if (!task.dueDate?.seconds || task.status === "done") return false;
  const dueTime = task.dueDate.seconds * 1000;
  const now = Date.now();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  return dueTime > now && dueTime - now <= threeDays;
}

/**
 * 期限までの日数を計算
 */
export function getDaysUntilDue(dueDate?: {
  seconds: number;
  nanoseconds: number;
}): number | null {
  if (!dueDate?.seconds) return null;
  const due = new Date(dueDate.seconds * 1000);
  const now = new Date();
  const diffTime = due.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
  return new Date(dueDate.seconds * 1000).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
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

import type {
  ProjectEvent,
  ProjectEventCategory,
  ProjectEventType,
} from "@/types/projectEvent";

type EventTemplate = {
  icon: "check" | "task" | "clock" | "user" | "bot" | "alert" | "note";
  title: string;
  description: string;
  category: ProjectEventCategory;
};

const STATUS_LABEL: Record<string, string> = {
  todo: "未着手",
  "in-progress": "進行中",
  review: "レビュー",
  done: "完了",
};

const ROLE_LABEL: Record<string, string> = {
  owner: "オーナー",
  admin: "管理者",
  member: "メンバー",
  viewer: "閲覧者",
};

const CATEGORY_MAP: Record<ProjectEventType, ProjectEventCategory> = {
  "task.created": "task",
  "task.status_changed": "task",
  "task.progress_changed": "task",
  "task.assigned": "task",
  "task.due_changed": "task",
  "task.updated": "task",
  "task.deleted": "task",
  "decision.made": "decision",
  "member.added": "member",
  "member.removed": "member",
  "member.role_changed": "member",
  "bot.command_executed": "bot",
  "bot.error": "bot",
};

function formatDateValue(value: unknown) {
  if (!value) return "未設定";
  if (typeof value === "string") return value;
  if (typeof value === "number") return new Date(value).toLocaleDateString();
  if (typeof value === "object" && (value as any).seconds) {
    const seconds = (value as any).seconds as number;
    return new Date(seconds * 1000).toLocaleDateString();
  }
  return "未設定";
}

function statusLabel(status?: string) {
  return STATUS_LABEL[status || ""] ?? status ?? "不明";
}

function roleLabel(role?: string | null) {
  if (!role) return "未設定";
  return ROLE_LABEL[role] ?? role;
}

function formatAssignee(name?: string | null) {
  if (!name) return "未設定";
  return name;
}

function formatProgress(value: unknown) {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return `${value}%`;
  }
  return "不明";
}

export function categorizeProjectEvent(
  event: ProjectEvent,
): ProjectEventCategory {
  return CATEGORY_MAP[event.type] ?? "other";
}

export function getEventTemplate(event: ProjectEvent): EventTemplate {
  const category = categorizeProjectEvent(event);
  const payload = event.payload || {};
  const taskTitle = payload.taskTitle || "タスク";

  switch (event.type) {
    case "task.created":
      return {
        icon: "task",
        title: "タスクを作成",
        description: `${event.actorName} が「${taskTitle}」を作成しました`,
        category,
      };
    case "task.status_changed":
      return {
        icon: "check",
        title: "ステータス変更",
        description: `「${taskTitle}」: ${statusLabel(payload.fromStatus)} → ${statusLabel(payload.toStatus)}`,
        category,
      };
    case "task.progress_changed":
      return {
        icon: "clock",
        title: "進捗を更新",
        description: `「${taskTitle}」: ${formatProgress(payload.fromProgress)} → ${formatProgress(payload.toProgress)}`,
        category,
      };
    case "task.assigned":
      return {
        icon: "user",
        title: "担当変更",
        description: `「${taskTitle}」: ${formatAssignee(payload.fromAssigneeName)} → ${formatAssignee(payload.toAssigneeName)}`,
        category,
      };
    case "task.due_changed":
      return {
        icon: "clock",
        title: "期限を変更",
        description: `「${taskTitle}」: ${formatDateValue(payload.fromDueDate)} → ${formatDateValue(payload.toDueDate)}`,
        category,
      };
    case "task.updated":
      return {
        icon: "task",
        title: "タスクを更新",
        description: `「${taskTitle}」を更新しました`,
        category,
      };
    case "task.deleted":
      return {
        icon: "alert",
        title: "タスクを削除",
        description: `「${taskTitle}」を削除しました`,
        category,
      };
    case "decision.made":
      return {
        icon: "check",
        title: "決定を記録",
        description: `「${taskTitle}」: ${payload.text || "決定を記録"}`,
        category,
      };
    case "member.added":
      return {
        icon: "user",
        title: "メンバー追加",
        description: `${event.actorName} が ${payload.memberName || payload.memberId || "メンバー"} を追加しました`,
        category,
      };
    case "member.removed":
      return {
        icon: "user",
        title: "メンバー削除",
        description: `${event.actorName} が ${payload.memberName || payload.memberId || "メンバー"} を削除しました`,
        category,
      };
    case "member.role_changed":
      return {
        icon: "user",
        title: "ロール変更",
        description: `${event.actorName} が ${payload.memberName || payload.memberId || "メンバー"} のロールを ${roleLabel(payload.fromRole)} → ${roleLabel(payload.toRole)} に変更しました`,
        category,
      };
    case "bot.command_executed":
      return {
        icon: "bot",
        title: "コマンド実行",
        description: `${payload.command || "コマンド"}（${payload.result || "unknown"}）`,
        category,
      };
    case "bot.error":
      return {
        icon: "bot",
        title: "Botエラー",
        description: payload.reason || "不明なエラーが発生しました",
        category,
      };
    default:
      return {
        icon: "note",
        title: "イベント",
        description: "更新が記録されました",
        category: "other",
      };
  }
}

export function iconPath(icon: EventTemplate["icon"]) {
  switch (icon) {
    case "check":
      return "M5 13l4 4L19 7";
    case "task":
      return "M5 4h14v16H5z M9 8h6";
    case "clock":
      return "M12 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 2v4l2.5 1.5";
    case "user":
      return "M12 12a4 4 0 1 0-0.001-8.001A4 4 0 0 0 12 12zm0 2c-3.333 0-6 1.667-6 3.5V20h12v-2.5C18 15.667 15.333 14 12 14z";
    case "bot":
      return "M7 8h10v6a5 5 0 0 1-10 0V8zm5-5v3m-5 4h10";
    case "alert":
      return "M12 9v4m0 4h.01M10.29 3.86 1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0z";
    case "note":
    default:
      return "M6 4h9l3 3v11H6z";
  }
}

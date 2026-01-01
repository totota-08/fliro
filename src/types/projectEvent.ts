export type ProjectEventType =
  | "task.created"
  | "task.status_changed"
  | "task.progress_changed"
  | "task.assigned"
  | "task.due_changed"
  | "task.updated"
  | "task.deleted"
  | "decision.made"
  | "member.added"
  | "member.removed"
  | "member.role_changed"
  | "bot.command_executed"
  | "bot.error";

export type ProjectEventOrigin = "ui" | "command" | "bot" | "system";

export type ProjectEvent = {
  v: 1;
  id: string;
  projectId: string;
  type: ProjectEventType;
  createdAt: any;
  origin: ProjectEventOrigin;
  actorId: string | null;
  actorName: string;
  payload: Record<string, any>;
};

export type ProjectEventInput = Omit<
  ProjectEvent,
  "id" | "projectId" | "createdAt" | "v"
> & {
  createdAt?: any;
};

export type ProjectEventCategory =
  | "task"
  | "decision"
  | "member"
  | "bot"
  | "other";

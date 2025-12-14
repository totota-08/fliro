export type TaskState = "todo" | "doing" | "done"
export type CommentType = "comment" | "decision" | "question" | "request"

export interface Task {
  id: string
  title: string
  description: string
  state: TaskState
  priority?: "low" | "medium" | "high"
  dueAt?: Date | null
  assigneeId?: string | null
  labelIds?: string[]
  visibility?: "private" | "org"
  watcherIds?: string[]
  decisionCount?: number
  openQuestionCount?: number
  openChecklistCount?: number
  createdAt?: Date | null
  updatedAt?: Date | null
  completedAt?: Date | null
}

export interface ChecklistItem {
  id: string
  body: string
  done: boolean
  assigneeId?: string | null
  dueAt?: Date | null
  order: number
  createdAt?: Date | null
  updatedAt?: Date | null
}

export interface Attachment {
  id: string
  name: string
  url: string
  contentType?: string
  size?: number
  createdAt?: Date | null
  authorId?: string
}

export interface LinkItem {
  id: string
  title: string
  url: string
  createdAt?: Date | null
  authorId?: string
}

export interface CommentItem {
  id: string
  type: CommentType
  body: string
  authorId: string
  createdAt?: Date | null
  updatedAt?: Date | null
  deletedAt?: Date | null
  resolvedAt?: Date | null
  resolvedBy?: string | null
  pinned?: boolean
}

export interface ActivityEvent {
  id: string
  actorType: "user" | "bot" | "system"
  actorId?: string
  eventType: string
  fieldName?: string
  oldValue?: any
  newValue?: any
  createdAt?: Date | null
}

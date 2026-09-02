export type ProjectStatus = "active" | "archived" | "completed";

/** ゲストがアクセス可能なページの種類 */
export type GuestAllowedPage =
  "dashboard" | "tasks" | "threads" | "activity" | "members";

export interface ProjectSettings {
  isPublic: boolean;
  allowGuestView: boolean;
  /** ゲストがアクセス可能なページ一覧（allowGuestView が true の場合に有効） */
  guestAllowedPages?: GuestAllowedPage[];
  defaultTaskStatus: string;
  aiChatEnabled?: boolean;
  aiApiKey?: string;
  notificationEnabled?: boolean;
  humorousCommandsEnabled?: boolean;
}

export interface ProjectStatsCache {
  totalTasks: number;
  completedTasks: number;
  totalMembers: number;
  lastActivityAt?: Date;
}

export interface ProjectDoc {
  name: string;
  description: string;
  ownerUserId: string;
  status: ProjectStatus;
  color?: string;
  icon?: string;
  startDate?: Date;
  dueDate?: Date;
  completedAt?: Date;
  settings: ProjectSettings;
  stats: ProjectStatsCache;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface ProjectMemberDoc {
  userId: string;
  role: "owner" | "admin" | "member" | "viewer";
  projectRole: "owner" | "member";
  roles?: string[];
  permissions: {
    canEditProject: boolean;
    canDeleteTasks: boolean;
    canInviteMembers: boolean;
    canManageSettings: boolean;
    canEditRoles: boolean;
    canManageTasks: boolean;
    canManageMembers: boolean;
  };
  invitedBy: string;
  joinedAt: Date;
  lastAccessedAt: Date;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  startDate?: string | null;
  dueDate?: string | null;
  isPublic?: boolean;
  allowGuestView?: boolean;
}

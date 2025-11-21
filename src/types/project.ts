export type ProjectStatus = 'active' | 'archived' | 'completed'

export interface ProjectSettings {
  isPublic: boolean
  allowGuestView: boolean
  defaultTaskStatus: string
  aiChatEnabled?: boolean
  aiApiKey?: string
  notificationEnabled?: boolean
}

export interface ProjectStatsCache {
  totalTasks: number
  completedTasks: number
  totalMembers: number
  lastActivityAt?: Date
}

export interface ProjectDoc {
  name: string
  description: string
  ownerUserId: string
  status: ProjectStatus
  color?: string
  icon?: string
  startDate?: Date
  dueDate?: Date
  completedAt?: Date
  settings: ProjectSettings
  stats: ProjectStatsCache
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

export interface ProjectMemberDoc {
  userId: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  permissions: {
    canEditProject: boolean
    canDeleteTasks: boolean
    canInviteMembers: boolean
    canManageSettings: boolean
  }
  invitedBy: string
  joinedAt: Date
  lastAccessedAt: Date
}

export interface UserProjectEntryDoc {
  projectName: string
  role: ProjectMemberDoc['role']
  lastAccessedAt: Date
}

export interface CreateProjectPayload {
  name: string
  description?: string
  color?: string
  icon?: string
  startDate?: string | null
  dueDate?: string | null
  isPublic?: boolean
  allowGuestView?: boolean
}

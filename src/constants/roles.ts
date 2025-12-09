export type RoleKey = 'admin' | 'member' | 'viewer'

export type RolePermissions = {
  canEditProject: boolean
  canDeleteTasks: boolean
  canInviteMembers: boolean
  canManageSettings: boolean
  canEditRoles: boolean
  canManageTasks: boolean
  canManageMembers: boolean
}

const defaultPermissions: RolePermissions = {
  canEditProject: false,
  canDeleteTasks: false,
  canInviteMembers: false,
  canManageSettings: false,
  canEditRoles: false,
  canManageTasks: false,
  canManageMembers: false,
}

export function buildPermissionsFromRoles(roles: string[] = []): RolePermissions {
  const normalized = roles.map((role) => role.toLowerCase())
  const isAdmin = normalized.includes('admin') || normalized.includes('owner')
  const isMember = normalized.includes('member')

  return {
    ...defaultPermissions,
    canEditProject: isAdmin,
    canDeleteTasks: isAdmin,
    canInviteMembers: isAdmin,
    canManageSettings: isAdmin,
    canEditRoles: isAdmin,
    canManageTasks: isAdmin || isMember,
    canManageMembers: isAdmin,
  }
}

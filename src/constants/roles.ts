export type RoleKey = "owner" | "admin" | "member" | "guest";

export type RolePermissions = {
  canEditProject: boolean;
  canDeleteTasks: boolean;
  canInviteMembers: boolean;
  canManageSettings: boolean;
  canEditRoles: boolean;
  canManageTasks: boolean;
  canManageMembers: boolean;
};

export type ProjectRolesMap = {
  owner: string[];
  admin: string[];
  member: string[];
  guest: string[];
};

export const ROLE_RANK: Record<RoleKey, number> = {
  owner: 0,
  admin: 1,
  member: 2,
  guest: 3,
};

const defaultPermissions: RolePermissions = {
  canEditProject: false,
  canDeleteTasks: false,
  canInviteMembers: false,
  canManageSettings: false,
  canEditRoles: false,
  canManageTasks: false,
  canManageMembers: false,
};

export function normalizeRole(input?: string | null): RoleKey {
  const raw = (input || "").toLowerCase();
  if (raw === "owner") return "owner";
  if (raw === "admin") return "admin";
  if (raw === "member") return "member";
  if (raw === "guest" || raw === "viewer") return "guest";
  return "guest";
}

export function normalizeProjectRoles(
  input?: Partial<ProjectRolesMap> | null,
): ProjectRolesMap {
  return {
    owner: Array.isArray(input?.owner) ? [...input!.owner] : [],
    admin: Array.isArray(input?.admin) ? [...input!.admin] : [],
    member: Array.isArray(input?.member) ? [...input!.member] : [],
    guest: Array.isArray(input?.guest) ? [...input!.guest] : [],
  };
}

export function resolveRoleFromProjectRoles(
  roles: ProjectRolesMap,
  userId: string,
): RoleKey | null {
  if (!userId) return null;
  if (roles.owner.includes(userId)) return "owner";
  if (roles.admin.includes(userId)) return "admin";
  if (roles.member.includes(userId)) return "member";
  if (roles.guest.includes(userId)) return "guest";
  return null;
}

export function buildPermissionsFromRole(role: RoleKey): RolePermissions {
  const normalized = normalizeRole(role);
  const isAdmin = normalized === "owner" || normalized === "admin";
  const isMember = normalized === "member";

  return {
    ...defaultPermissions,
    canEditProject: isAdmin,
    canDeleteTasks: isAdmin,
    canInviteMembers: isAdmin,
    canManageSettings: isAdmin,
    canEditRoles: isAdmin,
    canManageTasks: isAdmin || isMember,
    canManageMembers: isAdmin,
  };
}

export function buildPermissionsFromRoles(
  roles: string[] = [],
): RolePermissions {
  const normalized = roles.map((role) => normalizeRole(role));
  if (normalized.includes("owner")) return buildPermissionsFromRole("owner");
  if (normalized.includes("admin")) return buildPermissionsFromRole("admin");
  if (normalized.includes("member")) return buildPermissionsFromRole("member");
  if (normalized.includes("guest")) return buildPermissionsFromRole("guest");
  return buildPermissionsFromRole("guest");
}

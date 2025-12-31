import { database, db } from "@/lib/firebase";
import {
  ROLE_RANK,
  buildPermissionsFromRole,
  normalizeProjectRoles,
  normalizeRole,
  type ProjectRolesMap,
  type RoleKey,
} from "@/constants/roles";
import { addProjectEvent } from "@/services/projectActivityLogService";
import { ref, remove, set } from "firebase/database";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentSnapshot,
  type QuerySnapshot,
  type DocumentData,
} from "firebase/firestore";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.services.projectMembers");

type MemberDocData = {
  userId?: string;
  role?: string;
  nickname?: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string;
  lastAccessedAt?: { seconds: number; nanoseconds: number };
};

export interface ProjectMember {
  userId: string;
  role: RoleKey;
  projectRole?: "owner" | "member";
  nickname?: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string;
  displayName?: string; // Computed property for display
  lastAccessedAt?: { seconds: number; nanoseconds: number };
  permissions?: ReturnType<typeof buildPermissionsFromRole>;
}

interface AddProjectMemberOptions {
  projectId: string;
  userId: string;
  role?: RoleKey;
  invitedBy: string;
  inviteToken?: string;
  projectName?: string;
  profile?: {
    nickname?: string;
    fullName?: string;
    email?: string;
    avatarUrl?: string;
  };
  actorName?: string;
}

function buildMemberEntry(
  userId: string,
  data: MemberDocData | undefined,
  role: RoleKey,
): ProjectMember {
  const normalizedRole = normalizeRole(role);
  return {
    userId,
    role: normalizedRole,
    projectRole: normalizedRole === "owner" ? "owner" : "member",
    nickname: data?.nickname ?? null,
    fullName: data?.fullName ?? null,
    email: data?.email ?? null,
    avatarUrl: data?.avatarUrl ?? null,
    lastAccessedAt: data?.lastAccessedAt,
    permissions: buildPermissionsFromRole(normalizedRole),
    displayName:
      data?.nickname || data?.fullName || data?.email || userId || "Unknown",
  };
}

function buildRoleListsFromMembers(
  members: Map<string, MemberDocData>,
  ownerFallback?: string,
): ProjectRolesMap {
  const roles: ProjectRolesMap = {
    owner: [],
    admin: [],
    member: [],
    guest: [],
  };

  members.forEach((data, uid) => {
    const role = normalizeRole(data.role ?? "member");
    roles[role].push(uid);
  });

  if (ownerFallback && !roles.owner.includes(ownerFallback)) {
    roles.owner.push(ownerFallback);
  }

  return roles;
}

function hasRolesData(rawRoles: unknown, roles: ProjectRolesMap) {
  if (!rawRoles) return false;
  return (
    roles.owner.length > 0 ||
    roles.admin.length > 0 ||
    roles.member.length > 0 ||
    roles.guest.length > 0
  );
}

export function listenProjectMembers(
  projectId: string,
  callback: (members: ProjectMember[]) => void,
) {
  const membersRef = collection(db, "projects", projectId, "members");
  const projectRef = doc(db, "projects", projectId);

  let membersSnapshot: QuerySnapshot<DocumentData> | null = null;
  let projectSnapshot: DocumentSnapshot<DocumentData> | null = null;

  const emit = () => {
    if (!membersSnapshot) return;
    const memberMap = new Map<string, MemberDocData>();
    membersSnapshot.forEach((docSnap) => {
      memberMap.set(docSnap.id, docSnap.data() as MemberDocData);
    });

    const projectData = projectSnapshot?.data();
    const normalizedRoles = normalizeProjectRoles(
      (projectData as { roles?: ProjectRolesMap } | undefined)?.roles,
    );
    const useRoles = hasRolesData(
      (projectData as { roles?: ProjectRolesMap } | undefined)?.roles,
      normalizedRoles,
    );

    const members: ProjectMember[] = [];
    const seen = new Set<string>();

    if (useRoles) {
      const roleEntries: Array<[RoleKey, string[]]> = [
        ["owner", normalizedRoles.owner],
        ["admin", normalizedRoles.admin],
        ["member", normalizedRoles.member],
        ["guest", normalizedRoles.guest],
      ];
      roleEntries.forEach(([role, ids]) => {
        ids.forEach((uid) => {
          if (seen.has(uid)) return;
          members.push(buildMemberEntry(uid, memberMap.get(uid), role));
          seen.add(uid);
        });
      });
    }

    memberMap.forEach((data, uid) => {
      if (seen.has(uid)) return;
      const role = normalizeRole(data.role ?? "member");
      members.push(buildMemberEntry(uid, data, role));
    });

    members.sort((a, b) => {
      const rankDiff = ROLE_RANK[a.role] - ROLE_RANK[b.role];
      if (rankDiff !== 0) return rankDiff;
      return (a.displayName || "").localeCompare(b.displayName || "");
    });

    callback(members);
  };

  const stopMembers = onSnapshot(
    membersRef,
    (snapshot) => {
      membersSnapshot = snapshot;
      emit();
    },
    (error) => {
      logger.warn`Failed to listen members for ${projectId}: ${error}`;
    },
  );

  const stopProject = onSnapshot(
    projectRef,
    (snapshot) => {
      projectSnapshot = snapshot;
      emit();
    },
    (error) => {
      logger.warn`Failed to listen project ${projectId}: ${error}`;
    },
  );

  return () => {
    stopMembers();
    stopProject();
  };
}

export async function syncProjectRolesFromMembers(projectId: string) {
  const projectRef = doc(db, "projects", projectId);
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) return;
  const projectData = projectSnap.data() as { ownerUserId?: string };
  const existingRoles = normalizeProjectRoles(
    (projectSnap.data() as { roles?: ProjectRolesMap }).roles,
  );
  if (hasRolesData((projectSnap.data() as any).roles, existingRoles)) return;

  const membersSnap = await getDocs(
    collection(db, "projects", projectId, "members"),
  );
  const memberMap = new Map<string, MemberDocData>();
  membersSnap.forEach((docSnap) => {
    memberMap.set(docSnap.id, docSnap.data() as MemberDocData);
  });

  const roles = buildRoleListsFromMembers(memberMap, projectData.ownerUserId);
  await updateDoc(projectRef, {
    roles,
    roleVersion: 2,
  });
}

async function updateProjectRoles(
  projectId: string,
  userId: string,
  role: RoleKey,
) {
  const updates: Record<string, unknown> = {
    "roles.owner": arrayRemove(userId),
    "roles.admin": arrayRemove(userId),
    "roles.member": arrayRemove(userId),
    "roles.guest": arrayRemove(userId),
    roleVersion: 2,
  };
  updates[`roles.${role}`] = arrayUnion(userId);
  await updateDoc(doc(db, "projects", projectId), updates);
}

export async function addProjectMember({
  projectId,
  userId,
  role = "member",
  invitedBy,
  inviteToken,
  projectName,
  profile,
}: AddProjectMemberOptions) {
  const timestamp = serverTimestamp();
  const profileData = profile ?? {};
  const normalizedRole = normalizeRole(role);

  try {
    await updateProjectRoles(projectId, userId, normalizedRole);
  } catch (error) {
    logger.warn`Failed to update project roles: ${error}`;
  }

  await setDoc(
    doc(db, "projects", projectId, "members", userId),
    {
      userId,
      role: normalizedRole,
      status: "active",
      invitedBy,
      inviteToken: inviteToken ?? null,
      nickname: profileData.nickname ?? null,
      fullName: profileData.fullName ?? null,
      email: profileData.email ?? null,
      avatarUrl: profileData.avatarUrl ?? null,
      joinedAt: timestamp,
      lastAccessedAt: timestamp,
      updatedAt: timestamp,
    },
    { merge: true },
  );

  await setDoc(
    doc(db, "users", userId, "projectRefs", projectId),
    {
      projectId,
      projectName: projectName ?? "参加中プロジェクト",
      role: normalizedRole,
      joinedAt: timestamp,
      lastViewedAt: timestamp,
    },
    { merge: true },
  );

  // Sync to Realtime Database for chat rules
  const rtdbRef = ref(database, `projects/${projectId}/members/${userId}`);
  await set(rtdbRef, {
    role: normalizedRole,
    joinedAt: Date.now(),
  });

  try {
    await addProjectEvent(projectId, {
      type: "member.added",
      origin: invitedBy ? "ui" : "system",
      actorId: invitedBy || null,
      actorName:
        profileData.nickname || profileData.fullName || invitedBy || "System",
      payload: {
        memberId: userId,
        memberName:
          profileData.nickname ||
          profileData.fullName ||
          profileData.email ||
          userId,
      },
    });
  } catch (error) {
    logger.error`Failed to log member.added: ${error}`;
  }
}

export async function removeProjectMember(
  projectId: string,
  userId: string,
  actor?: {
    id?: string | null;
    name?: string;
    origin?: "ui" | "command" | "bot" | "system";
  },
) {
  await updateDoc(doc(db, "projects", projectId), {
    "roles.owner": arrayRemove(userId),
    "roles.admin": arrayRemove(userId),
    "roles.member": arrayRemove(userId),
    "roles.guest": arrayRemove(userId),
  });
  await deleteDoc(doc(db, "projects", projectId, "members", userId));
  await deleteDoc(doc(db, "users", userId, "projectRefs", projectId));

  // Remove from Realtime Database
  const rtdbRef = ref(database, `projects/${projectId}/members/${userId}`);
  await remove(rtdbRef);

  try {
    await addProjectEvent(projectId, {
      type: "member.removed",
      origin: actor?.origin ?? "ui",
      actorId: actor?.id ?? null,
      actorName: actor?.name || actor?.id || "System",
      payload: {
        memberId: userId,
        memberName: userId,
      },
    });
  } catch (error) {
    logger.error`Failed to log member.removed: ${error}`;
  }
}

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  role: ProjectMember["role"],
) {
  const normalizedRole = normalizeRole(role);
  await updateProjectRoles(projectId, userId, normalizedRole);

  await setDoc(
    doc(db, "projects", projectId, "members", userId),
    {
      role: normalizedRole,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await setDoc(
    doc(db, "users", userId, "projectRefs", projectId),
    {
      role: normalizedRole,
      lastViewedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const rtdbRef = ref(database, `projects/${projectId}/members/${userId}`);
  await set(rtdbRef, {
    role: normalizedRole,
    joinedAt: Date.now(),
  });
}

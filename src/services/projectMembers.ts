import { buildPermissionsFromRoles } from "@/constants/roles";
import { database, db } from "@/lib/firebase";
import { addProjectEvent } from "@/services/projectActivityLogService";
import { getLogger } from "@logtape/logtape";
import { ref, remove, set } from "firebase/database";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const logger = getLogger("app.services.projectMembers");

export interface ProjectMember {
  userId: string;
  role: "owner" | "admin" | "member" | "viewer";
  projectRole: "owner" | "member";
  roles?: string[];
  nickname?: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string;
  displayName?: string; // Computed property for display
  permissions?: ReturnType<typeof buildPermissionsFromRoles>;
}

interface AddProjectMemberOptions {
  projectId: string;
  userId: string;
  role?: "owner" | "admin" | "member" | "viewer";
  projectRole?: "owner" | "member";
  roles?: string[];
  invitedBy: string;
  projectName?: string;
  profile?: {
    nickname?: string;
    fullName?: string;
    email?: string;
    avatarUrl?: string;
  };
  actorName?: string;
}

interface UpdateMemberRoleOptions {
  actor?: {
    id?: string | null;
    name?: string;
    origin?: "ui" | "command" | "bot" | "system";
  };
  previousRole?: ProjectMember["role"];
  memberName?: string;
}

function getPermissionsFromRole(role: ProjectMember["role"]) {
  const isAdmin = role === "owner" || role === "admin";
  return {
    canEditProject: isAdmin,
    canDeleteTasks: isAdmin,
    canInviteMembers: isAdmin,
    canManageSettings: role === "owner",
  };
}

export function listenProjectMembers(
  projectId: string,
  callback: (members: ProjectMember[]) => void,
) {
  const membersRef = collection(db, "projects", projectId, "members");
  return onSnapshot(membersRef, (snapshot) => {
    const members: ProjectMember[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const roles = (data.roles as string[] | undefined) ?? [
        data.role || "member",
      ];
      const permissions = data.permissions ?? buildPermissionsFromRoles(roles);
      members.push({
        userId: doc.id,
        role: data.role,
        projectRole: data.projectRole,
        roles,
        nickname: data.nickname,
        fullName: data.fullName,
        email: data.email,
        avatarUrl: data.avatarUrl,
        permissions,
        displayName: data.nickname || data.fullName || "Unknown User",
      });
    });
    callback(members);
  });
}

export async function addProjectMember({
  projectId,
  userId,
  role = "member",
  projectRole = "member",
  roles,
  invitedBy,
  projectName,
  profile,
}: AddProjectMemberOptions) {
  const timestamp = serverTimestamp();
  const profileData = profile ?? {};
  const grantedRoles =
    roles && roles.length ? roles : [role === "owner" ? "admin" : role];
  const permissions = buildPermissionsFromRoles(grantedRoles);
  await setDoc(
    doc(db, "projects", projectId, "members", userId),
    {
      userId,
      role,
      projectRole,
      roles: grantedRoles,
      invitedBy,
      nickname: profileData.nickname ?? null,
      fullName: profileData.fullName ?? null,
      email: profileData.email ?? null,
      avatarUrl: profileData.avatarUrl ?? null,
      permissions,
      joinedAt: timestamp,
      lastAccessedAt: timestamp,
    },
    { merge: true },
  );

  await setDoc(
    doc(db, "userProjects", userId, "projects", projectId),
    {
      projectName: projectName ?? "参加中プロジェクト",
      role,
      lastAccessedAt: timestamp,
    },
    { merge: true },
  );

  // Sync to Realtime Database for chat rules
  const rtdbRef = ref(database, `projects/${projectId}/members/${userId}`);
  await set(rtdbRef, {
    role,
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
  if (actor?.id === userId && actor?.origin !== "system") {
    throw new Error("permission-denied: cannot remove self");
  }

  if (actor?.id === userId && actor?.origin !== "system") {
    throw new Error("permission-denied: cannot remove self");
  }

  await deleteDoc(doc(db, "projects", projectId, "members", userId));
  try {
    await deleteDoc(doc(db, "userProjects", userId, "projects", projectId));
  } catch (error) {
    logger.warn`Failed to delete userProjects for ${userId}: ${error}`;
  }

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
  options?: UpdateMemberRoleOptions,
) {
  const permissions = getPermissionsFromRole(role);
  await setDoc(
    doc(db, "projects", projectId, "members", userId),
    {
      role,
      permissions,
    },
    { merge: true },
  );
  await setDoc(
    doc(db, "userProjects", userId, "projects", projectId),
    {
      role,
      lastAccessedAt: serverTimestamp(),
    },
    { merge: true },
  ).catch((error) => {
    logger.warn`Failed to update userProjects for ${userId}: ${error}`;
  });

  try {
    if (!options?.previousRole || options.previousRole !== role) {
      await addProjectEvent(projectId, {
        type: "member.role_changed",
        origin: options?.actor?.origin ?? "ui",
        actorId: options?.actor?.id ?? null,
        actorName: options?.actor?.name || options?.actor?.id || "System",
        payload: {
          memberId: userId,
          memberName: options?.memberName ?? userId,
          fromRole: options?.previousRole ?? null,
          toRole: role,
        },
      });
    }
  } catch (error) {
    logger.error`Failed to log member.role_changed: ${error}`;
  }

  const rtdbRef = ref(database, `projects/${projectId}/members/${userId}`);
  await set(rtdbRef, {
    role,
    joinedAt: Date.now(),
  }).catch((error) => {
    logger.warn`Failed to update realtime member for ${userId}: ${error}`;
  });
}

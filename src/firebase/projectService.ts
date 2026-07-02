import { db } from "@/lib/firebase";
import { addProjectMember } from "@/services/projectMembers";
import { ensureDefaultRoles } from "@/services/rolesService";
import type {
  CreateProjectPayload,
  GuestAllowedPage,
  ProjectDoc,
} from "@/types/project";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

export async function createProject(
  payload: CreateProjectPayload,
  currentUserId: string,
) {
  const projectBase: any = {
    name: payload.name.trim(),
    description: payload.description?.trim() || "",
    ownerUserId: currentUserId,
    status: "active",
    settings: {
      isPublic: payload.isPublic ?? false,
      allowGuestView: payload.allowGuestView ?? false,
      defaultTaskStatus: "todo",
      aiChatEnabled: false,
      notificationEnabled: true,
      humorousCommandsEnabled: false,
    },
    stats: {
      totalTasks: 0,
      completedTasks: 0,
      totalMembers: 1,
      lastActivityAt: serverTimestamp(),
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (payload.color) projectBase.color = payload.color;
  if (payload.startDate) projectBase.startDate = new Date(payload.startDate);
  if (payload.dueDate) projectBase.dueDate = new Date(payload.dueDate);

  // Create project document
  const projRef = await addDoc(collection(db, "projects"), projectBase);

  await addProjectMember({
    projectId: projRef.id,
    userId: currentUserId,
    role: "owner",
    projectRole: "owner",
    roles: ["admin"],
    invitedBy: currentUserId,
    projectName: projectBase.name,
  });

  // デフォルトロールを作成
  await ensureDefaultRoles(projRef.id);

  return projRef.id;
}

export async function fetchProject(projectId: string) {
  const ref = doc(db, "projects", projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as unknown as ProjectDoc) };
}

export interface UpdateProjectMetadataPayload {
  name?: string;
  description?: string;
  isPublic?: boolean;
  allowGuestView?: boolean;
  guestAllowedPages?: GuestAllowedPage[];
}

export async function updateProjectMetadata(
  projectId: string,
  payload: UpdateProjectMetadataPayload,
) {
  const updateData: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (typeof payload.name === "string") {
    updateData.name = payload.name.trim();
  }
  if (typeof payload.description === "string") {
    updateData.description = payload.description.trim();
  }
  if (typeof payload.isPublic === "boolean") {
    updateData["settings.isPublic"] = payload.isPublic;
  }
  if (typeof payload.allowGuestView === "boolean") {
    updateData["settings.allowGuestView"] = payload.allowGuestView;
  }
  if (Array.isArray(payload.guestAllowedPages)) {
    updateData["settings.guestAllowedPages"] = payload.guestAllowedPages;
  }
  await updateDoc(doc(db, "projects", projectId), updateData);
}

export async function deleteProject(projectId: string) {
  // 招待リンクを先に削除する（削除済みプロジェクトへの参加を防ぐ）。
  // 削除権限はオーナー情報の参照に依存するため、プロジェクト本体より先に行う。
  const invitesSnap = await getDocs(
    query(
      collection(db, "projectInvites"),
      where("projectId", "==", projectId),
    ),
  );
  await Promise.all(invitesSnap.docs.map((invite) => deleteDoc(invite.ref)));

  const membersSnap = await getDocs(
    collection(db, "projects", projectId, "members"),
  );
  await Promise.all(
    membersSnap.docs.map(async (member) => {
      const memberId = member.id;
      await deleteDoc(doc(db, "projects", projectId, "members", memberId));
      await deleteDoc(doc(db, "userProjects", memberId, "projects", projectId));
    }),
  );

  const tasksSnap = await getDocs(
    collection(db, "projects", projectId, "tasks"),
  );
  await Promise.all(
    tasksSnap.docs.map((task) =>
      deleteDoc(doc(db, "projects", projectId, "tasks", task.id)),
    ),
  );

  await deleteDoc(doc(db, "projects", projectId));
}

// icon upload feature removed

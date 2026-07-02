import { db, storage } from "@/lib/firebase";
import { addProjectMember } from "@/services/projectMembers";
import { ensureDefaultRoles } from "@/services/rolesService";
import type {
  CreateProjectPayload,
  GuestAllowedPage,
  ProjectDoc,
} from "@/types/project";
import { getLogger } from "@logtape/logtape";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

const logger = getLogger("app.firebase.projectService");

export interface CreateProjectOptions {
  /** プロジェクトアイコン画像（作成後に Storage へアップロードされる） */
  iconFile?: File | null;
}

export async function createProject(
  payload: CreateProjectPayload,
  currentUserId: string,
  options: CreateProjectOptions = {},
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
  if (payload.icon) projectBase.icon = payload.icon;
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
    projectColor: payload.color,
  });

  // デフォルトロールを作成
  await ensureDefaultRoles(projRef.id);

  // アイコンはプロジェクトIDを含むStorageパスに置くため、作成後にアップロードする。
  // 失敗してもプロジェクト作成自体は成立させる。
  if (options.iconFile) {
    try {
      await setProjectIcon(projRef.id, currentUserId, options.iconFile);
    } catch (error) {
      logger.warn`Failed to upload project icon for ${projRef.id}: ${error}`;
    }
  }

  return projRef.id;
}

/**
 * プロジェクトアイコン画像を Storage にアップロードし、ダウンロードURLを返す
 */
export async function uploadProjectIcon(
  projectId: string,
  file: File,
): Promise<string> {
  const fileRef = storageRef(
    storage,
    `projects/${projectId}/icon/${Date.now()}`,
  );
  await uploadBytes(fileRef, file, { contentType: file.type });
  return getDownloadURL(fileRef);
}

/**
 * アイコンをアップロードしてプロジェクトに反映する
 * （projects/{id}.icon と、サイドバー表示用の userProjects エントリを更新）
 */
export async function setProjectIcon(
  projectId: string,
  userId: string,
  file: File,
): Promise<string> {
  const url = await uploadProjectIcon(projectId, file);
  await updateDoc(doc(db, "projects", projectId), {
    icon: url,
    updatedAt: serverTimestamp(),
  });
  await setDoc(
    doc(db, "userProjects", userId, "projects", projectId),
    { iconUrl: url },
    { merge: true },
  );
  return url;
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

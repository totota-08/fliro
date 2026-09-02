import { db } from "@/lib/firebase";
import { toMillis } from "@/utils/datetime";
import { addProjectMember } from "@/services/projectMembers";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

interface CreateInviteOptions {
  projectId: string;
  projectName?: string | null;
  createdBy: string;
  createdByName?: string | null;
  password?: string | null;
  expiresInHours?: number | null;
  maxUses?: number | null;
}

export interface ProjectInviteDoc {
  projectId: string;
  projectName?: string | null;
  token: string;
  createdBy: string;
  createdByName?: string | null;
  createdAt: any;
  acceptedAt?: any | null;
  acceptedBy?: string;
  status: "pending" | "accepted";
  passwordHash?: string | null;
  expiresAt?: any | null;
  maxUses?: number | null;
  usedCount?: number | null;
  acceptedEmail?: string | null;
  revokedAt?: any | null;
  revokedBy?: { id?: string | null; name?: string } | null;
  url?: string | null;
  memo?: string | null;
}

export type ProjectInvite = ProjectInviteDoc & { id: string };

export type ProjectInviteStatus = "active" | "expired" | "revoked";

export type ProjectInviteCursor = QueryDocumentSnapshot<DocumentData> | null;

export interface ListenProjectInvitesOptions {
  limitSize?: number;
  onCursor?: (cursor: ProjectInviteCursor) => void;
}

function createToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

async function hashInvitePassword(password: string) {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return password;
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createProjectInvite({
  projectId,
  projectName,
  createdBy,
  createdByName,
  password,
  expiresInHours,
  maxUses,
}: CreateInviteOptions) {
  const token = createToken();
  const ref = doc(db, "projectInvites", token);
  let resolvedProjectName =
    typeof projectName === "string" ? projectName.trim() : "";
  if (!resolvedProjectName) {
    try {
      const projectSnap = await getDoc(doc(db, "projects", projectId));
      if (projectSnap.exists()) {
        const data = projectSnap.data() as { name?: string };
        resolvedProjectName = (data.name ?? "").trim();
      }
    } catch {
      resolvedProjectName = "";
    }
  }
  if (!resolvedProjectName) {
    resolvedProjectName = "未設定のプロジェクト";
  }
  const passwordHash = password?.trim()
    ? await hashInvitePassword(password.trim())
    : null;
  const expiresAt =
    typeof expiresInHours === "number" && expiresInHours > 0
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
      : null;
  const sanitizedMaxUses =
    typeof maxUses === "number" && maxUses > 0
      ? Math.max(1, Math.floor(maxUses))
      : null;
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/invite/${token}`
      : null;
  await setDoc(ref, {
    projectId,
    projectName: resolvedProjectName,
    createdBy,
    createdByName: createdByName || null,
    token,
    passwordHash,
    createdAt: serverTimestamp(),
    status: "pending",
    expiresAt,
    maxUses: sanitizedMaxUses,
    usedCount: 0,
    revokedAt: null,
    revokedBy: null,
    url,
    memo: null,
  });
  return token;
}

export function buildInviteStatus(
  invite: ProjectInviteDoc,
): ProjectInviteStatus {
  if (invite.revokedAt) return "revoked";
  const expiresAt = toMillis(invite.expiresAt);
  if (typeof expiresAt === "number" && Date.now() > expiresAt) {
    return "expired";
  }
  return "active";
}

/** 招待ステータスの表示ラベル（全画面で統一） */
export function inviteStatusLabel(status: ProjectInviteStatus): string {
  if (status === "active") return "有効";
  if (status === "expired") return "期限切れ";
  return "無効化";
}

/** 招待ステータスに対応する CSS クラス */
export function inviteStatusClass(status: ProjectInviteStatus): string {
  if (status === "active") return "status-active";
  if (status === "expired") return "status-expired";
  return "status-revoked";
}

export function buildInviteUrl(invite: ProjectInviteDoc & { id?: string }) {
  if (invite.url) return invite.url;
  const token = invite.token || invite.id;
  if (!token) return "";
  if (typeof window === "undefined") return token;
  return `${window.location.origin}/invite/${token}`;
}

export async function fetchInviteByToken(token: string) {
  const ref = doc(db, "projectInvites", token);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return snapshot.data() as ProjectInviteDoc;
}

function mapInvite(
  docSnap: QueryDocumentSnapshot<DocumentData>,
): ProjectInvite {
  return {
    id: docSnap.id,
    ...(docSnap.data() as ProjectInviteDoc),
  };
}

export function listenProjectInvites(
  projectId: string,
  callback: (invites: ProjectInvite[]) => void,
  options?: ListenProjectInvitesOptions,
) {
  const limitSize = options?.limitSize ?? 50;
  const ref = collection(db, "projectInvites");
  const q = query(
    ref,
    where("projectId", "==", projectId),
    orderBy("createdAt", "desc"),
    limit(limitSize),
  );
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(mapInvite);
    const cursor =
      snapshot.docs.length && snapshot.docs[snapshot.docs.length - 1]
        ? snapshot.docs[snapshot.docs.length - 1]
        : null;
    options?.onCursor?.(cursor || null);
    callback(list);
  });
}

export async function fetchProjectInvitesPage(
  projectId: string,
  cursor: ProjectInviteCursor,
  limitSize = 50,
): Promise<{ invites: ProjectInvite[]; nextCursor: ProjectInviteCursor }> {
  const ref = collection(db, "projectInvites");
  const constraints = [
    where("projectId", "==", projectId),
    orderBy("createdAt", "desc"),
    limit(limitSize),
    ...(cursor ? [startAfter(cursor)] : []),
  ];
  const q = query(ref, ...constraints);
  const snapshot = await getDocs(q);
  const invites = snapshot.docs.map(mapInvite);
  const nextCursor =
    snapshot.docs.length > 0
      ? snapshot.docs[snapshot.docs.length - 1] || null
      : null;
  return { invites, nextCursor };
}

export async function revokeProjectInvite(
  inviteId: string,
  actor?: { id?: string | null; name?: string },
) {
  const ref = doc(db, "projectInvites", inviteId);
  await updateDoc(ref, {
    revokedAt: serverTimestamp(),
    revokedBy: {
      id: actor?.id ?? null,
      name: actor?.name || actor?.id || "System",
    },
  });
}

/**
 * Listen for pending invites for a specific user email.
 * Returns invites where acceptedEmail matches and status is 'pending'.
 */
export function listenUserInvites(
  email: string,
  callback: (invites: ProjectInvite[]) => void,
) {
  const ref = collection(db, "projectInvites");
  const q = query(
    ref,
    where("acceptedEmail", "==", email),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(50),
  );
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(mapInvite).filter((invite) => {
      // Filter out revoked invites
      if (invite.revokedAt) return false;
      // Filter out expired invites
      const expiresAt = toMillis(invite.expiresAt);
      if (typeof expiresAt === "number" && Date.now() > expiresAt) {
        return false;
      }
      return true;
    });
    callback(list);
  });
}

export async function redeemInvite(
  token: string,
  userId: string,
  email: string,
  options?: { password?: string },
) {
  const ref = doc(db, "projectInvites", token);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("招待リンクが無効です。");
  }
  const data = snap.data() as ProjectInviteDoc;
  if (data.revokedAt) {
    throw new Error("invite-revoked");
  }

  // Check if already a member
  const userProjectSnap = await getDoc(
    doc(db, "userProjects", userId, "projects", data.projectId),
  );
  if (userProjectSnap.exists()) {
    return data.projectId;
  }

  let expiresAtMillis: number | null = null;
  const rawExpires = (data as any).expiresAt;
  if (rawExpires) {
    if (typeof rawExpires.toMillis === "function") {
      expiresAtMillis = rawExpires.toMillis();
    } else if (typeof rawExpires.seconds === "number") {
      expiresAtMillis = rawExpires.seconds * 1000;
    } else if (rawExpires instanceof Date) {
      expiresAtMillis = rawExpires.getTime();
    }
  }
  if (expiresAtMillis && Date.now() > expiresAtMillis) {
    throw new Error("invite-expired");
  }

  const maxUses = data.maxUses ?? null;
  const usedCount = data.usedCount ?? 0;
  if (maxUses && usedCount >= maxUses) {
    throw new Error("invite-usage-limit");
  }

  if (data.passwordHash) {
    const provided = options?.password?.trim();
    if (!provided) {
      throw new Error("invite-password-required");
    }
    const hashed = await hashInvitePassword(provided);
    if (hashed !== data.passwordHash) {
      throw new Error("invite-password-invalid");
    }
  }
  if (data.status === "accepted" && (!maxUses || usedCount >= maxUses)) {
    return data.projectId;
  }

  const projectSnap = await getDoc(doc(db, "projects", data.projectId));
  const projectData = projectSnap.exists() ? projectSnap.data() : undefined;

  await addProjectMember({
    projectId: data.projectId,
    userId,
    role: "member",
    invitedBy: data.createdBy,
    projectName: projectData?.name as string | undefined,
    projectColor: projectData?.color as string | undefined,
    projectIconUrl: projectData?.icon as string | undefined,
  });
  // 複数ユーザーが同時に redeem しても usedCount が正しく増えるよう、
  // 読み直してから更新するトランザクションにする
  await runTransaction(db, async (transaction) => {
    const latestSnap = await transaction.get(ref);
    if (!latestSnap.exists()) return;
    const latest = latestSnap.data() as ProjectInviteDoc;
    const latestUsedCount = latest.usedCount ?? 0;
    const latestMaxUses = latest.maxUses ?? null;
    transaction.update(ref, {
      status:
        latestMaxUses && latestUsedCount + 1 >= latestMaxUses
          ? "accepted"
          : "pending",
      usedCount: latestUsedCount + 1,
      acceptedAt: serverTimestamp(),
      acceptedBy: userId,
      acceptedEmail: email,
    });
  });
  return data.projectId;
}

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addProjectMember } from "@/services/projectMembers";

interface CreateInviteOptions {
  projectId: string;
  createdBy: string;
  password?: string | null;
  expiresInHours?: number | null;
  maxUses?: number | null;
}

type InviteRole = "admin" | "member" | "viewer";

export interface ProjectInviteDoc {
  projectId: string;
  projectName?: string | null;
  token: string;
  createdBy: string;
  invitedBy?: string;
  type?: "email" | "link";
  role?: InviteRole;
  createdAt: Date | null;
  acceptedAt?: Date | null;
  acceptedBy?: string;
  status: "pending" | "accepted";
  passwordHash?: string | null;
  expiresAt?: Date | null;
  maxUses?: number | null;
  usedCount?: number | null;
  acceptedEmail?: string | null;
  email?: string | null;
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
  createdBy,
  password,
  expiresInHours,
  maxUses,
}: CreateInviteOptions) {
  const token = createToken();
  const ref = doc(db, "projectInvites", token);
  const projectSnap = await getDoc(doc(db, "projects", projectId));
  const projectName = projectSnap.exists()
    ? (projectSnap.data().name as string)
    : "プロジェクト";
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
  const inviteData = {
    projectId,
    projectName,
    createdBy,
    invitedBy: createdBy,
    token,
    passwordHash,
    createdAt: serverTimestamp(),
    status: "pending",
    expiresAt,
    maxUses: sanitizedMaxUses,
    usedCount: 0,
    role: "member",
    type: "link",
  };
  await setDoc(ref, inviteData);
  return token;
}

async function resolveInviteByToken(token: string) {
  const inviteRef = doc(db, "projectInvites", token);
  const inviteSnap = await getDoc(inviteRef);
  if (!inviteSnap.exists()) return null;
  return { ref: inviteRef, data: inviteSnap.data() as ProjectInviteDoc };
}

export async function fetchInviteByToken(token: string) {
  const resolved = await resolveInviteByToken(token);
  return resolved?.data ?? null;
}

export async function redeemInvite(
  token: string,
  userId: string,
  email: string,
  options?: { password?: string },
) {
  const resolved = await resolveInviteByToken(token);
  if (!resolved) {
    throw new Error("招待リンクが無効です。");
  }
  const { data, ref } = resolved;

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

  const projectName = data.projectName ?? undefined;
  const rawRole = typeof data.role === "string" ? data.role : "member";
  const safeRole: InviteRole =
    rawRole === "admin" || rawRole === "viewer" ? rawRole : "member";

  await addProjectMember({
    projectId: data.projectId,
    userId,
    role: safeRole,
    invitedBy: data.createdBy,
    projectName,
  });
  await updateDoc(ref, {
    status: maxUses && usedCount + 1 >= maxUses ? "accepted" : "pending",
    usedCount: usedCount + 1,
    acceptedAt: serverTimestamp(),
    acceptedBy: userId,
    acceptedEmail: email,
  });
  return data.projectId;
}

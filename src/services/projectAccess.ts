import { db } from "@/lib/firebase";
import {
  normalizeProjectRoles,
  normalizeRole,
  resolveRoleFromProjectRoles,
  type RoleKey,
} from "@/constants/roles";
import { doc, getDoc } from "firebase/firestore";

export async function getProjectRole(
  projectId: string,
  userId: string,
): Promise<RoleKey | null> {
  const projectSnap = await getDoc(doc(db, "projects", projectId));
  if (projectSnap.exists()) {
    const roles = normalizeProjectRoles(
      (projectSnap.data() as any)?.roles ?? null,
    );
    const role = resolveRoleFromProjectRoles(roles, userId);
    if (role) return role;
  }

  const memberSnap = await getDoc(
    doc(db, "projects", projectId, "members", userId),
  );
  if (!memberSnap.exists()) return null;
  return normalizeRole((memberSnap.data() as any)?.role ?? "guest");
}

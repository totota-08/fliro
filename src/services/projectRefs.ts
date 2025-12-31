import { db } from "@/lib/firebase";
import { normalizeRole, type RoleKey } from "@/constants/roles";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

export type ProjectRefItem = {
  id: string;
  projectName: string;
  role: RoleKey;
};

type LegacyProjectRef = {
  id: string;
  projectName: string;
  role: RoleKey;
  lastAccessedAt?: unknown;
};

async function loadLegacyProjectRefs(userId: string) {
  const snap = await getDocs(
    collection(db, "userProjects", userId, "projects"),
  );
  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    projectName: (docSnap.data().projectName as string) || "Project",
    role: normalizeRole(docSnap.data().role as string),
    lastAccessedAt: docSnap.data().lastAccessedAt,
  })) satisfies LegacyProjectRef[];
}

export async function listUserProjectRefs(
  userId: string,
  options?: { migrateLegacy?: boolean },
): Promise<ProjectRefItem[]> {
  const refsSnap = await getDocs(
    collection(db, "users", userId, "projectRefs"),
  );
  if (refsSnap.size > 0 || options?.migrateLegacy === false) {
    return refsSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      projectName: (docSnap.data().projectName as string) || "Project",
      role: normalizeRole(docSnap.data().role as string),
    }));
  }

  const legacyRefs = await loadLegacyProjectRefs(userId);
  if (!legacyRefs.length) return [];

  await Promise.all(
    legacyRefs.map((ref) =>
      setDoc(
        doc(db, "users", userId, "projectRefs", ref.id),
        {
          projectId: ref.id,
          projectName: ref.projectName,
          role: ref.role,
          joinedAt: ref.lastAccessedAt ?? serverTimestamp(),
          lastViewedAt: ref.lastAccessedAt ?? serverTimestamp(),
        },
        { merge: true },
      ),
    ),
  );

  return legacyRefs.map((ref) => ({
    id: ref.id,
    projectName: ref.projectName,
    role: ref.role,
  }));
}

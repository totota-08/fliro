import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Dashboard Summary Card Configuration
 */
export interface DashboardCardConfig {
  id: string;
  type: string;
  position: number;
  visible: boolean;
}

/**
 * Dashboard Settings stored per user per project
 * Path: profiles/{uid}/dashboardSettings/{projectId}
 */
export interface DashboardSettings {
  cards: DashboardCardConfig[];
  updatedAt?: unknown;
}

const DEFAULT_CARDS: DashboardCardConfig[] = [
  { id: "overdue", type: "overdue", position: 0, visible: true },
  { id: "due-soon", type: "due-soon", position: 1, visible: true },
  { id: "active", type: "active", position: 2, visible: true },
  { id: "done", type: "done", position: 3, visible: true },
];

/**
 * Get dashboard settings for a user in a specific project
 */
export async function getDashboardSettings(
  userId: string,
  projectId: string,
): Promise<DashboardSettings> {
  if (!userId || !projectId) {
    return { cards: DEFAULT_CARDS };
  }

  const docRef = doc(db, "profiles", userId, "dashboardSettings", projectId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return { cards: DEFAULT_CARDS };
  }

  const data = snapshot.data() as DashboardSettings;
  // Ensure all default cards exist (for backwards compatibility)
  const existingIds = new Set(data.cards.map((c) => c.id));
  const missingCards = DEFAULT_CARDS.filter((c) => !existingIds.has(c.id));

  if (missingCards.length > 0) {
    const maxPosition = Math.max(...data.cards.map((c) => c.position), -1);
    missingCards.forEach((card, index) => {
      data.cards.push({ ...card, position: maxPosition + 1 + index });
    });
  }

  return data;
}

/**
 * Save dashboard settings for a user in a specific project
 */
export async function saveDashboardSettings(
  userId: string,
  projectId: string,
  cards: DashboardCardConfig[],
): Promise<void> {
  if (!userId || !projectId) {
    throw new Error("userId and projectId are required");
  }

  const docRef = doc(db, "profiles", userId, "dashboardSettings", projectId);
  await setDoc(docRef, {
    cards,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get default card configurations
 */
export function getDefaultCards(): DashboardCardConfig[] {
  return [...DEFAULT_CARDS];
}

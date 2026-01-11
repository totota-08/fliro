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
 * Dashboard Insight Card Configuration
 */
export interface InsightCardConfig {
  id: string;
  type: "progress" | "status" | "health";
  position: number;
  visible: boolean;
}

/**
 * Dashboard Settings stored per user per project
 * Path: profiles/{uid}/dashboardSettings/{projectId}
 */
export interface DashboardSettings {
  cards: DashboardCardConfig[];
  insightCards?: InsightCardConfig[];
  updatedAt?: unknown;
}

const DEFAULT_CARDS: DashboardCardConfig[] = [
  { id: "overdue", type: "overdue", position: 0, visible: true },
  { id: "due-soon", type: "due-soon", position: 1, visible: true },
  { id: "active", type: "active", position: 2, visible: true },
  { id: "done", type: "done", position: 3, visible: true },
];

const DEFAULT_INSIGHT_CARDS: InsightCardConfig[] = [
  { id: "progress", type: "progress", position: 0, visible: true },
  { id: "status", type: "status", position: 1, visible: true },
  { id: "health", type: "health", position: 2, visible: true },
];

/**
 * Get dashboard settings for a user in a specific project
 */
export async function getDashboardSettings(
  userId: string,
  projectId: string,
): Promise<DashboardSettings> {
  if (!userId || !projectId) {
    return { cards: DEFAULT_CARDS, insightCards: DEFAULT_INSIGHT_CARDS };
  }

  const docRef = doc(db, "profiles", userId, "dashboardSettings", projectId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return { cards: DEFAULT_CARDS, insightCards: DEFAULT_INSIGHT_CARDS };
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

  // Ensure all default insight cards exist (for backwards compatibility)
  if (!data.insightCards) {
    data.insightCards = [...DEFAULT_INSIGHT_CARDS];
  } else {
    const existingInsightIds = new Set(data.insightCards.map((c) => c.id));
    const missingInsightCards = DEFAULT_INSIGHT_CARDS.filter(
      (c) => !existingInsightIds.has(c.id),
    );

    if (missingInsightCards.length > 0) {
      const maxInsightPosition = Math.max(
        ...data.insightCards.map((c) => c.position),
        -1,
      );
      missingInsightCards.forEach((card, index) => {
        data.insightCards!.push({
          ...card,
          position: maxInsightPosition + 1 + index,
        });
      });
    }
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
  insightCards?: InsightCardConfig[],
): Promise<void> {
  if (!userId || !projectId) {
    throw new Error("userId and projectId are required");
  }

  const docRef = doc(db, "profiles", userId, "dashboardSettings", projectId);
  await setDoc(docRef, {
    cards,
    insightCards: insightCards ?? DEFAULT_INSIGHT_CARDS,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Save only insight card settings for a user in a specific project
 */
export async function saveInsightCardSettings(
  userId: string,
  projectId: string,
  insightCards: InsightCardConfig[],
): Promise<void> {
  if (!userId || !projectId) {
    throw new Error("userId and projectId are required");
  }

  // Get existing settings first
  const existing = await getDashboardSettings(userId, projectId);

  const docRef = doc(db, "profiles", userId, "dashboardSettings", projectId);
  await setDoc(docRef, {
    cards: existing.cards,
    insightCards,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get default card configurations
 */
export function getDefaultCards(): DashboardCardConfig[] {
  return [...DEFAULT_CARDS];
}

/**
 * Get default insight card configurations
 */
export function getDefaultInsightCards(): InsightCardConfig[] {
  return [...DEFAULT_INSIGHT_CARDS];
}

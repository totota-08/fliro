import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, limit } from "firebase/firestore";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.services.releaseNotes");

export interface ReleaseChange {
  type: "feat" | "fix";
  text: string;
}

export interface ReleaseNote {
  id: string;
  version: string;
  date: string;
  isLatest: boolean;
  changes: ReleaseChange[];
  createdAt?: { seconds: number; nanoseconds: number };
}

/**
 * リリースノートを取得（最新順）
 */
export async function fetchReleaseNotes(
  maxCount: number = 10,
): Promise<ReleaseNote[]> {
  logger.debug`Fetching release notes (max: ${maxCount})`;

  try {
    const releaseNotesRef = query(
      collection(db, "releaseNotes"),
      orderBy("createdAt", "desc"),
      limit(maxCount),
    );

    const snapshot = await getDocs(releaseNotesRef);
    const notes: ReleaseNote[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      notes.push({
        id: doc.id,
        version: data.version,
        date: data.date,
        isLatest: data.isLatest ?? false,
        changes: data.changes ?? [],
        createdAt: data.createdAt,
      });
    });

    logger.debug`Fetched ${notes.length} release notes`;
    return notes;
  } catch (error) {
    logger.error`Failed to fetch release notes: ${error}`;
    return [];
  }
}

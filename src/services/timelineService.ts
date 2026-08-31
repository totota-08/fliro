import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

export type TimelinePost = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  isBot?: boolean;
  taskId?: string | null;
  dueDate?: string | null;
  createdAt?: { seconds: number; nanoseconds: number };
};

export function listenTimeline(
  projectId: string,
  callback: (posts: TimelinePost[]) => void,
) {
  const timelineRef = query(
    collection(db, "projects", projectId, "timeline"),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(timelineRef, (snapshot) => {
    const posts: TimelinePost[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<TimelinePost, "id">),
    }));
    callback(posts);
  });
}

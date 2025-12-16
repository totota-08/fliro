import { db } from "@/lib/firebase";
import type {
  ProjectEvent,
  ProjectEventInput,
  ProjectEventOrigin,
  ProjectEventType,
} from "@/types/projectEvent";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

export type ProjectEventCursor = QueryDocumentSnapshot<DocumentData> | null;

export interface ListenProjectEventsOptions {
  limitSize?: number;
  onCursor?: (cursor: ProjectEventCursor) => void;
}

export async function addProjectEvent(
  projectId: string,
  input: ProjectEventInput,
) {
  const ref = collection(db, "projects", projectId, "events");
  const docRef = await addDoc(ref, {
    v: 1,
    projectId,
    type: input.type,
    origin: input.origin,
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? "Unknown",
    payload: input.payload ?? {},
    createdAt: input.createdAt ?? serverTimestamp(),
  });
  return docRef.id;
}

export function listenProjectEvents(
  projectId: string,
  callback: (events: ProjectEvent[]) => void,
  options?: ListenProjectEventsOptions,
) {
  const limitSize = options?.limitSize ?? 50;
  const ref = collection(db, "projects", projectId, "events");
  const q = query(ref, orderBy("createdAt", "desc"), limit(limitSize));

  return onSnapshot(q, (snapshot) => {
    const list: ProjectEvent[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        projectId,
        ...data,
      } as ProjectEvent;
    });
    options?.onCursor?.(
      snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null,
    );
    callback(list);
  });
}

export interface FetchProjectEventsResult {
  events: ProjectEvent[];
  nextCursor: ProjectEventCursor;
}

export async function fetchProjectEventsPage(
  projectId: string,
  cursor: ProjectEventCursor,
  limitSize = 50,
): Promise<FetchProjectEventsResult> {
  const ref = collection(db, "projects", projectId, "events");
  const constraints = [
    orderBy("createdAt", "desc"),
    limit(limitSize),
    ...(cursor ? [startAfter(cursor)] : []),
  ];
  const q = query(ref, ...constraints);
  const snapshot = await getDocs(q);
  const events: ProjectEvent[] = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      projectId,
      ...data,
    } as ProjectEvent;
  });

  const nextCursor =
    snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

  return { events, nextCursor };
}

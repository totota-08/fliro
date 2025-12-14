import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

export type TaskDiscussionMessage = {
  id: string;
  taskId: string;
  projectId: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: Date | null;
  type: "normal" | "decision";
};

export function listenTaskDiscussion(
  projectId: string,
  taskId: string,
  callback: (messages: TaskDiscussionMessage[]) => void,
) {
  const ref = collection(
    db,
    "projects",
    projectId,
    "tasks",
    taskId,
    "messages",
  );
  const q = query(ref, orderBy("createdAt", "asc"));

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      let createdAt: Date | null = null;
      if (data.createdAt instanceof Timestamp) {
        createdAt = data.createdAt.toDate();
      }

      return {
        id: docSnap.id,
        taskId: data.taskId,
        projectId: data.projectId,
        text: data.text,
        senderId: data.senderId,
        senderName: data.senderName,
        createdAt,
        type: (data.type as "normal" | "decision") || "normal",
      } satisfies TaskDiscussionMessage;
    });
    callback(messages);
  });
}

export async function sendTaskDiscussionMessage(
  projectId: string,
  taskId: string,
  payload: {
    text: string;
    senderId: string;
    senderName: string;
  },
) {
  let text = payload.text;
  let type: "normal" | "decision" = "normal";

  if (text.startsWith("/decide ")) {
    type = "decision";
    // Remove '/decide ' prefix and add '✅ '
    text = "✅ " + text.slice(8);
  }

  await addDoc(
    collection(db, "projects", projectId, "tasks", taskId, "messages"),
    {
      taskId,
      projectId,
      text,
      senderId: payload.senderId,
      senderName: payload.senderName,
      createdAt: serverTimestamp(),
      type,
    },
  );
}

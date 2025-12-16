import { db } from "@/lib/firebase";
import { addProjectEvent } from "@/services/projectActivityLogService";
import {
  addDoc,
  collection,
  doc,
  getDoc,
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
  const text = payload.text;
  let type: "normal" | "decision" = "normal";
  let normalizedDecision: string | null = null;

  if (text.startsWith("/decide ")) {
    type = "decision";
    normalizedDecision = `✅ ${text.replace("/decide", "").trim()}`;
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

  if (type === "decision") {
    try {
      let taskTitle: string | undefined;
      try {
        const snap = await getDoc(
          doc(db, "projects", projectId, "tasks", taskId),
        );
        if (snap.exists()) {
          taskTitle = (snap.data() as any).title as string;
        }
      } catch {
        // best-effort
      }
      await addProjectEvent(projectId, {
        type: "decision.made",
        origin: "command",
        actorId: payload.senderId,
        actorName: payload.senderName,
        payload: {
          taskId,
          taskTitle: taskTitle ?? "",
          text: normalizedDecision ?? text,
        },
      });
    } catch {
      // ログはベストエフォート
    }
  }
}

import { toMillis } from "@/utils/datetime";
import { db } from "@/lib/firebase";
import { database } from "@/lib/firebaseDatabase";
import { getLogger } from "@logtape/logtape";
import {
  ref as dbRef,
  get as getValue,
  limitToLast,
  onValue,
  orderByKey,
  push,
  query,
  remove,
  serverTimestamp,
  set as setValue,
  update,
} from "firebase/database";
import { doc, getDoc } from "firebase/firestore";

const logger = getLogger("app.services.projectChat");

export interface ReactionSummary {
  emoji: string;
  count: number;
}

export interface ReactionDetail {
  emoji: string;
  userIds: string[];
  count: number;
}

export interface ChatMessage {
  id: string;
  text: string;
  author: string;
  senderName?: string;
  senderId?: string;
  projectId?: string;
  channelId?: string;
  linkedTaskId?: string;
  createdAt?: number;
  reactionSummary?: ReactionSummary[];
  reactionDetails?: ReactionDetail[];
  replyToId?: string;
  mentions?: string[];
  isBot?: boolean;
  isTask?: boolean;
  privateFor?: string | null;
}

function summarizeReactions(reactions: any): {
  summary: ReactionSummary[];
  details: ReactionDetail[];
} {
  if (!reactions || typeof reactions !== "object") {
    return { summary: [], details: [] };
  }
  const grouped: Record<string, string[]> = {};
  Object.values(reactions).forEach((entry: any) => {
    if (!entry || typeof entry !== "object") return;
    const emoji = typeof entry.emoji === "string" ? entry.emoji : "";
    const userId = typeof entry.userId === "string" ? entry.userId : "";
    if (!emoji) return;
    if (!grouped[emoji]) grouped[emoji] = [];
    if (userId && !grouped[emoji].includes(userId)) {
      grouped[emoji].push(userId);
    }
  });
  const details = Object.entries(grouped).map(([emoji, userIds]) => ({
    emoji,
    userIds,
    count: userIds.length,
  }));
  const summary = details.map(({ emoji, count }) => ({ emoji, count }));
  return { summary, details };
}

const memberSyncCache = new Map<string, Promise<void>>();

async function ensureRealtimeMember(projectId: string, userId: string) {
  if (!projectId || !userId) return;
  const cacheKey = `${projectId}:${userId}`;
  if (memberSyncCache.has(cacheKey)) {
    return memberSyncCache.get(cacheKey)!;
  }

  const task = (async () => {
    try {
      const memberRef = dbRef(
        database,
        `projects/${projectId}/members/${userId}`,
      );
      const snapshot = await getValue(memberRef);
      if (snapshot.exists()) return;

      const memberDoc = await getDoc(
        doc(db, "projects", projectId, "members", userId),
      );
      const data = memberDoc.exists() ? memberDoc.data() : null;

      const joinedAt = (data as any)?.joinedAt;
      await setValue(memberRef, {
        role: (data?.role as string) || "member",
        joinedAt:
          typeof joinedAt?.seconds === "number"
            ? joinedAt.seconds * 1000
            : Date.now(),
      });
    } catch (error) {
      logger.warn`Failed to ensure realtime member entry: ${error}`;
    }
  })();

  memberSyncCache.set(cacheKey, task);
  try {
    await task;
  } finally {
    memberSyncCache.delete(cacheKey);
  }
}

export function listenProjectChat(
  projectId: string,
  callback: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void,
) {
  const chatRef = query(
    dbRef(database, `projects/${projectId}/realtimeChat`),
    orderByKey(),
    limitToLast(50),
  );
  const unsubscribe = onValue(
    chatRef,
    (snapshot) => {
      const items: ChatMessage[] = [];
      snapshot.forEach((child) => {
        const data = child.val() as any;
        const reactions = summarizeReactions(data?.reactions);
        items.push({
          id: child.key || "",
          text: data?.text ?? "",
          author: data?.author ?? data?.senderName ?? "Unknown",
          senderName: data?.senderName ?? data?.author,
          senderId: data?.senderId,
          projectId: data?.projectId,
          channelId:
            typeof data?.channelId === "string" ? data.channelId : "general",
          linkedTaskId: data?.linkedTaskId,
          createdAt: toMillis(data?.createdAt) ?? undefined,
          reactionSummary: reactions.summary,
          reactionDetails: reactions.details,
          replyToId: data?.replyToId,
          mentions: Array.isArray(data?.mentions) ? data.mentions : [],
          isBot: Boolean(data?.isBot),
          isTask: Boolean(data?.isTask),
          privateFor:
            typeof data?.privateFor === "string" ? data.privateFor : null,
        });
      });
      items.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
      callback(items);
    },
    (error) => {
      logger.error`Chat listener error: ${error}`;
      if (onError) onError(error);
    },
  );
  return () => unsubscribe();
}

export async function sendProjectMessage(
  projectId: string,
  senderId: string,
  senderName: string,
  text: string,
  channelId = "general",
  replyToId?: string,
  metadata?: {
    linkedTaskId?: string | null;
    mentions?: string[];
    isBot?: boolean;
    isTask?: boolean;
    privateFor?: string | null;
  },
) {
  if (!projectId || !senderId || !text.trim()) {
    logger.warn`Invalid message parameters: projectId=${projectId}, senderId=${senderId}`;
    return;
  }
  if (!metadata?.isBot) {
    await ensureRealtimeMember(projectId, senderId);
  }
  const payload: any = {
    text,
    author: senderName,
    senderName,
    senderId,
    projectId,
    channelId,
    createdAt: serverTimestamp(),
  };
  if (replyToId) {
    payload.replyToId = replyToId;
  }
  if (metadata?.linkedTaskId) payload.linkedTaskId = metadata.linkedTaskId;
  if (metadata?.mentions?.length) payload.mentions = metadata.mentions;
  if (metadata?.isBot) payload.isBot = metadata.isBot;
  if (metadata?.isTask) payload.isTask = metadata.isTask;
  if (metadata?.privateFor) payload.privateFor = metadata.privateFor;
  await push(dbRef(database, `projects/${projectId}/realtimeChat`), payload);
}

export async function addMessageReaction(
  projectId: string,
  messageId: string,
  emoji: string,
  userId: string,
) {
  if (!emoji) return;
  await ensureRealtimeMember(projectId, userId);
  await push(
    dbRef(
      database,
      `projects/${projectId}/realtimeChat/${messageId}/reactions`,
    ),
    {
      emoji,
      userId,
      createdAt: serverTimestamp(),
    },
  );
}

/**
 * リアクションをトグル（未リアクションなら追加、リアクション済みなら削除）
 */
export async function toggleMessageReaction(
  projectId: string,
  messageId: string,
  emoji: string,
  userId: string,
): Promise<boolean> {
  if (!emoji || !userId) return false;

  const reactionsRef = dbRef(
    database,
    `projects/${projectId}/realtimeChat/${messageId}/reactions`,
  );
  const snapshot = await getValue(reactionsRef);

  // 既存のリアクションをチェック（重複がある可能性があるため全て収集）
  const existingKeys: string[] = [];
  if (snapshot.exists()) {
    snapshot.forEach((child) => {
      const data = child.val();
      if (data?.emoji === emoji && data?.userId === userId) {
        if (child.key) existingKeys.push(child.key);
      }
    });
  }

  if (existingKeys.length > 0) {
    // 既にリアクション済み → 全ての重複エントリを削除
    await Promise.all(
      existingKeys.map((key) =>
        remove(
          dbRef(
            database,
            `projects/${projectId}/realtimeChat/${messageId}/reactions/${key}`,
          ),
        ),
      ),
    );
    return false; // 削除した（リアクションなし状態に）
  } else {
    // 未リアクション → 追加
    await addMessageReaction(projectId, messageId, emoji, userId);
    return true; // 追加した（リアクションあり状態に）
  }
}

export async function updateProjectMessage(
  projectId: string,
  messageId: string,
  text?: string,
  linkedTaskId?: string,
) {
  const updates: any = {
    updatedAt: serverTimestamp(),
  };
  if (text !== undefined && text.trim()) {
    updates.text = text.trim();
  }
  if (linkedTaskId !== undefined) {
    updates.linkedTaskId = linkedTaskId;
  }
  await update(
    dbRef(database, `projects/${projectId}/realtimeChat/${messageId}`),
    updates,
  );
}

export async function deleteProjectMessage(
  projectId: string,
  messageId: string,
) {
  await remove(
    dbRef(database, `projects/${projectId}/realtimeChat/${messageId}`),
  );
}

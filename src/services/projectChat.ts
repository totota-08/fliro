import { database } from '@/firebase/config'
import { limitToLast, onValue, orderByKey, push, query, ref as dbRef, serverTimestamp } from 'firebase/database'

export interface ReactionSummary {
  emoji: string
  count: number
}

export interface ChatMessage {
  id: string
  text: string
  author: string
  senderName?: string
  senderId?: string
  projectId?: string
  linkedTaskId?: string
  createdAt?: number
  reactionSummary?: ReactionSummary[]
}

function resolveTimestamp(value: any): number | undefined {
  if (typeof value === 'number') return value
  if (value?.seconds) return value.seconds * 1000
  return undefined
}

function summarizeReactions(reactions: any): ReactionSummary[] {
  if (!reactions) return []
  const counts: Record<string, number> = {}
  Object.values(reactions).forEach((entry: any) => {
    const emoji = typeof entry?.emoji === 'string' ? entry.emoji : ''
    if (!emoji) return
    counts[emoji] = (counts[emoji] || 0) + 1
  })
  return Object.entries(counts).map(([emoji, count]) => ({ emoji, count }))
}

export function listenProjectChat(projectId: string, callback: (messages: ChatMessage[]) => void) {
  const chatRef = query(dbRef(database, `projects/${projectId}/realtimeChat`), orderByKey(), limitToLast(50))
  const unsubscribe = onValue(chatRef, (snapshot) => {
    const items: ChatMessage[] = []
    snapshot.forEach((child) => {
      const data = child.val() as any
      items.push({
        id: child.key || '',
        text: data?.text ?? '',
        author: data?.author ?? data?.senderName ?? 'Unknown',
        senderName: data?.senderName ?? data?.author,
        senderId: data?.senderId,
        projectId: data?.projectId,
        linkedTaskId: data?.linkedTaskId,
        createdAt: resolveTimestamp(data?.createdAt),
        reactionSummary: summarizeReactions(data?.reactions),
      })
    })
    items.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
    callback(items)
  })
  return () => unsubscribe()
}

export async function sendProjectMessage(projectId: string, senderId: string, senderName: string, text: string) {
  await push(dbRef(database, `projects/${projectId}/realtimeChat`), {
    text,
    author: senderName,
    senderName,
    senderId,
    projectId,
    createdAt: serverTimestamp(),
  })
}

export async function addMessageReaction(projectId: string, messageId: string, emoji: string, userId: string) {
  if (!emoji) return
  await push(dbRef(database, `projects/${projectId}/realtimeChat/${messageId}/reactions`), {
    emoji,
    userId,
    createdAt: serverTimestamp(),
  })
}

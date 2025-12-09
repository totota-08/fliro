import { database, db } from '@/firebase/config'
import { getLogger } from '@logtape/logtape'
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
} from 'firebase/database'
import { doc, getDoc } from 'firebase/firestore'

const logger = getLogger('app.services.projectChat')

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
  channelId?: string
  linkedTaskId?: string
  createdAt?: number
  reactionSummary?: ReactionSummary[]
  replyToId?: string
  mentions?: string[]
  isBot?: boolean
  isTask?: boolean
  privateFor?: string | null
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

const memberSyncCache = new Map<string, Promise<void>>()

async function ensureRealtimeMember(projectId: string, userId: string) {
  if (!projectId || !userId) return
  const cacheKey = `${projectId}:${userId}`
  if (memberSyncCache.has(cacheKey)) {
    return memberSyncCache.get(cacheKey)!
  }

  const task = (async () => {
    try {
      const memberRef = dbRef(database, `projects/${projectId}/members/${userId}`)
      const snapshot = await getValue(memberRef)
      if (snapshot.exists()) return

      const memberDoc = await getDoc(doc(db, 'projects', projectId, 'members', userId))
      const data = memberDoc.exists() ? memberDoc.data() : null

      const joinedAt = (data as any)?.joinedAt
      await setValue(memberRef, {
        role: (data?.role as string) || 'member',
        joinedAt: typeof joinedAt?.seconds === 'number' ? joinedAt.seconds * 1000 : Date.now(),
      })
    } catch (error) {
      logger.warn`Failed to ensure realtime member entry: ${error}`
    }
  })()

  memberSyncCache.set(cacheKey, task)
  try {
    await task
  } finally {
    memberSyncCache.delete(cacheKey)
  }
}

export function listenProjectChat(
  projectId: string,
  callback: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void,
) {
  const chatRef = query(dbRef(database, `projects/${projectId}/realtimeChat`), orderByKey(), limitToLast(50))
  const unsubscribe = onValue(
    chatRef,
    (snapshot) => {
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
          channelId: typeof data?.channelId === 'string' ? data.channelId : 'general',
          linkedTaskId: data?.linkedTaskId,
          createdAt: resolveTimestamp(data?.createdAt),
          reactionSummary: summarizeReactions(data?.reactions),
          replyToId: data?.replyToId,
          mentions: Array.isArray(data?.mentions) ? data.mentions : [],
          isBot: Boolean(data?.isBot),
          isTask: Boolean(data?.isTask),
          privateFor: typeof data?.privateFor === 'string' ? data.privateFor : null,
        })
      })
      items.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
      callback(items)
    },
    (error) => {
      logger.error`Chat listener error: ${error}`
      if (onError) onError(error)
    },
  )
  return () => unsubscribe()
}

export async function sendProjectMessage(
  projectId: string,
  senderId: string,
  senderName: string,
  text: string,
  channelId = 'general',
  replyToId?: string,
  metadata?: {
    linkedTaskId?: string | null
    mentions?: string[]
    isBot?: boolean
    isTask?: boolean
    privateFor?: string | null
  },
) {
  if (!metadata?.isBot) {
    await ensureRealtimeMember(projectId, senderId)
  }
  const payload: any = {
    text,
    author: senderName,
    senderName,
    senderId,
    projectId,
    channelId,
    createdAt: serverTimestamp(),
  }
  if (replyToId) {
    payload.replyToId = replyToId
  }
  if (metadata?.linkedTaskId) payload.linkedTaskId = metadata.linkedTaskId
  if (metadata?.mentions?.length) payload.mentions = metadata.mentions
  if (metadata?.isBot) payload.isBot = metadata.isBot
  if (metadata?.isTask) payload.isTask = metadata.isTask
  if (metadata?.privateFor) payload.privateFor = metadata.privateFor
  await push(dbRef(database, `projects/${projectId}/realtimeChat`), payload)
}

export async function addMessageReaction(projectId: string, messageId: string, emoji: string, userId: string) {
  if (!emoji) return
  await ensureRealtimeMember(projectId, userId)
  await push(dbRef(database, `projects/${projectId}/realtimeChat/${messageId}/reactions`), {
    emoji,
    userId,
    createdAt: serverTimestamp(),
  })
}

export async function updateProjectMessage(
  projectId: string,
  messageId: string,
  text?: string,
  linkedTaskId?: string,
) {
  const updates: any = {
    updatedAt: serverTimestamp(),
  }
  if (text !== undefined && text.trim()) {
    updates.text = text.trim()
  }
  if (linkedTaskId !== undefined) {
    updates.linkedTaskId = linkedTaskId
  }
  await update(dbRef(database, `projects/${projectId}/realtimeChat/${messageId}`), updates)
}

export async function deleteProjectMessage(projectId: string, messageId: string) {
  await remove(dbRef(database, `projects/${projectId}/realtimeChat/${messageId}`))
}

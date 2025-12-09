import { db } from '@/firebase/config'
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'

export type TimelinePost = {
  id: string
  authorId: string
  authorName: string
  body: string
  isBot?: boolean
  taskId?: string | null
  dueDate?: string | null
  createdAt?: { seconds: number; nanoseconds: number }
}

type CreateTimelinePayload = {
  authorId: string
  authorName: string
  body: string
  taskId?: string | null
  dueDate?: string | null
}

export function listenTimeline(projectId: string, callback: (posts: TimelinePost[]) => void) {
  const timelineRef = query(collection(db, 'projects', projectId, 'timeline'), orderBy('createdAt', 'desc'))
  return onSnapshot(timelineRef, (snapshot) => {
    const posts: TimelinePost[] = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<TimelinePost, 'id'>) }))
    callback(posts)
  })
}

export async function addTimelinePost(projectId: string, payload: CreateTimelinePayload) {
  await addDoc(collection(db, 'projects', projectId, 'timeline'), {
    ...payload,
    createdAt: serverTimestamp(),
    isBot: false,
  })
}

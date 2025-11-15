import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'

export interface ChatMessage {
  id: string
  text: string
  senderId: string
  senderName: string
  createdAt?: { seconds: number; nanoseconds: number }
}

export function listenProjectChat(projectId: string, callback: (messages: ChatMessage[]) => void) {
  const ref = query(collection(db, 'projects', projectId, 'chat'), orderBy('createdAt', 'asc'))
  return onSnapshot(ref, (snapshot) => {
    const items: ChatMessage[] = []
    snapshot.forEach((docSnap) => {
      items.push({ id: docSnap.id, ...(docSnap.data() as Omit<ChatMessage, 'id'>) })
    })
    callback(items)
  })
}

export async function sendProjectMessage(projectId: string, senderId: string, senderName: string, text: string) {
  await addDoc(collection(db, 'projects', projectId, 'chat'), {
    text,
    senderId,
    senderName,
    createdAt: serverTimestamp(),
  })
}

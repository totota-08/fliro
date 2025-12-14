import { db } from '@/lib/firebase'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import type {
  ActivityEvent,
  Attachment,
  ChecklistItem,
  CommentItem,
  LinkItem,
  Task,
} from '@/types/task'

const orgId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'org'

export function taskDoc(taskId: string) {
  return doc(db, 'orgs', orgId, 'tasks', taskId)
}

export function commentsCol(taskId: string) {
  return collection(db, 'orgs', orgId, 'tasks', taskId, 'comments')
}

export function checklistCol(taskId: string) {
  return collection(db, 'orgs', orgId, 'tasks', taskId, 'checklist')
}

export function attachmentsCol(taskId: string) {
  return collection(db, 'orgs', orgId, 'tasks', taskId, 'attachments')
}

export function linksCol(taskId: string) {
  return collection(db, 'orgs', orgId, 'tasks', taskId, 'links')
}

export function eventsCol(taskId: string) {
  return collection(db, 'orgs', orgId, 'tasks', taskId, 'events')
}

export function subscribeTask(
  taskId: string,
  cb: (task: Task | null) => void,
  onErr?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    taskDoc(taskId),
    (snap) => {
      if (!snap.exists()) return cb(null)
      const data = snap.data()
      cb({
        id: snap.id,
        ...data,
        dueAt: data.dueAt?.toDate?.() ?? null,
        createdAt: data.createdAt?.toDate?.() ?? null,
        updatedAt: data.updatedAt?.toDate?.() ?? null,
        completedAt: data.completedAt?.toDate?.() ?? null,
      } as Task)
    },
    onErr,
  )
}

export function subscribeComments(
  taskId: string,
  cb: (items: CommentItem[]) => void,
  onErr?: (error: FirestoreError) => void,
): Unsubscribe {
  const q = query(commentsCol(taskId), orderBy('createdAt', 'asc'))
  return onSnapshot(
    q,
    (snap) => {
      const list: CommentItem[] = []
      snap.forEach((docSnap) => {
        const data = docSnap.data()
        list.push({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() ?? null,
          updatedAt: data.updatedAt?.toDate?.() ?? null,
          resolvedAt: data.resolvedAt?.toDate?.() ?? null,
        } as CommentItem)
      })
      cb(list)
    },
    onErr,
  )
}

export function subscribeChecklist(
  taskId: string,
  cb: (items: ChecklistItem[]) => void,
  onErr?: (error: FirestoreError) => void,
): Unsubscribe {
  const q = query(checklistCol(taskId), orderBy('order', 'asc'))
  return onSnapshot(
    q,
    (snap) => {
      const list: ChecklistItem[] = []
      snap.forEach((docSnap) => {
        const data = docSnap.data()
        list.push({
          id: docSnap.id,
          ...data,
          dueAt: data.dueAt?.toDate?.() ?? null,
          createdAt: data.createdAt?.toDate?.() ?? null,
          updatedAt: data.updatedAt?.toDate?.() ?? null,
        } as ChecklistItem)
      })
      cb(list)
    },
    onErr,
  )
}

export function subscribeAttachments(
  taskId: string,
  cb: (items: Attachment[]) => void,
  onErr?: (error: FirestoreError) => void,
): Unsubscribe {
  const q = query(attachmentsCol(taskId), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => {
      const list: Attachment[] = []
      snap.forEach((docSnap) => {
        const data = docSnap.data()
        list.push({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() ?? null,
        } as Attachment)
      })
      cb(list)
    },
    onErr,
  )
}

export function subscribeLinks(
  taskId: string,
  cb: (items: LinkItem[]) => void,
  onErr?: (error: FirestoreError) => void,
): Unsubscribe {
  const q = query(linksCol(taskId), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => {
      const list: LinkItem[] = []
      snap.forEach((docSnap) => {
        const data = docSnap.data()
        list.push({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() ?? null,
        } as LinkItem)
      })
      cb(list)
    },
    onErr,
  )
}

export function subscribeEvents(
  taskId: string,
  cb: (items: ActivityEvent[]) => void,
  onErr?: (error: FirestoreError) => void,
): Unsubscribe {
  const q = query(eventsCol(taskId), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => {
      const list: ActivityEvent[] = []
      snap.forEach((docSnap) => {
        const data = docSnap.data()
        list.push({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() ?? null,
        } as ActivityEvent)
      })
      cb(list)
    },
    onErr,
  )
}

export async function updateTask(taskId: string, payload: Partial<Task>) {
  await updateDoc(taskDoc(taskId), {
    ...payload,
    updatedAt: serverTimestamp(),
  })
}

export async function addChecklistItem(taskId: string, payload: Partial<ChecklistItem>) {
  return addDoc(checklistCol(taskId), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function toggleChecklist(taskId: string, itemId: string, done: boolean) {
  await updateDoc(doc(checklistCol(taskId), itemId), {
    done,
    updatedAt: serverTimestamp(),
  })
}

export async function addComment(taskId: string, payload: Partial<CommentItem>) {
  return addDoc(commentsCol(taskId), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function resolveQuestion(taskId: string, commentId: string, resolved: boolean) {
  await updateDoc(doc(commentsCol(taskId), commentId), {
    resolvedAt: resolved ? serverTimestamp() : null,
  })
}

export async function fetchTaskOnce(taskId: string) {
  const snap = await getDoc(taskDoc(taskId))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    id: snap.id,
    ...data,
    dueAt: data.dueAt?.toDate?.() ?? null,
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
    completedAt: data.completedAt?.toDate?.() ?? null,
  } as Task
}

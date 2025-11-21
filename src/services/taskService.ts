import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/firebase/config'

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done'

export interface TaskDoc {
  id: string
  title: string
  description?: string
  status: TaskStatus
  dueDate?: { seconds: number; nanoseconds: number }
  assigneeId?: string
  assigneeName?: string
  createdBy: string
  projectId: string
  createdAt?: { seconds: number; nanoseconds: number }
  updatedAt?: { seconds: number; nanoseconds: number }
  progress?: number
}

export interface CreateTaskPayload {
  title: string
  description?: string
  status?: TaskStatus
  dueDate?: Date | null
  assigneeId?: string | null
  assigneeName?: string | null
  progress?: number
}

export function listenTasks(projectId: string, callback: (tasks: TaskDoc[]) => void) {
  const tasksRef = query(collection(db, 'projects', projectId, 'tasks'), orderBy('createdAt', 'asc'))
  return onSnapshot(tasksRef, (snapshot) => {
    const items: TaskDoc[] = []
    snapshot.forEach((docSnap) => {
      items.push({ id: docSnap.id, projectId, ...(docSnap.data() as Omit<TaskDoc, 'id' | 'projectId'>) })
    })
    callback(items)
  })
}

export async function createTask(projectId: string, payload: CreateTaskPayload, userId: string) {
  const docRef = await addDoc(collection(db, 'projects', projectId, 'tasks'), {
    title: payload.title,
    description: payload.description ?? '',
    status: payload.status ?? 'todo',
    dueDate: payload.dueDate ?? null,
    assigneeId: payload.assigneeId ?? null,
    assigneeName: payload.assigneeName ?? null,
    progress: payload.progress ?? 0,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export async function updateTask(projectId: string, taskId: string, updates: Partial<CreateTaskPayload>) {
  await updateDoc(doc(db, 'projects', projectId, 'tasks', taskId), {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteTask(projectId: string, taskId: string) {
  await deleteDoc(doc(db, 'projects', projectId, 'tasks', taskId))
}

import { db } from '@/firebase/config'
import { getLogger } from '@logtape/logtape'
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

const logger = getLogger('app.services.task')

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
  logger.debug`Starting to listen for tasks in project ${projectId}`
  const tasksRef = query(collection(db, 'projects', projectId, 'tasks'), orderBy('createdAt', 'asc'))
  return onSnapshot(tasksRef, (snapshot) => {
    logger.debug`Received task update for project ${projectId}. Count: ${snapshot.size}`
    const items: TaskDoc[] = []
    snapshot.forEach((docSnap) => {
      items.push({ id: docSnap.id, projectId, ...(docSnap.data() as Omit<TaskDoc, 'id' | 'projectId'>) })
    })
    callback(items)
  }, (error) => {
    logger.error`Failed to listen for tasks: ${error}`
  })
}

export async function createTask(projectId: string, payload: CreateTaskPayload, userId: string) {
  logger.info`Creating task in project ${projectId}: ${payload.title}`
  try {
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
    logger.info`Task created successfully. ID: ${docRef.id}`
    return docRef.id
  } catch (error) {
    logger.error`Failed to create task: ${error}`
    throw error
  }
}

export async function updateTask(projectId: string, taskId: string, updates: Partial<CreateTaskPayload>) {
  logger.debug`Updating task ${taskId} in project ${projectId}`
  try {
    await updateDoc(doc(db, 'projects', projectId, 'tasks', taskId), {
      ...updates,
      updatedAt: serverTimestamp(),
    })
    logger.debug`Task ${taskId} updated successfully`
  } catch (error) {
    logger.error`Failed to update task ${taskId}: ${error}`
    throw error
  }
}

export async function deleteTask(projectId: string, taskId: string) {
  logger.info`Deleting task ${taskId} in project ${projectId}`
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'tasks', taskId))
    logger.info`Task ${taskId} deleted successfully`
  } catch (error) {
    logger.error`Failed to delete task ${taskId}: ${error}`
    throw error
  }
}

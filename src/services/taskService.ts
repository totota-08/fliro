import { db } from "@/lib/firebase";
import { addProjectEvent } from "@/services/projectActivityLogService";
import type { ProjectEventOrigin } from "@/types/projectEvent";
import { getLogger } from "@logtape/logtape";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

const logger = getLogger("app.services.task");

export type TaskStatus = "todo" | "in-progress" | "done";

export interface TaskDoc {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  categoryId?: string | null;
  categoryName?: string | null;
  dueDate?: { seconds: number; nanoseconds: number };
  assigneeId?: string;
  assigneeName?: string;
  createdBy: string;
  createdByName?: string;
  projectId: string;
  createdAt?: { seconds: number; nanoseconds: number };
  updatedAt?: { seconds: number; nanoseconds: number };
  progress?: number;
  hasThread?: boolean;
  threadName?: string | null;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  status?: TaskStatus;
  dueDate?: Date | null;
  categoryId?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  progress?: number;
  hasThread?: boolean;
  threadName?: string | null;
}

export function listenTasks(
  projectId: string,
  callback: (tasks: TaskDoc[]) => void,
) {
  logger.debug`Starting to listen for tasks in project ${projectId}`;
  const tasksRef = query(
    collection(db, "projects", projectId, "tasks"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(
    tasksRef,
    (snapshot) => {
      logger.debug`Received task update for project ${projectId}. Count: ${snapshot.size}`;
      const items: TaskDoc[] = [];
      snapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          projectId,
          ...(docSnap.data() as Omit<TaskDoc, "id" | "projectId">),
        });
      });
      callback(items);
    },
    (error) => {
      logger.error`Failed to listen for tasks: ${error}`;
    },
  );
}

export async function createTask(
  projectId: string,
  payload: CreateTaskPayload,
  userId: string,
  options?: {
    origin?: ProjectEventOrigin;
    actorName?: string;
    actorId?: string | null;
  },
) {
  logger.info`Creating task in project ${projectId}: ${payload.title}`;
  const origin = options?.origin ?? "ui";
  const actorId = options?.actorId ?? userId;
  const actorName = options?.actorName ?? userId ?? "Unknown";
  try {
    const hasThread = payload.hasThread ?? false;
    const providedThreadName = (payload.threadName || "").trim();
    const threadName = hasThread ? providedThreadName || payload.title : null;
    const docRef = await addDoc(
      collection(db, "projects", projectId, "tasks"),
      {
        title: payload.title,
        description: payload.description ?? "",
        status: payload.status ?? "todo",
        dueDate: payload.dueDate ?? null,
        categoryId: payload.categoryId ?? null,
        assigneeId: payload.assigneeId ?? null,
        assigneeName: payload.assigneeName ?? null,
        progress: payload.progress ?? 0,
        createdBy: userId,
        createdByName: actorName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        hasThread,
        threadName,
      },
    );
    logger.info`Task created successfully. ID: ${docRef.id}`;
    try {
      await addProjectEvent(projectId, {
        type: "task.created",
        origin,
        actorId,
        actorName,
        payload: {
          taskId: docRef.id,
          taskTitle: payload.title,
          assigneeId: payload.assigneeId ?? null,
          assigneeName: payload.assigneeName ?? null,
          dueDate: payload.dueDate ?? null,
          status: payload.status ?? "todo",
          categoryId: payload.categoryId ?? null,
          progress: payload.progress ?? 0,
        },
      });
    } catch (eventError) {
      logger.error`Failed to add task.created event: ${eventError}`;
    }
    return docRef.id;
  } catch (error) {
    logger.error`Failed to create task: ${error}`;
    throw error;
  }
}

export async function updateTask(
  projectId: string,
  taskId: string,
  updates: Partial<CreateTaskPayload>,
  context?: {
    userId?: string | null;
    actorName?: string;
    origin?: ProjectEventOrigin;
  },
) {
  logger.debug`Updating task ${taskId} in project ${projectId}`;
  const origin = context?.origin ?? "ui";
  const actorId = context?.userId ?? null;
  const actorName = context?.actorName ?? context?.userId ?? "Unknown";
  const taskRef = doc(db, "projects", projectId, "tasks", taskId);
  let eventsQueue: Array<{
    type: TaskEventType;
    payload: Record<string, any>;
  }> = [];

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(taskRef);
      if (!snap.exists()) {
        throw new Error("task-not-found");
      }
      const before: TaskDoc = {
        id: snap.id,
        projectId,
        ...(snap.data() as Omit<TaskDoc, "id" | "projectId">),
      };

      transaction.update(taskRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      // Calculate events within transaction to ensure 'before' is consistent
      eventsQueue = []; // Reset queue on retry

      const after: TaskDoc = {
        ...before,
        ...(updates as any),
      };

      if (updates.status && updates.status !== before.status) {
        eventsQueue.push({
          type: "task.status_changed",
          payload: {
            taskId,
            taskTitle: after.title,
            fromStatus: before.status,
            toStatus: updates.status,
          },
        });
      }

      if (
        typeof updates.progress === "number" &&
        !Number.isNaN(updates.progress) &&
        (before.progress ?? 0) !== updates.progress
      ) {
        eventsQueue.push({
          type: "task.progress_changed",
          payload: {
            taskId,
            taskTitle: after.title,
            fromProgress: before.progress ?? 0,
            toProgress: updates.progress,
          },
        });
      }

      const assigneeChanged =
        Object.prototype.hasOwnProperty.call(updates, "assigneeId") ||
        Object.prototype.hasOwnProperty.call(updates, "assigneeName");
      if (
        assigneeChanged &&
        (before.assigneeId !== after.assigneeId ||
          before.assigneeName !== after.assigneeName)
      ) {
        eventsQueue.push({
          type: "task.assigned",
          payload: {
            taskId,
            taskTitle: after.title,
            fromAssigneeId: before.assigneeId ?? null,
            fromAssigneeName: before.assigneeName ?? null,
            toAssigneeId: after.assigneeId ?? null,
            toAssigneeName: after.assigneeName ?? null,
          },
        });
      }

      const dueChanged = Object.prototype.hasOwnProperty.call(
        updates,
        "dueDate",
      );
      if (dueChanged) {
        const fromDue =
          before.dueDate && "seconds" in before.dueDate
            ? before.dueDate
            : (before.dueDate ?? null);
        const toDue = updates.dueDate ?? after.dueDate ?? null;
        if (JSON.stringify(fromDue) !== JSON.stringify(toDue)) {
          eventsQueue.push({
            type: "task.due_changed",
            payload: {
              taskId,
              taskTitle: after.title,
              fromDueDate: fromDue,
              toDueDate: toDue,
            },
          });
        }
      }

      const remainingChanges: Array<{ field: string; from: any; to: any }> = [];
      const tracked = [
        "status",
        "progress",
        "assigneeId",
        "assigneeName",
        "dueDate",
      ];
      Object.entries(updates).forEach(([field, value]) => {
        if (tracked.includes(field)) return;
        const previous = (before as any)[field];
        if (JSON.stringify(previous) !== JSON.stringify(value)) {
          remainingChanges.push({ field, from: previous ?? null, to: value });
        }
      });

      if (remainingChanges.length) {
        eventsQueue.push({
          type: "task.updated",
          payload: {
            taskId,
            taskTitle: after.title,
            changes: remainingChanges,
          },
        });
      }
    });

    logger.debug`Task ${taskId} updated successfully via transaction`;

    // Dispatch events after transaction success
    for (const entry of eventsQueue) {
      try {
        await addProjectEvent(projectId, {
          type: entry.type,
          origin,
          actorId,
          actorName,
          payload: entry.payload,
        });
      } catch (eventError) {
        logger.error`Failed to add task update event ${entry.type}: ${eventError}`;
      }
    }
  } catch (error) {
    logger.error`Failed to update task ${taskId}: ${error}`;
    throw error;
  }
}

type TaskEventType =
  | "task.status_changed"
  | "task.progress_changed"
  | "task.assigned"
  | "task.due_changed"
  | "task.updated";

export async function deleteTask(
  projectId: string,
  taskId: string,
  context?: {
    userId?: string | null;
    actorName?: string;
    origin?: ProjectEventOrigin;
  },
) {
  logger.info`Deleting task ${taskId} in project ${projectId}`;
  const origin = context?.origin ?? "ui";
  const actorId = context?.userId ?? null;
  const actorName = context?.actorName ?? context?.userId ?? "Unknown";
  let title: string | undefined;
  try {
    const snap = await getDoc(doc(db, "projects", projectId, "tasks", taskId));
    if (snap.exists()) {
      title = (snap.data() as any).title as string;
    }
  } catch (error) {
    logger.error`Failed to fetch task before delete ${taskId}: ${error}`;
  }
  try {
    await deleteDoc(doc(db, "projects", projectId, "tasks", taskId));
    logger.info`Task ${taskId} deleted successfully`;
    try {
      await addProjectEvent(projectId, {
        type: "task.deleted",
        origin,
        actorId,
        actorName,
        payload: {
          taskId,
          taskTitle: title ?? "",
        },
      });
    } catch (eventError) {
      logger.error`Failed to add task.deleted event: ${eventError}`;
    }
  } catch (error) {
    logger.error`Failed to delete task ${taskId}: ${error}`;
    throw error;
  }
}

export function listenTask(
  projectId: string,
  taskId: string,
  callback: (task: TaskDoc | null) => void,
) {
  logger.debug`Starting to listen for task ${taskId} in project ${projectId}`;
  const taskRef = doc(db, "projects", projectId, "tasks", taskId);
  return onSnapshot(
    taskRef,
    (docSnap) => {
      logger.debug`Received update for task ${taskId}`;
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback({
          id: docSnap.id,
          projectId,
          ...(data as Omit<TaskDoc, "id" | "projectId">),
        });
      } else {
        callback(null);
      }
    },
    (error) => {
      logger.error`Failed to listen for task ${taskId}: ${error}`;
    },
  );
}

import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.services.taskCategoryService");

const MAX_CATEGORY_NAME_LENGTH = 30;

export type TaskCategory = {
  id: string;
  name: string;
  color?: string;
  description?: string;
  createdAt?: { seconds: number; nanoseconds: number };
  updatedAt?: { seconds: number; nanoseconds: number };
};

export function listenTaskCategories(
  projectId: string,
  callback: (categories: TaskCategory[]) => void,
) {
  const ref = collection(db, "projects", projectId, "categories");
  return onSnapshot(ref, (snapshot) => {
    const list: TaskCategory[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: (data.name as string) || "カテゴリ",
        color: data.color as string | undefined,
        description: data.description as string | undefined,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });
    callback(list);
  });
}

/**
 * カテゴリを追加する
 * @param projectId プロジェクトID
 * @param name カテゴリ名（必須、最大30文字）
 * @param options オプション（color, description）
 */
export async function addTaskCategory(
  projectId: string,
  name: string,
  options?: { color?: string; description?: string },
) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("カテゴリ名は必須です");
  }

  if (trimmedName.length > MAX_CATEGORY_NAME_LENGTH) {
    throw new Error(
      `カテゴリ名は${MAX_CATEGORY_NAME_LENGTH}文字以内で入力してください`,
    );
  }

  const categoryData: Record<string, unknown> = {
    name: trimmedName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (options?.color) {
    categoryData.color = options.color;
  }

  if (options?.description) {
    categoryData.description = options.description.trim();
  }

  const docRef = await addDoc(
    collection(db, "projects", projectId, "categories"),
    categoryData,
  );

  logger.info`Created category ${trimmedName} (${docRef.id}) in project ${projectId}`;

  return docRef.id;
}

/**
 * カテゴリを更新する
 * @param projectId プロジェクトID
 * @param categoryId カテゴリID
 * @param patch 更新するフィールド（name, color, description）
 */
export async function updateTaskCategory(
  projectId: string,
  categoryId: string,
  patch: { name?: string; color?: string; description?: string },
) {
  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (patch.name !== undefined) {
    const trimmedName = patch.name.trim();

    if (!trimmedName) {
      throw new Error("カテゴリ名は必須です");
    }

    if (trimmedName.length > MAX_CATEGORY_NAME_LENGTH) {
      throw new Error(
        `カテゴリ名は${MAX_CATEGORY_NAME_LENGTH}文字以内で入力してください`,
      );
    }

    updateData.name = trimmedName;
  }

  if (patch.color !== undefined) {
    updateData.color = patch.color || null;
  }

  if (patch.description !== undefined) {
    updateData.description = patch.description?.trim() || null;
  }

  await updateDoc(
    doc(db, "projects", projectId, "categories", categoryId),
    updateData,
  );

  logger.info`Updated category ${categoryId} in project ${projectId}`;
}

/**
 * カテゴリを削除する
 * @param projectId プロジェクトID
 * @param categoryId カテゴリID
 * @throws Error カテゴリを使用しているタスクがある場合
 */
export async function deleteTaskCategory(
  projectId: string,
  categoryId: string,
) {
  // 使用中チェック: このカテゴリを使用しているタスクがあるか確認
  const tasksRef = collection(db, "projects", projectId, "tasks");
  const tasksQuery = query(
    tasksRef,
    where("categoryId", "==", categoryId),
    limit(1),
  );
  const tasksSnapshot = await getDocs(tasksQuery);

  if (!tasksSnapshot.empty) {
    throw new Error("このカテゴリを使用しているタスクがあるため削除できません");
  }

  await deleteDoc(doc(db, "projects", projectId, "categories", categoryId));

  logger.info`Deleted category ${categoryId} from project ${projectId}`;
}

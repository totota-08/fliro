import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";

export type TaskCategory = {
  id: string;
  name: string;
};

export function listenTaskCategories(
  projectId: string,
  callback: (categories: TaskCategory[]) => void,
) {
  const ref = collection(db, "projects", projectId, "categories");
  return onSnapshot(ref, (snapshot) => {
    const list: TaskCategory[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      name: (docSnap.data().name as string) || "カテゴリ",
    }));
    callback(list);
  });
}

export async function addTaskCategory(projectId: string, name: string) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("カテゴリ名は必須です");
  }
  if (trimmedName.length > 50) {
    throw new Error("カテゴリ名は50文字以内にしてください");
  }
  await addDoc(collection(db, "projects", projectId, "categories"), {
    name: trimmedName,
  });
}

export async function renameTaskCategory(
  projectId: string,
  categoryId: string,
  name: string,
) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("カテゴリ名は必須です");
  }
  if (trimmedName.length > 50) {
    throw new Error("カテゴリ名は50文字以内にしてください");
  }
  await updateDoc(doc(db, "projects", projectId, "categories", categoryId), {
    name: trimmedName,
  });
}

export async function deleteTaskCategory(
  projectId: string,
  categoryId: string,
) {
  await deleteDoc(doc(db, "projects", projectId, "categories", categoryId));
}

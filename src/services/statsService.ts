import { collection, getCountFromServer } from "firebase/firestore";
import { db } from "@/firebase/config";

export async function fetchScaleStats() {
  const [userSnap, projectSnap] = await Promise.all([
    getCountFromServer(collection(db, "profiles")),
    getCountFromServer(collection(db, "projects")),
  ]);

  return {
    users: userSnap.data().count,
    projects: projectSnap.data().count,
  };
}

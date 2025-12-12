import { auth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";

export const getCurrentUser = () => {
  return new Promise<User | null>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      (error) => {
        unsubscribe();
        reject(error);
      },
    );
  });
};

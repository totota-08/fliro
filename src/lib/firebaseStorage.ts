import { app, useEmulators } from "@/lib/firebase";
import { connectStorageEmulator, getStorage } from "firebase/storage";

// Storage は利用チャンクにのみバンドルするため lib/firebase.ts から分離
export const storage = getStorage(app);

if (useEmulators) {
  connectStorageEmulator(storage, "localhost", 9199);
}

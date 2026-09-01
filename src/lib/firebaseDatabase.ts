import { app, useEmulators } from "@/lib/firebase";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";

// Realtime Database は利用チャンクにのみバンドルするため lib/firebase.ts から分離
export const database = getDatabase(app);

if (useEmulators) {
  connectDatabaseEmulator(database, "localhost", 9000);
}

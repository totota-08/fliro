import { app, useEmulators } from "@/lib/firebase";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

// Cloud Functions は利用チャンクにのみバンドルするため lib/firebase.ts から分離
export const functions = getFunctions(app, "asia-northeast1");

if (useEmulators) {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

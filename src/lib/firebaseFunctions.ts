/**
 * Cloud Functions インスタンス
 *
 * Functions SDK は管理画面 / ベータゲートでしか使わないため、
 * 初期表示のバンドルから切り離している。
 * （このモジュールを import するのは遅延ロードされるサービスのみにすること）
 */
import { app, useEmulators } from "@/lib/firebase";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

const functions = getFunctions(app, "asia-northeast1");

if (useEmulators) {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

export { functions };

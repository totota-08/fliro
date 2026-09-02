/**
 * Cloud Storage インスタンス
 *
 * Storage SDK はアバター / プロジェクトアイコンのアップロード時にしか
 * 使わないため、初期表示のバンドルから切り離している。
 * （このモジュールを import するのは遅延ロードされるサービスのみにすること）
 */
import { app, useEmulators } from "@/lib/firebase";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const storage = getStorage(app);

if (useEmulators) {
  connectStorageEmulator(storage, "localhost", 9199);
}

export { storage };

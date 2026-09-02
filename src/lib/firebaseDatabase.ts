/**
 * Realtime Database インスタンス
 *
 * Realtime Database SDK は 100KB 以上あり、チャット / メンバー在席表示など
 * 一部の機能でしか使わない。初期表示のバンドルに載せないため、
 * @/lib/firebase から切り離してこのモジュールに置いている。
 * （このモジュールを import するのは遅延ロードされるサービスのみにすること）
 */
import { app, useEmulators } from "@/lib/firebase";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";

const database = getDatabase(app);

if (useEmulators) {
  connectDatabaseEmulator(database, "localhost", 9000);
}

export { database };

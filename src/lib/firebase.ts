import { firebaseConfig } from "@/config/firebaseConfig";
import { getApp, getApps, initializeApp, setLogLevel } from "firebase/app";
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

/**
 * 環境変数からFirebaseのログレベルを設定
 * レベル別フラグ（VITE_LOG_DEBUG, VITE_LOG_INFO, VITE_LOG_WARNING, VITE_LOG_ERROR）に対応
 */
function configureFirebaseLogLevel() {
  type FirebaseLogLevel =
    | "debug"
    | "verbose"
    | "info"
    | "warn"
    | "error"
    | "silent";

  const parseFlag = (
    value: string | undefined,
    defaultValue: boolean,
  ): boolean => {
    if (value === undefined) return defaultValue;
    return value === "true";
  };

  const isProd = import.meta.env.PROD;
  const debugEnabled = parseFlag(import.meta.env.VITE_LOG_DEBUG, !isProd);
  const infoEnabled = parseFlag(import.meta.env.VITE_LOG_INFO, !isProd);
  const warningEnabled = parseFlag(import.meta.env.VITE_LOG_WARNING, true);
  const errorEnabled = parseFlag(import.meta.env.VITE_LOG_ERROR, true);

  // すべて無効の場合は silent
  if (!debugEnabled && !infoEnabled && !warningEnabled && !errorEnabled) {
    setLogLevel("silent");
    return;
  }

  // 有効な最低レベルを決定
  let firebaseLevel: FirebaseLogLevel;
  if (debugEnabled) {
    firebaseLevel = "debug";
  } else if (infoEnabled) {
    firebaseLevel = "info";
  } else if (warningEnabled) {
    firebaseLevel = "warn";
  } else {
    firebaseLevel = "error";
  }

  setLogLevel(firebaseLevel);
}

configureFirebaseLogLevel();

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// App Check の初期化
// 開発環境で VITE_APP_CHECK_ENABLED=false の場合はスキップ
const appCheckEnabled =
  import.meta.env.VITE_APP_CHECK_ENABLED !== "false" &&
  typeof window !== "undefined" &&
  import.meta.env.VITE_APP_CHECK_KEY;

if (appCheckEnabled) {
  // デバッグモード: VITE_APP_CHECK_DEBUG=true の場合、デバッグトークンを出力
  // 出力されたトークンをFirebaseコンソール > App Check > アプリ > デバッグトークンを管理 で登録する
  if (import.meta.env.VITE_APP_CHECK_DEBUG === "true") {
    // @ts-expect-error Firebase App Check debug token
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_APP_CHECK_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const database = getDatabase(app);
const functions = getFunctions(app, "asia-northeast1");

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const githubProvider = new GithubAuthProvider();
githubProvider.setCustomParameters({ allow_signup: "true" });

const useEmulators =
  import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

if (useEmulators) {
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(db, "localhost", 8080);
  connectDatabaseEmulator(database, "localhost", 9000);
  connectStorageEmulator(storage, "localhost", 9199);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

export {
  app,
  auth,
  database,
  db,
  functions,
  githubProvider,
  googleProvider,
  storage,
};

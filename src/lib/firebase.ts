import { firebaseConfig } from "@/config/firebaseConfig";
import { getApp, getApps, initializeApp, setLogLevel } from "firebase/app";
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
// TODO: App Check を正しく設定後に有効化する
// import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

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

// TODO: App Check を正しく設定後に有効化する
// App Check の初期化
// VITE_APP_CHECK_KEY が設定されている場合のみ有効化
// if (typeof window !== "undefined" && import.meta.env.VITE_APP_CHECK_KEY) {
//   // デバッグモード: VITE_DEBUG_MODE=true の場合、デバッグトークンを出力
//   // 出力されたトークンをFirebaseコンソール > App Check > アプリ > デバッグトークンを管理 で登録する
//   if (import.meta.env.VITE_DEBUG_MODE === "true") {
//     // @ts-expect-error Firebase App Check debug token
//     self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
//   }
//
//   initializeAppCheck(app, {
//     provider: new ReCaptchaV3Provider(import.meta.env.VITE_APP_CHECK_KEY),
//     isTokenAutoRefreshEnabled: true,
//   });
// }

/**
 * エミュレータを使用するかどうか
 *
 * Auth / Firestore 以外（Database / Storage / Functions）は遅延ロードされる
 * ため、それぞれのモジュール（@/lib/firebaseDatabase など）から参照する。
 */
export const useEmulators =
  import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

const auth = getAuth(app);
const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const githubProvider = new GithubAuthProvider();
githubProvider.setCustomParameters({ allow_signup: "true" });

if (useEmulators) {
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(db, "localhost", 8080);
}

export { app, auth, db, githubProvider, googleProvider };

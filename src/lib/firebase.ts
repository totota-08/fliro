import { firebaseConfig } from "@/config/firebaseConfig";
import { getLogLevelFlags } from "@/utils/logger";
import { getApp, getApps, initializeApp, setLogLevel } from "firebase/app";
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
// TODO: App Check を正しく設定後に有効化する
// import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

/**
 * 環境変数からFirebaseのログレベルを設定
 * レベル別フラグの解釈は utils/logger.ts の getLogLevelFlags に一本化している
 */
function configureFirebaseLogLevel() {
  const flags = getLogLevelFlags();
  if (!flags.debug && !flags.info && !flags.warning && !flags.error) {
    setLogLevel("silent");
    return;
  }
  setLogLevel(
    flags.debug
      ? "debug"
      : flags.info
        ? "info"
        : flags.warning
          ? "warn"
          : "error",
  );
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

const auth = getAuth(app);
const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const githubProvider = new GithubAuthProvider();
githubProvider.setCustomParameters({ allow_signup: "true" });

// database / storage / functions は初期ロードを軽くするため
// lib/firebaseDatabase.ts / firebaseStorage.ts / firebaseFunctions.ts で初期化する
const useEmulators =
  import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

if (useEmulators) {
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(db, "localhost", 8080);
}

export { app, auth, db, githubProvider, googleProvider, useEmulators };

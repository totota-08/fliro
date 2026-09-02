// ロガーを最初に初期化（他のモジュールより先に）
import { initLogger } from "@/utils/logger";
await initLogger();

import { appName, appVersion } from "@/constants/appMeta";
import { initAuthListener } from "@/store/auth";
import "@/styles/motion.css";
import "@/styles/ui-tokens.css";
import { createApp } from "vue";
import App from "./App.vue";
import "./assets/reset.css";
import "./assets/style.css";
import router from "./router";

import "@/lib/firebase";

import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.main");

const app = createApp(App);

if (typeof document !== "undefined") {
  document.title = appVersion ? `${appName} ${appVersion}` : appName;
}

// 認証の初期化は待たずにマウントする。
// 待ってしまうと Firebase Auth の復元 + プロフィール取得が終わるまで
// 画面が真っ白のままになるため、まずローディング画面を描画する。
// 認証状態が必要なルートは router の beforeEach（waitForAuthReady）が待つ。
initAuthListener().catch((error) => {
  logger.error`Failed to initialize Firebase auth: ${error}`;
});

app.use(router).mount("#app");

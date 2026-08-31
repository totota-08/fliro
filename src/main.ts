// ロガーを最初に初期化（他のモジュールより先に）
import { initLogger } from "@/utils/logger";
await initLogger();

import { appName, appVersion } from "@/constants/appMeta";
import { initAuthListener } from "@/store/auth";
import "@/styles/motion.css";
import "@/styles/ui-tokens.css";
import "@/styles/buttons.css";
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

initAuthListener()
  .catch((error) => {
    logger.error`Failed to initialize Firebase auth: ${error}`;
  })
  .finally(() => {
    app.use(router).mount("#app");
  });

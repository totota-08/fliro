import { appName, appVersion } from "@/constants/appMeta";
import { initAuthListener } from "@/store/auth";
import { createApp } from "vue";
import App from "./App.vue";
import "./assets/reset.css";
import "./assets/style.css";
import router from "./router";

import { initLogger } from "@/utils/logger";
import "@/lib/firebase";

import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.main");

const app = createApp(App);

if (typeof document !== "undefined") {
  document.title = appVersion ? `${appName} ${appVersion}` : appName;
}

// Initialize logger first before any code that might use it
await initLogger();

initAuthListener()
  .catch((error) => {
    logger.error`Failed to initialize Firebase auth: ${error}`;
  })
  .finally(() => {
    app.use(router).mount("#app");
  });

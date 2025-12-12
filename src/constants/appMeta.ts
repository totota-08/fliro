import packageInfo from "../../package.json";

const appName = packageInfo.name || "App";
const appVersion = packageInfo.version || "";

export { appName, appVersion };

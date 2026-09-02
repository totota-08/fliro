import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // 初期表示のバンドルとライブラリを分離し、
    // アプリ更新時にライブラリ側のキャッシュが無効化されないようにする
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          // firebase / @firebase のどのプロダクトかを判定する
          const firebaseProduct = id.match(
            /.*node_modules\/(?:@firebase|firebase)\/([^/]+)/,
          )?.[1];

          if (firebaseProduct) {
            if (firebaseProduct.startsWith("webchannel-wrapper")) {
              return "firebase-firestore";
            }
            // Database / Storage / Functions は初期表示に不要。
            // チャンクを固定するとエントリ側の静的グラフに載ってしまうため、
            // Rollup の自動分割（＝遅延チャンク）に任せる。
            if (
              firebaseProduct.startsWith("database") ||
              firebaseProduct.startsWith("storage") ||
              firebaseProduct.startsWith("functions")
            ) {
              return;
            }
            if (firebaseProduct.startsWith("firestore")) {
              return "firebase-firestore";
            }
            if (firebaseProduct.startsWith("auth")) {
              return "firebase-auth";
            }
            return "firebase-core";
          }

          if (/.*node_modules\/(?:@vue\/|vue\/|vue-router\/)/.test(id)) {
            return "vue-vendor";
          }
          if (id.includes("/@logtape/")) {
            return "logtape";
          }
        },
      },
    },
  },
});

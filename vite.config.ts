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
    rollupOptions: {
      output: {
        // 更新頻度の低いベンダーを分離し、アプリ更新時のキャッシュ再利用を高める
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
          vue: ["vue", "vue-router"],
        },
      },
    },
  },
});

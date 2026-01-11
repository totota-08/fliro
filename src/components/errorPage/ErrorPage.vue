<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ROUTE_NAMES } from "@/constants/routes";

export type ErrorType =
  | "forbidden"
  | "not_found"
  | "path_not_found"
  | "network"
  | "unknown";

interface ErrorConfig {
  code: string;
  title: string;
  message: string;
  hint: string;
  color: string;
  canRetry: boolean;
}

const route = useRoute();
const router = useRouter();

const errorType = computed(
  () => (route.query.errorType as ErrorType) || "forbidden",
);
const projectId = computed(() => route.query.projectId as string | undefined);
const customReason = computed(() => route.query.reason as string | undefined);
const invalidPath = computed(() => route.query.path as string | undefined);

const errorConfigs: Record<ErrorType, ErrorConfig> = {
  forbidden: {
    code: "403",
    title: "アクセス拒否",
    message: "このページにアクセスする権限がありません。",
    hint: "この操作に必要な権限がありません。プロジェクトの管理者に連絡してください。",
    color: "#ef4444",
    canRetry: false,
  },
  not_found: {
    code: "404",
    title: "ページが見つかりません",
    message: "お探しのプロジェクトまたはページは存在しません。",
    hint: "URLが正しいか確認するか、マイページから別のプロジェクトを選択してください。",
    color: "#f59e0b",
    canRetry: false,
  },
  path_not_found: {
    code: "404",
    title: "ページが見つかりません",
    message: "リクエストされたパスは存在しません。",
    hint: "URLが正しいか確認するか、トップページからやり直してください。",
    color: "#f59e0b",
    canRetry: false,
  },
  network: {
    code: "接続エラー",
    title: "通信に失敗しました",
    message: "サーバーとの通信中にエラーが発生しました。",
    hint: "インターネット接続を確認し、再度お試しください。問題が続く場合は、しばらく時間をおいてからアクセスしてください。",
    color: "#6366f1",
    canRetry: true,
  },
  unknown: {
    code: "エラー",
    title: "問題が発生しました",
    message: "予期しないエラーが発生しました。",
    hint: "ページを再読み込みするか、しばらく時間をおいてから再度お試しください。",
    color: "#64748b",
    canRetry: true,
  },
};

const config = computed(() => errorConfigs[errorType.value]);
const displayMessage = computed(
  () => customReason.value || config.value.message,
);

function goBack() {
  if (window.history.length > 2) {
    router.back();
  } else if (projectId.value) {
    router.push({
      name: ROUTE_NAMES.projectDashboard,
      params: { projectId: projectId.value },
    });
  } else {
    router.push({ name: ROUTE_NAMES.myPage });
  }
}

function goHome() {
  router.push({ name: ROUTE_NAMES.home });
}

function retry() {
  window.location.reload();
}
</script>

<template>
  <section class="error-page">
    <div class="error-page__content">
      <p class="error-page__code" :style="{ color: config.color }">
        {{ config.code }}
      </p>
      <h2 class="error-page__title">{{ config.title }}</h2>
      <p class="error-page__message">
        {{ displayMessage }}
      </p>
      <p v-if="invalidPath" class="error-page__path-container">
        <span class="error-page__path">{{ invalidPath }}</span>
      </p>
      <p class="error-page__hint">
        {{ config.hint }}
      </p>
      <div class="error-page__actions">
        <button v-if="config.canRetry" class="error-page__cta" @click="retry">
          再試行
        </button>
        <button
          v-else-if="errorType === 'path_not_found'"
          class="error-page__cta"
          @click="goHome"
        >
          トップページへ
        </button>
        <button v-else class="error-page__cta" @click="goBack">戻る</button>
        <RouterLink :to="{ name: ROUTE_NAMES.myPage }" class="error-page__link">
          マイページへ
        </RouterLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.error-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 3rem 1.5rem;
  background: var(--ui-surface-page, #f8fafc);
  color: var(--ui-text-strong, #0f172a);
}

.error-page__content {
  display: grid;
  gap: 1.25rem;
  max-width: 520px;
  text-align: center;
  padding: 3rem 2.5rem;
  border-radius: var(--ui-radius-xl, 1.25rem);
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  box-shadow: var(--ui-shadow-xl, 0 20px 50px rgba(0, 0, 0, 0.12));
}

.error-page__code {
  font-size: clamp(2.5rem, 8vw, 4rem);
  margin: 0;
  font-weight: var(--ui-font-bold, 700);
  letter-spacing: 0.05em;
}

.error-page__title {
  font-size: clamp(1.25rem, 4vw, 1.75rem);
  margin: 0;
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.error-page__message {
  margin: 0;
  color: var(--ui-text, #0b2e33);
  line-height: var(--ui-leading-relaxed, 1.625);
  font-size: var(--ui-text-base, 1rem);
}

.error-page__path-container {
  margin: 0;
}

.error-page__path {
  display: inline-block;
  font-family:
    "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo,
    monospace;
  padding: 0.25rem 0.75rem;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text-strong, #0f172a);
  font-size: var(--ui-text-sm, 0.875rem);
  word-break: break-all;
}

.error-page__hint {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
  line-height: var(--ui-leading-relaxed, 1.625);
}

.error-page__actions {
  display: flex;
  gap: var(--ui-space-3, 0.75rem);
  justify-content: center;
  margin-top: var(--ui-space-2, 0.5rem);
}

.error-page__cta {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-6, 1.5rem);
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-brand-500, #4f7c82);
  color: var(--ui-surface, #ffffff);
  font-weight: var(--ui-font-semibold, 600);
  font-size: var(--ui-text-sm, 0.875rem);
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition: var(--ui-transition-colors, background 0.15s ease);
}

.error-page__cta:hover {
  background: var(--ui-brand-600, #3d6166);
}

.error-page__cta:focus {
  outline: none;
  box-shadow: var(--ui-ring-focus, 0 0 0 3px rgba(79, 124, 130, 0.3));
}

.error-page__link {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-6, 1.5rem);
  border-radius: var(--ui-radius-full, 9999px);
  background: transparent;
  color: var(--ui-brand-500, #4f7c82);
  font-weight: var(--ui-font-semibold, 600);
  font-size: var(--ui-text-sm, 0.875rem);
  text-decoration: none;
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  transition: var(--ui-transition-colors, background 0.15s ease);
}

.error-page__link:hover {
  background: var(--ui-surface-muted, #f1f5f9);
}

.error-page__link:focus {
  outline: none;
  box-shadow: var(--ui-ring-focus, 0 0 0 3px rgba(79, 124, 130, 0.3));
}

@media (max-width: 600px) {
  .error-page {
    padding: 2rem 1.25rem;
  }

  .error-page__content {
    padding: 2.5rem 1.75rem;
  }

  .error-page__actions {
    flex-direction: column;
  }
}
</style>

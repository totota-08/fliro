<script setup lang="ts">
/**
 * MaintenancePage - メンテナンス画面
 *
 * フルページのメンテナンス通知
 * Fliroロゴ表示
 * メンテナンスメッセージ表示（Firestoreから取得）
 * 管理者の場合は「管理者ページへ」リンク表示
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import BrandLogo from "@/components/common/BrandLogo.vue";
import AppButton from "@/components/ui/AppButton.vue";
import { appName } from "@/constants/appMeta";
import { ROUTE_NAMES } from "@/constants/routes";
import { useAuthStore } from "@/store/auth";
import { subscribeToAppConfig } from "@/features/admin/services/appConfigService";
import type { MaintenanceConfig } from "@/features/admin/types/admin";
import { multiFactor } from "firebase/auth";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.pages.MaintenancePage");

const { user } = useAuthStore();
const maintenanceConfig = ref<MaintenanceConfig | null>(null);
const isAdmin = ref(false);
const loading = ref(true);

// デフォルトメッセージ
const defaultMessage = "現在メンテナンス中です。しばらくお待ちください。";

// 表示するメッセージ
const displayMessage = computed(() => {
  return maintenanceConfig.value?.message || defaultMessage;
});

// 管理者チェック
async function checkAdminStatus() {
  if (!user.value) {
    isAdmin.value = false;
    return;
  }

  try {
    const tokenResult = await user.value.getIdTokenResult(true);
    isAdmin.value = tokenResult.claims.admin === true;

    // MFA状態もチェック（管理者ページへのアクセスにはMFAが必要な場合がある）
    const mfaUser = multiFactor(user.value);
    const hasMFA = mfaUser.enrolledFactors.length > 0;

    // 管理者でかつMFAが有効な場合のみ管理者リンクを表示
    // ただし、MFAなしでも管理者ページでMFA設定を促すため、isAdminは維持
    if (isAdmin.value) {
      logger.info`Admin user detected (MFA: ${hasMFA})`;
    }
  } catch (error) {
    logger.error`Failed to check admin status: ${error}`;
    isAdmin.value = false;
  }
}

// 購読解除関数
let unsubscribe: (() => void) | null = null;

onMounted(async () => {
  // メンテナンス設定を購読
  unsubscribe = subscribeToAppConfig(
    (config) => {
      maintenanceConfig.value = config;
      loading.value = false;
    },
    () => {
      // announcement callback - not used here
    },
  );

  // 管理者チェック
  await checkAdminStatus();
});

onBeforeUnmount(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});
</script>

<template>
  <div class="maintenance-page">
    <div class="maintenance-card">
      <!-- ブランドロゴ -->
      <div class="maintenance-brand">
        <div class="maintenance-brand__icon">
          <BrandLogo />
        </div>
        <span class="maintenance-brand__name">{{ appName }}</span>
      </div>

      <!-- メンテナンスアイコン -->
      <div class="maintenance-icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
          />
        </svg>
      </div>

      <!-- メインコンテンツ -->
      <div class="maintenance-content">
        <h1 class="maintenance-title">メンテナンス中</h1>
        <p class="maintenance-message">
          {{ displayMessage }}
        </p>
      </div>

      <!-- 管理者リンク -->
      <div v-if="isAdmin" class="maintenance-admin">
        <AppButton variant="outline" :to="{ name: ROUTE_NAMES.admin }">
          管理者ページへ
        </AppButton>
      </div>
    </div>

    <!-- フッター -->
    <footer class="maintenance-footer">
      <p>
        &copy; {{ new Date().getFullYear() }} {{ appName }}. All rights
        reserved.
      </p>
    </footer>
  </div>
</template>

<style scoped>
.maintenance-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-6, 1.5rem);
  background: linear-gradient(
    135deg,
    var(--ui-brand-200, #d4f1f5),
    var(--ui-bg, #f5fcff) 45%,
    var(--ui-brand-300, #b8e3e9)
  );
}

.maintenance-card {
  width: min(480px, 100%);
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-2xl, 1.5rem);
  padding: var(--ui-space-10, 2.5rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  box-shadow: var(--ui-shadow-2xl);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-6, 1.5rem);
}

.maintenance-brand {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
}

.maintenance-brand__icon {
  width: 48px;
  height: 48px;
}

.maintenance-brand__name {
  font-size: var(--ui-text-xl, 1.25rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-brand-900, #0b2e33);
}

.maintenance-icon {
  width: 80px;
  height: 80px;
  padding: var(--ui-space-4, 1rem);
  background: var(--ui-warning-light, #fef3c7);
  border-radius: var(--ui-radius-full, 9999px);
  color: var(--ui-warning, #f59e0b);
}

.maintenance-icon svg {
  width: 100%;
  height: 100%;
}

.maintenance-content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.maintenance-title {
  margin: 0;
  font-size: var(--ui-text-2xl, 1.5rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.maintenance-message {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  color: var(--ui-text-muted, #64748b);
  line-height: var(--ui-leading-relaxed, 1.625);
  white-space: pre-wrap;
}

.maintenance-admin {
  margin-top: var(--ui-space-4, 1rem);
  padding-top: var(--ui-space-4, 1rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  width: 100%;
}

.maintenance-footer {
  margin-top: var(--ui-space-8, 2rem);
  text-align: center;
}

.maintenance-footer p {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

@media (max-width: 640px) {
  .maintenance-page {
    padding: var(--ui-space-4, 1rem);
  }

  .maintenance-card {
    padding: var(--ui-space-6, 1.5rem);
  }

  .maintenance-icon {
    width: 64px;
    height: 64px;
  }

  .maintenance-title {
    font-size: var(--ui-text-xl, 1.25rem);
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .maintenance-icon {
    animation: none;
  }
}
</style>

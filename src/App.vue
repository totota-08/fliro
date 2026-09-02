<script setup lang="ts">
import LoadingScreen from "@/components/ui/LoadingScreen.vue";
import RouterProgressBar from "@/components/ui/RouterProgressBar.vue";
import AppAnnouncementBanner from "@/components/common/AppAnnouncementBanner.vue";
import { useNavigationState } from "@/composables/useNavigationState";
import { useAuthStore, waitForAuthReady } from "@/store/auth";
import { BetaGatePage, useBetaAccess } from "@/features/beta-gate";
import { subscribeToAppConfig } from "@/features/admin/services/appConfigService";
import type {
  AnnouncementConfig,
  MaintenanceConfig,
} from "@/features/admin/types/admin";
import { onMounted, onBeforeUnmount, ref, computed } from "vue";
import { RouterView, useRoute } from "vue-router";

const isLoading = ref(true);
const { isProjectSwitch } = useNavigationState();
const auth = useAuthStore();
const route = useRoute();
const { isBetaGateEnabled, hasBetaAccess } = useBetaAccess();

// 通知・メンテナンス状態
const announcementConfig = ref<AnnouncementConfig | null>(null);
const maintenanceConfig = ref<MaintenanceConfig | null>(null);
const announcementDismissed = ref(false);

// 通知バナーを表示するかどうか
const shouldShowAnnouncement = computed(() => {
  if (!announcementConfig.value?.enabled) return false;
  if (announcementDismissed.value) return false;
  return true;
});

// 管理者用メンテナンス警告表示
const showMaintenanceWarning = computed(() => {
  // 管理者かつメンテナンス有効時に表示
  // （管理者チェックはuserのカスタムクレームで）
  return maintenanceConfig.value?.enabled === true;
});

// ベータゲートを表示すべきか
const shouldShowBetaGate = computed(() => {
  // ベータゲートが無効なら表示しない
  if (!isBetaGateEnabled.value) return false;

  // 認証準備中は表示しない
  if (!auth.authReady.value) return false;

  // 未ログインなら表示しない（ログインページを見せる）
  if (!auth.isAuthenticated.value) return false;

  // プロフィール取得前は判定できないため表示しない（ゲートのちらつき防止）
  if (!auth.profileReady.value) return false;

  // 認証関連ページにいるなら表示しない
  const authRoutes = [
    "login",
    "signup",
    "passwordReset",
    "passwordResetConfirm",
    "verifyEmail",
  ];
  if (route.name && authRoutes.includes(String(route.name))) return false;

  // ベータアクセス権があれば表示しない
  if (hasBetaAccess.value) return false;

  return true;
});

let appConfigUnsubscribe: (() => void) | null = null;

onMounted(async () => {
  // 認証状態の準備を待つ（プロフィール取得は待たない）
  await waitForAuthReady();
  isLoading.value = false;

  // appConfig購読開始
  appConfigUnsubscribe = subscribeToAppConfig(
    (maintenance) => {
      maintenanceConfig.value = maintenance;
    },
    (announcement) => {
      announcementConfig.value = announcement;
    },
  );
});

onBeforeUnmount(() => {
  // appConfig購読解除
  if (appConfigUnsubscribe) {
    appConfigUnsubscribe();
  }
});
</script>

<template>
  <LoadingScreen :loading="isLoading" />
  <RouterProgressBar />

  <!-- プロジェクト切り替え時のオーバーレイ -->
  <transition name="project-switch-fade">
    <div v-if="isProjectSwitch" class="project-switch-overlay">
      <div class="project-switch-spinner" aria-label="読み込み中"></div>
      <p class="project-switch-text">プロジェクトを切り替え中...</p>
    </div>
  </transition>

  <!-- ベータゲート表示 -->
  <BetaGatePage v-if="shouldShowBetaGate" />

  <!-- App-wide Announcement Banner -->
  <AppAnnouncementBanner
    v-if="shouldShowAnnouncement && announcementConfig"
    :message="announcementConfig.message"
    :type="announcementConfig.type"
    :link="announcementConfig.link"
    :link-text="announcementConfig.linkText"
    :dismissible="announcementConfig.dismissible"
    @dismiss="announcementDismissed = true"
  />

  <!-- Maintenance Mode Warning for Admins -->
  <div v-if="showMaintenanceWarning" class="maintenance-admin-warning">
    メンテナンスモードが有効です。一般ユーザーはアクセスできません。
  </div>

  <!-- 通常のルーティング -->
  <RouterView v-else v-slot="{ Component }">
    <transition name="page-fade">
      <component
        :is="Component"
        :key="
          $route.params.projectId
            ? `project-${$route.params.projectId}`
            : $route.path
        "
      />
    </transition>
  </RouterView>
</template>

<style scoped>
/* プロジェクト切り替えオーバーレイ */
.project-switch-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--ui-z-modal, 50);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-4, 1rem);
  background: rgba(245, 252, 255, 0.95);
  backdrop-filter: blur(4px);
}

.project-switch-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--ui-border-light, rgba(11, 46, 51, 0.1));
  border-top-color: var(--ui-brand-600, #4f7c82);
  border-radius: 50%;
  animation: project-switch-spin 0.8s linear infinite;
}

.project-switch-text {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text-muted, #64748b);
}

@keyframes project-switch-spin {
  to {
    transform: rotate(360deg);
  }
}

/* オーバーレイのトランジション */
.project-switch-fade-enter-active,
.project-switch-fade-leave-active {
  transition: opacity 150ms var(--ui-ease-standard, ease);
}

.project-switch-fade-enter-from,
.project-switch-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .project-switch-spinner {
    animation: none;
    border-top-color: var(--ui-brand-600, #4f7c82);
    border-right-color: var(--ui-brand-600, #4f7c82);
  }
}

/* ページ遷移のトランジション */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 150ms var(--ui-ease-standard, ease);
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}

/* メンテナンス管理者警告 */
.maintenance-admin-warning {
  background: var(--ui-warning, #eab308);
  color: var(--ui-warning-dark, #713f12);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  text-align: center;
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
}
</style>

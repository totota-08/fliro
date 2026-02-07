<script setup lang="ts">
/**
 * AdminDashboardPage - 管理者ダッシュボード
 *
 * 管理者用の設定・管理ページ
 * MFAセッションが無効な場合はAdminMFAGateを表示
 */
import { ref, computed, onMounted, onUnmounted } from "vue";
import AppShell from "@/layouts/AppShell.vue";
import SectionCard from "@/components/ui/SectionCard.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AdminMFAGate from "../components/AdminMFAGate.vue";
import UserSearchPanel from "../components/UserSearchPanel.vue";
import InviteCodeManager from "../components/InviteCodeManager.vue";
import MaintenanceToggle from "../components/MaintenanceToggle.vue";
import AnnouncementEditor from "../components/AnnouncementEditor.vue";
import SampleProjectSelector from "../components/SampleProjectSelector.vue";
import { useAdminAccess } from "../composables/useAdminAccess";
import NotFoundPage from "@/components/errorPage/404.vue";

const {
  session,
  isAdmin,
  hasMFAEnabled,
  loading,
  isSessionValid,
  verifySession,
  clearSession,
} = useAdminAccess();

// タブ管理
type TabId = "users" | "invite-codes" | "app-settings";
const activeTab = ref<TabId>("users");

const tabs: { id: TabId; label: string }[] = [
  { id: "users", label: "ユーザー管理" },
  { id: "invite-codes", label: "招待コード" },
  { id: "app-settings", label: "アプリ設定" },
];

// セッション残り時間の表示
const remainingTime = ref<number>(0);
let timerInterval: ReturnType<typeof setInterval> | null = null;

const formattedRemainingTime = computed(() => {
  const minutes = Math.floor(remainingTime.value / 60);
  const seconds = remainingTime.value % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
});

function updateRemainingTime() {
  if (isSessionValid.value && session.value.expiresAt) {
    // セッションが有効な場合のみ残り時間を計算
    remainingTime.value = Math.max(
      0,
      Math.floor((session.value.expiresAt - Date.now()) / 1000),
    );
  } else {
    remainingTime.value = 0;
  }
}

function handleMFAVerified() {
  verifySession();
  startTimer();
}

function handleLogout() {
  clearSession();
  stopTimer();
}

function startTimer() {
  updateRemainingTime();
  timerInterval = setInterval(updateRemainingTime, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

onMounted(() => {
  if (isSessionValid.value) {
    startTimer();
  }
});

onUnmounted(() => {
  stopTimer();
});
</script>

<template>
  <AppShell>
    <!-- ローディング中 -->
    <div v-if="loading" class="admin-dashboard__loading">
      <div class="admin-dashboard__spinner" />
      <p>読み込み中...</p>
    </div>

    <!-- 管理者でない場合は404を表示（管理者ページの存在を隠す） -->
    <NotFoundPage v-else-if="!isAdmin" />

    <!-- MFA未設定の場合 -->
    <div v-else-if="!hasMFAEnabled" class="admin-dashboard__mfa-required">
      <SectionCard size="md" elevated>
        <div class="admin-dashboard__mfa-required-content">
          <div
            class="admin-dashboard__icon-wrapper admin-dashboard__icon-wrapper--warning"
          >
            <svg
              class="admin-dashboard__icon"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 9V13M12 17H12.01M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </div>
          <h1 class="admin-dashboard__title">2段階認証の設定が必要です</h1>
          <p class="admin-dashboard__description">
            管理者ダッシュボードにアクセスするには、<br />
            まず2段階認証（MFA）を設定してください。
          </p>
          <AppButton variant="primary" to="/account/settings">
            アカウント設定へ
          </AppButton>
        </div>
      </SectionCard>
    </div>

    <!-- MFAゲート -->
    <AdminMFAGate v-else-if="!isSessionValid" @verified="handleMFAVerified" />

    <!-- 管理者ダッシュボード本体 -->
    <div v-else class="admin-dashboard">
      <!-- ヘッダー -->
      <header class="admin-dashboard__header">
        <div class="admin-dashboard__header-content">
          <h1 class="admin-dashboard__page-title">管理者ダッシュボード</h1>
          <p class="admin-dashboard__page-description">
            アプリケーションの設定と管理を行います
          </p>
        </div>
        <div class="admin-dashboard__session-info">
          <span class="admin-dashboard__session-timer">
            セッション残り時間: {{ formattedRemainingTime }}
          </span>
          <AppButton variant="ghost" size="sm" @click="handleLogout">
            ログアウト
          </AppButton>
        </div>
      </header>

      <!-- タブナビゲーション -->
      <nav class="admin-dashboard__tabs" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          role="tab"
          :aria-selected="activeTab === tab.id"
          :class="[
            'admin-dashboard__tab',
            { 'admin-dashboard__tab--active': activeTab === tab.id },
          ]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>

      <!-- タブコンテンツ -->
      <div class="admin-dashboard__content">
        <!-- ユーザー管理タブ -->
        <UserSearchPanel v-if="activeTab === 'users'" />

        <!-- 招待コードタブ -->
        <InviteCodeManager v-if="activeTab === 'invite-codes'" />

        <!-- アプリ設定タブ -->
        <template v-if="activeTab === 'app-settings'">
          <SampleProjectSelector />
          <MaintenanceToggle />
          <AnnouncementEditor />
        </template>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.admin-dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6, 1.5rem);
}

/* ローディング */
.admin-dashboard__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: var(--ui-space-4, 1rem);
  color: var(--ui-text-muted, #64748b);
}

.admin-dashboard__spinner {
  width: 40px;
  height: 40px;
  border-radius: var(--ui-radius-full, 9999px);
  border: 3px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-top-color: var(--ui-brand-600, #4f7c82);
  animation: admin-spinner 0.8s linear infinite;
}

@keyframes admin-spinner {
  to {
    transform: rotate(360deg);
  }
}

/* MFA未設定 */
.admin-dashboard__mfa-required {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
}

.admin-dashboard__mfa-required-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--ui-space-4, 1rem);
  padding: var(--ui-space-6, 1.5rem);
  max-width: 400px;
}

.admin-dashboard__icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: var(--ui-radius-full, 9999px);
}

.admin-dashboard__icon-wrapper--warning {
  background: var(--ui-warning-light, #fef3c7);
}

.admin-dashboard__icon {
  width: 32px;
  height: 32px;
}

.admin-dashboard__icon-wrapper--warning .admin-dashboard__icon {
  color: var(--ui-status-warning, #d97706);
}

.admin-dashboard__title {
  margin: 0;
  font-size: var(--ui-text-xl, 1.25rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.admin-dashboard__description {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  line-height: 1.6;
}

/* ヘッダー */
.admin-dashboard__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--ui-space-4, 1rem);
  flex-wrap: wrap;
}

.admin-dashboard__header-content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.admin-dashboard__page-title {
  margin: 0;
  font-size: var(--ui-text-2xl, 1.5rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.admin-dashboard__page-description {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.admin-dashboard__session-info {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
}

.admin-dashboard__session-timer {
  font-size: var(--ui-text-sm, 0.875rem);
  font-family: var(--ui-font-mono);
  color: var(--ui-text-muted, #64748b);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-md, 0.75rem);
}

/* タブナビゲーション */
.admin-dashboard__tabs {
  display: flex;
  gap: var(--ui-space-1, 0.25rem);
  padding: var(--ui-space-1, 0.25rem);
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-lg, 1rem);
  overflow-x: auto;
}

.admin-dashboard__tab {
  flex: 1;
  min-width: max-content;
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  background: transparent;
  border: none;
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text-muted, #64748b);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.admin-dashboard__tab:hover {
  color: var(--ui-text, #0b2e33);
}

.admin-dashboard__tab--active {
  background: var(--ui-surface, #fff);
  color: var(--ui-text-strong, #0f172a);
  box-shadow: var(--ui-shadow-sm);
}

/* コンテンツ */
.admin-dashboard__content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

/* レスポンシブ */
@media (max-width: 768px) {
  .admin-dashboard__header {
    flex-direction: column;
  }

  .admin-dashboard__session-info {
    width: 100%;
    justify-content: space-between;
  }

  .admin-dashboard__tabs {
    flex-wrap: nowrap;
  }

  .admin-dashboard__tab {
    flex: none;
    padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  }
}
</style>

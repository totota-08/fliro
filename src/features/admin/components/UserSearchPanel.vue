<script setup lang="ts">
/**
 * UserSearchPanel - ユーザー検索・管理者権限管理パネル
 *
 * 機能:
 * - メールアドレスでユーザーを検索（部分一致）
 * - 検索結果をカード形式で表示
 * - 管理者権限の付与/剥奪
 * - MFA未設定ユーザーには管理者権限を付与できない
 */
import { ref } from "vue";
import { getLogger } from "@logtape/logtape";
import AppInput from "@/components/ui/AppInput.vue";
import AppButton from "@/components/ui/AppButton.vue";
import SectionCard from "@/components/ui/SectionCard.vue";
import UserAvatar from "@/components/common/UserAvatar.vue";
import ReauthModal from "./ReauthModal.vue";
import { searchUsers, setUserAdmin } from "../services/adminService";
import type { AdminUserInfo } from "../types/admin";

const logger = getLogger(["features", "admin", "UserSearchPanel"]);

// State
const searchQuery = ref("");
const users = ref<AdminUserInfo[]>([]);
const isSearching = ref(false);
const searchError = ref<string | null>(null);
const updatingUserIds = ref<Set<string>>(new Set());

// 再認証モーダル
const showReauthModal = ref(false);
const pendingAdminChange = ref<{ user: AdminUserInfo; grant: boolean } | null>(
  null,
);

// 検索実行
async function handleSearch() {
  const query = searchQuery.value.trim();
  if (!query) {
    searchError.value = "検索キーワードを入力してください";
    return;
  }

  isSearching.value = true;
  searchError.value = null;

  try {
    users.value = await searchUsers(query);
    if (users.value.length === 0) {
      searchError.value = "該当するユーザーが見つかりませんでした";
    }
  } catch (error) {
    logger.error`ユーザー検索に失敗しました: ${error}`;
    searchError.value =
      "検索中にエラーが発生しました。もう一度お試しください。";
    users.value = [];
  } finally {
    isSearching.value = false;
  }
}

// Enter キーで検索
function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    handleSearch();
  }
}

// 管理者権限の切り替え（再認証が必要）
function toggleAdmin(user: AdminUserInfo) {
  if (!user.hasMFA && !user.isAdmin) {
    // MFA未設定で管理者でない場合は付与不可
    return;
  }

  // 再認証モーダルを表示
  pendingAdminChange.value = { user, grant: !user.isAdmin };
  showReauthModal.value = true;
}

// 再認証キャンセル
function handleReauthCancel() {
  showReauthModal.value = false;
  pendingAdminChange.value = null;
}

// 再認証成功後の処理
async function handleReauthSuccess() {
  showReauthModal.value = false;

  if (!pendingAdminChange.value) return;

  const { user, grant } = pendingAdminChange.value;
  pendingAdminChange.value = null;

  await performAdminChange(user, grant);
}

// 実際の権限変更処理
async function performAdminChange(user: AdminUserInfo, grant: boolean) {
  updatingUserIds.value.add(user.uid);

  try {
    const result = await setUserAdmin(user.uid, grant);
    if (result.success) {
      // ローカルの状態を更新
      user.isAdmin = grant;
      logger.info`ユーザー ${user.email} の管理者権限を ${grant ? "付与" : "剥奪"} しました`;
    } else {
      throw new Error(result.error || "権限の更新に失敗しました");
    }
  } catch (error) {
    logger.error`管理者権限の変更に失敗しました: ${error}`;
    searchError.value = "権限の変更に失敗しました。もう一度お試しください。";
  } finally {
    updatingUserIds.value.delete(user.uid);
  }
}

// ユーザーの権限変更中かどうか
function isUpdating(uid: string): boolean {
  return updatingUserIds.value.has(uid);
}

// MFA未設定で管理者でない場合は付与不可
function canGrantAdmin(user: AdminUserInfo): boolean {
  return user.hasMFA || user.isAdmin;
}
</script>

<template>
  <SectionCard
    title="ユーザー検索"
    subtitle="メールアドレスでユーザーを検索し、管理者権限を管理します"
  >
    <div class="search-section">
      <div class="search-form">
        <AppInput
          v-model="searchQuery"
          type="search"
          placeholder="メールアドレスで検索..."
          :disabled="isSearching"
          @keydown="handleKeydown"
        />
        <AppButton
          variant="primary"
          :loading="isSearching"
          :disabled="isSearching"
          @click="handleSearch"
        >
          検索
        </AppButton>
      </div>

      <!-- エラーメッセージ -->
      <p v-if="searchError" class="search-error" role="alert">
        {{ searchError }}
      </p>
    </div>

    <!-- 検索結果 -->
    <div v-if="users.length > 0" class="user-list">
      <div v-for="user in users" :key="user.uid" class="user-card">
        <div class="user-info">
          <UserAvatar
            :src="user.avatarUrl"
            :name="user.nickname || user.fullName"
            :size="48"
          />
          <div class="user-details">
            <p class="user-name">
              {{ user.nickname || user.fullName || "名前未設定" }}
            </p>
            <p class="user-email">{{ user.email }}</p>
          </div>
        </div>

        <div class="user-badges">
          <!-- MFA バッジ -->
          <span
            :class="[
              'badge',
              user.hasMFA ? 'badge--success' : 'badge--warning',
            ]"
          >
            {{ user.hasMFA ? "MFA有効" : "MFA無効" }}
          </span>

          <!-- 管理者バッジ -->
          <span
            :class="['badge', user.isAdmin ? 'badge--admin' : 'badge--neutral']"
          >
            {{ user.isAdmin ? "管理者" : "一般" }}
          </span>
        </div>

        <div class="user-actions">
          <!-- MFA未設定の警告 -->
          <p v-if="!user.hasMFA && !user.isAdmin" class="mfa-warning">
            MFA未設定のため管理者権限を付与できません
          </p>

          <AppButton
            v-if="user.isAdmin"
            variant="danger-outline"
            size="sm"
            :loading="isUpdating(user.uid)"
            :disabled="isUpdating(user.uid)"
            @click="toggleAdmin(user)"
          >
            権限を剥奪
          </AppButton>
          <AppButton
            v-else
            variant="primary"
            size="sm"
            :loading="isUpdating(user.uid)"
            :disabled="isUpdating(user.uid) || !canGrantAdmin(user)"
            @click="toggleAdmin(user)"
          >
            管理者に設定
          </AppButton>
        </div>
      </div>
    </div>

    <!-- 検索前の状態 -->
    <div v-else-if="!isSearching && !searchError" class="empty-state">
      <p>メールアドレスを入力して検索してください</p>
    </div>

    <!-- 再認証モーダル -->
    <ReauthModal
      :open="showReauthModal"
      :title="
        pendingAdminChange?.grant ? '管理者権限の付与' : '管理者権限の剥奪'
      "
      :description="
        pendingAdminChange?.grant
          ? `${pendingAdminChange?.user?.email} に管理者権限を付与します。この操作にはセキュリティのため再認証が必要です。`
          : `${pendingAdminChange?.user?.email} から管理者権限を剥奪します。この操作にはセキュリティのため再認証が必要です。`
      "
      @close="handleReauthCancel"
      @success="handleReauthSuccess"
    />
  </SectionCard>
</template>

<style scoped>
.search-section {
  margin-bottom: var(--ui-space-6);
}

.search-form {
  display: flex;
  gap: var(--ui-space-3);
  align-items: flex-start;
}

.search-form > :first-child {
  flex: 1;
}

.search-error {
  margin: var(--ui-space-3) 0 0;
  padding: var(--ui-space-3);
  background: var(--ui-danger-light);
  border-radius: var(--ui-radius-sm);
  color: var(--ui-danger-text);
  font-size: var(--ui-text-sm);
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

.user-card {
  display: flex;
  align-items: center;
  gap: var(--ui-space-4);
  padding: var(--ui-space-4);
  background: var(--ui-surface-muted);
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-border-light);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  flex: 1;
  min-width: 0;
}

.user-details {
  min-width: 0;
}

.user-name {
  margin: 0;
  font-weight: var(--ui-font-semibold);
  color: var(--ui-text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  margin: var(--ui-space-1) 0 0;
  font-size: var(--ui-text-sm);
  color: var(--ui-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-badges {
  display: flex;
  gap: var(--ui-space-2);
  flex-shrink: 0;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--ui-space-1) var(--ui-space-2);
  border-radius: var(--ui-radius-full);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-medium);
  white-space: nowrap;
}

.badge--success {
  background: var(--ui-success-light);
  color: var(--ui-success-text);
}

.badge--warning {
  background: var(--ui-warning-light);
  color: var(--ui-warning-text);
}

.badge--admin {
  background: var(--ui-brand-100);
  color: var(--ui-brand-700);
}

.badge--neutral {
  background: var(--ui-surface-muted);
  color: var(--ui-text-muted);
  border: 1px solid var(--ui-border);
}

.user-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--ui-space-2);
  flex-shrink: 0;
}

.mfa-warning {
  margin: 0;
  font-size: var(--ui-text-xs);
  color: var(--ui-warning-dark);
  text-align: right;
  max-width: 180px;
}

.empty-state {
  text-align: center;
  padding: var(--ui-space-8) var(--ui-space-4);
  color: var(--ui-text-muted);
}

/* レスポンシブ対応 */
@media (max-width: 768px) {
  .user-card {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-3);
  }

  .user-info {
    width: 100%;
  }

  .user-badges {
    width: 100%;
    flex-wrap: wrap;
  }

  .user-actions {
    width: 100%;
    align-items: stretch;
  }

  .mfa-warning {
    text-align: left;
    max-width: none;
  }
}
</style>

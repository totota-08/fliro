<script setup lang="ts">
import UserAvatar from "@/components/common/UserAvatar.vue";
import AppButton from "@/components/ui/AppButton.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import SectionCard from "@/components/ui/SectionCard.vue";
import { ROUTE_NAMES } from "@/constants/routes";
import { removeAccount, updateAccountAvatar } from "@/services/accountActions";
import { signOutUser, useAuthStore } from "@/store/auth";
import { getLogger } from "@logtape/logtape";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

const logger = getLogger("app.pages.debug.AuthDebugPage");
const router = useRouter();
const { user, profile } = useAuthStore();

const maskedPassword = "********";
const profileJson = computed(() =>
  JSON.stringify(profile.value ?? {}, null, 2),
);
const avatarUrl = computed(
  () => profile.value?.avatarUrl || user.value?.photoURL || "",
);

const avatarUploading = ref(false);
const avatarMessage = ref("");
const avatarMessageType = ref<"success" | "error">("success");
const deleteLoading = ref(false);
const deleteError = ref("");

const handleAvatarChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  avatarMessage.value = "";

  if (!file) {
    return;
  }

  avatarUploading.value = true;
  try {
    await updateAccountAvatar(file);
    avatarMessage.value = "アイコンを更新しました。";
    avatarMessageType.value = "success";
  } catch (error) {
    logger.error`Failed to upload avatar: ${error}`;
    avatarMessage.value = "アイコンのアップロードに失敗しました。";
    avatarMessageType.value = "error";
  } finally {
    avatarUploading.value = false;
    input.value = "";
  }
};

const handleDeleteAccount = async () => {
  if (deleteLoading.value) return;

  const confirmed = window.confirm(
    "本当にアカウントを削除しますか？この操作は取り消せません。",
  );
  if (!confirmed) return;

  deleteError.value = "";
  deleteLoading.value = true;
  try {
    await removeAccount();
    await router.push({ name: ROUTE_NAMES.login });
  } catch (error) {
    logger.error`Failed to delete account: ${error}`;
    deleteError.value =
      "アカウントを削除できませんでした。再ログイン後に再度お試しください。";
  } finally {
    deleteLoading.value = false;
  }
};

const handleSignOut = async () => {
  await signOutUser();
  await router.push({ name: ROUTE_NAMES.login });
};
</script>

<template>
  <div class="account-shell">
    <PageHeader
      title="アカウント設定"
      :breadcrumbs="[{ label: 'マイページ', to: { name: ROUTE_NAMES.myPage } }]"
    >
      <template #actions>
        <AppButton :to="{ name: ROUTE_NAMES.myPage }" variant="outline">
          マイページへ戻る
        </AppButton>
      </template>
    </PageHeader>

    <div class="account-content">
      <!-- アバター設定 -->
      <SectionCard elevated>
        <template #header>
          <h3 class="section-title">プロフィール画像</h3>
        </template>
        <div class="avatar-section">
          <UserAvatar
            :src="avatarUrl"
            :name="profile?.nickname || profile?.fullName"
            :size="96"
          />
          <div class="avatar-info">
            <p class="avatar-description">
              画像ファイル（PNG / JPG / WEBP
              など）を選択してアイコンを変更できます。
            </p>
            <label class="upload-button">
              <input
                type="file"
                accept="image/*"
                @change="handleAvatarChange"
                :disabled="avatarUploading"
              />
              {{ avatarUploading ? "アップロード中..." : "アイコンを変更" }}
            </label>
            <p
              v-if="avatarMessage"
              class="avatar-message"
              :class="`avatar-message--${avatarMessageType}`"
            >
              {{ avatarMessage }}
            </p>
          </div>
        </div>
      </SectionCard>

      <!-- アカウント情報 -->
      <div class="info-grid">
        <SectionCard>
          <template #header>
            <h3 class="section-title">Firebase認証情報</h3>
          </template>
          <dl class="info-list">
            <div class="info-item">
              <dt>UID</dt>
              <dd>{{ user?.uid ?? "取得中..." }}</dd>
            </div>
            <div class="info-item">
              <dt>メールアドレス</dt>
              <dd>{{ user?.email ?? "未設定" }}</dd>
            </div>
            <div class="info-item">
              <dt>パスワード</dt>
              <dd>{{ user ? maskedPassword : "未ログイン" }}</dd>
            </div>
            <div class="info-item">
              <dt>写真 URL</dt>
              <dd class="truncate">{{ user?.photoURL ?? "未設定" }}</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard>
          <template #header>
            <h3 class="section-title">プロフィール情報</h3>
          </template>
          <dl class="info-list">
            <div class="info-item">
              <dt>本名</dt>
              <dd>{{ profile?.fullName ?? "未登録" }}</dd>
            </div>
            <div class="info-item">
              <dt>ニックネーム</dt>
              <dd>{{ profile?.nickname ?? "未登録" }}</dd>
            </div>
            <div class="info-item">
              <dt>生年月日</dt>
              <dd>{{ profile?.birthday ?? "未登録" }}</dd>
            </div>
            <div class="info-item">
              <dt>アイコン URL</dt>
              <dd class="truncate">{{ profile?.avatarUrl || "未登録" }}</dd>
            </div>
          </dl>
        </SectionCard>
      </div>

      <!-- デバッグ情報 -->
      <SectionCard>
        <template #header>
          <h3 class="section-title">プロフィールデータ (JSON)</h3>
          <p class="section-description">開発者向けのデバッグ情報です。</p>
        </template>
        <pre class="json-view">{{ profileJson }}</pre>
      </SectionCard>

      <!-- アクション -->
      <SectionCard>
        <template #header>
          <h3 class="section-title">アカウント操作</h3>
        </template>
        <div class="account-actions">
          <div class="actions-row">
            <AppButton
              variant="outline"
              @click="router.push({ name: ROUTE_NAMES.home })"
            >
              ホームへ戻る
            </AppButton>
            <AppButton
              variant="outline"
              @click="router.push({ name: ROUTE_NAMES.projectCreate })"
            >
              プロジェクトを作成
            </AppButton>
            <AppButton variant="outline" @click="handleSignOut">
              サインアウト
            </AppButton>
          </div>
          <div class="danger-zone">
            <p class="danger-warning">
              アカウントを削除すると、すべてのデータが完全に削除されます。この操作は取り消せません。
            </p>
            <AppButton
              variant="danger"
              :disabled="deleteLoading"
              @click="handleDeleteAccount"
            >
              {{ deleteLoading ? "削除中..." : "アカウントを削除" }}
            </AppButton>
            <p v-if="deleteError" class="error-message">{{ deleteError }}</p>
          </div>
        </div>
      </SectionCard>
    </div>
  </div>
</template>

<style scoped>
.account-shell {
  min-height: 100vh;
  padding: var(--space-lg) var(--space-xl);
  background: var(--surface);
}

.account-content {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

/* セクションタイトル */
.section-title {
  margin: 0;
  font-size: var(--font-lg);
  color: var(--brand);
}

.section-description {
  margin: var(--space-xs) 0 0;
  color: var(--text-muted);
  font-size: var(--font-sm);
}

/* アバターセクション */
.avatar-section {
  display: flex;
  gap: var(--space-lg);
  align-items: center;
}

.avatar-info {
  flex: 1;
}

.avatar-description {
  margin: 0;
  color: var(--text-muted);
}

.upload-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  margin-top: var(--space-md);
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-full);
  background: var(--brand);
  color: white;
  cursor: pointer;
  font-weight: 600;
  transition: background var(--transition-fast);
}

.upload-button:hover {
  background: var(--brand-strong);
}

.upload-button input {
  display: none;
}

.avatar-message {
  margin-top: var(--space-sm);
  font-weight: 600;
}

.avatar-message--success {
  color: var(--success);
}

.avatar-message--error {
  color: var(--danger);
}

/* 情報グリッド */
.info-grid {
  display: grid;
  gap: var(--space-lg);
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.info-list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.info-item {
  display: flex;
  gap: var(--space-md);
}

.info-item dt {
  flex-shrink: 0;
  width: 120px;
  font-weight: 600;
  color: var(--text-muted);
}

.info-item dd {
  margin: 0;
  word-break: break-all;
  color: var(--brand);
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

/* JSON表示 */
.json-view {
  margin: 0;
  padding: var(--space-md);
  background: var(--surface);
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  overflow-x: auto;
  border: 1px solid var(--border);
}

/* アクション */
.account-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}

.danger-zone {
  padding-top: var(--space-lg);
  border-top: 1px solid var(--border);
}

.danger-warning {
  margin: 0 0 var(--space-md);
  color: var(--danger);
  font-size: var(--font-sm);
}

.error-message {
  margin-top: var(--space-sm);
  color: var(--danger);
  font-weight: 600;
}

/* レスポンシブ */
@media (max-width: 768px) {
  .account-shell {
    padding: var(--space-md);
  }

  .avatar-section {
    flex-direction: column;
    text-align: center;
  }

  .info-item {
    flex-direction: column;
    gap: var(--space-2xs);
  }

  .info-item dt {
    width: auto;
  }

  .actions-row {
    flex-direction: column;
  }
}
</style>

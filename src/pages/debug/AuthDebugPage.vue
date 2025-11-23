<script setup lang="ts">
import UserAvatar from '@/components/common/UserAvatar.vue'
import { ROUTE_NAMES } from '@/constants/routes'
import { removeAccount, updateAccountAvatar } from '@/services/accountActions'
import { signOutUser, useAuthStore } from '@/store/auth'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const { user, profile } = useAuthStore()

const maskedPassword = '********'
const profileJson = computed(() => JSON.stringify(profile.value ?? {}, null, 2))
const avatarUrl = computed(() => profile.value?.avatarUrl || user.value?.photoURL || '')


const avatarUploading = ref(false)
const avatarMessage = ref('')
const deleteLoading = ref(false)
const deleteError = ref('')

const handleAvatarChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  avatarMessage.value = ''

  if (!file) {
    return
  }

  avatarUploading.value = true
  try {
    await updateAccountAvatar(file)
    avatarMessage.value = 'アイコンを更新しました。'
  } catch (error) {
    console.error(error)
    avatarMessage.value = `アイコンのアップロードに失敗しました。${error}`
  } finally {
    avatarUploading.value = false
    input.value = ''
  }
}

const handleDeleteAccount = async () => {
  if (deleteLoading.value) return

  const confirmed = window.confirm('本当にアカウントを削除しますか？この操作は取り消せません。')
  if (!confirmed) return

  deleteError.value = ''
  deleteLoading.value = true
  try {
    await removeAccount()
    await router.push({ name: ROUTE_NAMES.login })
  } catch (error) {
    console.error(error)
    deleteError.value =
      `アカウントを削除できませんでした。再ログイン後に再度お試しください。${error}`
  } finally {
    deleteLoading.value = false
  }
}

const handleSignOut = async () => {
  await signOutUser()
  await router.push({ name: ROUTE_NAMES.login })
}
</script>

<template>
  <section class="debug-card">
    <header>
      <h1>UserInfo</h1>
    </header>

    <section class="avatar-panel">
      <UserAvatar :src="avatarUrl" :name="profile?.nickname || profile?.fullName" :size="96" />
      <div class="avatar-panel__content">
        <p>画像ファイル（PNG / JPG / WEBP など）を選択してアイコンを変更できます。</p>
        <label class="upload-button">
          <input type="file" accept="image/*" @change="handleAvatarChange" :disabled="avatarUploading" />
          {{ avatarUploading ? 'アップロード中...' : 'アイコンをアップロード' }}
        </label>
        <p v-if="avatarMessage" class="avatar-message">{{ avatarMessage }}</p>
      </div>
    </section>

    <div class="debug-grid">
      <article class="debug-panel">
        <h2>Firebase User</h2>
        <dl>
          <dt>UID</dt>
          <dd>{{ user?.uid ?? '取得中...' }}</dd>

          <dt>メールアドレス</dt>
          <dd>{{ user?.email ?? '未設定' }}</dd>

          <dt>パスワード</dt>
          <dd>{{ user ? maskedPassword : '未ログイン' }}</dd>

          <dt>写真 URL</dt>
          <dd>{{ user?.photoURL ?? '未設定' }}</dd>
        </dl>
      </article>

      <article class="debug-panel">
        <h2>プロフィール</h2>
        <dl>
          <dt>本名</dt>
          <dd>{{ profile?.fullName ?? '未登録' }}</dd>

          <dt>ニックネーム</dt>
          <dd>{{ profile?.nickname ?? '未登録' }}</dd>

          <dt>生年月日</dt>
          <dd>{{ profile?.birthday ?? '未登録' }}</dd>

          <dt>アイコン URL</dt>
          <dd>{{ profile?.avatarUrl || '未登録' }}</dd>
        </dl>
      </article>
    </div>

    <article class="debug-panel">
      <h2>Raw Profile JSON</h2>
      <pre>{{ profileJson }}</pre>
    </article>

    <div class="debug-actions">
      <button
        type="button"
        class="debug-button"
        @click="router.push({ name: ROUTE_NAMES.home })"
      >
        ホームへ戻る
      </button>
      <button
        type="button"
        class="debug-button"
        @click="router.push({ name: ROUTE_NAMES.projectCreate })"
      >
        プロジェクトを作成
      </button>
      <button type="button" class="debug-button" @click="handleSignOut">
        サインアウト
      </button>
      <button
        type="button"
        class="debug-button debug-button--danger"
        :disabled="deleteLoading"
        @click="handleDeleteAccount"
      >
        {{ deleteLoading ? 'アカウント削除中...' : 'アカウントを削除' }}
      </button>
    </div>

    <p v-if="deleteError" class="delete-error">{{ deleteError }}</p>
  </section>
</template>

<style scoped>
.debug-card {
  max-width: 900px;
  margin: 0 auto;
  padding: 2.5rem;
  background: var(--surface-elevated);
  border-radius: 1.5rem;
  box-shadow: 0 24px 50px rgba(11, 46, 51, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.avatar-panel {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: #fff;
}

.avatar-panel__content {
  flex: 1;
}



.upload-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.65rem 1.25rem;
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
}

.upload-button input {
  display: none;
}

.avatar-message {
  margin-top: 0.5rem;
  font-weight: 600;
  color: var(--primary-strong);
}

.debug-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.debug-panel {
  border: 1px solid var(--border);
  border-radius: 1rem;
  padding: 1.5rem;
  background: #fff;
}

dl {
  margin: 0;
  display: grid;
  grid-template-columns: 120px 1fr;
  row-gap: 0.5rem;
  column-gap: 0.5rem;
}

dt {
  font-weight: 600;
  color: var(--text-muted);
}

dd {
  margin: 0;
  word-break: break-all;
}

pre {
  margin: 0;
  padding: 1rem;
  background: var(--surface);
  border-radius: 0.75rem;
  font-size: 0.85rem;
  overflow-x: auto;
}

.debug-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: flex-end;
}

.debug-button {
  border: none;
  border-radius: 0.75rem;
  padding: 0.85rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  background: var(--primary);
  color: #fff;
}

.debug-button--danger {
  background: #d64545;
}

.debug-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.delete-error {
  color: #d64545;
  font-weight: 600;
  text-align: right;
}
</style>

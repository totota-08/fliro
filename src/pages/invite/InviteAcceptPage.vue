<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import { ROUTE_NAMES } from '@/constants/routes'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { redeemInvite } from '@/services/projectInvites'
import { useAuthStore } from '@/store/auth'
import { signInAnonymously } from 'firebase/auth'

const route = useRoute()
const router = useRouter()
const { user } = useAuthStore()
const token = String(route.params.token || '')
const loading = ref(true)
const errorMsg = ref('')
const projectPreview = ref<{ projectId: string; name?: string; requiresPassword?: boolean } | null>(null)
const requiresPassword = ref(false)
const passwordInput = ref('')

onMounted(async () => {
  try {
    const inviteSnap = await getDoc(doc(db, 'projectInvites', token))
    if (!inviteSnap.exists()) {
      errorMsg.value = '招待リンクが無効です。'
      return
    }
    const invite = inviteSnap.data() as { projectId: string; passwordHash?: string | null }
    const projectSnap = await getDoc(doc(db, 'projects', invite.projectId))
    projectPreview.value = {
      projectId: invite.projectId,
      name: projectSnap.exists() ? (projectSnap.data().name as string) : undefined,
      requiresPassword: Boolean(invite.passwordHash),
    }
    requiresPassword.value = Boolean(invite.passwordHash)
  } catch (error) {
    console.error(error)
    errorMsg.value = '招待情報を読み込めませんでした。'
  } finally {
    loading.value = false
  }
})

async function handleJoin() {
  if (!projectPreview.value) return
  if (requiresPassword.value && !passwordInput.value.trim()) {
    errorMsg.value = 'パスワードを入力してください。'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    let inviteUser = user.value
    if (!inviteUser) {
      const credential = await signInAnonymously(auth)
      inviteUser = credential.user
    }
    if (!inviteUser) {
      throw new Error('anonymous-signin-failed')
    }
    const projectId = await redeemInvite(token, inviteUser.uid, inviteUser.email ?? '', {
      password: passwordInput.value.trim() || undefined,
    })
    await router.push({ name: ROUTE_NAMES.projectDashboard, params: { projectId } })
  } catch (error) {
    console.error(error)
    if (error instanceof Error && error.message === 'invite-password-invalid') {
      errorMsg.value = 'パスワードが正しくありません。'
    } else if (error instanceof Error && error.message === 'invite-password-required') {
      errorMsg.value = 'このリンクにはパスワードが必要です。'
    } else {
      errorMsg.value = '招待の承認に失敗しました。'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="invite-shell">
    <section class="invite-card">
      <p class="invite-eyebrow">Project Invitation</p>
      <h1>Teamie プロジェクトへの招待</h1>

      <div v-if="loading">読み込み中...</div>
      <p v-else-if="errorMsg" class="error">{{ errorMsg }}</p>

      <template v-else>
        <p>以下のプロジェクトに参加しますか？</p>
        <dl>
          <div>
            <dt>招待先</dt>
            <dd>{{ projectPreview?.name || projectPreview?.projectId }}</dd>
          </div>
          <div>
            <dt>パスワード</dt>
            <dd>{{ requiresPassword ? '入力が必要です' : '不要' }}</dd>
          </div>
        </dl>

        <div v-if="requiresPassword" class="password-block">
          <label>
            <span>参加パスワード</span>
            <input
              v-model="passwordInput"
              type="password"
              placeholder="リンク作成時のパスワードを入力"
            />
          </label>
        </div>

        <div class="actions">
          <AppButton variant="secondary" :to="{ name: ROUTE_NAMES.home }">ホームに戻る</AppButton>
          <AppButton variant="primary" :loading="loading" @click="handleJoin">
            {{ user ? '参加する' : 'アカウントを作成して参加' }}
          </AppButton>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.invite-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at top, #e3f6f8, #fff);
  padding: 2rem;
}

.invite-card {
  background: #fff;
  border: 2px solid #b8e3e9;
  border-radius: 1.5rem;
  padding: 2rem;
  max-width: 520px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.invite-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.3em;
  color: #4f7c82;
  margin: 0;
}

h1 {
  margin: 0;
  color: #0b2e33;
}

dl {
  margin: 0;
  display: grid;
  gap: 0.5rem;
}

dt {
  font-size: 0.85rem;
  color: #4f7c82;
}

dd {
  margin: 0;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.password-block {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.password-block span {
  font-weight: 600;
  color: #0b2e33;
}

.password-block input {
  border: 2px solid #b8e3e9;
  border-radius: 0.9rem;
  padding: 0.75rem 1rem;
  font-size: 1rem;
}

.password-block input:focus {
  outline: none;
  border-color: #4f7c82;
  box-shadow: 0 0 0 3px rgba(79, 124, 130, 0.2);
}

.error {
  color: #d64545;
  font-weight: 600;
}
</style>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import AuthBrand from '@/components/ui/AuthBrand.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { verifyEmailWithCode } from '@/services/accountActions'
import { ROUTE_NAMES } from '@/constants/routes'

const route = useRoute()
const router = useRouter()
const oobCode = ref<string | null>(null)
const loading = ref(true)
const success = ref(false)
const errorMessage = ref('')
const continueUrl = computed(() => (typeof route.query.continueUrl === 'string' ? route.query.continueUrl : null))

onMounted(async () => {
  const code = route.query.oobCode
  const mode = route.query.mode

  if (mode === 'resetPassword') {
    router.replace({
      name: ROUTE_NAMES.passwordResetConfirm,
      query: route.query,
    })
    return
  }

  if (mode !== 'verifyEmail') {
    errorMessage.value = 'メール認証用リンクではありません。'
    loading.value = false
    return
  }

  if (typeof code !== 'string') {
    errorMessage.value = '認証コードが無効です。再度メールのリンクからアクセスしてください。'
    loading.value = false
    return
  }

  oobCode.value = code

  try {
    await verifyEmailWithCode(code)
    success.value = true
  } catch (error) {
    console.error(error)
    errorMessage.value = '認証に失敗しました。リンクの有効期限が切れている可能性があります。'
  } finally {
    loading.value = false
  }
})

const goToLogin = () => router.push({ name: ROUTE_NAMES.login })
const goToContinue = () => {
  if (continueUrl.value) {
    window.location.assign(continueUrl.value)
    return
  }
  goToLogin()
}
</script>

<template>
  <div class="action-shell">
    <div class="action-card">
      <AuthBrand
        title="メール認証"
        :description="success ? 'メールアドレスの認証が完了しました。' : 'メールアドレスを確認しています。'"
      />

      <div class="action-body">
        <p v-if="loading">メール認証を処理しています...</p>
        <template v-else>
          <p v-if="success">
            これでアカウントの登録が完了しました。
            {{ continueUrl ? '続行先に移動してください。' : 'ログイン画面に戻ってサインインしてください。' }}
          </p>
          <p v-if="errorMessage" class="action-error">{{ errorMessage }}</p>
        </template>
      </div>

      <div class="action-footer">
        <AppButton v-if="success" variant="primary" @click="goToContinue">
          {{ continueUrl ? '続行する' : 'ログインへ' }}
        </AppButton>
        <RouterLink v-else :to="{ name: ROUTE_NAMES.passwordReset }">ヘルプを見る</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.action-shell {
  min-height: calc(100vh - 4rem);
  background: linear-gradient(135deg, rgba(184, 227, 233, 0.35), #fff, rgba(147, 177, 181, 0.35));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.action-card {
  width: min(460px, 100%);
  background: #fff;
  border-radius: 1.5rem;
  padding: 2.25rem;
  border: 1px solid rgba(147, 177, 181, 0.35);
  box-shadow: 0 40px 70px rgba(11, 46, 51, 0.1);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.action-body {
  color: #4f7c82;
  line-height: 1.7;
}

.action-error {
  background: rgba(214, 69, 69, 0.08);
  border: 1px solid rgba(214, 69, 69, 0.35);
  color: #d64545;
  border-radius: 0.85rem;
  padding: 0.75rem 1rem;
  font-weight: 600;
}

.action-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  align-items: center;
}

.action-footer a {
  font-weight: 600;
  color: #4f7c82;
}

.action-footer a:hover {
  color: #0b2e33;
}
</style>

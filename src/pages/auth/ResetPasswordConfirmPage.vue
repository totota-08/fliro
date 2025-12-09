<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import AuthBrand from '@/components/ui/AuthBrand.vue'
import AuthFormField from '@/components/ui/AuthFormField.vue'
import { ROUTE_NAMES } from '@/constants/routes'
import { finalizePasswordReset } from '@/services/accountActions'
import { getLogger } from '@logtape/logtape'
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

const logger = getLogger('app.pages.auth.ResetPasswordConfirm')

const router = useRouter()
const route = useRoute()

const form = reactive({
  password: '',
  confirmPassword: '',
})

const loading = ref(false)
const success = ref(false)
const errorMessage = ref('')
const oobCode = computed(() => (typeof route.query.oobCode === 'string' ? route.query.oobCode : ''))
const continueUrl = computed(() => (typeof route.query.continueUrl === 'string' ? route.query.continueUrl : null))
const mode = computed(() => route.query.mode)


const isValid = computed(() => {
  return form.password.length >= 6 && form.password === form.confirmPassword
})

const handleSubmit = async () => {
  if (!isValid.value || loading.value) return
  if (!oobCode.value || mode.value !== 'resetPassword') {
    errorMessage.value = 'パスワード再設定リンクが無効です。'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    await finalizePasswordReset(oobCode.value, form.password)
    success.value = true
  } catch (error) {
    logger.error`Password reset failed: ${error}`
    errorMessage.value = '再設定に失敗しました。リンクの有効期限が切れている可能性があります。'
  } finally {
    loading.value = false
  }
}

const continueAfterReset = () => {
  if (continueUrl.value) {
    window.location.assign(continueUrl.value)
  } else {
    router.push({ name: ROUTE_NAMES.login })
  }
}
</script>

<template>
  <div class="reset-shell">
    <div class="reset-card">
      <AuthBrand title="パスワード再設定" description="新しいパスワードを入力してください。" />

      <form v-if="!success" class="reset-form" @submit.prevent="handleSubmit">
        <AuthFormField
          v-model="form.password"
          label="新しいパスワード"
          type="password"
          placeholder="8文字以上"
          hint="8文字以上、英数字を含む"
          show-toggle
          required
        />

        <AuthFormField
          v-model="form.confirmPassword"
          label="新しいパスワード（確認）"
          type="password"
          placeholder="もう一度入力"
          show-toggle
          required
        />

        <p v-if="errorMessage" class="reset-error">{{ errorMessage }}</p>

        <AppButton type="submit" variant="primary" block :disabled="!isValid || loading" :loading="loading">
          パスワードを更新
        </AppButton>
      </form>

      <div v-else class="reset-success">
        <p>
          パスワードを更新しました。
          {{ continueUrl ? '続行先に移動してください。' : '新しいパスワードでログインしてください。' }}
        </p>
        <AppButton variant="primary" @click="continueAfterReset">
          {{ continueUrl ? '続行する' : 'ログインへ戻る' }}
        </AppButton>
      </div>

      <p class="reset-helper">
        リンクが無効な場合は
        <RouterLink :to="{ name: ROUTE_NAMES.passwordReset }">再度メールを送信する</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.reset-shell {
  min-height: calc(100vh - 4rem);
  background: linear-gradient(135deg, rgba(184, 227, 233, 0.35), #fff, rgba(147, 177, 181, 0.35));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.reset-card {
  width: min(500px, 100%);
  background: #fff;
  border-radius: 1.5rem;
  padding: 2.5rem;
  border: 1px solid rgba(147, 177, 181, 0.35);
  box-shadow: 0 40px 70px rgba(11, 46, 51, 0.1);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.reset-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.reset-success {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: rgba(79, 124, 130, 0.08);
  border: 1px solid rgba(79, 124, 130, 0.2);
  border-radius: 0.85rem;
  padding: 1rem;
  color: #0b2e33;
}

.reset-error {
  background: rgba(214, 69, 69, 0.08);
  border: 1px solid rgba(214, 69, 69, 0.35);
  color: #d64545;
  border-radius: 0.85rem;
  padding: 0.75rem 1rem;
  font-weight: 600;
}

.reset-helper {
  text-align: center;
  color: #4f7c82;
}

.reset-helper a {
  font-weight: 600;
  color: #4f7c82;
}

.reset-helper a:hover {
  color: #0b2e33;
}
</style>

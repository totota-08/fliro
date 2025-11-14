<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AuthBrand from '@/components/ui/AuthBrand.vue'
import AuthFormField from '@/components/ui/AuthFormField.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { requestPasswordReset } from '@/services/accountActions'
import { ROUTE_NAMES } from '@/constants/routes'

const email = ref('')
const loading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const isValid = computed(() => email.value.includes('@'))

const handleSubmit = async () => {
  if (!isValid.value || loading.value) return

  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await requestPasswordReset(email.value)
    successMessage.value = 'パスワード再設定用のメールを送信しました。受信ボックスをご確認ください。'
  } catch (error) {
    console.error(error)
    errorMessage.value = 'メールを送信できませんでした。時間を置いて再度お試しください。'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="reset-shell">
    <div class="reset-card">
      <AuthBrand title="パスワード再設定" description="登録済みのメールアドレスを入力してください。" />

      <form class="reset-form" @submit.prevent="handleSubmit">
        <AuthFormField v-model="email" label="メールアドレス" type="email" placeholder="you@example.com" required />

        <p v-if="successMessage" class="reset-success">{{ successMessage }}</p>
        <p v-if="errorMessage" class="reset-error">{{ errorMessage }}</p>

        <AppButton type="submit" variant="primary" block :disabled="!isValid || loading" :loading="loading">
          再設定メールを送信
        </AppButton>
      </form>

      <p class="reset-helper">
        ログイン画面に戻る
        <RouterLink :to="{ name: ROUTE_NAMES.login }">ログイン</RouterLink>
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
  width: min(460px, 100%);
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
  background: rgba(79, 124, 130, 0.1);
  border: 1px solid rgba(79, 124, 130, 0.2);
  color: #0b2e33;
  border-radius: 0.85rem;
  padding: 0.85rem 1rem;
  font-weight: 600;
}

.reset-error {
  background: rgba(214, 69, 69, 0.08);
  border: 1px solid rgba(214, 69, 69, 0.35);
  color: #d64545;
  border-radius: 0.85rem;
  padding: 0.85rem 1rem;
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

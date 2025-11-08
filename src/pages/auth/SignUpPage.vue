<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import AuthBrand from '@/components/ui/AuthBrand.vue'
import AuthFormField from '@/components/ui/AuthFormField.vue'
import { createAccount, authenticateWithProvider } from '@/services/accountActions'
import { ROUTE_NAMES } from '@/constants/routes'
import type { SocialProvider } from '@/types/auth'

const router = useRouter()
const route = useRoute()

const form = reactive({
  fullName: '',
  nickname: '',
  birthday: '',
  email: '',
  password: '',
})

const loading = ref(false)
const providerLoading = ref<SocialProvider | null>(null)
const agreeTerms = ref(false)
const errorMessage = ref('')

const isValid = computed(() => {
  return (
    agreeTerms.value &&
    form.fullName.trim().length > 1 &&
    form.nickname.trim().length > 1 &&
    Boolean(form.birthday) &&
    form.email.includes('@') &&
    form.password.length >= 6
  )
})

const redirectPath = computed(() => {
  return (route.query.redirect as string) || { name: ROUTE_NAMES.authDebug }
})

const handleSubmit = async () => {
  if (!isValid.value || loading.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    await createAccount({ ...form })
    await router.push(redirectPath.value)
  } catch (error) {
    console.error(error)
    errorMessage.value = mapFirebaseError(error)
  } finally {
    loading.value = false
  }
}

const handleProvider = async (provider: SocialProvider) => {
  if (providerLoading.value) return

  providerLoading.value = provider
  errorMessage.value = ''

  try {
    await authenticateWithProvider(provider)
    await router.push(redirectPath.value)
  } catch (error) {
    console.error(error)
    errorMessage.value = mapFirebaseError(error)
  } finally {
    providerLoading.value = null
  }
}

function mapFirebaseError(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) {
    const code = String((error as { code?: string }).code)
    if (code === 'auth/email-already-in-use') return 'このメールアドレスは既に登録されています。'
    if (code === 'auth/invalid-email') return 'メールアドレスの形式を確認してください。'
    if (code === 'auth/weak-password') return 'パスワードは 6 文字以上で設定してください。'
  }
  return 'アカウントの作成に失敗しました。時間を置いて再度お試しください。'
}
</script>

<template>
  <div class="signup-shell">
    <div class="signup-card">
      <div class="signup-card__header">
        <AuthBrand title="アカウント作成" description="無料でアカウントを作成してチームでの協働を始めましょう" />
      </div>

      <form class="signup-form" @submit.prevent="handleSubmit">
        <AuthFormField v-model="form.fullName" label="本名" type="text" placeholder="山田 太郎" required />

        <AuthFormField v-model="form.nickname" label="ニックネーム" type="text" placeholder="たろー" required />

        <AuthFormField v-model="form.birthday" label="生年月日" type="date" required />

        <AuthFormField
          v-model="form.email"
          label="メールアドレス"
          type="email"
          placeholder="example@company.com"
          required
        />

        <AuthFormField
          v-model="form.password"
          label="パスワード"
          type="password"
          placeholder="8文字以上"
          hint="8文字以上、英数字を含む"
          required
        />

        <label class="terms">
          <input v-model="agreeTerms" type="checkbox" />
          <span>
            <RouterLink to="/terms">利用規約</RouterLink>と
            <RouterLink to="/privacy">プライバシーポリシー</RouterLink>に同意します
          </span>
        </label>

        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>

        <AppButton
          type="submit"
          variant="primary"
          block
          :disabled="!isValid || loading"
          :loading="loading"
        >
          アカウントを作成
        </AppButton>
      </form>

      <div class="divider">
        <span>または</span>
      </div>

      <AppButton
        variant="outline"
        block
        :disabled="Boolean(providerLoading) && providerLoading !== 'google'"
        :loading="providerLoading === 'google'"
        @click="handleProvider('google')"
      >
        Googleで登録
      </AppButton>

      <footer class="signup-footer">
        <p>
          すでにアカウントをお持ちの場合は
          <RouterLink :to="{ name: ROUTE_NAMES.login }">ログイン</RouterLink>
        </p>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.signup-shell {
  min-height: calc(100vh - 4rem);
  background: linear-gradient(135deg, rgba(184, 227, 233, 0.35), #fff, rgba(147, 177, 181, 0.35));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.signup-card {
  width: min(480px, 100%);
  background: #fff;
  border-radius: 1.5rem;
  padding: 2.25rem;
  border: 1px solid rgba(147, 177, 181, 0.35);
  box-shadow: 0 40px 70px rgba(11, 46, 51, 0.12);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.signup-card__header {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.signup-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.terms {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  font-size: 0.9rem;
  color: #4f7c82;
}

.terms input {
  margin-top: 0.25rem;
}

.terms a {
  color: #4f7c82;
  font-weight: 600;
}

.terms a:hover {
  color: #0b2e33;
}

.form-error {
  background: rgba(214, 69, 69, 0.08);
  border: 1px solid rgba(214, 69, 69, 0.35);
  color: #d64545;
  padding: 0.75rem 1rem;
  border-radius: 0.9rem;
  font-weight: 600;
}

.divider {
  position: relative;
  text-align: center;
  color: #93b1b5;
  font-size: 0.85rem;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 1px;
  background: rgba(147, 177, 181, 0.5);
}

.divider span {
  background: #fff;
  padding: 0 0.75rem;
  position: relative;
  font-weight: 600;
}

.signup-footer {
  text-align: center;
  font-size: 0.95rem;
  color: #4f7c82;
}

.signup-footer a {
  font-weight: 600;
  color: #4f7c82;
}

.signup-footer a:hover {
  color: #0b2e33;
}

@media (max-width: 600px) {
  .signup-card {
    padding: 2rem 1.5rem;
  }
}
</style>

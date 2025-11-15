<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import AuthProviderButtons from '@/components/ui/AuthProviderButtons.vue'
import AuthBrand from '@/components/ui/AuthBrand.vue'
import AuthFormField from '@/components/ui/AuthFormField.vue'
import {
  authenticateWithEmail,
  authenticateWithProvider,
} from '@/services/accountActions'
import { ROUTE_NAMES } from '@/constants/routes'
import type { SocialProvider } from '@/types/auth'
import { fetchProfile } from '@/firebase/authService'
import { auth } from '@/firebase/config'

const router = useRouter()
const route = useRoute()

const form = reactive({
  email: '',
  password: '',
})

const rememberMe = ref(false)
const loading = ref(false)
const providerLoading = ref<SocialProvider | null>(null)
const errorMessage = ref('')

const redirectTarget = computed(() => {
  return (route.query.redirect as string) || { name: ROUTE_NAMES.myPage }
})

const providers: { id: SocialProvider; label: string; icon: string }[] = [
  { id: 'google', label: 'Google でログイン', icon: 'google' },
  { id: 'github', label: 'GitHub でログイン', icon: 'github' },
]
const checksetUp = async () => {
  const user = auth.currentUser
  if (!user) return

  const profile = await fetchProfile(user.uid)
  if (profile && profile.setUp === false) {
    await router.push({ name: ROUTE_NAMES.signup, query: { setup: 'false' } })
    return
  }
  await router.push(redirectTarget.value)
}
const handleSubmit = async () => {
  if (loading.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    await authenticateWithEmail({ ...form })
    await checksetUp()
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
    await checksetUp()
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
    if (code === 'auth/invalid-credential') return 'メールアドレスまたはパスワードが正しくありません。'
    if (code === 'auth/user-disabled') return 'このアカウントは無効化されています。'
    if (code === 'auth/too-many-requests') return '試行回数が多すぎます。しばらく待ってから再度お試しください。'
  }
  return 'ログインできませんでした。時間を置いて再度お試しください。'
}
</script>

<template>
  <div class="login-hero">
    <div class="login-card">
      <AuthBrand title="ログイン" description="アカウントにログインしてください" />

      <form class="login-form" @submit.prevent="handleSubmit">
        <AuthFormField
          v-model="form.email"
          label="メールアドレス"
          type="email"
          placeholder="you@example.com"
          autocomplete="email"
          required
        />

        <AuthFormField
          v-model="form.password"
          label="パスワード"
          type="password"
          placeholder="••••••••"
          autocomplete="current-password"
          required
        />

        <div class="form-assist">
          <label class="remember">
            <input v-model="rememberMe" type="checkbox" />
            <span>ログイン状態を保持</span>
          </label>
          <RouterLink :to="{ name: ROUTE_NAMES.passwordReset }">
            パスワードを忘れた場合
          </RouterLink>
        </div>

        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>

        <AppButton
          type="submit"
          variant="primary"
          block
          :disabled="loading"
          :loading="loading"
        >
          ログイン
        </AppButton>
      </form>

      <div class="divider">
        <span>または</span>
      </div>

      <AuthProviderButtons
        class="provider-section"
        :providers="providers"
        :loading="providerLoading"
        @select="handleProvider"
      />

      <p class="login-helper">
        アカウントをお持ちでない場合
        <RouterLink :to="{ name: ROUTE_NAMES.signup }">新規登録</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-hero {
  min-height: calc(100vh - 6rem);
  padding: 3rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #b8e3e9, #fff 45%, #93b1b5);
}

.login-card {
  width: min(480px, 100%);
  background: #fff;
  border-radius: 1.5rem;
  padding: 2.5rem;
  border: 1px solid rgba(147, 177, 181, 0.4);
  box-shadow: 0 40px 80px rgba(11, 46, 51, 0.12);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-assist {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.9rem;
}

.remember {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #4f7c82;
}

.remember input {
  width: 16px;
  height: 16px;
}

.form-assist a {
  color: #4f7c82;
  text-decoration: none;
}

.form-assist a:hover {
  color: #0b2e33;
}

.form-error {
  background: rgba(214, 69, 69, 0.1);
  border: 1px solid rgba(214, 69, 69, 0.3);
  color: #d64545;
  padding: 0.75rem 1rem;
  border-radius: 0.8rem;
  font-weight: 600;
}

.divider {
  margin: 2rem 0 1.5rem;
  text-align: center;
  position: relative;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  height: 1px;
  width: 100%;
  background: rgba(147, 177, 181, 0.6);
}

.divider span {
  display: inline-block;
  padding: 0 0.75rem;
  background: #fff;
  position: relative;
  color: #93b1b5;
  font-weight: 600;
}

.social-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.social-btn {
  width: 100%;
  padding: 0.85rem 1rem;
  border-radius: 0.9rem;
  border: 2px solid #93b1b5;
  background: transparent;
  font-weight: 600;
  color: #0b2e33;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
}

.social-btn:hover:not(:disabled) {
  background: #b8e3e9;
}

.social-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.social-icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-size: contain;
  background-repeat: no-repeat;
}

.social-icon[data-icon='google'] {
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path fill="%234285F4" d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z"/><path fill="%2334A853" d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0010 20z"/><path fill="%23FBBC05" d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z"/><path fill="%23EA4335" d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.19 5.736 7.395 3.977 10 3.977z"/></svg>');
}

.social-icon[data-icon='github'] {
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="%230B2E33" viewBox="0 0 24 24"><path d="M12 0a12 12 0 00-3.79 23.4c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.05-1.61-4.05-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.21.09 1.84 1.25 1.84 1.25 1.07 1.84 2.8 1.31 3.48 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.51.12-3.14 0 0 1.01-.32 3.3 1.23a11.37 11.37 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.63.24 2.84.12 3.14.77.84 1.24 1.91 1.24 3.22 0 4.63-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.23v3.31c0 .32.22.69.82.58A12 12 0 0012 0z" /></svg>');
}

.login-helper {
  margin-top: 1.75rem;
  text-align: center;
  color: #4f7c82;
}

.login-helper a {
  font-weight: 600;
  color: #4f7c82;
}

.login-helper a:hover {
  color: #0b2e33;
}

.provider-section {
  margin-top: 1rem;
}

@media (max-width: 640px) {
  .login-card {
    padding: 2rem;
  }

  .login-hero {
    padding: 2rem 1.25rem;
  }
}
</style>

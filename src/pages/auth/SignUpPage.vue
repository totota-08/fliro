<script setup lang="ts">
import { computed, reactive, ref, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import AuthBrand from '@/components/ui/AuthBrand.vue'
import AuthFormField from '@/components/ui/AuthFormField.vue'
import AuthProviderButtons from '@/components/ui/AuthProviderButtons.vue'
import {
  authenticateWithProvider,
  completeProfileSetup,
  updateAccountAvatar,
} from '@/services/accountActions'
import {
  fetchProfile,
  refreshCurrentUser,
  registerCredentials,
  resendVerificationEmail,
} from '@/firebase/authService'
import { ROUTE_NAMES } from '@/constants/routes'
import type { SocialProvider } from '@/types/auth'
import { auth } from '@/firebase/config'

const router = useRouter()
const route = useRoute()

type SignUpStep = 'credentials' | 'verify' | 'profile'

const currentStep = ref<SignUpStep>('credentials')
const credentialForm = reactive({
  email: '',
  password: '',
})
const profileForm = reactive({
  fullName: '',
  nickname: '',
  birthday: '',
  jobRole: '',
  jobTitle: '',
})

const providerLoading = ref<SocialProvider | null>(null)
const credentialLoading = ref(false)
const profileLoading = ref(false)
const resendLoading = ref(false)
const verificationChecking = ref(false)
const credentialError = ref('')
const verificationMessage = ref('')
const verificationError = ref('')
const profileError = ref('')
const credentialEmail = ref('')

const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)

onMounted(async () => {
  const user = auth.currentUser
  if (route.query.setup === 'false' && user) {
    const profile = await fetchProfile(user.uid)
    if (profile && !profile.setUp) {
      currentStep.value = 'profile'
      hydrateProfileFromUser()
    }
  }
})

const hydrateProfileFromUser = () => {
  const user = auth.currentUser
  if (!user) return

  if (!profileForm.fullName && user.displayName) {
    profileForm.fullName = user.displayName
  }

  if (!profileForm.nickname && user.displayName) {
    profileForm.nickname = user.displayName
  }

  if (!credentialEmail.value && user.email) {
    credentialEmail.value = user.email
  }
}

const providerOptions: { id: SocialProvider; label: string; icon: string }[] = [
  { id: 'google', label: 'Googleで登録', icon: 'google' },
  { id: 'github', label: 'GitHubで登録', icon: 'github' },
]

const jobOptions = [
  { value: '', label: '職業を選択してください' },
  { value: 'engineer', label: 'エンジニア' },
  { value: 'designer', label: 'デザイナー' },
  { value: 'product', label: 'プロダクトマネージャー' },
  { value: 'marketing', label: 'マーケター' },
  { value: 'sales', label: '営業' },
  { value: 'cs', label: 'カスタマーサクセス' },
  { value: 'other', label: 'その他' },
]

const stepOrder: SignUpStep[] = ['credentials', 'verify', 'profile']
const stepLabels: Record<SignUpStep, string> = {
  credentials: 'メールアドレス登録',
  verify: 'メール認証',
  profile: 'プロフィール設定',
}

const credentialValid = computed(() => {
  return credentialForm.email.includes('@') && credentialForm.password.length >= 6
})

const profileValid = computed(() => {
  return (
    profileForm.fullName.trim().length > 1 &&
    Boolean(profileForm.birthday) &&
    Boolean(profileForm.jobRole)
  )
})

const redirectPath = computed(() => {
  return (route.query.redirect as string) || { name: ROUTE_NAMES.myPage }
})

const currentStepIndex = computed(() => {
  return Math.max(stepOrder.indexOf(currentStep.value), 0)
})

const progressPercent = computed(() => {
  return ((currentStepIndex.value + 1) / stepOrder.length) * 100
})

const handleCredentialSubmit = async () => {
  if (!credentialValid.value || credentialLoading.value) return

  credentialLoading.value = true
  credentialError.value = ''

  try {
    await registerCredentials({ ...credentialForm })
    credentialEmail.value = credentialForm.email
    verificationMessage.value = '認証メールを送信しました。受信ボックスをご確認ください。'
    currentStep.value = 'verify'
  } catch (error) {
    console.error(error)
    credentialError.value = mapFirebaseError(error)
  } finally {
    credentialLoading.value = false
  }
}

const handleProviderSelect = async (provider: SocialProvider) => {
  if (providerLoading.value) return

  providerLoading.value = provider
  credentialError.value = ''
  verificationError.value = ''
  profileError.value = ''

  try {
    await authenticateWithProvider(provider)
    hydrateProfileFromUser()
    currentStep.value = 'profile'
  } catch (error) {
    console.error(error)
    credentialError.value = mapFirebaseError(error)
  } finally {
    providerLoading.value = null
  }
}

const handleResend = async () => {
  if (resendLoading.value) return
  resendLoading.value = true
  verificationMessage.value = ''
  verificationError.value = ''

  try {
    await resendVerificationEmail()
    verificationMessage.value = '認証メールを再送しました。'
  } catch (error) {
    console.error(error)
    verificationError.value = '認証メールの再送に失敗しました。'
  } finally {
    resendLoading.value = false
  }
}

const checkVerificationStatus = async () => {
  if (verificationChecking.value) return
  verificationChecking.value = true
  verificationError.value = ''

  try {
    const user = await refreshCurrentUser()
    if (user?.emailVerified) {
      currentStep.value = 'profile'
      hydrateProfileFromUser()
      return
    }
    verificationError.value = 'まだメール認証が確認できません。確認後に再度お試しください。'
  } catch (error) {
    console.error(error)
    verificationError.value = '認証状態を確認できませんでした。'
  } finally {
    verificationChecking.value = false
  }
}

const handleProfileSubmit = async () => {
  if (!profileValid.value || profileLoading.value) return

  profileLoading.value = true
  profileError.value = ''

  try {
    const nickname = buildNickname(profileForm.fullName, profileForm.nickname)
    await completeProfileSetup({
      fullName: profileForm.fullName,
      nickname,
      birthday: profileForm.birthday,
      jobRole: profileForm.jobRole,
      jobTitle: profileForm.jobTitle,
    })

    if (avatarFile.value) {
      await updateAccountAvatar(avatarFile.value)
    }

    await router.push(redirectPath.value)
  } catch (error) {
    console.error(error)
    profileError.value = 'プロフィールの保存に失敗しました。'
  } finally {
    profileLoading.value = false
  }
}

const handleAvatarChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  avatarFile.value = file

  if (file) {
    avatarPreview.value = URL.createObjectURL(file)
  } else {
    avatarPreview.value = null
  }
}

function buildNickname(fullName: string, nickname?: string) {
  const trimmed = nickname?.trim()
  if (trimmed) {
    return trimmed
  }

  const tokens = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length >= 2) {
    return `${extractInitial(tokens[0] ?? fullName)}${extractInitial(tokens[1] ?? tokens[0] ?? fullName)}`
  }

  const initial = extractInitial(fullName)
  return initial.padEnd(2, initial)
}

function extractInitial(value: string) {
  const ascii = value.match(/[A-Za-z]/)
  if (ascii) {
    return ascii[0].toUpperCase()
  }
  return value.trim().charAt(0).toUpperCase() || 'U'
}

function mapFirebaseError(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) {
    const code = String((error as { code?: string }).code)
    if (code === 'auth/email-already-in-use') return 'このメールアドレスは既に登録されています。'
    if (code === 'auth/invalid-email') return 'メールアドレスの形式を確認してください。'
    if (code === 'auth/weak-password') return 'パスワードは 6 文字以上で設定してください。'
  }
  return 'リクエストを処理できませんでした。時間を置いて再度お試しください。'
}
</script>

<template>
  <div class="signup-shell">
    <div class="signup-card">
      <AuthBrand title="アカウント作成" description="ステップに沿ってアカウントを作成しましょう" />
      <div class="signup-progress">
        <div class="signup-progress__labels">
          <span>ステップ {{ currentStepIndex + 1 }} / {{ stepOrder.length }}</span>
          <span>{{ stepLabels[currentStep] }}</span>
        </div>
        <div class="signup-progress__bar">
          <div class="signup-progress__value" :style="{ width: `${progressPercent}%` }" />
        </div>
      </div>

      <Transition name="slide-fade" mode="out-in">
        <section :key="currentStep">
          <form v-if="currentStep === 'credentials'" class="signup-form" @submit.prevent="handleCredentialSubmit">
            <AuthFormField v-model="credentialForm.email" label="メールアドレス" type="email" placeholder="you@example.com" required />

            <AuthFormField
              v-model="credentialForm.password"
              label="パスワード"
              type="password"
              placeholder="8文字以上"
              hint="8文字以上、英数字を含む"
              required
            />

            <p v-if="credentialError" class="form-error">{{ credentialError }}</p>

            <AppButton
              type="submit"
              variant="primary"
              block
              :disabled="!credentialValid || credentialLoading"
              :loading="credentialLoading"
            >
              認証メールを送信
            </AppButton>

            <div class="divider">
              <span>または</span>
            </div>

            <AuthProviderButtons
              class="provider-section"
              :providers="providerOptions"
              :loading="providerLoading"
              @select="handleProviderSelect"
            />
          </form>

          <div v-else-if="currentStep === 'verify'" class="verify-step">
            <p>
              <strong>{{ credentialEmail }}</strong>
              宛に認証メールを送信しました。受信ボックスからリンクをクリックして認証を完了してください。
            </p>
            <p v-if="verificationMessage" class="verify-step__message">{{ verificationMessage }}</p>
            <p v-if="verificationError" class="form-error">{{ verificationError }}</p>
            <div class="verify-step__actions">
              <AppButton
                type="button"
                variant="secondary"
                :disabled="resendLoading"
                :loading="resendLoading"
                @click="handleResend"
              >
                認証メールを再送
              </AppButton>
              <AppButton
                type="button"
                variant="primary"
                :disabled="verificationChecking"
                :loading="verificationChecking"
                @click="checkVerificationStatus"
              >
                認証を確認
              </AppButton>
            </div>
          </div>

          <form v-else class="signup-form" @submit.prevent="handleProfileSubmit">
            <AuthFormField v-model="profileForm.fullName" label="本名" type="text" placeholder="山田 太郎" required />

            <AuthFormField
              v-model="profileForm.nickname"
              label="ニックネーム (任意)"
              type="text"
              placeholder="任意で入力"
            />

            <AuthFormField v-model="profileForm.birthday" label="生年月日" type="date" required />

            <div class="job-field">
              <label class="job-field__label" for="jobRole">職業</label>
              <select id="jobRole" v-model="profileForm.jobRole" required>
                <option v-for="option in jobOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>

            <AuthFormField
              v-model="profileForm.jobTitle"
              label="役職 (任意)"
              type="text"
              placeholder="例: プロジェクトマネージャー"
            />

            <div class="avatar-field">
              <span>アイコン</span>
              <label class="avatar-field__upload">
                <input type="file" accept="image/*" @change="handleAvatarChange" />
                画像を選択
              </label>
              <p class="avatar-field__hint">アップロードは任意です。PNG / JPG / WEBP などに対応しています。</p>
              <div v-if="avatarPreview" class="avatar-field__preview">
                <img :src="avatarPreview" alt="アイコンのプレビュー" />
              </div>
            </div>

            <p v-if="profileError" class="form-error">{{ profileError }}</p>

            <AppButton
              type="submit"
              variant="primary"
              block
              :disabled="!profileValid || profileLoading"
              :loading="profileLoading"
            >
              プロフィールを登録
            </AppButton>
          </form>
        </section>
      </Transition>

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

.signup-progress {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.signup-progress__labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: #4f7c82;
  font-weight: 600;
}

.signup-progress__bar {
  width: 100%;
  height: 0.4rem;
  border-radius: 999px;
  background: rgba(147, 177, 181, 0.3);
  overflow: hidden;
}

.signup-progress__value {
  height: 100%;
  background: linear-gradient(90deg, #4f7c82, #0b2e33);
  border-radius: 999px;
  transition: width 200ms ease;
}

.signup-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

.provider-section {
  margin-top: 0.5rem;
}

.verify-step {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: left;
  color: #4f7c82;
}

.verify-step__message {
  color: #0b2e33;
  font-weight: 600;
}

.verify-step__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.avatar-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.avatar-field__upload {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px dashed #93b1b5;
  border-radius: 0.85rem;
  color: #4f7c82;
  cursor: pointer;
}

.avatar-field__upload input {
  display: none;
}

.avatar-field__hint {
  margin: 0;
  font-size: 0.85rem;
  color: #93b1b5;
}

.job-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.job-field__label {
  font-weight: 600;
  color: #0b2e33;
}

.job-field select {
  border: 1px solid #93b1b5;
  border-radius: 0.85rem;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  background: #fff;
  color: #0b2e33;
}

.job-field select:focus {
  outline: none;
  border-color: #4f7c82;
  box-shadow: 0 0 0 3px rgba(79, 124, 130, 0.2);
}

.avatar-field__preview img {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #b8e3e9;
}

.form-error {
  background: rgba(214, 69, 69, 0.08);
  border: 1px solid rgba(214, 69, 69, 0.35);
  color: #d64545;
  padding: 0.75rem 1rem;
  border-radius: 0.9rem;
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

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 240ms ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@media (max-width: 600px) {
  .signup-card {
    padding: 2rem 1.5rem;
  }

  .verify-step__actions {
    flex-direction: column;
  }
}
</style>

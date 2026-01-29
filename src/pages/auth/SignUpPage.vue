<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import AppSelect from "@/components/ui/AppSelect.vue";
import AuthBrand from "@/components/ui/AuthBrand.vue";
import AuthCredentialFields from "@/components/ui/AuthCredentialFields.vue";
import AuthFormField from "@/components/ui/AuthFormField.vue";
import AuthProviderButtons from "@/components/ui/AuthProviderButtons.vue";
import { useAuth } from "@/composables/useAuth";
import { ROUTE_NAMES } from "@/constants/routes";
import {
  fetchProfile,
  refreshCurrentUser,
  registerCredentials,
  resendVerificationEmail,
} from "@/firebase/authService";
import { getCurrentUser } from "@/lib/getCurrentUser";
import {
  authenticateWithProvider,
  completeProfileSetup,
  updateAccountAvatar,
} from "@/services/accountActions";
import type { SocialProvider } from "@/types/auth";
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.pages.auth.SignUp");

const router = useRouter();
const route = useRoute();
const { user } = useAuth();

type SignUpStep = "credentials" | "verify" | "profile";

const currentStep = ref<SignUpStep>("credentials");
const credentialForm = reactive({
  email: "",
  password: "",
});
const profileForm = reactive({
  fullName: "",
  nickname: "",
  birthday: "",
  jobRole: "",
  jobTitle: "",
});

const providerLoading = ref<SocialProvider | null>(null);
const credentialLoading = ref(false);
const profileLoading = ref(false);
const resendLoading = ref(false);
const verificationChecking = ref(false);
const credentialError = ref("");
const verificationMessage = ref("");
const verificationError = ref("");
const profileError = ref("");
const credentialEmail = ref("");

const avatarFile = ref<File | null>(null);
const avatarPreview = ref<string | null>(null);

onMounted(async () => {
  const currentUser = user.value ?? (await getCurrentUser());
  if (route.query.setup === "false" && currentUser) {
    const profile = await fetchProfile(currentUser.uid);
    if (profile && !profile.setUp) {
      currentStep.value = "profile";
      hydrateProfileFromUser(currentUser);
    }
  }
});

const hydrateProfileFromUser = (current = user.value) => {
  if (!current) return;

  if (!profileForm.fullName && current.displayName) {
    profileForm.fullName = current.displayName;
  }

  if (!profileForm.nickname && current.displayName) {
    profileForm.nickname = current.displayName;
  }

  if (!credentialEmail.value && current.email) {
    credentialEmail.value = current.email;
  }
};

const providerOptions: { id: SocialProvider; label: string; icon: string }[] = [
  { id: "google", label: "Googleで登録", icon: "google" },
  { id: "github", label: "GitHubで登録", icon: "github" },
];

const jobOptions = [
  { value: "", label: "職業を選択してください" },
  { value: "engineer", label: "エンジニア" },
  { value: "designer", label: "デザイナー" },
  { value: "product", label: "プロダクトマネージャー" },
  { value: "marketing", label: "マーケター" },
  { value: "sales", label: "営業" },
  { value: "cs", label: "カスタマーサクセス" },
  { value: "student", label: "学生" },
  { value: "researcher", label: "研究者" },
  { value: "other", label: "その他" },
];

const stepOrder: SignUpStep[] = ["credentials", "verify", "profile"];
const stepLabels: Record<SignUpStep, string> = {
  credentials: "メールアドレス登録",
  verify: "メール認証",
  profile: "プロフィール設定",
};

const credentialValid = computed(() => {
  return (
    credentialForm.email.includes("@") && credentialForm.password.length >= 8
  );
});

const profileValid = computed(() => {
  return profileForm.fullName.trim().length > 1 && Boolean(profileForm.jobRole);
});

const redirectPath = computed(() => {
  return (route.query.redirect as string) || { name: ROUTE_NAMES.myPage };
});

const currentStepIndex = computed(() => {
  return Math.max(stepOrder.indexOf(currentStep.value), 0);
});

const progressPercent = computed(() => {
  return ((currentStepIndex.value + 1) / stepOrder.length) * 100;
});

const handleCredentialSubmit = async () => {
  if (!credentialValid.value || credentialLoading.value) return;

  credentialLoading.value = true;
  credentialError.value = "";

  try {
    await registerCredentials({ ...credentialForm });
    credentialEmail.value = credentialForm.email;
    verificationMessage.value =
      "認証メールを送信しました。受信ボックスをご確認ください。";
    currentStep.value = "verify";
  } catch (error) {
    logger.error`Credential registration failed: ${error}`;
    credentialError.value = mapFirebaseError(error);
  } finally {
    credentialLoading.value = false;
  }
};

const handleProviderSelect = async (provider: SocialProvider) => {
  if (providerLoading.value) return;

  providerLoading.value = provider;
  credentialError.value = "";
  verificationError.value = "";
  profileError.value = "";

  try {
    await authenticateWithProvider(provider);
    const currentUser = user.value ?? (await getCurrentUser());
    hydrateProfileFromUser(currentUser);
    currentStep.value = "profile";
  } catch (error) {
    logger.error`Provider auth failed: ${error}`;
    credentialError.value = mapFirebaseError(error);
  } finally {
    providerLoading.value = null;
  }
};

const handleResend = async () => {
  if (resendLoading.value) return;
  resendLoading.value = true;
  verificationMessage.value = "";
  verificationError.value = "";

  try {
    await resendVerificationEmail();
    verificationMessage.value = "認証メールを再送しました。";
  } catch (error) {
    logger.error`Resend verification failed: ${error}`;
    verificationError.value = "認証メールの再送に失敗しました。";
  } finally {
    resendLoading.value = false;
  }
};

const checkVerificationStatus = async () => {
  if (verificationChecking.value) return;
  verificationChecking.value = true;
  verificationError.value = "";

  try {
    const user = await refreshCurrentUser();
    if (user?.emailVerified) {
      currentStep.value = "profile";
      hydrateProfileFromUser(user);
      return;
    }
    verificationError.value =
      "まだメール認証が確認できません。確認後に再度お試しください。";
  } catch (error) {
    logger.error`Verification check failed: ${error}`;
    verificationError.value = "認証状態を確認できませんでした。";
  } finally {
    verificationChecking.value = false;
  }
};

const handleProfileSubmit = async () => {
  if (!profileValid.value || profileLoading.value) return;

  profileLoading.value = true;
  profileError.value = "";

  try {
    const nickname = buildNickname(profileForm.fullName, profileForm.nickname);
    await completeProfileSetup({
      fullName: profileForm.fullName,
      nickname,
      birthday: profileForm.birthday,
      jobRole: profileForm.jobRole,
      jobTitle: profileForm.jobTitle,
    });

    if (avatarFile.value) {
      await updateAccountAvatar(avatarFile.value);
    }

    await router.push(redirectPath.value);
  } catch (error) {
    logger.error`Profile submission failed: ${error}`;
    profileError.value = "プロフィールの保存に失敗しました。";
  } finally {
    profileLoading.value = false;
  }
};

const handleAvatarChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  avatarFile.value = file;

  if (file) {
    avatarPreview.value = URL.createObjectURL(file);
  } else {
    avatarPreview.value = null;
  }
};

function buildNickname(fullName: string, nickname?: string) {
  const trimmed = nickname?.trim();
  if (trimmed) {
    return trimmed;
  }

  const tokens = fullName.trim().split(/\s+/).filter(Boolean);

  if (tokens.length >= 2) {
    return `${extractInitial(tokens[0] ?? fullName)}${extractInitial(tokens[1] ?? tokens[0] ?? fullName)}`;
  }

  const initial = extractInitial(fullName);
  return initial.padEnd(2, initial);
}

function extractInitial(value: string) {
  const ascii = value.match(/[A-Za-z]/);
  if (ascii) {
    return ascii[0].toUpperCase();
  }
  return value.trim().charAt(0).toUpperCase() || "U";
}

function mapFirebaseError(error: unknown): string {
  if (typeof error === "object" && error && "code" in error) {
    const code = String((error as { code?: string }).code);

    // メール・パスワード関連
    if (code === "auth/email-already-in-use")
      return "このメールアドレスは既に登録されています。ログインをお試しください。";
    if (code === "auth/invalid-email")
      return "メールアドレスの形式が正しくありません。";
    if (code === "auth/weak-password")
      return "パスワードは8文字以上で、より強力なものを設定してください。";
    if (code === "auth/operation-not-allowed")
      return "この認証方法は現在利用できません。";

    // ソーシャルログイン関連
    if (code === "auth/account-exists-with-different-credential")
      return "このメールアドレスは別の方法（Google/GitHubなど）で登録されています。そちらでログインしてください。";
    if (code === "auth/popup-closed-by-user")
      return "登録がキャンセルされました。もう一度お試しください。";
    if (code === "auth/cancelled-popup-request")
      return "登録がキャンセルされました。";
    if (code === "auth/popup-blocked")
      return "ポップアップがブロックされました。ブラウザの設定を確認してください。";

    // ネットワークエラー
    if (code === "auth/network-request-failed")
      return "ネットワーク接続に問題があります。インターネット接続を確認してください。";

    // 制限エラー
    if (code === "auth/too-many-requests")
      return "リクエストが多すぎます。しばらく時間を置いてから再度お試しください。";

    // App Check / セキュリティエラー
    if (code === "auth/app-check-token-error" || code.includes("appCheck"))
      return "セキュリティ検証に失敗しました。ページを再読み込みしてください。";

    // 未知のauth/エラー
    if (code.startsWith("auth/")) {
      logger.warn`Unknown auth error code: ${code}`;
      return `登録エラーが発生しました（${code}）。時間を置いて再度お試しください。`;
    }
  }

  logger.warn`Unexpected signup error: ${error}`;
  return "リクエストを処理できませんでした。時間を置いて再度お試しください。";
}
</script>

<template>
  <div class="signup-shell">
    <div class="signup-card">
      <AuthBrand
        title="アカウント作成"
        description="ステップに沿ってアカウントを作成しましょう"
      />
      <div class="signup-progress">
        <div class="signup-progress__labels">
          <span
            >ステップ {{ currentStepIndex + 1 }} / {{ stepOrder.length }}</span
          >
          <span>{{ stepLabels[currentStep] }}</span>
        </div>
        <div class="signup-progress__bar">
          <div
            class="signup-progress__value"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
      </div>

      <Transition name="slide-fade" mode="out-in">
        <section :key="currentStep">
          <form
            v-if="currentStep === 'credentials'"
            class="signup-form"
            @submit.prevent="handleCredentialSubmit"
          >
            <AuthCredentialFields
              variant="signup"
              v-model:email="credentialForm.email"
              v-model:password="credentialForm.password"
              email-placeholder="you@example.com"
              password-placeholder="8文字以上"
              password-hint="8文字以上、英数字を含む"
            />

            <p v-if="credentialError" class="form-error">
              {{ credentialError }}
            </p>

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
            <p v-if="verificationMessage" class="verify-step__message">
              {{ verificationMessage }}
            </p>
            <p v-if="verificationError" class="form-error">
              {{ verificationError }}
            </p>
            <div class="verify-step__actions">
              <AppButton
                type="button"
                variant="ghost"
                @click="currentStep = 'credentials'"
              >
                戻る
              </AppButton>
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

          <form
            v-else
            class="signup-form"
            @submit.prevent="handleProfileSubmit"
          >
            <AuthFormField
              v-model="profileForm.fullName"
              label="本名"
              type="text"
              placeholder="山田 太郎"
              required
            />

            <AuthFormField
              v-model="profileForm.nickname"
              label="ニックネーム (任意)"
              type="text"
              placeholder="任意で入力"
            />

            <AuthFormField
              v-model="profileForm.birthday"
              label="生年月日 (任意)"
              type="date"
            />

            <div class="form-field">
              <label class="form-field__label">職業</label>
              <AppSelect
                v-model="profileForm.jobRole"
                :options="jobOptions"
                :placeholder="undefined"
              />
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
                <input
                  type="file"
                  accept="image/*"
                  @change="handleAvatarChange"
                />
                画像を選択
              </label>
              <p class="avatar-field__hint">
                アップロードは任意です。PNG / JPG / WEBP などに対応しています。
              </p>
              <div v-if="avatarPreview" class="avatar-field__preview">
                <img :src="avatarPreview" alt="アイコンのプレビュー" />
              </div>
            </div>

            <p v-if="profileError" class="form-error">{{ profileError }}</p>

            <div class="profile-actions">
              <AppButton
                type="button"
                variant="ghost"
                @click="currentStep = 'verify'"
              >
                戻る
              </AppButton>
              <AppButton
                type="submit"
                variant="primary"
                :disabled="!profileValid || profileLoading"
                :loading="profileLoading"
              >
                プロフィールを登録
              </AppButton>
            </div>
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
  background: linear-gradient(
    135deg,
    rgba(184, 227, 233, 0.35),
    var(--ui-surface, #fff),
    rgba(147, 177, 181, 0.35)
  );
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-8, 2rem) var(--ui-space-4, 1rem);
}

@supports (min-height: 100dvh) {
  .signup-shell {
    min-height: calc(100dvh - 4rem);
  }
}

.signup-card {
  width: min(500px, 100%);
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-2xl, 1.5rem);
  padding: var(--ui-space-10, 2.5rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  box-shadow: var(--ui-shadow-2xl);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6, 1.5rem);
}

.signup-progress {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.signup-progress__labels {
  display: flex;
  justify-content: space-between;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-brand-600, #4f7c82);
  font-weight: var(--ui-font-semibold, 600);
}

.signup-progress__bar {
  width: 100%;
  height: 0.4rem;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-border, rgba(11, 46, 51, 0.12));
  overflow: hidden;
}

.signup-progress__value {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--ui-brand-600, #4f7c82),
    var(--ui-brand-900, #0b2e33)
  );
  border-radius: var(--ui-radius-full, 9999px);
  transition: width var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.signup-form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.divider {
  position: relative;
  text-align: center;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.divider::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 1px;
  background: var(--ui-border, rgba(11, 46, 51, 0.12));
}

.divider span {
  background: var(--ui-surface, #ffffff);
  padding: 0 var(--ui-space-3, 0.75rem);
  position: relative;
  font-weight: var(--ui-font-semibold, 600);
}

.provider-section {
  margin-top: var(--ui-space-2, 0.5rem);
}

.verify-step {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
  text-align: left;
  color: var(--ui-brand-600, #4f7c82);
}

.verify-step__message {
  color: var(--ui-brand-900, #0b2e33);
  font-weight: var(--ui-font-semibold, 600);
}

.verify-step__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-3, 0.75rem);
}

.avatar-field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.avatar-field__upload {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  border: 1px dashed var(--ui-border-strong, rgba(11, 46, 51, 0.2));
  border-radius: var(--ui-radius-md, 0.75rem);
  color: var(--ui-brand-600, #4f7c82);
  cursor: pointer;
  transition: var(--ui-transition-colors);
  min-height: var(--ui-touch-target-min, 44px);
}

.avatar-field__upload:hover {
  border-color: var(--ui-brand-600, #4f7c82);
  background: var(--ui-brand-100, #e5f6f8);
}

.avatar-field__upload input {
  display: none;
}

.avatar-field__hint {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.form-field__label {
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
  font-size: var(--ui-text-sm, 0.875rem);
}

.avatar-field__preview img {
  width: 72px;
  height: 72px;
  border-radius: var(--ui-radius-full, 9999px);
  object-fit: cover;
  border: 2px solid var(--ui-brand-200, #b8e3e9);
}

.form-error {
  background: var(--ui-danger-bg, rgba(214, 69, 69, 0.08));
  border: 1px solid rgba(214, 69, 69, 0.35);
  color: var(--ui-danger, #d64545);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
}

.profile-actions {
  display: flex;
  justify-content: space-between;
  gap: var(--ui-space-3, 0.75rem);
}

.signup-footer {
  text-align: center;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-brand-600, #4f7c82);
}

.signup-footer a {
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-brand-600, #4f7c82);
  text-decoration: none;
  transition: var(--ui-transition-colors);
  min-height: var(--ui-touch-target-min, 44px);
  display: inline-flex;
  align-items: center;
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  border-radius: var(--ui-radius-sm, 0.5rem);
}

.signup-footer a:hover {
  color: var(--ui-brand-900, #0b2e33);
  background: var(--ui-brand-100, #e5f6f8);
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@media (max-width: 768px) {
  .signup-shell {
    padding: var(--ui-space-6, 1.5rem) var(--ui-space-4, 1rem);
  }

  .signup-card {
    padding: var(--ui-space-8, 2rem);
  }
}

@media (max-width: 600px) {
  .signup-card {
    padding: var(--ui-space-6, 1.5rem) var(--ui-space-5, 1.25rem);
  }

  .verify-step__actions {
    flex-direction: column;
  }
}
</style>

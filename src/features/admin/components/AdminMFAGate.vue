<script setup lang="ts">
/**
 * AdminMFAGate - 管理者MFA認証ゲート
 *
 * 管理者ダッシュボードにアクセスするために再認証（パスワード/SNS + MFA）が必要であることを説明し、
 * 認証方法に応じた入力を要求するフルページゲートコンポーネント。
 */
import { computed, ref, nextTick, onMounted } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppInput from "@/components/ui/AppInput.vue";
import SectionCard from "@/components/ui/SectionCard.vue";
import {
  reauthenticateWithPassword,
  reauthenticateWithProvider,
  completeMFAReauthentication,
  getAuthProviderInfo,
} from "@/firebase/authService";
import type { MultiFactorResolver } from "firebase/auth";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.features.admin.AdminMFAGate");

const emit = defineEmits<{
  verified: [];
}>();

// 認証方法
type AuthMethod = "password" | "google" | "github";
type Step = "init" | "password" | "provider" | "totp";

const currentStep = ref<Step>("init");
const authMethod = ref<AuthMethod | null>(null);
const hasPassword = ref(false);
const providers = ref<string[]>([]);

// パスワード入力
const password = ref("");
const passwordLoading = ref(false);
const passwordError = ref<string | undefined>(undefined);
const passwordInputRef = ref<HTMLInputElement | null>(null);

// プロバイダ認証
const providerLoading = ref(false);
const providerError = ref<string | undefined>(undefined);

// TOTP入力
const totpCode = ref("");
const totpLoading = ref(false);
const totpError = ref<string | undefined>(undefined);
const totpInputRef = ref<HTMLInputElement | null>(null);
const mfaResolver = ref<MultiFactorResolver | null>(null);

const isValidPassword = computed(() => password.value.length >= 6);
const isValidTotpCode = computed(() => {
  const code = totpCode.value.trim();
  return code.length === 6 && /^\d+$/.test(code);
});

// プロバイダの表示名
const providerDisplayNames: Record<string, string> = {
  "google.com": "Google",
  "github.com": "GitHub",
  password: "パスワード",
};

function getProviderDisplayName(providerId: string): string {
  return providerDisplayNames[providerId] || providerId;
}

// 初期化
async function initAuthMethod() {
  try {
    const info = await getAuthProviderInfo();
    hasPassword.value = info.hasPassword;
    providers.value = info.providers;

    // パスワード認証がある場合はパスワード入力から開始
    if (info.hasPassword) {
      authMethod.value = "password";
      currentStep.value = "password";
      await nextTick();
      passwordInputRef.value?.focus();
    } else if (info.providers.includes("google.com")) {
      authMethod.value = "google";
      currentStep.value = "provider";
    } else if (info.providers.includes("github.com")) {
      authMethod.value = "github";
      currentStep.value = "provider";
    } else {
      // 未知のプロバイダ
      providerError.value = "サポートされていない認証方法です。";
      currentStep.value = "provider";
    }
  } catch (error) {
    logger.error`Failed to get auth provider info: ${error}`;
    providerError.value = "認証情報の取得に失敗しました。";
    currentStep.value = "provider";
  }
}

async function handlePasswordSubmit() {
  if (!isValidPassword.value || passwordLoading.value) return;

  passwordLoading.value = true;
  passwordError.value = undefined;

  try {
    const result = await reauthenticateWithPassword(password.value);

    if (result.requiresMFA && result.resolver) {
      // MFAが必要 - TOTPステップへ移行
      mfaResolver.value = result.resolver;
      currentStep.value = "totp";
      await nextTick();
      totpInputRef.value?.focus();
    } else {
      // MFAなしで再認証成功
      emit("verified");
    }
  } catch (err) {
    logger.error`Password reauthentication failed: ${err}`;
    const error = err as { code?: string; message?: string };

    if (
      error.code === "auth/wrong-password" ||
      error.code === "auth/invalid-credential"
    ) {
      passwordError.value = "パスワードが正しくありません。";
    } else if (error.code === "auth/too-many-requests") {
      passwordError.value =
        "ログイン試行回数が多すぎます。しばらく待ってからお試しください。";
    } else {
      passwordError.value = "認証に失敗しました。もう一度お試しください。";
    }
    password.value = "";
    await nextTick();
    passwordInputRef.value?.focus();
  } finally {
    passwordLoading.value = false;
  }
}

async function handleProviderAuth() {
  if (providerLoading.value || !authMethod.value) return;

  providerLoading.value = true;
  providerError.value = undefined;

  const providerId =
    authMethod.value === "google" ? "google.com" : "github.com";

  try {
    const result = await reauthenticateWithProvider(providerId);

    if (result.requiresMFA && result.resolver) {
      // MFAが必要 - TOTPステップへ移行
      mfaResolver.value = result.resolver;
      currentStep.value = "totp";
      await nextTick();
      totpInputRef.value?.focus();
    } else {
      // MFAなしで再認証成功
      emit("verified");
    }
  } catch (err) {
    logger.error`Provider reauthentication failed: ${err}`;
    const error = err as { code?: string };

    if (error.code === "auth/popup-closed-by-user") {
      providerError.value = "認証がキャンセルされました。";
    } else if (error.code === "auth/popup-blocked") {
      providerError.value =
        "ポップアップがブロックされました。ブラウザの設定を確認してください。";
    } else if (error.code === "auth/user-mismatch") {
      providerError.value =
        "別のアカウントでログインしようとしています。現在のアカウントで再認証してください。";
    } else {
      providerError.value = "認証に失敗しました。もう一度お試しください。";
    }
  } finally {
    providerLoading.value = false;
  }
}

async function handleTotpSubmit() {
  if (!isValidTotpCode.value || totpLoading.value || !mfaResolver.value) return;

  totpLoading.value = true;
  totpError.value = undefined;

  try {
    await completeMFAReauthentication(mfaResolver.value, totpCode.value.trim());
    emit("verified");
  } catch (err) {
    logger.error`TOTP verification failed: ${err}`;
    const error = err as { code?: string };

    if (error.code === "auth/invalid-verification-code") {
      totpError.value =
        "認証コードが正しくありません。もう一度お試しください。";
    } else if (error.code === "auth/code-expired") {
      totpError.value =
        "認証コードの有効期限が切れました。新しいコードを入力してください。";
    } else {
      totpError.value = "認証に失敗しました。もう一度お試しください。";
    }
    totpCode.value = "";
    await nextTick();
    totpInputRef.value?.focus();
  } finally {
    totpLoading.value = false;
  }
}

function goBack() {
  totpCode.value = "";
  totpError.value = undefined;
  mfaResolver.value = null;

  if (hasPassword.value) {
    currentStep.value = "password";
    nextTick(() => {
      passwordInputRef.value?.focus();
    });
  } else {
    currentStep.value = "provider";
  }
}

// パスワード認証とSNS認証の切り替え
function switchToPassword() {
  authMethod.value = "password";
  currentStep.value = "password";
  providerError.value = undefined;
  nextTick(() => {
    passwordInputRef.value?.focus();
  });
}

function switchToProvider(provider: "google" | "github") {
  authMethod.value = provider;
  currentStep.value = "provider";
  passwordError.value = undefined;
  password.value = "";
}

onMounted(() => {
  initAuthMethod();
});
</script>

<template>
  <div class="admin-mfa-gate">
    <SectionCard size="md" elevated>
      <div class="admin-mfa-gate__content">
        <!-- ヘッダー -->
        <div class="admin-mfa-gate__header">
          <div class="admin-mfa-gate__icon-wrapper">
            <svg
              class="admin-mfa-gate__icon"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                stroke="currentColor"
                stroke-width="2"
              />
              <path
                d="M12 11V17M12 7H12.01"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <h1 class="admin-mfa-gate__title">管理者認証が必要です</h1>
          <p class="admin-mfa-gate__description">
            管理者ダッシュボードにアクセスするには、セキュリティのため再認証が必要です。
          </p>
        </div>

        <!-- 初期化中 -->
        <div v-if="currentStep === 'init'" class="admin-mfa-gate__loading">
          <div class="admin-mfa-gate__spinner" />
          <p>認証情報を確認しています...</p>
        </div>

        <!-- パスワード入力 -->
        <template v-if="currentStep === 'password'">
          <div class="admin-mfa-gate__step-info">
            <span class="admin-mfa-gate__step-badge">ステップ 1/2</span>
            <span class="admin-mfa-gate__step-text"
              >パスワードを入力してください</span
            >
          </div>

          <div class="admin-mfa-gate__field">
            <label for="admin-password-input">パスワード</label>
            <AppInput
              id="admin-password-input"
              ref="passwordInputRef"
              v-model="password"
              type="password"
              placeholder="パスワードを入力"
              autocomplete="current-password"
              :disabled="passwordLoading"
              @keydown.enter="handlePasswordSubmit"
            />
          </div>

          <p v-if="passwordError" class="admin-mfa-gate__error" role="alert">
            {{ passwordError }}
          </p>

          <div class="admin-mfa-gate__actions">
            <AppButton
              variant="primary"
              size="lg"
              block
              :disabled="!isValidPassword"
              :loading="passwordLoading"
              @click="handlePasswordSubmit"
            >
              次へ
            </AppButton>
          </div>

          <!-- SNS認証への切り替え -->
          <div
            v-if="
              providers.includes('google.com') ||
              providers.includes('github.com')
            "
            class="admin-mfa-gate__switch"
          >
            <p class="admin-mfa-gate__switch-label">または</p>
            <div class="admin-mfa-gate__switch-buttons">
              <AppButton
                v-if="providers.includes('google.com')"
                variant="outline"
                size="sm"
                @click="switchToProvider('google')"
              >
                Googleで認証
              </AppButton>
              <AppButton
                v-if="providers.includes('github.com')"
                variant="outline"
                size="sm"
                @click="switchToProvider('github')"
              >
                GitHubで認証
              </AppButton>
            </div>
          </div>
        </template>

        <!-- プロバイダ認証 -->
        <template v-if="currentStep === 'provider'">
          <div class="admin-mfa-gate__step-info">
            <span class="admin-mfa-gate__step-badge">ステップ 1/2</span>
            <span class="admin-mfa-gate__step-text"
              >{{
                getProviderDisplayName(
                  authMethod === "google" ? "google.com" : "github.com",
                )
              }}で再認証してください</span
            >
          </div>

          <p v-if="providerError" class="admin-mfa-gate__error" role="alert">
            {{ providerError }}
          </p>

          <div class="admin-mfa-gate__actions">
            <AppButton
              v-if="authMethod === 'google'"
              variant="primary"
              size="lg"
              block
              :loading="providerLoading"
              @click="handleProviderAuth"
            >
              <svg
                class="admin-mfa-gate__provider-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Googleで再認証
            </AppButton>
            <AppButton
              v-if="authMethod === 'github'"
              variant="primary"
              size="lg"
              block
              :loading="providerLoading"
              @click="handleProviderAuth"
            >
              <svg
                class="admin-mfa-gate__provider-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                />
              </svg>
              GitHubで再認証
            </AppButton>
          </div>

          <!-- パスワード認証への切り替え -->
          <div v-if="hasPassword" class="admin-mfa-gate__switch">
            <p class="admin-mfa-gate__switch-label">または</p>
            <AppButton variant="outline" size="sm" @click="switchToPassword">
              パスワードで認証
            </AppButton>
          </div>
        </template>

        <!-- TOTP入力 -->
        <template v-if="currentStep === 'totp'">
          <div class="admin-mfa-gate__step-info">
            <span class="admin-mfa-gate__step-badge">ステップ 2/2</span>
            <span class="admin-mfa-gate__step-text"
              >認証コードを入力してください</span
            >
          </div>

          <div class="admin-mfa-gate__field">
            <label for="admin-totp-input">認証コード（6桁）</label>
            <input
              id="admin-totp-input"
              ref="totpInputRef"
              v-model="totpCode"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="6"
              placeholder="000000"
              autocomplete="one-time-code"
              class="admin-mfa-gate__totp-input"
              :disabled="totpLoading"
              @keydown.enter="handleTotpSubmit"
            />
          </div>

          <p v-if="totpError" class="admin-mfa-gate__error" role="alert">
            {{ totpError }}
          </p>

          <div class="admin-mfa-gate__actions">
            <AppButton
              variant="primary"
              size="lg"
              block
              :disabled="!isValidTotpCode"
              :loading="totpLoading"
              @click="handleTotpSubmit"
            >
              認証する
            </AppButton>
            <AppButton
              variant="ghost"
              size="sm"
              block
              :disabled="totpLoading"
              @click="goBack"
            >
              戻る
            </AppButton>
          </div>

          <p class="admin-mfa-gate__help">
            認証コードがわからない場合は、設定した認証アプリ（Google
            Authenticator等）をご確認ください。
          </p>
        </template>
      </div>
    </SectionCard>
  </div>
</template>

<style scoped>
.admin-mfa-gate {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 4rem);
  padding: var(--ui-space-4, 1rem);
}

.admin-mfa-gate__content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5, 1.25rem);
  max-width: 400px;
  margin: 0 auto;
  padding: var(--ui-space-4, 1rem);
}

.admin-mfa-gate__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--ui-space-3, 0.75rem);
}

.admin-mfa-gate__icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: var(--ui-brand-50, #f0f9fa);
  border-radius: var(--ui-radius-full, 9999px);
  margin-bottom: var(--ui-space-2, 0.5rem);
}

.admin-mfa-gate__icon {
  width: 32px;
  height: 32px;
  color: var(--ui-brand-600, #4f7c82);
}

.admin-mfa-gate__title {
  margin: 0;
  font-size: var(--ui-text-xl, 1.25rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.admin-mfa-gate__description {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  line-height: 1.6;
}

.admin-mfa-gate__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-6, 1.5rem);
  color: var(--ui-text-muted, #64748b);
}

.admin-mfa-gate__spinner {
  width: 32px;
  height: 32px;
  border-radius: var(--ui-radius-full, 9999px);
  border: 3px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-top-color: var(--ui-brand-600, #4f7c82);
  animation: admin-mfa-spinner 0.8s linear infinite;
}

@keyframes admin-mfa-spinner {
  to {
    transform: rotate(360deg);
  }
}

.admin-mfa-gate__step-info {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-3, 0.75rem);
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-md, 0.75rem);
}

.admin-mfa-gate__step-badge {
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  background: var(--ui-brand-600, #4f7c82);
  color: white;
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-medium, 500);
  border-radius: var(--ui-radius-sm, 0.5rem);
}

.admin-mfa-gate__step-text {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text, #0b2e33);
}

.admin-mfa-gate__field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.admin-mfa-gate__field label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text, #0b2e33);
}

.admin-mfa-gate__totp-input {
  padding: var(--ui-space-4, 1rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-xl, 1.25rem);
  font-family: var(--ui-font-mono);
  letter-spacing: 0.5em;
  text-align: center;
  color: var(--ui-text, #0b2e33);
  background: var(--ui-surface, #fff);
  transition: var(--ui-transition-colors);
}

.admin-mfa-gate__totp-input:focus {
  outline: none;
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.admin-mfa-gate__totp-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.admin-mfa-gate__totp-input::placeholder {
  letter-spacing: 0.5em;
  color: var(--ui-text-muted, #64748b);
}

.admin-mfa-gate__error {
  margin: 0;
  padding: var(--ui-space-3, 0.75rem);
  background: var(--ui-danger-light, #fee2e2);
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-status-danger, #dc2626);
  text-align: center;
}

.admin-mfa-gate__actions {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
  margin-top: var(--ui-space-2, 0.5rem);
}

.admin-mfa-gate__provider-icon {
  width: 18px;
  height: 18px;
  margin-right: var(--ui-space-2, 0.5rem);
}

.admin-mfa-gate__switch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
  margin-top: var(--ui-space-2, 0.5rem);
  padding-top: var(--ui-space-4, 1rem);
  border-top: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
}

.admin-mfa-gate__switch-label {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.admin-mfa-gate__switch-buttons {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
  flex-wrap: wrap;
  justify-content: center;
}

.admin-mfa-gate__help {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  text-align: center;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .admin-mfa-gate {
    min-height: calc(100vh - 2rem);
    padding: var(--ui-space-3, 0.75rem);
  }

  .admin-mfa-gate__content {
    padding: var(--ui-space-2, 0.5rem);
  }
}
</style>

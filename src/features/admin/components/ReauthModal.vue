<script setup lang="ts">
/**
 * ReauthModal - 重要操作の再認証モーダル
 *
 * 管理者権限の付与/剥奪やメンテナンスモードの有効化など
 * 重要な操作を行う前に再認証を要求するモーダルコンポーネント
 */
import { ref, computed, nextTick, watch } from "vue";
import AppModal from "@/components/ui/AppModal.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppAlert from "@/components/ui/AppAlert.vue";
import {
  reauthenticateWithPassword,
  reauthenticateWithProvider,
  completeMFAReauthentication,
  getAuthProviderInfo,
} from "@/firebase/authService";
import type { MultiFactorResolver } from "firebase/auth";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.features.admin.ReauthModal");

const props = defineProps<{
  open: boolean;
  title?: string;
  description?: string;
}>();

const emit = defineEmits<{
  close: [];
  success: [];
}>();

// 認証ステップ
type Step = "init" | "password" | "provider" | "totp";
const currentStep = ref<Step>("init");

// プロバイダ情報
const hasPassword = ref(false);
const providers = ref<string[]>([]);
const primaryProvider = ref<string | null>(null);

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

// モーダルが開いたら初期化
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      resetState();
      await initAuthMethod();
    }
  },
);

function resetState() {
  currentStep.value = "init";
  password.value = "";
  passwordError.value = undefined;
  providerError.value = undefined;
  totpCode.value = "";
  totpError.value = undefined;
  mfaResolver.value = null;
}

async function initAuthMethod() {
  try {
    const info = await getAuthProviderInfo();
    hasPassword.value = info.hasPassword;
    providers.value = info.providers;
    primaryProvider.value = info.primaryProvider;

    if (info.hasPassword) {
      currentStep.value = "password";
      await nextTick();
      passwordInputRef.value?.focus();
    } else if (info.providers.includes("google.com")) {
      currentStep.value = "provider";
    } else if (info.providers.includes("github.com")) {
      currentStep.value = "provider";
    } else {
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
      mfaResolver.value = result.resolver;
      currentStep.value = "totp";
      await nextTick();
      totpInputRef.value?.focus();
    } else {
      emit("success");
      emit("close");
    }
  } catch (err) {
    logger.error`Password reauthentication failed: ${err}`;
    const error = err as { code?: string };

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
  if (providerLoading.value) return;

  providerLoading.value = true;
  providerError.value = undefined;

  const providerId =
    primaryProvider.value === "google.com" ||
    providers.value.includes("google.com")
      ? "google.com"
      : "github.com";

  try {
    const result = await reauthenticateWithProvider(providerId);

    if (result.requiresMFA && result.resolver) {
      mfaResolver.value = result.resolver;
      currentStep.value = "totp";
      await nextTick();
      totpInputRef.value?.focus();
    } else {
      emit("success");
      emit("close");
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
    emit("success");
    emit("close");
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

function handleClose() {
  resetState();
  emit("close");
}
</script>

<template>
  <AppModal
    :open="open"
    :title="title || '再認証が必要です'"
    size="sm"
    @close="handleClose"
  >
    <div class="reauth-modal">
      <p v-if="description" class="reauth-modal__description">
        {{ description }}
      </p>
      <p v-else class="reauth-modal__description">
        この操作を行うには、セキュリティのため再認証が必要です。
      </p>

      <!-- 初期化中 -->
      <div v-if="currentStep === 'init'" class="reauth-modal__loading">
        <div class="reauth-modal__spinner" />
        <p>認証情報を確認しています...</p>
      </div>

      <!-- パスワード入力 -->
      <template v-if="currentStep === 'password'">
        <div class="reauth-modal__field">
          <label for="reauth-password-input">パスワード</label>
          <AppInput
            id="reauth-password-input"
            ref="passwordInputRef"
            v-model="password"
            type="password"
            placeholder="パスワードを入力"
            autocomplete="current-password"
            :disabled="passwordLoading"
            @keydown.enter="handlePasswordSubmit"
          />
        </div>

        <AppAlert v-if="passwordError" variant="danger">
          {{ passwordError }}
        </AppAlert>
      </template>

      <!-- プロバイダ認証 -->
      <template v-if="currentStep === 'provider'">
        <p class="reauth-modal__provider-info">
          {{
            getProviderDisplayName(
              primaryProvider === "google.com" ||
                providers.includes("google.com")
                ? "google.com"
                : "github.com",
            )
          }}で再認証してください
        </p>

        <AppAlert v-if="providerError" variant="danger">
          {{ providerError }}
        </AppAlert>
      </template>

      <!-- TOTP入力 -->
      <template v-if="currentStep === 'totp'">
        <div class="reauth-modal__field">
          <label for="reauth-totp-input">認証コード（6桁）</label>
          <input
            id="reauth-totp-input"
            ref="totpInputRef"
            v-model="totpCode"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="6"
            placeholder="000000"
            autocomplete="one-time-code"
            class="reauth-modal__totp-input"
            :disabled="totpLoading"
            @keydown.enter="handleTotpSubmit"
          />
        </div>

        <AppAlert v-if="totpError" variant="danger">
          {{ totpError }}
        </AppAlert>

        <p class="reauth-modal__help">
          認証アプリ（Google
          Authenticator等）に表示されている6桁のコードを入力してください。
        </p>
      </template>
    </div>

    <template #footer>
      <AppButton variant="secondary" @click="handleClose">
        キャンセル
      </AppButton>

      <AppButton
        v-if="currentStep === 'password'"
        variant="primary"
        :disabled="!isValidPassword"
        :loading="passwordLoading"
        @click="handlePasswordSubmit"
      >
        認証する
      </AppButton>

      <AppButton
        v-if="currentStep === 'provider'"
        variant="primary"
        :loading="providerLoading"
        @click="handleProviderAuth"
      >
        {{
          getProviderDisplayName(
            primaryProvider === "google.com" || providers.includes("google.com")
              ? "google.com"
              : "github.com",
          )
        }}で認証
      </AppButton>

      <AppButton
        v-if="currentStep === 'totp'"
        variant="primary"
        :disabled="!isValidTotpCode"
        :loading="totpLoading"
        @click="handleTotpSubmit"
      >
        認証する
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.reauth-modal {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.reauth-modal__description {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  line-height: 1.6;
}

.reauth-modal__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-4, 1rem);
  color: var(--ui-text-muted, #64748b);
}

.reauth-modal__spinner {
  width: 24px;
  height: 24px;
  border-radius: var(--ui-radius-full, 9999px);
  border: 2px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-top-color: var(--ui-brand-600, #4f7c82);
  animation: reauth-spinner 0.8s linear infinite;
}

@keyframes reauth-spinner {
  to {
    transform: rotate(360deg);
  }
}

.reauth-modal__field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.reauth-modal__field label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text, #0b2e33);
}

.reauth-modal__provider-info {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text, #0b2e33);
  text-align: center;
}

.reauth-modal__totp-input {
  padding: var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-lg, 1.125rem);
  font-family: var(--ui-font-mono);
  letter-spacing: 0.3em;
  text-align: center;
  color: var(--ui-text, #0b2e33);
  background: var(--ui-surface, #fff);
  transition: var(--ui-transition-colors);
}

.reauth-modal__totp-input:focus {
  outline: none;
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.reauth-modal__totp-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.reauth-modal__totp-input::placeholder {
  letter-spacing: 0.3em;
  color: var(--ui-text-muted, #64748b);
}

.reauth-modal__help {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  line-height: 1.5;
}
</style>

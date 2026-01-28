<script setup lang="ts">
/**
 * MFAEnrollmentModal.vue - MFA（二段階認証）登録モーダル
 *
 * TOTP（Google Authenticatorなど）を使用した二段階認証の登録を行う
 */
import AppButton from "@/components/ui/AppButton.vue";
import { getLogger } from "@logtape/logtape";
import { computed, ref, watch } from "vue";

interface Props {
  open: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  totpSecret: any;
  qrCodeUrl: string;
}

interface Emits {
  (e: "close"): void;
  (e: "confirm", verificationCode: string, displayName: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const logger = getLogger("app.components.modals.MFAEnrollmentModal");

const verificationCode = ref("");
const displayName = ref("認証アプリ");
const error = ref("");

const isValid = computed(() => {
  return (
    verificationCode.value.trim().length === 6 &&
    displayName.value.trim().length > 0
  );
});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      verificationCode.value = "";
      displayName.value = "認証アプリ";
      error.value = "";
    }
  },
);

function handleClose() {
  emit("close");
}

function handleConfirm() {
  if (!isValid.value) {
    error.value = "入力内容を確認してください。";
    return;
  }

  emit("confirm", verificationCode.value.trim(), displayName.value.trim());
}

function copySecret() {
  if (!props.totpSecret) return;

  const secretKey = props.totpSecret.secretKey;
  navigator.clipboard.writeText(secretKey);
  logger.info`Secret key copied to clipboard`;
}
</script>

<template>
  <div v-if="open" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title">二段階認証の設定</h2>
        <button class="modal-close" aria-label="閉じる" @click="handleClose">
          ✕
        </button>
      </div>

      <div class="modal-body">
        <div class="step-section">
          <h3 class="step-title">1. 認証アプリでQRコードをスキャン</h3>
          <p class="step-description">
            Google Authenticator や Authy
            などの認証アプリで以下のQRコードをスキャンしてください。
          </p>
          <div v-if="qrCodeUrl" class="qr-code-container">
            <img :src="qrCodeUrl" alt="QR Code" class="qr-code" />
          </div>
        </div>

        <div class="step-section">
          <h3 class="step-title">2. または、シークレットキーを手動で入力</h3>
          <div v-if="totpSecret" class="secret-key-container">
            <code class="secret-key">{{ totpSecret.secretKey }}</code>
            <AppButton variant="secondary" size="sm" @click="copySecret">
              コピー
            </AppButton>
          </div>
        </div>

        <div class="step-section">
          <h3 class="step-title">3. 認証コードを入力</h3>
          <p class="step-description">
            認証アプリに表示された6桁のコードを入力してください。
          </p>
          <div class="form-field">
            <label for="mfa-code">認証コード（6桁）</label>
            <input
              id="mfa-code"
              v-model="verificationCode"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="6"
              placeholder="123456"
              autocomplete="one-time-code"
            />
          </div>
          <div class="form-field">
            <label for="mfa-display-name">表示名（任意）</label>
            <input
              id="mfa-display-name"
              v-model="displayName"
              type="text"
              placeholder="認証アプリ"
            />
          </div>
        </div>

        <p v-if="error" class="error-message">{{ error }}</p>
      </div>

      <div class="modal-footer">
        <AppButton variant="secondary" @click="handleClose">
          キャンセル
        </AppButton>
        <AppButton
          variant="primary"
          :disabled="!isValid"
          @click="handleConfirm"
        >
          設定を完了
        </AppButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(11, 46, 51, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--ui-space-4, 1rem);
}

.modal-content {
  background: var(--ui-surface, #fff);
  border-radius: var(--ui-radius-lg, 1rem);
  box-shadow: var(--ui-shadow-xl);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ui-space-4, 1rem) var(--ui-space-6, 1.5rem);
  border-bottom: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
}

.modal-title {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.modal-close {
  background: none;
  border: none;
  font-size: var(--ui-text-xl, 1.25rem);
  color: var(--ui-text-muted, #64748b);
  cursor: pointer;
  padding: var(--ui-space-1, 0.25rem);
  line-height: 1;
  transition: var(--ui-transition-colors);
}

.modal-close:hover {
  color: var(--ui-text-strong, #0f172a);
}

.modal-body {
  padding: var(--ui-space-6, 1.5rem);
  overflow-y: auto;
  flex: 1;
}

.step-section {
  margin-bottom: var(--ui-space-6, 1.5rem);
}

.step-section:last-child {
  margin-bottom: 0;
}

.step-title {
  margin: 0 0 var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.step-description {
  margin: 0 0 var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  line-height: 1.5;
}

.qr-code-container {
  display: flex;
  justify-content: center;
  padding: var(--ui-space-4, 1rem);
  background: var(--ui-surface-secondary, #f8f9fa);
  border-radius: var(--ui-radius-md, 0.75rem);
}

.qr-code {
  max-width: 200px;
  height: auto;
  border-radius: var(--ui-radius-sm, 0.5rem);
}

.secret-key-container {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
  align-items: center;
  padding: var(--ui-space-3, 0.75rem);
  background: var(--ui-surface-secondary, #f8f9fa);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
}

.secret-key {
  flex: 1;
  font-family: "Monaco", "Menlo", "Courier New", monospace;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text, #0b2e33);
  word-break: break-all;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
  margin-bottom: var(--ui-space-3, 0.75rem);
}

.form-field:last-child {
  margin-bottom: 0;
}

.form-field label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text-muted, #64748b);
}

.form-field input {
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text, #0b2e33);
  background: var(--ui-surface, #fff);
  transition: var(--ui-transition-colors);
}

.form-field input:focus {
  outline: none;
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.error-message {
  margin: var(--ui-space-3, 0.75rem) 0 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-danger, #d64545);
}

.modal-footer {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
  justify-content: flex-end;
  padding: var(--ui-space-4, 1rem) var(--ui-space-6, 1.5rem);
  border-top: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
}

@media (max-width: 768px) {
  .modal-content {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }

  .qr-code {
    max-width: 160px;
  }

  .modal-footer {
    flex-direction: column-reverse;
  }

  .modal-footer button {
    width: 100%;
  }
}
</style>

<script setup lang="ts">
/**
 * MFAVerificationModal - MFA検証モーダル
 *
 * 重要な操作（アカウント削除、プロジェクト削除、パスワード変更など）の
 * 実行前にMFA（2段階認証）を要求するモーダル。
 */
import { computed, ref, watch, nextTick } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppModal from "@/components/ui/AppModal.vue";

const props = withDefaults(
  defineProps<{
    /** モーダルの開閉状態 */
    open: boolean;
    /** モーダルのタイトル */
    title?: string;
    /** 説明文 */
    description?: string;
    /** 確認ボタンのラベル */
    confirmLabel?: string;
    /** キャンセルボタンのラベル */
    cancelLabel?: string;
    /** 実行中かどうか */
    loading?: boolean;
    /** エラーメッセージ */
    error?: string;
  }>(),
  {
    title: "2段階認証",
    description:
      "セキュリティのため、認証アプリに表示されている6桁のコードを入力してください。",
    confirmLabel: "確認",
    cancelLabel: "キャンセル",
    loading: false,
    error: undefined,
  },
);

const emit = defineEmits<{
  close: [];
  verified: [code: string];
}>();

const verificationCode = ref("");
const inputRef = ref<HTMLInputElement | null>(null);

const isValidCode = computed(() => {
  const code = verificationCode.value.trim();
  return code.length === 6 && /^\d+$/.test(code);
});

function handleVerify() {
  if (!isValidCode.value || props.loading) return;
  emit("verified", verificationCode.value.trim());
}

function handleClose() {
  if (props.loading) return;
  verificationCode.value = "";
  emit("close");
}

// フォーカス管理：モーダルが開いたら入力欄にフォーカス
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      verificationCode.value = "";
      await nextTick();
      inputRef.value?.focus();
    }
  },
);
</script>

<template>
  <AppModal :open="open" :title="title" @close="handleClose">
    <div class="mfa-verification-modal">
      <!-- 説明 -->
      <div class="mfa-verification-modal__info">
        <svg
          class="mfa-verification-modal__icon"
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
            d="M12 16V12M12 8H12.01"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <p>{{ description }}</p>
      </div>

      <!-- 入力フィールド -->
      <div class="mfa-verification-modal__field">
        <label :for="`mfa-code-input-${$.uid}`">認証コード（6桁）</label>
        <input
          :id="`mfa-code-input-${$.uid}`"
          ref="inputRef"
          v-model="verificationCode"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="6"
          placeholder="000000"
          autocomplete="one-time-code"
          :disabled="loading"
          @keydown.enter="handleVerify"
        />
      </div>

      <!-- エラーメッセージ -->
      <p v-if="error" class="mfa-verification-modal__error" role="alert">
        {{ error }}
      </p>

      <!-- アクションボタン -->
      <div class="mfa-verification-modal__actions">
        <AppButton variant="secondary" :disabled="loading" @click="handleClose">
          {{ cancelLabel }}
        </AppButton>
        <AppButton
          variant="primary"
          :disabled="!isValidCode"
          :loading="loading"
          @click="handleVerify"
        >
          {{ confirmLabel }}
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.mfa-verification-modal {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.mfa-verification-modal__info {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-3, 0.75rem);
  background: var(--ui-brand-50, #f0f9fa);
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-brand-700, #1a4a51);
}

.mfa-verification-modal__info p {
  margin: 0;
  flex: 1;
  line-height: 1.5;
}

.mfa-verification-modal__icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: var(--ui-brand-600, #4f7c82);
}

.mfa-verification-modal__field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.mfa-verification-modal__field label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text, #0b2e33);
}

.mfa-verification-modal__field input {
  padding: var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-lg, 1.125rem);
  font-family: var(--ui-font-mono);
  letter-spacing: 0.5em;
  text-align: center;
  color: var(--ui-text, #0b2e33);
  background: var(--ui-surface, #fff);
  transition: var(--ui-transition-colors);
}

.mfa-verification-modal__field input:focus {
  outline: none;
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.mfa-verification-modal__field input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.mfa-verification-modal__field input::placeholder {
  letter-spacing: 0.5em;
  color: var(--ui-text-muted, #64748b);
}

.mfa-verification-modal__error {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-status-danger, #dc2626);
}

.mfa-verification-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-2, 0.5rem);
  margin-top: var(--ui-space-2, 0.5rem);
}

@media (max-width: 768px) {
  .mfa-verification-modal__actions {
    flex-direction: column-reverse;
  }

  .mfa-verification-modal__actions button {
    width: 100%;
  }
}
</style>

<script setup lang="ts">
/**
 * ConfirmDangerModal - 危険な操作の確認モーダル
 *
 * アカウント削除などの破壊的操作の確認用。
 * 入力フィールドで特定のテキスト（パスワードやメールなど）を
 * 一致させてから操作を実行可能にする。
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
    /** 警告メッセージ（赤い背景で強調） */
    warningMessage?: string;
    /** 入力欄の説明文 */
    inputLabel?: string;
    /** 入力欄のプレースホルダー */
    inputPlaceholder?: string;
    /** 入力タイプ（password/text/email） */
    inputType?: "password" | "text" | "email";
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
    title: "操作の確認",
    warningMessage: undefined,
    inputLabel: "確認のため入力してください",
    inputPlaceholder: "",
    inputType: "password",
    confirmLabel: "実行",
    cancelLabel: "キャンセル",
    loading: false,
    error: undefined,
  },
);

const emit = defineEmits<{
  close: [];
  confirm: [value: string];
}>();

const inputValue = ref("");
const inputRef = ref<HTMLInputElement | null>(null);

const canConfirm = computed(() => inputValue.value.trim().length > 0);

function handleConfirm() {
  if (!canConfirm.value || props.loading) return;
  emit("confirm", inputValue.value);
}

function handleClose() {
  if (props.loading) return;
  inputValue.value = "";
  emit("close");
}

// フォーカス管理：モーダルが開いたら入力欄にフォーカス
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      inputValue.value = "";
      await nextTick();
      inputRef.value?.focus();
    }
  },
);
</script>

<template>
  <AppModal :open="open" :title="title" @close="handleClose">
    <div class="confirm-danger-modal">
      <!-- 警告メッセージ -->
      <div v-if="warningMessage" class="confirm-danger-modal__warning">
        <svg
          class="confirm-danger-modal__warning-icon"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.64 18.3 1.55 18.64 1.55 19C1.55 19.33 1.64 19.67 1.82 19.97C2 20.27 2.26 20.52 2.58 20.68C2.89 20.85 3.24 20.93 3.6 20.93H20.4C20.76 20.93 21.11 20.85 21.42 20.68C21.74 20.52 22 20.27 22.18 19.97C22.36 19.67 22.45 19.33 22.45 19C22.45 18.64 22.36 18.3 22.18 18L13.71 3.86C13.53 3.56 13.27 3.31 12.96 3.15C12.65 2.98 12.33 2.9 12 2.9C11.67 2.9 11.35 2.98 11.04 3.15C10.73 3.31 10.47 3.56 10.29 3.86Z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <p>{{ warningMessage }}</p>
      </div>

      <!-- 入力フィールド -->
      <div class="confirm-danger-modal__field">
        <label :for="`confirm-danger-input-${$.uid}`">{{ inputLabel }}</label>
        <input
          :id="`confirm-danger-input-${$.uid}`"
          ref="inputRef"
          v-model="inputValue"
          :type="inputType"
          :placeholder="inputPlaceholder"
          :disabled="loading"
          @keydown.enter="handleConfirm"
        />
      </div>

      <!-- エラーメッセージ -->
      <p v-if="error" class="confirm-danger-modal__error" role="alert">
        {{ error }}
      </p>

      <!-- アクションボタン -->
      <div class="confirm-danger-modal__actions">
        <AppButton variant="secondary" :disabled="loading" @click="handleClose">
          {{ cancelLabel }}
        </AppButton>
        <AppButton
          variant="danger"
          :disabled="!canConfirm"
          :loading="loading"
          @click="handleConfirm"
        >
          {{ confirmLabel }}
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.confirm-danger-modal {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.confirm-danger-modal__warning {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-3, 0.75rem);
  background: var(--ui-danger-light, #fee2e2);
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-danger-text, #991b1b);
}

.confirm-danger-modal__warning p {
  margin: 0;
  flex: 1;
}

.confirm-danger-modal__warning-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: var(--ui-status-danger, #dc2626);
}

.confirm-danger-modal__field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.confirm-danger-modal__field label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text, #0b2e33);
}

.confirm-danger-modal__field input {
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text, #0b2e33);
  background: var(--ui-surface, #fff);
  transition: var(--ui-transition-colors);
}

.confirm-danger-modal__field input:focus {
  outline: none;
  border-color: var(--ui-status-danger, #dc2626);
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
}

.confirm-danger-modal__field input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.confirm-danger-modal__error {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-status-danger, #dc2626);
}

.confirm-danger-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-2, 0.5rem);
  margin-top: var(--ui-space-2, 0.5rem);
}
</style>

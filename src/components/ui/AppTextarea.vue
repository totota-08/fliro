<script setup lang="ts">
/**
 * AppTextarea - 統一テキストエリアコンポーネント
 */
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    placeholder?: string;
    disabled?: boolean;
    error?: boolean;
    errorMessage?: string;
    rows?: number;
    resize?: "none" | "vertical" | "horizontal" | "both";
  }>(),
  {
    modelValue: "",
    placeholder: "",
    disabled: false,
    error: false,
    errorMessage: undefined,
    rows: 4,
    resize: "vertical",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const textareaValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit("update:modelValue", value),
});

const hasError = computed(() => props.error || Boolean(props.errorMessage));
</script>

<template>
  <div class="app-textarea-wrapper">
    <textarea
      v-model="textareaValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :rows="rows"
      :class="['app-textarea', { 'app-textarea--error': hasError }]"
      :style="{ resize }"
      :aria-invalid="hasError"
    />
    <p v-if="errorMessage" class="app-textarea__error" role="alert">
      {{ errorMessage }}
    </p>
  </div>
</template>

<style scoped>
.app-textarea-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.app-textarea {
  width: 100%;
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-sm, 0.5rem);
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text, #0b2e33);
  font-size: max(var(--ui-text-base, 1rem), 16px); /* iOS zoom prevention */
  font-family: inherit;
  line-height: var(--ui-leading-normal, 1.5);
  transition: var(--ui-transition-all);
  min-height: calc(var(--ui-touch-target-min, 44px) * 2); /* At least 2 lines */
}

.app-textarea::placeholder {
  color: var(--ui-text-placeholder, #94a3b8);
}

.app-textarea:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.app-textarea:disabled {
  background: var(--ui-surface-muted, #f1f5f9);
  cursor: not-allowed;
  opacity: 0.6;
}

/* Error State */
.app-textarea--error {
  border-color: var(--ui-danger, #d64545);
}

.app-textarea--error:focus {
  box-shadow: var(--ui-ring-danger);
}

.app-textarea__error {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-danger, #d64545);
}
</style>

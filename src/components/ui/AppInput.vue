<script setup lang="ts">
/**
 * AppInput - 統一テキスト入力コンポーネント
 */
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    type?: "text" | "email" | "password" | "search" | "tel" | "url" | "number";
    placeholder?: string;
    disabled?: boolean;
    error?: boolean;
    errorMessage?: string;
    size?: "sm" | "md" | "lg";
  }>(),
  {
    modelValue: "",
    type: "text",
    placeholder: "",
    disabled: false,
    error: false,
    errorMessage: undefined,
    size: "md",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const inputValue = computed({
  get: () => props.modelValue,
  set: (value: string | number) => emit("update:modelValue", String(value)),
});

const hasError = computed(() => props.error || Boolean(props.errorMessage));
</script>

<template>
  <div class="app-input-wrapper">
    <input
      v-model="inputValue"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="[
        'app-input',
        `app-input--${size}`,
        { 'app-input--error': hasError },
      ]"
      :aria-invalid="hasError"
    />
    <p v-if="errorMessage" class="app-input__error" role="alert">
      {{ errorMessage }}
    </p>
  </div>
</template>

<style scoped>
.app-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.app-input {
  width: 100%;
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-sm, 0.5rem);
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text, #0b2e33);
  font-size: max(var(--ui-text-base, 1rem), 16px); /* iOS zoom prevention */
  transition:
    border-color var(--ui-duration-base, 180ms) var(--ui-ease-standard),
    box-shadow var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.app-input::placeholder {
  color: var(--ui-text-placeholder, #94a3b8);
}

.app-input:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.app-input:disabled {
  background: var(--ui-surface-muted, #f1f5f9);
  cursor: not-allowed;
  opacity: 0.6;
}

/* Sizes */
.app-input--sm {
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  font-size: max(var(--ui-text-sm, 0.875rem), 16px); /* iOS zoom prevention */
  min-height: var(--ui-touch-target-min, 44px);
}

.app-input--md {
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  min-height: var(--ui-touch-target-min, 44px);
}

.app-input--lg {
  padding: var(--ui-space-4, 1rem) var(--ui-space-5, 1.25rem);
  font-size: var(--ui-text-lg, 1.125rem);
  min-height: var(--ui-touch-target-comfortable, 48px);
}

/* Error State */
.app-input--error {
  border-color: var(--ui-danger, #d64545);
}

.app-input--error:focus {
  box-shadow: var(--ui-ring-danger);
}

.app-input__error {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-danger, #d64545);
}
</style>

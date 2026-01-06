<script setup lang="ts">
/**
 * AppSelect - 統一セレクトボックスコンポーネント
 */
import { computed } from "vue";

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | number;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
    error?: boolean;
    errorMessage?: string;
    size?: "sm" | "md" | "lg";
  }>(),
  {
    modelValue: "",
    placeholder: "選択してください",
    disabled: false,
    error: false,
    errorMessage: undefined,
    size: "md",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string | number];
}>();

const selectValue = computed({
  get: () => props.modelValue,
  set: (value: string | number) => emit("update:modelValue", value),
});

const hasError = computed(() => props.error || Boolean(props.errorMessage));
</script>

<template>
  <div class="app-select-wrapper">
    <div class="app-select-container">
      <select
        v-model="selectValue"
        :disabled="disabled"
        :class="[
          'app-select',
          `app-select--${size}`,
          { 'app-select--error': hasError },
        ]"
        :aria-invalid="hasError"
      >
        <option v-if="placeholder" value="" disabled>
          {{ placeholder }}
        </option>
        <option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          :disabled="option.disabled"
        >
          {{ option.label }}
        </option>
      </select>
      <svg
        class="app-select__icon"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clip-rule="evenodd"
        />
      </svg>
    </div>
    <p v-if="errorMessage" class="app-select__error" role="alert">
      {{ errorMessage }}
    </p>
  </div>
</template>

<style scoped>
.app-select-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.app-select-container {
  position: relative;
  display: inline-block;
  width: 100%;
}

.app-select {
  width: 100%;
  appearance: none;
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-sm, 0.5rem);
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text, #0b2e33);
  font-size: var(--ui-text-base, 1rem);
  cursor: pointer;
  transition: var(--ui-transition-all);
  padding-right: var(--ui-space-10, 2.5rem);
}

.app-select:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.app-select:disabled {
  background: var(--ui-surface-muted, #f1f5f9);
  cursor: not-allowed;
  opacity: 0.6;
}

/* Sizes */
.app-select--sm {
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
}

.app-select--md {
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
}

.app-select--lg {
  padding: var(--ui-space-4, 1rem) var(--ui-space-5, 1.25rem);
  font-size: var(--ui-text-lg, 1.125rem);
}

/* Error State */
.app-select--error {
  border-color: var(--ui-danger, #d64545);
}

.app-select--error:focus {
  box-shadow: var(--ui-ring-danger);
}

.app-select__icon {
  position: absolute;
  right: var(--ui-space-3, 0.75rem);
  top: 50%;
  transform: translateY(-50%);
  width: 1.25rem;
  height: 1.25rem;
  color: var(--ui-text-muted, #64748b);
  pointer-events: none;
}

.app-select__error {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-danger, #d64545);
}
</style>

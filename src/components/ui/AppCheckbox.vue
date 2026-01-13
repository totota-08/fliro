<script setup lang="ts">
/**
 * AppCheckbox - カスタムチェックボックスコンポーネント
 * Deep Green / Card UI デザインに準拠
 */
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue?: boolean;
    disabled?: boolean;
    size?: "sm" | "md" | "lg";
    label?: string;
    description?: string;
    error?: boolean;
  }>(),
  {
    modelValue: false,
    disabled: false,
    size: "md",
    label: undefined,
    description: undefined,
    error: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const isChecked = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
});
</script>

<template>
  <label
    class="app-checkbox"
    :class="[
      `app-checkbox--${size}`,
      {
        'app-checkbox--checked': isChecked,
        'app-checkbox--disabled': disabled,
        'app-checkbox--error': error,
        'app-checkbox--with-content': label || description,
      },
    ]"
  >
    <input
      v-model="isChecked"
      type="checkbox"
      class="app-checkbox__input"
      :disabled="disabled"
    />
    <span class="app-checkbox__box">
      <svg
        class="app-checkbox__icon"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 6L5 9L10 3"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
    <div v-if="label || description" class="app-checkbox__content">
      <span v-if="label" class="app-checkbox__label">{{ label }}</span>
      <span v-if="description" class="app-checkbox__description">{{
        description
      }}</span>
    </div>
  </label>
</template>

<style scoped>
.app-checkbox {
  display: inline-flex;
  align-items: flex-start;
  gap: var(--ui-space-3, 0.75rem);
  cursor: pointer;
  user-select: none;
}

.app-checkbox--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.app-checkbox__input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.app-checkbox__box {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ui-surface, #ffffff);
  border: 2px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-sm, 0.5rem);
  transition: all var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.app-checkbox--checked .app-checkbox__box {
  background: var(--ui-brand-600, #4f7c82);
  border-color: var(--ui-brand-600, #4f7c82);
}

.app-checkbox--error .app-checkbox__box {
  border-color: var(--ui-danger, #d64545);
}

.app-checkbox__input:focus-visible + .app-checkbox__box {
  box-shadow: var(--ui-ring-focus);
}

.app-checkbox--error .app-checkbox__input:focus-visible + .app-checkbox__box {
  box-shadow: var(--ui-ring-danger);
}

.app-checkbox__icon {
  color: var(--ui-surface, #ffffff);
  opacity: 0;
  transform: scale(0.5);
  transition: all var(--ui-duration-fast, 120ms) var(--ui-ease-standard);
}

.app-checkbox--checked .app-checkbox__icon {
  opacity: 1;
  transform: scale(1);
}

/* Sizes */
.app-checkbox--sm .app-checkbox__box {
  width: 16px;
  height: 16px;
  border-radius: calc(var(--ui-radius-sm, 0.5rem) * 0.5);
}

.app-checkbox--sm .app-checkbox__icon {
  width: 10px;
  height: 10px;
}

.app-checkbox--md .app-checkbox__box {
  width: 20px;
  height: 20px;
}

.app-checkbox--md .app-checkbox__icon {
  width: 12px;
  height: 12px;
}

.app-checkbox--lg .app-checkbox__box {
  width: 24px;
  height: 24px;
}

.app-checkbox--lg .app-checkbox__icon {
  width: 14px;
  height: 14px;
}

/* Content */
.app-checkbox__content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.app-checkbox--sm .app-checkbox__content {
  padding-top: 0;
}

.app-checkbox--md .app-checkbox__content {
  padding-top: 1px;
}

.app-checkbox--lg .app-checkbox__content {
  padding-top: 2px;
}

.app-checkbox__label {
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text, #0b2e33);
  line-height: var(--ui-leading-tight, 1.25);
}

.app-checkbox--sm .app-checkbox__label {
  font-size: var(--ui-text-sm, 0.875rem);
}

.app-checkbox__description {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  line-height: var(--ui-leading-normal, 1.5);
}

/* Hover states */
.app-checkbox:not(.app-checkbox--disabled):hover .app-checkbox__box {
  border-color: var(--ui-border-strong, rgba(11, 46, 51, 0.2));
}

.app-checkbox--checked:not(.app-checkbox--disabled):hover .app-checkbox__box {
  background: var(--ui-brand-700, #1a4a51);
  border-color: var(--ui-brand-700, #1a4a51);
}

@media (prefers-reduced-motion: reduce) {
  .app-checkbox__box,
  .app-checkbox__icon {
    transition: none;
  }
}
</style>

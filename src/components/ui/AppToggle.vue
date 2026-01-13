<script setup lang="ts">
/**
 * AppToggle - カスタムトグルスイッチコンポーネント
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
  }>(),
  {
    modelValue: false,
    disabled: false,
    size: "md",
    label: undefined,
    description: undefined,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const isChecked = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
});

function toggle() {
  if (props.disabled) return;
  isChecked.value = !isChecked.value;
}
</script>

<template>
  <label
    class="app-toggle"
    :class="[
      `app-toggle--${size}`,
      {
        'app-toggle--checked': isChecked,
        'app-toggle--disabled': disabled,
        'app-toggle--with-content': label || description,
      },
    ]"
  >
    <input
      v-model="isChecked"
      type="checkbox"
      class="app-toggle__input"
      :disabled="disabled"
      @keydown.enter.prevent="toggle"
    />
    <span class="app-toggle__track">
      <span class="app-toggle__thumb">
        <svg
          v-if="isChecked"
          class="app-toggle__icon"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M2.5 6L5 8.5L9.5 3.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </span>
    <div v-if="label || description" class="app-toggle__content">
      <span v-if="label" class="app-toggle__label">{{ label }}</span>
      <span v-if="description" class="app-toggle__description">{{
        description
      }}</span>
    </div>
  </label>
</template>

<style scoped>
.app-toggle {
  display: inline-flex;
  align-items: flex-start;
  gap: var(--ui-space-3, 0.75rem);
  cursor: pointer;
  user-select: none;
}

.app-toggle--with-content {
  align-items: flex-start;
}

.app-toggle--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.app-toggle__input {
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

.app-toggle__track {
  position: relative;
  flex-shrink: 0;
  background: var(--ui-surface-muted, #f1f5f9);
  border: 2px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-full, 9999px);
  transition: all var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.app-toggle--checked .app-toggle__track {
  background: var(--ui-brand-600, #4f7c82);
  border-color: var(--ui-brand-600, #4f7c82);
}

.app-toggle__input:focus-visible + .app-toggle__track {
  box-shadow: var(--ui-ring-focus);
}

.app-toggle__thumb {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-full, 9999px);
  box-shadow: var(--ui-shadow-sm);
  transition: transform var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.app-toggle__icon {
  color: var(--ui-brand-600, #4f7c82);
}

/* Sizes */
.app-toggle--sm .app-toggle__track {
  width: 36px;
  height: 20px;
}

.app-toggle--sm .app-toggle__thumb {
  width: 14px;
  height: 14px;
  top: 1px;
  left: 1px;
}

.app-toggle--sm.app-toggle--checked .app-toggle__thumb {
  transform: translateX(16px);
}

.app-toggle--sm .app-toggle__icon {
  width: 8px;
  height: 8px;
}

.app-toggle--md .app-toggle__track {
  width: 44px;
  height: 24px;
}

.app-toggle--md .app-toggle__thumb {
  width: 18px;
  height: 18px;
  top: 1px;
  left: 1px;
}

.app-toggle--md.app-toggle--checked .app-toggle__thumb {
  transform: translateX(20px);
}

.app-toggle--md .app-toggle__icon {
  width: 10px;
  height: 10px;
}

.app-toggle--lg .app-toggle__track {
  width: 52px;
  height: 28px;
}

.app-toggle--lg .app-toggle__thumb {
  width: 22px;
  height: 22px;
  top: 1px;
  left: 1px;
}

.app-toggle--lg.app-toggle--checked .app-toggle__thumb {
  transform: translateX(24px);
}

.app-toggle--lg .app-toggle__icon {
  width: 12px;
  height: 12px;
}

/* Content */
.app-toggle__content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
  padding-top: 2px;
}

.app-toggle__label {
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
  line-height: var(--ui-leading-tight, 1.25);
}

.app-toggle__description {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  line-height: var(--ui-leading-normal, 1.5);
}

/* Hover states */
.app-toggle:not(.app-toggle--disabled):hover .app-toggle__track {
  border-color: var(--ui-border-strong, rgba(11, 46, 51, 0.2));
}

.app-toggle--checked:not(.app-toggle--disabled):hover .app-toggle__track {
  background: var(--ui-brand-700, #1a4a51);
  border-color: var(--ui-brand-700, #1a4a51);
}

@media (prefers-reduced-motion: reduce) {
  .app-toggle__track,
  .app-toggle__thumb {
    transition: none;
  }
}
</style>

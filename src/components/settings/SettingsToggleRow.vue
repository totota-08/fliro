<script setup lang="ts">
/**
 * SettingsToggleRow.vue
 * トグル行（ラベル/説明/スイッチ）を統一
 */
import { useId } from "vue";

interface Props {
  label: string;
  description?: string;
  modelValue: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

const props = withDefaults(defineProps<Props>(), {
  description: "",
  disabled: false,
  disabledReason: "",
});

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const inputId = `toggle-${useId()}`;

function toggle() {
  if (!props.disabled) {
    emit("update:modelValue", !props.modelValue);
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    toggle();
  }
}
</script>

<template>
  <div
    class="settings-toggle"
    :class="{ 'settings-toggle--disabled': disabled }"
    role="switch"
    :aria-checked="modelValue"
    :aria-disabled="disabled"
    tabindex="0"
    @click="toggle"
    @keydown="handleKeydown"
  >
    <div class="settings-toggle__content">
      <span class="settings-toggle__label">{{ label }}</span>
      <span v-if="description" class="settings-toggle__description">
        {{ description }}
      </span>
      <span
        v-if="disabled && disabledReason"
        class="settings-toggle__disabled-reason"
      >
        {{ disabledReason }}
      </span>
    </div>
    <label :for="inputId" class="settings-toggle__switch" @click.stop>
      <input
        :id="inputId"
        type="checkbox"
        class="settings-toggle__input"
        :checked="modelValue"
        :disabled="disabled"
        @change="toggle"
      />
      <span
        class="settings-toggle__slider"
        :class="{ 'settings-toggle__slider--active': modelValue }"
      />
    </label>
  </div>
</template>

<style scoped>
.settings-toggle {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-space-4, 1rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface-muted, #f1f5f9);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.settings-toggle:hover:not(.settings-toggle--disabled) {
  background: var(--ui-brand-100, #e5f6f8);
}

.settings-toggle:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

.settings-toggle--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.settings-toggle__content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
  min-width: 0;
  flex: 1;
}

.settings-toggle__label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text, #0b2e33);
  line-height: var(--ui-leading-tight, 1.25);
}

.settings-toggle__description {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  line-height: var(--ui-leading-normal, 1.5);
}

.settings-toggle__disabled-reason {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-warning-text, #7c4a00);
  font-style: italic;
}

.settings-toggle__switch {
  position: relative;
  flex-shrink: 0;
}

.settings-toggle__input {
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

.settings-toggle__slider {
  position: relative;
  display: block;
  width: 44px;
  height: 24px;
  background-color: var(--ui-border-strong, rgba(11, 46, 51, 0.2));
  border-radius: var(--ui-radius-full, 9999px);
  transition: var(--ui-transition-colors);
}

.settings-toggle__slider::before {
  content: "";
  position: absolute;
  height: 20px;
  width: 20px;
  left: 2px;
  bottom: 2px;
  background-color: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-full, 9999px);
  transition: var(--ui-transition-transform);
  box-shadow: var(--ui-shadow-sm);
}

.settings-toggle__slider--active {
  background-color: var(--ui-brand-600, #4f7c82);
}

.settings-toggle__slider--active::before {
  transform: translateX(20px);
}

.settings-toggle__input:focus-visible + .settings-toggle__slider {
  box-shadow: var(--ui-ring-focus);
}

@media (prefers-reduced-motion: reduce) {
  .settings-toggle__slider::before {
    transition: none;
  }
}
</style>

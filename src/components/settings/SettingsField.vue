<script setup lang="ts">
/**
 * SettingsField.vue
 * ラベル + 補足 + 入力欄の縦レイアウトを統一
 */

interface Props {
  label: string;
  help?: string;
  required?: boolean;
  htmlFor?: string;
}

withDefaults(defineProps<Props>(), {
  help: "",
  required: false,
  htmlFor: "",
});
</script>

<template>
  <div class="settings-field">
    <label
      v-if="label"
      class="settings-field__label"
      :for="htmlFor || undefined"
    >
      {{ label }}
      <span v-if="required" class="settings-field__required" aria-label="必須"
        >*</span
      >
    </label>
    <p v-if="help" class="settings-field__help">{{ help }}</p>
    <div class="settings-field__input">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.settings-field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.settings-field__label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text, #0b2e33);
  line-height: var(--ui-leading-tight, 1.25);
}

.settings-field__required {
  color: var(--ui-danger, #d64545);
  margin-left: var(--ui-space-1, 0.25rem);
}

.settings-field__help {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  margin: 0;
  line-height: var(--ui-leading-normal, 1.5);
}

.settings-field__input {
  width: 100%;
}

.settings-field__input :deep(input),
.settings-field__input :deep(textarea),
.settings-field__input :deep(select) {
  width: 100%;
}
</style>

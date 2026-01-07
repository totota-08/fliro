<script setup lang="ts">
/**
 * AppField - 統一フォームフィールドコンポーネント
 *
 * ラベル + コントロール + ヘルプテキスト の共通レイアウト
 */
withDefaults(
  defineProps<{
    label?: string;
    htmlFor?: string;
    required?: boolean;
    hint?: string;
    error?: string;
  }>(),
  {
    label: undefined,
    htmlFor: undefined,
    required: false,
    hint: undefined,
    error: undefined,
  },
);
</script>

<template>
  <div class="app-field">
    <label v-if="label" :for="htmlFor" class="app-field__label">
      {{ label }}
      <span v-if="required" class="app-field__required" aria-hidden="true"
        >*</span
      >
    </label>

    <div class="app-field__control">
      <slot />
    </div>

    <p v-if="hint && !error" class="app-field__hint">
      {{ hint }}
    </p>

    <p v-if="error" class="app-field__error" role="alert">
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.app-field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.app-field__label {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1, 0.25rem);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text, #0b2e33);
}

.app-field__required {
  color: var(--ui-danger, #d64545);
}

.app-field__control {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.app-field__hint {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.app-field__error {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-danger, #d64545);
}
</style>

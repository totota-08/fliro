<script setup lang="ts">
/**
 * SettingsSectionCard.vue
 * 設定セクション共通のカードUI
 */
import { computed } from "vue";

interface Props {
  title: string;
  description?: string;
  dirty?: boolean;
  saving?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  description: "",
  dirty: false,
  saving: false,
  saveDisabled: false,
  saveLabel: "保存",
});

const emit = defineEmits<{
  save: [];
}>();

const isButtonDisabled = computed(
  () => props.saveDisabled || !props.dirty || props.saving,
);

function handleSave() {
  if (!isButtonDisabled.value) {
    emit("save");
  }
}
</script>

<template>
  <section class="settings-card">
    <header class="settings-card__header">
      <div class="settings-card__header-left">
        <div v-if="$slots.icon" class="settings-card__icon">
          <slot name="icon" />
        </div>
        <div class="settings-card__titles">
          <h2 class="settings-card__title">{{ title }}</h2>
          <p v-if="description" class="settings-card__description">
            {{ description }}
          </p>
        </div>
      </div>
      <div class="settings-card__header-right">
        <slot name="headerActions">
          <button
            v-if="$slots.default"
            type="button"
            class="settings-card__save-btn"
            :class="{
              'settings-card__save-btn--disabled': isButtonDisabled,
              'settings-card__save-btn--saving': saving,
            }"
            :disabled="isButtonDisabled"
            @click="handleSave"
          >
            <span
              v-if="saving"
              class="settings-card__spinner"
              aria-hidden="true"
            />
            {{ saving ? "保存中..." : saveLabel }}
          </button>
        </slot>
      </div>
    </header>
    <div v-if="$slots.default" class="settings-card__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.settings-card {
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-xl, 1.25rem);
  box-shadow: var(--ui-shadow-md);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  overflow: hidden;
}

.settings-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-space-4, 1rem);
  padding: var(--ui-space-5, 1.25rem) var(--ui-space-6, 1.5rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.settings-card__header-left {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-3, 0.75rem);
  min-width: 0;
}

.settings-card__icon {
  width: 36px;
  height: 36px;
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-600, #4f7c82);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.settings-card__icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.settings-card__titles {
  min-width: 0;
}

.settings-card__title {
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
  margin: 0;
  line-height: var(--ui-leading-tight, 1.25);
}

.settings-card__description {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  margin: var(--ui-space-1, 0.25rem) 0 0;
  line-height: var(--ui-leading-normal, 1.5);
}

.settings-card__header-right {
  flex-shrink: 0;
}

.settings-card__save-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: none;
  background: var(--ui-brand-600, #4f7c82);
  color: var(--ui-text-inverse, #ffffff);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.settings-card__save-btn:hover:not(:disabled) {
  background: var(--ui-brand-700, #3d6166);
}

.settings-card__save-btn:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

.settings-card__save-btn--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.settings-card__save-btn--saving {
  cursor: wait;
}

.settings-card__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: var(--ui-radius-full, 9999px);
  animation: settings-spin 0.8s linear infinite;
}

@keyframes settings-spin {
  to {
    transform: rotate(360deg);
  }
}

.settings-card__body {
  padding: var(--ui-space-5, 1.25rem) var(--ui-space-6, 1.5rem);
}

@media (prefers-reduced-motion: reduce) {
  .settings-card__spinner {
    animation: none;
  }
}
</style>

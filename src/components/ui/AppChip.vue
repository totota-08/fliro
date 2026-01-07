<script setup lang="ts">
/**
 * AppChip - 統一チップコンポーネント
 *
 * カテゴリやタグの表示に使用
 * 削除可能なチップにも対応
 */
withDefaults(
  defineProps<{
    color?: string;
    removable?: boolean;
    size?: "sm" | "md";
  }>(),
  {
    color: undefined,
    removable: false,
    size: "md",
  },
);

const emit = defineEmits<{
  remove: [];
}>();
</script>

<template>
  <span
    :class="['app-chip', `app-chip--${size}`]"
    :style="color ? { '--chip-color': color } : undefined"
  >
    <span class="app-chip__dot" aria-hidden="true" />
    <span class="app-chip__label">
      <slot />
    </span>
    <button
      v-if="removable"
      type="button"
      class="app-chip__remove"
      aria-label="削除"
      @click="emit('remove')"
    >
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path
          d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
        />
      </svg>
    </button>
  </span>
</template>

<style scoped>
.app-chip {
  --chip-color: var(--ui-brand-600, #4f7c82);

  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-full, 9999px);
  color: var(--ui-text, #0b2e33);
}

/* Sizes */
.app-chip--sm {
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-xs, 0.75rem);
}

.app-chip--md {
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
}

.app-chip__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--chip-color);
  flex-shrink: 0;
}

.app-chip__label {
  font-weight: var(--ui-font-medium, 500);
}

.app-chip__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--ui-text-muted, #64748b);
  cursor: pointer;
  border-radius: var(--ui-radius-full, 9999px);
  transition: var(--ui-transition-colors);
}

.app-chip__remove:hover {
  background: var(--ui-danger-light, #fee2e2);
  color: var(--ui-danger, #d64545);
}

.app-chip__remove svg {
  width: 0.75rem;
  height: 0.75rem;
}
</style>

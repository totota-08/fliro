<script setup lang="ts">
/**
 * AppBadge - 統一バッジコンポーネント
 *
 * ステータスやロールの表示に使用
 */
withDefaults(
  defineProps<{
    variant?:
      | "default"
      | "primary"
      | "success"
      | "warning"
      | "danger"
      | "info"
      | "owner"
      | "admin"
      | "member"
      | "viewer";
    size?: "sm" | "md";
  }>(),
  {
    variant: "default",
    size: "md",
  },
);
</script>

<template>
  <span :class="['app-badge', `app-badge--${variant}`, `app-badge--${size}`]">
    <slot />
  </span>
</template>

<style scoped>
.app-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--ui-radius-full, 9999px);
  font-weight: var(--ui-font-semibold, 600);
  white-space: nowrap;
}

/* Sizes */
.app-badge--sm {
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-xs, 0.75rem);
}

.app-badge--md {
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
}

/* Variants */
.app-badge--default {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text, #0b2e33);
}

.app-badge--primary {
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-900, #0b2e33);
}

.app-badge--success {
  background: var(--ui-success-light, #dcfce7);
  color: var(--ui-success, #16a34a);
}

.app-badge--warning {
  background: var(--ui-warning-light, #fef3c7);
  color: #b45309;
}

.app-badge--danger {
  background: var(--ui-danger-light, #fee2e2);
  color: var(--ui-danger, #d64545);
}

.app-badge--info {
  background: var(--ui-info-light, #e0f2fe);
  color: var(--ui-info, #0284c7);
}

/* Role Variants */
.app-badge--owner {
  background: rgba(11, 46, 51, 0.12);
  color: var(--ui-brand-900, #0b2e33);
}

.app-badge--admin {
  background: rgba(79, 124, 130, 0.2);
  color: var(--ui-brand-900, #0b2e33);
}

.app-badge--member,
.app-badge--viewer {
  background: rgba(11, 46, 51, 0.06);
  color: var(--ui-text-muted, #64748b);
}
</style>

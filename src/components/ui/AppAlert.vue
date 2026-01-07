<script setup lang="ts">
/**
 * AppAlert - 統一アラートコンポーネント
 *
 * info / success / warning / danger の4種類
 */
withDefaults(
  defineProps<{
    variant?: "info" | "success" | "warning" | "danger";
    title?: string;
    dismissible?: boolean;
  }>(),
  {
    variant: "info",
    title: undefined,
    dismissible: false,
  },
);

const emit = defineEmits<{
  dismiss: [];
}>();
</script>

<template>
  <div
    :class="['app-alert', `app-alert--${variant}`]"
    role="alert"
    :aria-live="variant === 'danger' ? 'assertive' : 'polite'"
  >
    <div class="app-alert__icon" aria-hidden="true">
      <!-- Info -->
      <svg v-if="variant === 'info'" viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
          clip-rule="evenodd"
        />
      </svg>
      <!-- Success -->
      <svg
        v-else-if="variant === 'success'"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
          clip-rule="evenodd"
        />
      </svg>
      <!-- Warning -->
      <svg
        v-else-if="variant === 'warning'"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clip-rule="evenodd"
        />
      </svg>
      <!-- Danger -->
      <svg v-else viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
          clip-rule="evenodd"
        />
      </svg>
    </div>

    <div class="app-alert__content">
      <p v-if="title" class="app-alert__title">{{ title }}</p>
      <div class="app-alert__body">
        <slot />
      </div>
    </div>

    <button
      v-if="dismissible"
      type="button"
      class="app-alert__dismiss"
      aria-label="閉じる"
      @click="emit('dismiss')"
    >
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path
          d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
        />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.app-alert {
  display: flex;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid transparent;
}

/* Variants */
.app-alert--info {
  background: var(--ui-info-light, #e0f2fe);
  border-color: rgba(2, 132, 199, 0.2);
  color: #0c4a6e;
}

.app-alert--success {
  background: var(--ui-success-light, #dcfce7);
  border-color: rgba(22, 163, 74, 0.2);
  color: #14532d;
}

.app-alert--warning {
  background: var(--ui-warning-light, #fef3c7);
  border-color: rgba(245, 158, 11, 0.2);
  color: #78350f;
}

.app-alert--danger {
  background: var(--ui-danger-light, #fee2e2);
  border-color: rgba(214, 69, 69, 0.2);
  color: #7f1d1d;
}

.app-alert__icon {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
}

.app-alert__icon svg {
  width: 100%;
  height: 100%;
}

.app-alert--info .app-alert__icon {
  color: var(--ui-info, #0284c7);
}

.app-alert--success .app-alert__icon {
  color: var(--ui-success, #16a34a);
}

.app-alert--warning .app-alert__icon {
  color: var(--ui-warning, #f59e0b);
}

.app-alert--danger .app-alert__icon {
  color: var(--ui-danger, #d64545);
}

.app-alert__content {
  flex: 1;
  min-width: 0;
}

.app-alert__title {
  margin: 0 0 var(--ui-space-1, 0.25rem);
  font-weight: var(--ui-font-semibold, 600);
  font-size: var(--ui-text-sm, 0.875rem);
}

.app-alert__body {
  font-size: var(--ui-text-sm, 0.875rem);
  line-height: var(--ui-leading-normal, 1.5);
}

.app-alert__body p {
  margin: 0;
}

.app-alert__dismiss {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: none;
  background: transparent;
  color: currentColor;
  opacity: 0.6;
  cursor: pointer;
  border-radius: var(--ui-radius-sm, 0.5rem);
  transition: var(--ui-transition-colors);
}

.app-alert__dismiss:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.1);
}

.app-alert__dismiss svg {
  width: 100%;
  height: 100%;
}
</style>

<script setup lang="ts">
/**
 * AppButton - 統一ボタンコンポーネント
 *
 * variants: primary / secondary / outline / ghost / danger
 * sizes: sm / md / lg
 */
import { computed, useAttrs } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";

const props = withDefaults(
  defineProps<{
    variant?:
      | "primary"
      | "secondary"
      | "outline"
      | "ghost"
      | "danger"
      | "danger-outline";
    size?: "sm" | "md" | "lg";
    loading?: boolean;
    to?: RouteLocationRaw;
    type?: "button" | "submit" | "reset";
    block?: boolean;
  }>(),
  {
    variant: "primary",
    size: "md",
    loading: false,
    type: "button",
    block: false,
  },
);

const attrs = useAttrs();

const isLink = computed(() => Boolean(props.to));
const classes = computed(() => [
  "app-button",
  `app-button--${props.variant}`,
  `app-button--${props.size}`,
  { "is-loading": props.loading, "is-block": props.block },
]);
</script>

<template>
  <component
    :is="isLink ? RouterLink : 'button'"
    :to="isLink ? to : undefined"
    :type="!isLink ? type : undefined"
    v-bind="attrs"
    :class="classes"
    :aria-busy="loading ? 'true' : undefined"
  >
    <span v-if="loading" class="app-button__spinner" aria-hidden="true" />
    <slot />
  </component>
</template>

<style scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-2, 0.5rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    background-color var(--ui-duration-base, 180ms) var(--ui-ease-standard),
    color var(--ui-duration-base, 180ms) var(--ui-ease-standard),
    border-color var(--ui-duration-base, 180ms) var(--ui-ease-standard),
    box-shadow var(--ui-duration-base, 180ms) var(--ui-ease-standard),
    transform var(--ui-duration-base, 180ms) var(--ui-ease-standard);
  text-decoration: none;
  white-space: nowrap;
}

/* Sizes */
.app-button--sm {
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  border-radius: var(--ui-radius-sm, 0.5rem);
  min-height: var(--ui-touch-target-min, 44px);
}

.app-button--md {
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-5, 1.25rem);
  font-size: var(--ui-text-base, 1rem);
  min-height: var(--ui-touch-target-comfortable, 48px);
}

.app-button--lg {
  padding: var(--ui-space-4, 1rem) var(--ui-space-6, 1.5rem);
  font-size: var(--ui-text-lg, 1.125rem);
  min-height: 52px;
}

/* Primary */
.app-button--primary {
  background: var(--ui-brand-600, #4f7c82);
  border-color: var(--ui-brand-600, #4f7c82);
  color: var(--ui-text-inverse, #fff);
  box-shadow: var(--ui-shadow-btn-primary);
}

.app-button--primary:not(:disabled):hover {
  background: var(--ui-brand-900, #0b2e33);
  border-color: var(--ui-brand-900, #0b2e33);
  transform: translateY(-1px);
  box-shadow: var(--ui-shadow-btn-hover);
}

.app-button--primary:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

/* Secondary (= Outline with border) */
.app-button--secondary {
  background: transparent;
  border-color: var(--ui-border-strong, rgba(11, 46, 51, 0.2));
  color: var(--ui-text, #0b2e33);
}

.app-button--secondary:not(:disabled):hover {
  border-color: var(--ui-brand-600, #4f7c82);
  color: var(--ui-brand-600, #4f7c82);
  transform: translateY(-1px);
}

.app-button--secondary:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

/* Outline */
.app-button--outline {
  background: transparent;
  border-color: var(--ui-brand-600, #4f7c82);
  color: var(--ui-brand-600, #4f7c82);
}

.app-button--outline:not(:disabled):hover {
  background: var(--ui-brand-100, #e5f6f8);
  border-color: var(--ui-brand-900, #0b2e33);
  color: var(--ui-brand-900, #0b2e33);
}

.app-button--outline:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

/* Ghost */
.app-button--ghost {
  background: transparent;
  border-color: transparent;
  color: var(--ui-text, #0b2e33);
}

.app-button--ghost:not(:disabled):hover {
  background: var(--ui-surface-muted, #f1f5f9);
}

.app-button--ghost:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

/* Danger */
.app-button--danger {
  background: var(--ui-danger, #d64545);
  border-color: var(--ui-danger, #d64545);
  color: var(--ui-text-inverse, #fff);
}

.app-button--danger:not(:disabled):hover {
  background: #b73a3a;
  border-color: #b73a3a;
  transform: translateY(-1px);
}

.app-button--danger:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-danger);
}

/* Danger Outline */
.app-button--danger-outline {
  background: transparent;
  border-color: var(--ui-danger, #d64545);
  color: var(--ui-danger, #d64545);
}

.app-button--danger-outline:not(:disabled):hover {
  background: var(--ui-danger-light, #fee2e2);
}

.app-button--danger-outline:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-danger);
}

/* Disabled */
.app-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

/* Block */
.app-button.is-block {
  display: flex;
  width: 100%;
}

/* Spinner */
.app-button__spinner {
  width: 1rem;
  height: 1rem;
  border-radius: var(--ui-radius-full, 9999px);
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: var(--ui-text-inverse, #fff);
  animation: app-button-spin 0.8s linear infinite;
}

.app-button--secondary .app-button__spinner,
.app-button--outline .app-button__spinner,
.app-button--ghost .app-button__spinner {
  border-color: var(--ui-border, rgba(11, 46, 51, 0.12));
  border-top-color: var(--ui-text, #0b2e33);
}

@keyframes app-button-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Touch device active state */
@media (hover: none) and (pointer: coarse) {
  .app-button:not(:disabled):active {
    transform: scale(0.97);
    transition: transform 0.1s ease;
  }
}
</style>

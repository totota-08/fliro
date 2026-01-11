<script setup lang="ts">
/**
 * DangerZoneCard.vue
 * Danger Zone を折りたたみカード化
 */
import { ref, computed } from "vue";

interface Props {
  title: string;
  defaultOpen?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  defaultOpen: false,
});

const isOpen = ref(props.defaultOpen);
const contentId = computed(
  () => `danger-zone-${Math.random().toString(36).slice(2, 9)}`,
);

function toggle() {
  isOpen.value = !isOpen.value;
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    toggle();
  }
}
</script>

<template>
  <section class="danger-zone">
    <header
      class="danger-zone__header"
      role="button"
      tabindex="0"
      :aria-expanded="isOpen"
      :aria-controls="contentId"
      @click="toggle"
      @keydown="handleKeydown"
    >
      <div class="danger-zone__header-left">
        <div class="danger-zone__icon">
          <slot name="icon">
            <svg
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </slot>
        </div>
        <span class="danger-zone__title">{{ title }}</span>
      </div>
      <span
        class="danger-zone__chevron"
        :class="{ 'danger-zone__chevron--open': isOpen }"
        aria-hidden="true"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </span>
    </header>
    <div
      :id="contentId"
      class="danger-zone__content"
      :class="{ 'danger-zone__content--open': isOpen }"
      :aria-hidden="!isOpen"
    >
      <div class="danger-zone__content-inner">
        <slot />
      </div>
    </div>
  </section>
</template>

<style scoped>
.danger-zone {
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-xl, 1.25rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  overflow: hidden;
}

.danger-zone__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4, 1rem);
  padding: var(--ui-space-4, 1rem) var(--ui-space-5, 1.25rem);
  cursor: pointer;
  user-select: none;
  transition: var(--ui-transition-colors);
}

.danger-zone__header:hover {
  background: var(--ui-surface-muted, #f1f5f9);
}

.danger-zone__header:focus-visible {
  outline: none;
  box-shadow: inset var(--ui-ring-focus);
}

.danger-zone__header-left {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
}

.danger-zone__icon {
  width: 32px;
  height: 32px;
  border-radius: var(--ui-radius-sm, 0.5rem);
  background: var(--ui-danger-light, #fee2e2);
  color: var(--ui-danger, #d64545);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.danger-zone__icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.danger-zone__title {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.danger-zone__chevron {
  color: var(--ui-text-muted, #64748b);
  transition: var(--ui-transition-transform);
  flex-shrink: 0;
}

.danger-zone__chevron--open {
  transform: rotate(180deg);
}

.danger-zone__content {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows var(--ui-duration-base, 180ms) var(--ui-ease-standard),
    opacity var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.danger-zone__content--open {
  grid-template-rows: 1fr;
  opacity: 1;
}

.danger-zone__content-inner {
  overflow: hidden;
}

.danger-zone__content--open .danger-zone__content-inner {
  padding: var(--ui-space-5, 1.25rem);
  padding-top: 0;
}

@media (prefers-reduced-motion: reduce) {
  .danger-zone__chevron,
  .danger-zone__content {
    transition: none;
  }
}
</style>

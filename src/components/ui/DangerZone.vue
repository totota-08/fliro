<script setup lang="ts">
/**
 * DangerZone - 危険な操作用の折りたたみセクション
 *
 * アカウント削除などの破壊的操作を「折りたたみ」で隠し、
 * 常時赤面積を減らすためのコンポーネント
 */
import { ref } from "vue";

const props = withDefaults(
  defineProps<{
    /** 折りたたみヘッダーに表示するタイトル */
    title?: string;
    /** 折りたたみヘッダーに表示する説明（閉じ状態でも見える） */
    summary?: string;
    /** デフォルトで開いた状態にするか */
    defaultOpen?: boolean;
  }>(),
  {
    title: "危険な操作",
    summary: undefined,
    defaultOpen: false,
  },
);

const isOpen = ref(props.defaultOpen);
</script>

<template>
  <details class="danger-zone" :open="isOpen">
    <summary class="danger-zone__header" @click.prevent="isOpen = !isOpen">
      <div class="danger-zone__header-content">
        <div class="danger-zone__indicator" aria-hidden="true">
          <svg
            class="danger-zone__chevron"
            :class="{ 'is-open': isOpen }"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M9 18L15 12L9 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div class="danger-zone__titles">
          <h3 class="danger-zone__title">{{ title }}</h3>
          <p v-if="summary" class="danger-zone__summary">{{ summary }}</p>
        </div>
      </div>
    </summary>
    <div class="danger-zone__body">
      <slot />
    </div>
  </details>
</template>

<style scoped>
.danger-zone {
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-danger-light, rgba(220, 38, 38, 0.3));
  border-radius: var(--ui-radius-xl, 1.25rem);
  overflow: hidden;
}

.danger-zone[open] {
  border-color: var(--ui-status-danger, #dc2626);
}

.danger-zone__header {
  display: flex;
  align-items: center;
  padding: var(--ui-space-4, 1rem) var(--ui-space-5, 1.25rem);
  cursor: pointer;
  list-style: none;
  user-select: none;
  transition: background var(--ui-duration-fast, 150ms)
    var(--ui-ease-standard, ease);
}

.danger-zone__header::-webkit-details-marker {
  display: none;
}

.danger-zone__header:hover {
  background: rgba(220, 38, 38, 0.03);
}

.danger-zone__header:focus-visible {
  outline: 2px solid var(--ui-status-danger, #dc2626);
  outline-offset: -2px;
}

.danger-zone__header-content {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
}

.danger-zone__indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  color: var(--ui-status-danger, #dc2626);
}

.danger-zone__chevron {
  width: 16px;
  height: 16px;
  transition: transform var(--ui-duration-fast, 150ms)
    var(--ui-ease-standard, ease);
}

.danger-zone__chevron.is-open {
  transform: rotate(90deg);
}

.danger-zone__titles {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.danger-zone__title {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-status-danger, #dc2626);
}

.danger-zone__summary {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.danger-zone__body {
  padding: 0 var(--ui-space-5, 1.25rem) var(--ui-space-4, 1rem);
  animation: dangerZoneSlideDown var(--ui-duration-fast, 150ms)
    var(--ui-ease-standard, ease);
}

@keyframes dangerZoneSlideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .danger-zone__chevron,
  .danger-zone__header {
    transition: none;
  }

  .danger-zone__body {
    animation: none;
  }
}
</style>

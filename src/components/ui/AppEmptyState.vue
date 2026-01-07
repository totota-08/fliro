<script setup lang="ts">
/**
 * AppEmptyState - 統一空状態コンポーネント
 *
 * データがない場合の表示を統一
 */
withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    icon?: "empty" | "search" | "error" | "folder";
  }>(),
  {
    title: "データがありません",
    description: undefined,
    icon: "empty",
  },
);
</script>

<template>
  <div class="app-empty-state">
    <div class="app-empty-state__icon" aria-hidden="true">
      <!-- Empty -->
      <svg v-if="icon === 'empty'" viewBox="0 0 24 24" fill="none">
        <path
          d="M20 7L12 3L4 7M20 7L12 11M20 7V17L12 21M12 11L4 7M12 11V21M4 7V17L12 21"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <!-- Search -->
      <svg v-else-if="icon === 'search'" viewBox="0 0 24 24" fill="none">
        <circle
          cx="11"
          cy="11"
          r="8"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <path
          d="M21 21L16.65 16.65"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
      <!-- Error -->
      <svg v-else-if="icon === 'error'" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <path
          d="M12 8V12"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
        <circle cx="12" cy="16" r="1" fill="currentColor" />
      </svg>
      <!-- Folder -->
      <svg v-else viewBox="0 0 24 24" fill="none">
        <path
          d="M3 6C3 4.89543 3.89543 4 5 4H9L11 6H19C20.1046 6 21 6.89543 21 8V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V6Z"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>

    <h3 class="app-empty-state__title">{{ title }}</h3>

    <p v-if="description" class="app-empty-state__description">
      {{ description }}
    </p>

    <div v-if="$slots.action" class="app-empty-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.app-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-12, 3rem) var(--ui-space-6, 1.5rem);
  text-align: center;
}

.app-empty-state__icon {
  width: 4rem;
  height: 4rem;
  margin-bottom: var(--ui-space-4, 1rem);
  color: var(--ui-text-placeholder, #94a3b8);
}

.app-empty-state__icon svg {
  width: 100%;
  height: 100%;
}

.app-empty-state__title {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.app-empty-state__description {
  margin: var(--ui-space-2, 0.5rem) 0 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  max-width: 24rem;
}

.app-empty-state__action {
  margin-top: var(--ui-space-6, 1.5rem);
}
</style>

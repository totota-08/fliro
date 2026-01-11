<script setup lang="ts">
/**
 * DangerZoneCard - 危険な操作用カードコンポーネント
 *
 * アカウント削除などの破壊的操作を表示するための警告カード
 */

withDefaults(
  defineProps<{
    /** カードのタイトル */
    title?: string;
  }>(),
  {
    title: "危険な操作",
  },
);
</script>

<template>
  <section class="danger-zone-card">
    <header class="danger-zone-card__header">
      <h3 class="danger-zone-card__title">{{ title }}</h3>
    </header>
    <div class="danger-zone-card__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.danger-zone-card {
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-status-danger, #dc2626);
  border-radius: var(--ui-radius-xl, 1.25rem);
  overflow: hidden;
}

.danger-zone-card__header {
  padding: var(--ui-space-4, 1rem) var(--ui-space-5, 1.25rem);
  background: rgba(220, 38, 38, 0.05);
  border-bottom: 1px solid var(--ui-status-danger, #dc2626);
}

.danger-zone-card__title {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-status-danger, #dc2626);
}

.danger-zone-card__body {
  padding: var(--ui-space-4, 1rem) var(--ui-space-5, 1.25rem);
}
</style>

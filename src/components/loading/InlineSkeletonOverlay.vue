<script setup lang="ts">
withDefaults(
  defineProps<{
    loading: boolean;
    rows?: number;
  }>(),
  {
    loading: false,
    rows: 3,
  },
);
</script>

<template>
  <div v-if="loading" class="inline-skeleton-overlay" aria-busy="true">
    <div class="skeleton skeleton--row" v-for="n in rows" :key="n"></div>
  </div>
</template>

<style scoped>
.inline-skeleton-overlay {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--surface-base, #fff) 60%, transparent);
  z-index: 10;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  pointer-events: all; /* Blocks interaction behind */
  backdrop-filter: blur(1px);
}
</style>

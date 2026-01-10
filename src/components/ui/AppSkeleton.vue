<script setup lang="ts">
defineProps<{
  variant?: "text" | "avatar" | "card" | "row" | "custom";
  width?: string;
  height?: string;
  rounded?: "sm" | "md" | "lg" | "full";
}>();
</script>

<template>
  <div
    class="skeleton"
    :class="[
      variant && `skeleton--${variant}`,
      rounded && `skeleton--rounded-${rounded}`,
    ]"
    :style="{
      width: width || undefined,
      height: height || undefined,
    }"
  ></div>
</template>

<style scoped>
.skeleton {
  background-color: var(--ui-border-light);
  border-radius: var(--ui-radius-sm);
  position: relative;
  overflow: hidden;
  animation: skeleton-fade-in 0.2s ease-out;
}

/* 既存の motion.css のスケルトンアニメーション（::after）を利用 */

@keyframes skeleton-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Variant styles */
.skeleton--text {
  height: 1em;
  width: 100%;
  margin-bottom: 0.5em;
}

.skeleton--avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.skeleton--card {
  width: 100%;
  height: 200px;
  border-radius: var(--ui-radius-md);
}

.skeleton--row {
  width: 100%;
  height: 48px;
  margin-bottom: var(--ui-space-2);
  border-radius: var(--ui-radius-sm);
}

/* Rounded variants */
.skeleton--rounded-sm {
  border-radius: var(--ui-radius-sm);
}

.skeleton--rounded-md {
  border-radius: var(--ui-radius-md);
}

.skeleton--rounded-lg {
  border-radius: var(--ui-radius-lg);
}

.skeleton--rounded-full {
  border-radius: var(--ui-radius-full);
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
  }
}
</style>

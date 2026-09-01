<template>
  <span class="bot-avatar-ui" role="img" aria-label="ボット">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4.5" y="8.5" width="15" height="10" rx="3" />
      <path d="M12 8.5V5.8" />
      <circle cx="12" cy="4.4" r="1.3" />
      <circle cx="9.3" cy="13" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.7" cy="13" r="0.9" fill="currentColor" stroke="none" />
      <path d="M9.5 16h5" />
    </svg>
  </span>
</template>

<script setup lang="ts"></script>

<style scoped>
/* サイズは呼び出し側から --bot-avatar-size で調整する */
.bot-avatar-ui {
  width: var(--bot-avatar-size, 36px);
  height: var(--bot-avatar-size, 36px);
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-success-50, #f0fdf4);
  border: 1px solid var(--ui-success-200, #bbf7d0);
  color: var(--ui-success-dark, #15803d);
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
}

.bot-avatar-ui svg {
  width: 60%;
  height: 60%;
}
</style>

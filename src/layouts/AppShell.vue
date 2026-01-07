<script setup lang="ts">
/**
 * AppShell - 汎用アプリシェル
 *
 * マイページなどプロジェクトコンテキスト以外のページ用
 * サイドバーなしのシンプルなレイアウト
 */
</script>

<template>
  <div class="app-shell">
    <header v-if="$slots.header" class="app-shell__header">
      <slot name="header" />
    </header>

    <main class="app-shell__main">
      <slot />
    </main>

    <footer v-if="$slots.footer" class="app-shell__footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--ui-bg, #f5fcff);
}

@supports (min-height: 100dvh) {
  .app-shell {
    min-height: 100dvh;
  }
}

.app-shell__header {
  position: sticky;
  top: 0;
  z-index: var(--ui-z-sticky, 20);
  background: var(--ui-surface, #ffffff);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.app-shell__main {
  flex: 1;
  width: 100%;
  max-width: var(--ui-content-max-width, 1200px);
  margin: 0 auto;
  padding: var(--ui-space-8, 2rem) var(--ui-space-6, 1.5rem);
}

.app-shell__footer {
  background: var(--ui-surface-muted, #f1f5f9);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  padding: var(--ui-space-6, 1.5rem);
}

@media (max-width: 768px) {
  .app-shell__main {
    padding: var(--ui-space-4, 1rem);
  }
}
</style>

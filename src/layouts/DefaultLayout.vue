<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>

<template>
  <div class="layout">
    <header class="layout__header">
      <div class="layout__brand">
        <span class="layout__logo">Teamie</span>
        <span class="layout__tagline">少人数チームのためのプロジェクト管理</span>
      </div>
      <nav class="layout__nav">
        <a class="layout__link" href="#features">機能</a>
        <a class="layout__link" href="#workflow">ワークフロー</a>
        <a class="layout__link" href="#faq">FAQ</a>
      </nav>
    </header>

    <main class="layout__main">
      <slot />
    </main>

    <footer class="layout__footer">
      <p>© {{ currentYear }} Teamie</p>
    </footer>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  min-height: 100vh;
  grid-template-rows: auto 1fr auto;
}

.layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 3rem;
  background: var(--surface-muted);
  border-bottom: 1px solid var(--border);
}

.layout__brand {
  display: flex;
  flex-direction: column;
}

.layout__logo {
  font-weight: 700;
  font-size: 1.5rem;
  color: var(--primary);
}

.layout__tagline {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.layout__nav {
  display: flex;
  gap: 1rem;
}

.layout__link {
  color: var(--text);
  text-decoration: none;
  font-weight: 500;
}

.layout__link:hover {
  color: var(--primary);
}

.layout__main {
  padding: 3rem;
  background: var(--surface-elevated);
}

.layout__footer {
  padding: 1.5rem 3rem;
  text-align: center;
  background: var(--surface-muted);
  border-top: 1px solid var(--border);
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .layout__header,
  .layout__footer {
    padding: 1.25rem 1.5rem;
  }

  .layout__main {
    padding: 2rem 1.5rem;
  }

  .layout__nav {
    display: none;
  }
}
</style>

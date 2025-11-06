<template>
    <section class="error-page">
    <h1 class="error-page__title">404 Not Found</h1>
    <p class="error-page__message">お探しのページは見つかりませんでした。</p>
    </section>
</template>

<style scoped>
.error-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 2rem;
    background: radial-gradient(circle, rgba(184, 227, 233, 0.35), transparent 70%);
    color: var(--primary-strong, #0b2e33);
    text-align: center;
}

.error-page__title {
  font-size: clamp(2rem, 5vw, 3.5rem);
  margin: 0 0 1rem;
}

.error-page__message {
  font-size: 1rem;
  margin: 0;
  color: var(--text-muted, #516064);
}
</style>

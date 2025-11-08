<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    brandName?: string;
  }>(),
  {
    brandName: "Teamie",
    description: "",
  }
);
</script>

<template>
  <header class="auth-brand">
    <div class="auth-brand__badge">
      <span class="auth-brand__icon">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </span>
      <span class="auth-brand__name">{{ props.brandName }}</span>
    </div>
    <h1>{{ props.title }}</h1>
    <p v-if="props.description">{{ props.description }}</p>
    <slot />
  </header>
</template>

<style scoped>
.auth-brand {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.auth-brand__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: center;
  margin-bottom: 0.25rem;
}

.auth-brand__icon {
  width: 42px;
  height: 42px;
  border-radius: 0.85rem;
  background: #4f7c82;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.auth-brand__icon svg {
  width: 26px;
  height: 26px;
  fill: none;
  stroke: #fff;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.auth-brand__name {
  font-size: 1.4rem;
  font-weight: 700;
  color: #0b2e33;
}

h1 {
  margin: 0;
  font-size: 1.75rem;
  color: #0b2e33;
}

p {
  margin: 0;
  color: #4f7c82;
}
</style>

<script setup lang="ts">
import { appName } from "@/constants/appMeta";
import BrandLogo from "@/components/common/BrandLogo.vue";

const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    brandName?: string;
  }>(),
  {
    brandName: appName,
    description: "",
  },
);
</script>

<template>
  <header class="auth-brand">
    <div class="auth-brand__badge">
      <span class="auth-brand__icon">
        <BrandLogo class="auth-brand__logo" />
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.auth-brand__logo {
  width: 100%;
  height: 100%;
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

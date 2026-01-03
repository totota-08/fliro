<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    variant?: "members" | "invites" | "timeline" | "dashboard" | "default";
  }>(),
  {
    variant: "default",
  },
);

const isMembers = computed(() => props.variant === "members");
const isInvites = computed(() => props.variant === "invites");
</script>

<template>
  <div class="page-skeleton" aria-busy="true" aria-label="Loading content">
    <!-- Header Skeleton -->
    <header class="page-skeleton__header">
      <div
        class="skeleton skeleton--text"
        style="width: 120px; height: 1.2rem"
      ></div>
      <div
        class="skeleton skeleton--text"
        style="width: 240px; height: 2rem; margin-top: 0.5rem"
      ></div>
    </header>

    <!-- Specific Variants -->
    <div v-if="isMembers" class="page-skeleton__content">
      <div class="page-skeleton__stats">
        <div class="skeleton skeleton--card" style="height: 80px"></div>
        <div class="skeleton skeleton--card" style="height: 80px"></div>
        <div class="skeleton skeleton--card" style="height: 80px"></div>
      </div>
      <div class="page-skeleton__list">
        <div class="skeleton skeleton--row" v-for="n in 5" :key="n"></div>
      </div>
    </div>

    <div v-else-if="isInvites" class="page-skeleton__content">
      <div class="page-skeleton__list">
        <div
          class="skeleton skeleton--row"
          style="height: 60px"
          v-for="n in 3"
          :key="n"
        ></div>
      </div>
    </div>

    <!-- Default / Fallback -->
    <div v-else class="page-skeleton__content">
      <div class="skeleton skeleton--text" style="width: 60%"></div>
      <div class="skeleton skeleton--text" style="width: 80%"></div>
      <div class="skeleton skeleton--card" style="margin-top: 2rem"></div>
    </div>
  </div>
</template>

<style scoped>
.page-skeleton {
  padding: 0;
  width: 100%;
  animation: fade-in 0.3s ease-out;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.page-skeleton__header {
  margin-bottom: 2rem;
}

.page-skeleton__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.page-skeleton__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>

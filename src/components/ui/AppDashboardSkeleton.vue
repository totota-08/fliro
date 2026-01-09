<script setup lang="ts">
import AppSkeleton from "./AppSkeleton.vue";
</script>

<template>
  <div class="dashboard-skeleton">
    <!-- サマリーカード -->
    <div class="summary-cards">
      <div v-for="i in 3" :key="i" class="summary-card">
        <AppSkeleton variant="text" width="120px" />
        <AppSkeleton variant="text" width="80px" height="2rem" />
      </div>
    </div>

    <!-- タスクリスト -->
    <div class="task-list">
      <AppSkeleton variant="text" width="200px" height="1.5rem" />
      <div class="task-items">
        <AppSkeleton v-for="i in 5" :key="i" variant="row" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-skeleton {
  padding: var(--ui-space-6);
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

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--ui-space-4);
  margin-bottom: var(--ui-space-8);
}

.summary-card {
  background: var(--ui-surface);
  border: 1px solid var(--ui-border-light);
  border-radius: var(--ui-radius-md);
  padding: var(--ui-space-6);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}

.task-list {
  background: var(--ui-surface);
  border: 1px solid var(--ui-border-light);
  border-radius: var(--ui-radius-md);
  padding: var(--ui-space-6);
}

.task-items {
  margin-top: var(--ui-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-skeleton {
    animation: none;
  }
}
</style>

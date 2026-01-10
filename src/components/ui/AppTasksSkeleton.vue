<script setup lang="ts">
import AppSkeleton from "./AppSkeleton.vue";

defineProps<{
  count?: number;
}>();
</script>

<template>
  <div class="tasks-skeleton">
    <!-- タブ切り替えスケルトン -->
    <div class="tasks-skeleton__tabs">
      <AppSkeleton width="120px" height="40px" rounded="md" />
      <AppSkeleton width="100px" height="40px" rounded="md" />
    </div>

    <!-- タスクカードスケルトン -->
    <div class="tasks-skeleton__list">
      <div
        v-for="i in count || 5"
        :key="i"
        class="tasks-skeleton__card"
        :style="{ animationDelay: `${i * 50}ms` }"
      >
        <div class="tasks-skeleton__card-header">
          <AppSkeleton width="100px" height="16px" />
          <div class="tasks-skeleton__badges">
            <AppSkeleton width="60px" height="20px" rounded="full" />
            <AppSkeleton width="40px" height="20px" rounded="full" />
          </div>
        </div>
        <AppSkeleton width="80%" height="24px" />
        <AppSkeleton width="60%" height="16px" />
        <div class="tasks-skeleton__card-footer">
          <AppSkeleton width="80px" height="16px" />
          <AppSkeleton width="50px" height="16px" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tasks-skeleton {
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

.tasks-skeleton__tabs {
  display: flex;
  gap: var(--ui-space-2);
  margin-bottom: var(--ui-space-6);
}

.tasks-skeleton__list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

.tasks-skeleton__card {
  background: var(--ui-surface);
  border: 1px solid var(--ui-border-light);
  border-radius: var(--ui-radius-md);
  padding: var(--ui-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  animation: slide-in 0.4s ease-out;
  animation-fill-mode: backwards;
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.tasks-skeleton__card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tasks-skeleton__badges {
  display: flex;
  gap: var(--ui-space-2);
}

.tasks-skeleton__card-footer {
  display: flex;
  gap: var(--ui-space-4);
  margin-top: var(--ui-space-2);
}

@media (prefers-reduced-motion: reduce) {
  .tasks-skeleton,
  .tasks-skeleton__card {
    animation: none;
  }
}
</style>

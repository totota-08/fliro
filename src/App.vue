<script setup lang="ts">
import LoadingScreen from "@/components/ui/LoadingScreen.vue";
import RouterProgressBar from "@/components/ui/RouterProgressBar.vue";
import { useNavigationState } from "@/composables/useNavigationState";
import { onMounted, ref } from "vue";
import { RouterView } from "vue-router";

const isLoading = ref(true);
const { isProjectSwitch } = useNavigationState();

onMounted(async () => {
  // Minimum loading time for smooth UX
  await new Promise((resolve) => setTimeout(resolve, 800));
  isLoading.value = false;
});
</script>

<template>
  <LoadingScreen :loading="isLoading" />
  <RouterProgressBar />

  <!-- プロジェクト切り替え時のオーバーレイ -->
  <transition name="project-switch-fade">
    <div v-if="isProjectSwitch" class="project-switch-overlay">
      <div class="project-switch-spinner" aria-label="読み込み中"></div>
      <p class="project-switch-text">プロジェクトを切り替え中...</p>
    </div>
  </transition>

  <RouterView v-slot="{ Component }">
    <transition name="page-fade">
      <component :is="Component" :key="$route.fullPath" />
    </transition>
  </RouterView>
</template>

<style scoped>
/* プロジェクト切り替えオーバーレイ */
.project-switch-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--ui-z-modal, 50);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-4, 1rem);
  background: rgba(245, 252, 255, 0.95);
  backdrop-filter: blur(4px);
}

.project-switch-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--ui-border-light, rgba(11, 46, 51, 0.1));
  border-top-color: var(--ui-brand-600, #4f7c82);
  border-radius: 50%;
  animation: project-switch-spin 0.8s linear infinite;
}

.project-switch-text {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text-muted, #64748b);
}

@keyframes project-switch-spin {
  to {
    transform: rotate(360deg);
  }
}

/* オーバーレイのトランジション */
.project-switch-fade-enter-active,
.project-switch-fade-leave-active {
  transition: opacity 150ms var(--ui-ease-standard, ease);
}

.project-switch-fade-enter-from,
.project-switch-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .project-switch-spinner {
    animation: none;
    border-top-color: var(--ui-brand-600, #4f7c82);
    border-right-color: var(--ui-brand-600, #4f7c82);
  }
}
</style>

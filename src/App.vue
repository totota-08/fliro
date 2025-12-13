<script setup lang="ts">
import LoadingScreen from "@/components/ui/LoadingScreen.vue";
import PageTransitionOverlay from "@/components/ui/PageTransitionOverlay.vue";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { RouterView, useRouter } from "vue-router";

const isLoading = ref(true);
const isRouteTransitioning = ref(false);
let finishTimer: ReturnType<typeof setTimeout> | null = null;
const unregisterGuards: Array<() => void> = [];
const router = useRouter();

const startRouteOverlay = () => {
  if (finishTimer) {
    clearTimeout(finishTimer);
    finishTimer = null;
  }
  isRouteTransitioning.value = true;
};

const stopRouteOverlay = () => {
  if (finishTimer) clearTimeout(finishTimer);
  finishTimer = setTimeout(() => {
    isRouteTransitioning.value = false;
  }, 320);
};

onMounted(async () => {
  const offBefore = router.beforeEach((to, from, next) => {
    if (to.fullPath !== from.fullPath) {
      startRouteOverlay();
    }
    next();
  });
  const offAfter = router.afterEach(() => {
    stopRouteOverlay();
  });

  if (typeof offBefore === "function") unregisterGuards.push(offBefore);
  if (typeof offAfter === "function") unregisterGuards.push(offAfter);

  // Minimum loading time for smooth UX
  await new Promise((resolve) => setTimeout(resolve, 800));
  isLoading.value = false;
});

onBeforeUnmount(() => {
  unregisterGuards.forEach((fn) => {
    try {
      fn();
    } catch {
      /* noop */
    }
  });
  if (finishTimer) clearTimeout(finishTimer);
});
</script>

<template>
  <LoadingScreen :loading="isLoading" />
  <PageTransitionOverlay :active="isRouteTransitioning" />
  <RouterView v-slot="{ Component, route }">
    <transition name="page-shift">
      <component :is="Component" :key="route.fullPath" class="page-frame" />
    </transition>
  </RouterView>
</template>

<style scoped>
.page-frame {
  min-height: 100vh;
  position: relative;
  isolation: isolate;
  background: linear-gradient(
      140deg,
      rgba(147, 177, 181, 0.08),
      rgba(184, 227, 233, 0.26)
    ),
    radial-gradient(circle at 18% 20%, rgba(79, 124, 130, 0.06), transparent 28%),
    #ffffff;
  background-attachment: fixed;
  transition: background 0.6s ease;
}

.page-shift-enter-active,
.page-shift-leave-active {
  transition:
    opacity 0.36s ease,
    transform 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.4s ease;
}

.page-shift-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.985);
  filter: blur(6px);
}

.page-shift-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.995);
  filter: blur(8px);
}
</style>

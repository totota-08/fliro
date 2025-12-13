<script setup lang="ts">
import LoadingScreen from "@/components/ui/LoadingScreen.vue";
import { onMounted, ref } from "vue";
import { RouterView } from "vue-router";

const isLoading = ref(true);

onMounted(async () => {
  // Minimum loading time for smooth UX
  await new Promise((resolve) => setTimeout(resolve, 800));
  isLoading.value = false;
});
</script>

<template>
  <LoadingScreen :loading="isLoading" />
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

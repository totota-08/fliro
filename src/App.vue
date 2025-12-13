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
  <RouterView v-slot="{ Component }">
    <transition name="fade-slide" mode="out-in">
      <component :is="Component" />
    </transition>
  </RouterView>
</template>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>

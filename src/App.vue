<script setup lang="ts">
import LoadingScreen from '@/components/ui/LoadingScreen.vue'
import { onMounted, ref } from 'vue'
import { RouterView } from 'vue-router'

const isLoading = ref(true)

onMounted(async () => {
  // Minimum loading time for smooth UX
  await new Promise((resolve) => setTimeout(resolve, 800))
  isLoading.value = false
})
</script>

<template>
  <LoadingScreen :loading="isLoading" />
  <RouterView />
</template>

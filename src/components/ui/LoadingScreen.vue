<script setup lang="ts">
import { appName } from '@/constants/appMeta'

defineProps<{
  loading: boolean
}>()
</script>

<template>
  <transition name="fade">
    <div v-if="loading" class="loading-screen">
      <div class="loading-content">
        <div class="spinner"></div>
        <p class="loading-text">{{ appName }}</p>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.loading-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #ffffff;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #0ea5e9;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  color: #0f172a;
  font-size: 1.25rem;
  letter-spacing: -0.025em;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

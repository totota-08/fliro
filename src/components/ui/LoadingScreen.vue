<script setup lang="ts">
defineProps<{
  loading: boolean;
}>();
</script>

<template>
  <transition name="fade">
    <div v-if="loading" class="loading-screen">
      <div class="loading-content">
        <!-- Fliro Icon (V3×V4 hybrid design) -->
        <svg
          class="loading-icon"
          viewBox="0 0 120 120"
          width="80"
          height="80"
          fill="none"
        >
          <rect width="120" height="120" rx="28" fill="#4f7c82" />
          <path
            d="M73 22 C65 22, 57 28, 53 38 C49 50, 45 64, 41 76 C39 82, 35 90, 27 94"
            stroke="#ffffff"
            stroke-width="5"
            stroke-linecap="round"
            fill="none"
          />
          <path
            d="M28 54 C40 50, 56 48, 74 47 C80 46.5, 84 47, 86 49"
            stroke="#ffffff"
            stroke-width="5"
            stroke-linecap="round"
            fill="none"
          />
        </svg>
        <!-- App name -->
        <p class="loading-text">Fliro</p>
        <!-- Tagline -->
        <p class="loading-tagline">PROJECT FLOW</p>
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
  background-color: #f8fafa;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.loading-icon {
  filter: drop-shadow(0 4px 16px rgba(11, 46, 51, 0.3));
}

.loading-text {
  font-family:
    "Sora",
    system-ui,
    -apple-system,
    sans-serif;
  font-weight: 600;
  font-size: 1.5rem;
  color: #0b2e33;
  letter-spacing: 3px;
  margin: 0;
}

.loading-tagline {
  font-family:
    "DM Sans",
    system-ui,
    -apple-system,
    sans-serif;
  font-weight: 400;
  font-size: 0.5rem;
  color: var(--color-teal, #4f7c82);
  letter-spacing: 3.5px;
  text-transform: uppercase;
  margin: 0;
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

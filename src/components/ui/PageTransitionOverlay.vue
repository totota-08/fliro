<script setup lang="ts">
defineProps<{
  active: boolean;
}>();
</script>

<template>
  <transition name="overlay-fade">
    <div v-if="active" class="overlay" aria-live="polite" aria-busy="true">
      <div class="halo"></div>
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
      <div class="sparkles">
        <span class="sparkle s1"></span>
        <span class="sparkle s2"></span>
        <span class="sparkle s3"></span>
        <span class="sparkle s4"></span>
      </div>
      <p class="message">ちょっとだけ待ってね…</p>
    </div>
  </transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: grid;
  place-items: center;
  backdrop-filter: blur(4px);
  background: radial-gradient(circle at 30% 30%, rgba(184, 227, 233, 0.45), transparent 42%),
    radial-gradient(circle at 70% 65%, rgba(147, 177, 181, 0.35), transparent 40%),
    rgba(255, 255, 255, 0.78);
  overflow: hidden;
}

.halo {
  position: absolute;
  width: 220px;
  height: 220px;
  background: conic-gradient(from 120deg, rgba(79, 124, 130, 0.35), rgba(184, 227, 233, 0.5), rgba(79, 124, 130, 0.35));
  filter: blur(36px);
  animation: spin 8s linear infinite;
}

.orb {
  position: absolute;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f9d8ff, #9ed9f3);
  box-shadow:
    0 12px 30px rgba(11, 46, 51, 0.16),
    inset 0 2px 6px rgba(255, 255, 255, 0.6);
  animation: float 3s ease-in-out infinite;
}

.orb-1 {
  top: 32%;
  left: 45%;
  animation-delay: 0s;
}

.orb-2 {
  top: 58%;
  left: 55%;
  width: 46px;
  height: 46px;
  animation-delay: -0.6s;
}

.orb-3 {
  top: 48%;
  left: 65%;
  width: 36px;
  height: 36px;
  animation-delay: -1.2s;
}

.sparkles {
  position: relative;
  width: 140px;
  height: 140px;
}

.sparkle {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ffd88b;
  box-shadow: 0 0 12px rgba(255, 216, 139, 0.75);
  animation: pulse 1.4s ease-in-out infinite;
}

.sparkle.s1 {
  top: 40px;
  left: 12px;
  animation-delay: 0s;
}

.sparkle.s2 {
  top: 12px;
  right: 18px;
  animation-delay: -0.3s;
}

.sparkle.s3 {
  bottom: 20px;
  right: 30px;
  animation-delay: -0.6s;
}

.sparkle.s4 {
  bottom: 8px;
  left: 22px;
  animation-delay: -0.9s;
}

.message {
  position: relative;
  margin-top: 18px;
  padding: 10px 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: #0b2e33;
  font-weight: 700;
  letter-spacing: 0.02em;
  box-shadow:
    0 6px 24px rgba(11, 46, 51, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition:
    opacity 0.32s ease,
    transform 0.36s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

@keyframes float {
  0%,
  100% {
    transform: translateY(-6px) scale(1);
  }
  50% {
    transform: translateY(6px) scale(1.04);
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(0.75);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.4;
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>

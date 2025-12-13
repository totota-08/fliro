<script setup lang="ts">
import { appName } from "@/constants/appMeta";

import { onMounted, onUnmounted, ref, watch } from "vue";

const props = defineProps<{
  loading: boolean;
}>();

const messages = [
  "ちょっと待っててね…",
  "今日もいい感じに進んでるよ！",
  "コーヒー飲んでる間に準備するね☕️",
  "猫の手も借りたい…かも？🐾",
  "データをふわっと並べ替え中…",
];

const currentMessage = ref(messages[0]);
let timer: ReturnType<typeof setInterval> | null = null;

const pickMessage = () => {
  const candidates = messages.filter((m) => m !== currentMessage.value);
  const next = candidates[Math.floor(Math.random() * candidates.length)] ?? messages[0];
  currentMessage.value = next;
};

const startCycle = () => {
  if (timer) return;
  pickMessage();
  timer = setInterval(pickMessage, 2200);
};

const stopCycle = () => {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
};

onMounted(() => {
  if (props.loading) startCycle();
});

watch(
  () => props.loading,
  (val) => {
    if (val) {
      startCycle();
    } else {
      stopCycle();
    }
  },
);

onUnmounted(() => {
  stopCycle();
});
</script>

<template>
  <transition name="fade">
    <div v-if="loading" class="loading-screen">
      <div class="loading-content">
        <div class="spinner"></div>
        <p class="loading-text">{{ appName }}</p>
        <p class="loading-message">{{ currentMessage }}</p>
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
  font-family: "Inter", sans-serif;
  font-weight: 600;
  color: #0f172a;
  font-size: 1.25rem;
  letter-spacing: -0.025em;
}

.loading-message {
  margin: 0;
  font-weight: 700;
  color: #4f7c82;
  background: rgba(147, 177, 181, 0.12);
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
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

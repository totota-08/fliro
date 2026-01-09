<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const isLoading = ref(false);
const progress = ref(0);

let progressInterval: ReturnType<typeof setInterval> | null = null;

function startProgress() {
  isLoading.value = true;
  progress.value = 0;

  // プログレスバーを徐々に進める（90%まで）
  progressInterval = setInterval(() => {
    if (progress.value < 90) {
      // 最初は早く、後半は遅く
      const increment = progress.value < 30 ? 10 : progress.value < 60 ? 5 : 2;
      progress.value += increment;
    }
  }, 100);
}

function finishProgress() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }

  // 100%まで一気に進めてからフェードアウト
  progress.value = 100;
  setTimeout(() => {
    isLoading.value = false;
    setTimeout(() => {
      progress.value = 0;
    }, 300); // フェードアウト後にリセット
  }, 200);
}

onMounted(() => {
  router.beforeEach(() => {
    startProgress();
  });

  router.afterEach(() => {
    finishProgress();
  });

  router.onError(() => {
    finishProgress();
  });
});
</script>

<template>
  <transition name="progress-fade">
    <div v-if="isLoading" class="router-progress-bar">
      <div class="progress-bar" :style="{ width: `${progress}%` }"></div>
    </div>
  </transition>
</template>

<style scoped>
.router-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background-color: transparent;
  z-index: var(--ui-z-toast);
  pointer-events: none;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--ui-brand-500) 0%,
    var(--ui-brand-600) 50%,
    var(--ui-brand-700) 100%
  );
  box-shadow: 0 0 10px rgba(79, 124, 130, 0.5);
  transition: width 0.1s var(--ui-ease-standard);
  border-radius: 0 2px 2px 0;
}

.progress-fade-enter-active,
.progress-fade-leave-active {
  transition: opacity 0.3s var(--ui-ease-standard);
}

.progress-fade-enter-from,
.progress-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .progress-bar {
    transition: none;
  }

  .router-progress-bar {
    display: none;
  }
}
</style>

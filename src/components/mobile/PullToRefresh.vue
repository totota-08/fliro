<script setup lang="ts">
/**
 * PullToRefresh - プルトゥーリフレッシュコンポーネント
 *
 * スマホアプリでおなじみの「引っ張って更新」機能を提供
 */
import { ref, onMounted, onBeforeUnmount } from "vue";

const emit = defineEmits<{
  refresh: [];
}>();

const props = withDefaults(
  defineProps<{
    threshold?: number;
    disabled?: boolean;
  }>(),
  {
    threshold: 80,
    disabled: false,
  },
);

// 状態
const isPulling = ref(false);
const isRefreshing = ref(false);
const pullDistance = ref(0);
const containerRef = ref<HTMLElement | null>(null);

// タッチ座標
let startY = 0;
let currentY = 0;

// スクロール位置が0かチェック
function isAtTop(): boolean {
  if (!containerRef.value) return false;
  const scrollable = containerRef.value.querySelector(".pull-to-refresh__content");
  if (!scrollable) return false;
  return scrollable.scrollTop === 0;
}

// タッチ開始
function handleTouchStart(e: TouchEvent) {
  if (props.disabled || isRefreshing.value) return;
  if (!isAtTop()) return;

  startY = e.touches[0].clientY;
  currentY = startY;
  isPulling.value = true;
}

// タッチ移動
function handleTouchMove(e: TouchEvent) {
  if (!isPulling.value || props.disabled || isRefreshing.value) return;
  if (!isAtTop()) {
    isPulling.value = false;
    pullDistance.value = 0;
    return;
  }

  currentY = e.touches[0].clientY;
  const distance = currentY - startY;

  if (distance > 0) {
    // 引っ張りに抵抗を加える（物理演算風）
    pullDistance.value = Math.min(distance * 0.5, props.threshold * 1.5);

    // ブラウザのデフォルトスクロールを防ぐ
    if (distance > 10) {
      e.preventDefault();
    }
  } else {
    pullDistance.value = 0;
  }
}

// タッチ終了
async function handleTouchEnd() {
  if (!isPulling.value) return;

  isPulling.value = false;

  // 閾値を超えたらリフレッシュ実行
  if (pullDistance.value >= props.threshold) {
    isRefreshing.value = true;
    emit("refresh");

    // 最小表示時間（UXのため）
    await new Promise(resolve => setTimeout(resolve, 800));

    isRefreshing.value = false;
    pullDistance.value = 0;
  } else {
    // 閾値未満なら元に戻す
    pullDistance.value = 0;
  }
}

// リフレッシュの完了を外部から呼び出せるようにする
function completeRefresh() {
  isRefreshing.value = false;
  pullDistance.value = 0;
}

defineExpose({ completeRefresh });

// イベントリスナー設定
onMounted(() => {
  if (containerRef.value) {
    containerRef.value.addEventListener("touchstart", handleTouchStart, { passive: true });
    containerRef.value.addEventListener("touchmove", handleTouchMove, { passive: false });
    containerRef.value.addEventListener("touchend", handleTouchEnd);
  }
});

onBeforeUnmount(() => {
  if (containerRef.value) {
    containerRef.value.removeEventListener("touchstart", handleTouchStart);
    containerRef.value.removeEventListener("touchmove", handleTouchMove);
    containerRef.value.removeEventListener("touchend", handleTouchEnd);
  }
});
</script>

<template>
  <div ref="containerRef" class="pull-to-refresh">
    <!-- プルインジケーター -->
    <div
      class="pull-to-refresh__indicator"
      :style="{
        height: `${pullDistance}px`,
        opacity: pullDistance > 0 ? 1 : 0,
      }"
    >
      <div
        class="pull-to-refresh__spinner"
        :class="{
          'is-active': isRefreshing || pullDistance >= threshold,
          'is-refreshing': isRefreshing,
        }"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            fill="currentColor"
          />
        </svg>
      </div>

      <p class="pull-to-refresh__text">
        <span v-if="isRefreshing">更新中...</span>
        <span v-else-if="pullDistance >= threshold">離して更新</span>
        <span v-else>引っ張って更新</span>
      </p>
    </div>

    <!-- コンテンツ -->
    <div
      class="pull-to-refresh__content"
      :style="{
        transform: `translateY(${pullDistance}px)`,
        transition: isPulling ? 'none' : 'transform 0.3s ease-out',
      }"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.pull-to-refresh {
  position: relative;
  overflow: hidden;
  height: 100%;
}

.pull-to-refresh__indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-2, 0.5rem);
  background: var(--ui-surface, #ffffff);
  transition: opacity 0.2s ease;
  z-index: 1;
}

.pull-to-refresh__spinner {
  width: 2rem;
  height: 2rem;
  color: var(--ui-brand-600, #4f7c82);
  transition: transform 0.3s ease;
}

.pull-to-refresh__spinner svg {
  width: 100%;
  height: 100%;
}

.pull-to-refresh__spinner.is-active {
  animation: spin 0.8s linear infinite;
}

.pull-to-refresh__spinner.is-refreshing {
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.pull-to-refresh__text {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text-muted, #64748b);
}

.pull-to-refresh__content {
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

/* prefers-reduced-motion対応 */
@media (prefers-reduced-motion: reduce) {
  .pull-to-refresh__spinner.is-active,
  .pull-to-refresh__spinner.is-refreshing {
    animation: none;
  }

  .pull-to-refresh__content {
    transition: none !important;
  }
}
</style>

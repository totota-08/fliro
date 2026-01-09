<script setup lang="ts">
/**
 * SwipeableTaskCard - スワイプ操作可能なタスクカード
 *
 * ネイティブアプリのようなスワイプジェスチャーを提供
 * - 右スワイプ: 完了にする（緑）
 * - 左スワイプ: 削除（赤）
 */
import { ref, computed } from "vue";

interface Task {
  id: string;
  title: string;
  description?: string;
  displayStatus?: string;
  dueMessage?: string;
  dueClass?: string;
  isCompleted?: boolean;
}

const props = defineProps<{
  task: Task;
}>();

const emit = defineEmits<{
  complete: [task: Task];
  delete: [task: Task];
  click: [task: Task];
}>();

// スワイプ状態
const startX = ref(0);
const currentX = ref(0);
const isSwiping = ref(false);
const swipeDistance = ref(0);

// スワイプの閾値（ピクセル）
const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 120;

// スワイプ方向と色
const swipeDirection = computed(() => {
  if (swipeDistance.value > 20) return "right"; // 完了
  if (swipeDistance.value < -20) return "left"; // 削除
  return "none";
});

const swipeColor = computed(() => {
  if (swipeDirection.value === "right") return "var(--ui-success, #16a34a)";
  if (swipeDirection.value === "left") return "var(--ui-danger, #d64545)";
  return "transparent";
});

const swipeLabel = computed(() => {
  if (swipeDirection.value === "right") return "✓ 完了";
  if (swipeDirection.value === "left") return "削除";
  return "";
});

// タッチイベントハンドラ
function handleTouchStart(e: TouchEvent) {
  startX.value = e.touches[0].clientX;
  currentX.value = e.touches[0].clientX;
  isSwiping.value = true;
}

function handleTouchMove(e: TouchEvent) {
  if (!isSwiping.value) return;

  currentX.value = e.touches[0].clientX;
  let distance = currentX.value - startX.value;

  // 最大スワイプ距離を制限
  if (distance > MAX_SWIPE) distance = MAX_SWIPE;
  if (distance < -MAX_SWIPE) distance = -MAX_SWIPE;

  swipeDistance.value = distance;
}

function handleTouchEnd() {
  if (!isSwiping.value) return;

  const distance = swipeDistance.value;

  // 閾値を超えたらアクションを実行
  if (distance > SWIPE_THRESHOLD) {
    emit("complete", props.task);
  } else if (distance < -SWIPE_THRESHOLD) {
    emit("delete", props.task);
  }

  // リセット
  resetSwipe();
}

function resetSwipe() {
  isSwiping.value = false;
  swipeDistance.value = 0;
  startX.value = 0;
  currentX.value = 0;
}

function handleClick() {
  if (Math.abs(swipeDistance.value) < 5) {
    emit("click", props.task);
  }
}
</script>

<template>
  <div class="swipeable-task-card">
    <!-- 背景アクション表示 -->
    <div
      class="swipeable-task-card__background"
      :style="{ backgroundColor: swipeColor }"
    >
      <span
        v-if="swipeDirection !== 'none'"
        class="swipeable-task-card__action-label"
        :class="`is-${swipeDirection}`"
      >
        {{ swipeLabel }}
      </span>
    </div>

    <!-- スワイプ可能なカード本体 -->
    <div
      class="swipeable-task-card__content"
      :style="{
        transform: `translateX(${swipeDistance}px)`,
        transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
      }"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @touchcancel="resetSwipe"
      @click="handleClick"
    >
      <div class="task-card">
        <div class="task-card__header">
          <h4 class="task-card__title">{{ task.title }}</h4>
          <span
            v-if="task.displayStatus"
            class="task-card__status"
            :class="`is-${task.displayStatus}`"
          >
            {{ task.displayStatus }}
          </span>
        </div>

        <p
          v-if="task.description"
          class="task-card__description"
        >
          {{
            task.description.length > 50
              ? task.description.slice(0, 50) + "..."
              : task.description
          }}
        </p>

        <div v-if="task.dueMessage" class="task-card__due-info">
          <svg
            class="task-card__due-icon"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clip-rule="evenodd"
            />
          </svg>
          <span :class="['task-card__due-text', task.dueClass]">
            {{ task.dueMessage }}
          </span>
        </div>

        <!-- スワイプヒント（最初の数回だけ表示） -->
        <div class="task-card__swipe-hint">
          ← スワイプで操作 →
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.swipeable-task-card {
  position: relative;
  overflow: hidden;
  margin-bottom: var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-lg, 1rem);
}

.swipeable-task-card__background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  transition: background-color 0.2s ease;
}

.swipeable-task-card__action-label {
  position: absolute;
  font-weight: var(--ui-font-semibold, 600);
  font-size: var(--ui-text-base, 1rem);
  color: white;
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
}

.swipeable-task-card__action-label.is-right {
  left: var(--ui-space-4, 1rem);
}

.swipeable-task-card__action-label.is-left {
  right: var(--ui-space-4, 1rem);
}

.swipeable-task-card__content {
  position: relative;
  z-index: 1;
  background: var(--ui-surface, #ffffff);
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}

.task-card {
  padding: var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-lg, 1rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  background: var(--ui-surface, #ffffff);
  box-shadow: 0 1px 3px rgba(11, 46, 51, 0.08);
  min-height: 44px;
}

.task-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--ui-space-3, 0.75rem);
  margin-bottom: var(--ui-space-2, 0.5rem);
}

.task-card__title {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
  line-height: var(--ui-leading-normal, 1.5);
  flex: 1;
}

.task-card__status {
  flex-shrink: 0;
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
  border-radius: var(--ui-radius-full, 9999px);
  line-height: 1.2;
}

.task-card__status.is-進行中 {
  background: var(--ui-info-light, #e0f2fe);
  color: var(--ui-info, #0284c7);
}

.task-card__status.is-完了 {
  background: var(--ui-success-light, #dcfce7);
  color: var(--ui-success, #16a34a);
}

.task-card__status.is-未着手 {
  background: var(--ui-muted, #f1f5f9);
  color: var(--ui-text-muted, #64748b);
}

.task-card__description {
  margin: 0 0 var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  line-height: var(--ui-leading-normal, 1.5);
}

.task-card__due-info {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  background: var(--ui-muted, #f1f5f9);
  border-radius: var(--ui-radius-md, 0.75rem);
  width: fit-content;
}

.task-card__due-icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: var(--ui-text-muted, #64748b);
}

.task-card__due-text {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text-muted, #64748b);
}

.task-card__due-text.is-danger {
  color: var(--ui-danger, #d64545);
}

.task-card__due-text.is-warning {
  color: var(--ui-warning, #f59e0b);
}

.task-card__swipe-hint {
  margin-top: var(--ui-space-3, 0.75rem);
  padding-top: var(--ui-space-3, 0.75rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-placeholder, #94a3b8);
  text-align: center;
  opacity: 0.7;
}

/* タッチフィードバック */
.swipeable-task-card__content:active .task-card {
  transform: scale(0.98);
  transition: transform 0.1s ease;
}

/* prefers-reduced-motion対応 */
@media (prefers-reduced-motion: reduce) {
  .swipeable-task-card__content,
  .task-card {
    transition: none !important;
  }
}
</style>

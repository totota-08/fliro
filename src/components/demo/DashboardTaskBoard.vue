<script setup lang="ts">
import { appName } from "@/constants/appMeta";
import { computed, onMounted, onBeforeUnmount, ref } from "vue";

interface TaskItem {
  title: string;
  description: string;
  status: "未着手" | "進行中" | "レビュー" | "完了";
  priority: "高" | "中" | "低";
  due: string;
  assignee: string;
  comments: number;
}

const columns: {
  key: string;
  title: string;
  badge?: string;
  tasks: TaskItem[];
}[] = [
  {
    key: "todo",
    title: "未着手",
    tasks: [
      {
        title: "データベース設計レビュー",
        description: "認証まわりのテーブル設計を確認",
        status: "未着手",
        priority: "中",
        due: "2025-11-12",
        assignee: "鈴木一郎",
        comments: 3,
      },
      {
        title: "APIドキュメント作成",
        description: "社内共有用のエンドポイント一覧",
        status: "未着手",
        priority: "低",
        due: "2025-11-15",
        assignee: "高橋美咲",
        comments: 6,
      },
    ],
  },
  {
    key: "progress",
    title: "進行中",
    badge: "2",
    tasks: [
      {
        title: "トップページのデザイン作成",
        description: "コンポーネントガイドラインに合わせる",
        status: "進行中",
        priority: "高",
        due: "2025-11-10",
        assignee: "田中太郎",
        comments: 5,
      },
      {
        title: "ユーザー認証機能の実装",
        description: "Firebase Auth + ロール権限",
        status: "進行中",
        priority: "高",
        due: "2025-11-08",
        assignee: "佐藤花子",
        comments: 12,
      },
    ],
  },
  {
    key: "done",
    title: "完了",
    badge: "0",
    tasks: [],
  },
];

const activeTask = ref<TaskItem | null>(null);
const focusTrail = ref<number[]>([]);
const autoHighlightTimer = ref<number>();

const flattenedTasks = computed(() =>
  columns.flatMap((column) => column.tasks),
);

function openTask(task: TaskItem) {
  activeTask.value = task;
  stopAutoHighlight();
}

function closeTask() {
  activeTask.value = null;
}

function stopAutoHighlight() {
  if (autoHighlightTimer.value) {
    window.clearInterval(autoHighlightTimer.value);
    autoHighlightTimer.value = undefined;
  }
  focusTrail.value = [];
}

onMounted(() => {
  let cursor = 0;
  autoHighlightTimer.value = window.setInterval(() => {
    const list = flattenedTasks.value;
    if (!list.length) return;
    const index = cursor % list.length;
    const nextTask = list[index];
    if (nextTask) {
      activeTask.value = nextTask;
      focusTrail.value = [index];
      cursor += 1;
    }
  }, 7000);
});

onBeforeUnmount(() => {
  stopAutoHighlight();
});
</script>

<template>
  <section class="board">
    <div class="board__header">
      <h2>タスク管理</h2>
      <button type="button" class="board__new">＋ 新規タスク</button>
    </div>

    <div class="board__columns">
      <article v-for="column in columns" :key="column.key" class="board-column">
        <header class="board-column__header">
          <h3>{{ column.title }}</h3>
          <span v-if="column.badge" class="badge">{{ column.badge }}</span>
        </header>

        <p v-if="column.tasks.length === 0" class="board-column__empty">
          完了したタスクはまだありません。
        </p>

        <div v-else class="board-column__tasks">
          <article
            v-for="task in column.tasks"
            :key="task.title"
            class="task-card"
            :class="{
              'is-selected': activeTask?.title === task.title,
              'is-highlight':
                focusTrail[0] !== undefined &&
                flattenedTasks[focusTrail[0]]?.title === task.title,
            }"
            role="button"
            tabindex="0"
            @click="openTask(task)"
            @keydown.enter.prevent="openTask(task)"
          >
            <div class="task-card__head">
              <h4>{{ task.title }}</h4>
              <span class="priority" :class="`priority--${task.priority}`">{{
                task.priority
              }}</span>
            </div>
            <p class="task-card__description">{{ task.description }}</p>
            <dl class="task-card__meta">
              <div>
                <dt>期限</dt>
                <dd>{{ task.due }}</dd>
              </div>
              <div>
                <dt>担当</dt>
                <dd>{{ task.assignee }}</dd>
              </div>
              <div>
                <dt>コメント</dt>
                <dd>{{ task.comments }}</dd>
              </div>
            </dl>
          </article>
        </div>
      </article>
    </div>

    <transition name="task-detail">
      <div
        v-if="activeTask"
        class="task-detail"
        role="dialog"
        aria-modal="true"
      >
        <div class="task-detail__header">
          <h3>{{ activeTask.title }}</h3>
          <button
            type="button"
            class="task-detail__close"
            @click="closeTask"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <p class="task-detail__description">{{ activeTask.description }}</p>
        <dl class="task-detail__grid">
          <div>
            <dt>ステータス</dt>
            <dd>{{ activeTask.status }}</dd>
          </div>
          <div>
            <dt>優先度</dt>
            <dd>{{ activeTask.priority }}</dd>
          </div>
          <div>
            <dt>期限</dt>
            <dd>{{ activeTask.due }}</dd>
          </div>
          <div>
            <dt>担当者</dt>
            <dd>{{ activeTask.assignee }}</dd>
          </div>
          <div>
            <dt>コメント</dt>
            <dd>{{ activeTask.comments }}</dd>
          </div>
        </dl>
        <p class="task-detail__hint">
          ※ このデモではカードをクリックすると詳細が開きます。実際の
          {{ appName }} ではさらにサブタスクやコメントを閲覧できます。
        </p>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.board {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6, 1.5rem);
  overflow-x: hidden;
}

.board__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--ui-space-1, 0.25rem);
}

.board__header h2 {
  font-size: var(--ui-text-xl, 1.25rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.board__new {
  border: none;
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-5, 1.25rem);
  font-weight: var(--ui-font-semibold, 600);
  background: var(--ui-brand-600, #4f7c82);
  color: var(--ui-text-inverse, #fff);
  cursor: pointer;
  box-shadow: var(
    --ui-shadow-btn-primary,
    0 12px 28px rgba(79, 124, 130, 0.35)
  );
  transition: var(--ui-transition-all, all 180ms ease);
}

.board__new:hover {
  transform: translateY(-1px);
  background: var(--ui-brand-700, #3d6166);
  box-shadow: var(--ui-shadow-btn-hover, 0 16px 32px rgba(79, 124, 130, 0.4));
}

.board__columns {
  display: grid;
  gap: var(--ui-space-5, 1.25rem);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  position: relative;
}

.board-column {
  background: var(--ui-surface-elevated, #fff);
  border-radius: var(--ui-radius-xl, 1.25rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  padding: var(--ui-space-5, 1.25rem);
  min-height: 320px;
  box-shadow: var(--ui-shadow-lg, 0 12px 24px rgba(11, 46, 51, 0.08));
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
  box-sizing: border-box;
  min-width: 0;
}

.board-column__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.board-column__header h3 {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.8rem;
  height: 1.8rem;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-brand-100, rgba(79, 124, 130, 0.18));
  color: var(--ui-brand-900, #0b2e33);
  font-weight: var(--ui-font-semibold, 600);
  font-size: var(--ui-text-sm, 0.875rem);
}

.board-column__empty {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.board-column__tasks {
  display: grid;
  gap: var(--ui-space-4, 1rem);
}

.task-card {
  border-radius: var(--ui-radius-lg, 1rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.1));
  padding: var(--ui-space-4, 1rem);
  background: var(--ui-surface-accent, rgba(184, 227, 233, 0.2));
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
  cursor: pointer;
  transition: var(--ui-transition-all, all 180ms ease);
  width: 100%;
  box-sizing: border-box;
}

.task-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-space-3, 0.75rem);
}

.task-card__head h4 {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.task-card__description {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.task-card__meta {
  margin: 0;
  display: flex;
  gap: var(--ui-space-3, 0.75rem);
  flex-wrap: wrap;
}

.task-card__meta div {
  display: flex;
  flex-direction: column;
  min-width: 90px;
}

.task-card__meta dt {
  font-size: var(--ui-text-xs, 0.75rem);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ui-text-muted, #64748b);
}

.task-card__meta dd {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text, #0b2e33);
}

.priority {
  border-radius: var(--ui-radius-full, 9999px);
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-inverse, #fff);
}

.priority--高 {
  background: var(--ui-brand-900, #0b2e33);
}

.priority--中 {
  background: var(--ui-brand-600, #4f7c82);
}

.priority--低 {
  background: var(--ui-brand-400, #93b1b5);
}

.task-card:hover {
  transform: translateY(-2px);
  border-color: var(--ui-brand-400, rgba(79, 124, 130, 0.4));
  box-shadow: var(--ui-shadow-lg, 0 12px 24px rgba(11, 46, 51, 0.12));
}

.task-card.is-selected {
  border-color: var(--ui-border-strong, rgba(11, 46, 51, 0.3));
  box-shadow: var(--ui-shadow-xl, 0 20px 40px rgba(11, 46, 51, 0.15));
  background: var(--ui-surface-accent-strong, rgba(184, 227, 233, 0.35));
}

.task-card.is-highlight {
  animation: pulse 1.4s ease-in-out infinite alternate;
}

@keyframes pulse {
  from {
    transform: translateY(-2px);
  }
  to {
    transform: translateY(-6px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .task-card {
    transition: none;
  }
  .task-card.is-highlight {
    animation: none;
  }
  .board__new {
    transition: none;
  }
}

.task-detail-enter-active,
.task-detail-leave-active {
  transition: opacity 200ms ease;
}

.task-detail-enter-from,
.task-detail-leave-to {
  opacity: 0;
}

.task-detail {
  margin-top: var(--ui-space-2, 0.5rem);
  border-radius: var(--ui-radius-2xl, 1.5rem);
  background: var(--ui-surface-elevated, #fff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.12));
  padding: var(--ui-space-6, 1.5rem);
  box-shadow: var(--ui-shadow-xl, 0 20px 40px rgba(11, 46, 51, 0.12));
  display: grid;
  gap: var(--ui-space-4, 1rem);
}

.task-detail__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4, 1rem);
}

.task-detail__header h3 {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.task-detail__close {
  border: none;
  width: 2rem;
  height: 2rem;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-brand-100, rgba(79, 124, 130, 0.18));
  color: var(--ui-brand-900, #0b2e33);
  cursor: pointer;
  transition: var(--ui-transition-colors, background 180ms ease);
}

.task-detail__close:hover {
  background: var(--ui-brand-200, rgba(79, 124, 130, 0.25));
}

.task-detail__description {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  line-height: var(--ui-leading-relaxed, 1.7);
}

.task-detail__grid {
  margin: 0;
  display: grid;
  gap: var(--ui-space-4, 1rem);
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}

.task-detail__grid dt {
  font-size: var(--ui-text-xs, 0.75rem);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ui-text-muted, #64748b);
}

.task-detail__grid dd {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.task-detail__hint {
  margin: 0;
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface-accent, rgba(184, 227, 233, 0.3));
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

@media (max-width: 960px) {
  .board__columns {
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }
}
</style>

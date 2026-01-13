<script setup lang="ts">
/**
 * WeeklyTasksCard - 今週やることカード
 *
 * 期限が7日以内のタスクを表示。
 * 緊急度による色分けと空状態の改善を実装。
 */
import SectionCard from "@/components/ui/SectionCard.vue";
import PageSkeleton from "@/components/loading/PageSkeleton.vue";
import { computed } from "vue";

export interface TaskDoc {
  title: string;
  status: string;
  dueDate?: { seconds: number };
  projectId: string;
  projectName: string;
}

const props = defineProps<{
  loading: boolean;
  tasks: TaskDoc[];
  upcomingTasks: TaskDoc[];
}>();

const maxDisplayTasks = 5;
const displayedTasks = computed(() =>
  props.upcomingTasks.slice(0, maxDisplayTasks),
);

function getUrgencyClass(dueDate?: { seconds: number }): string {
  if (!dueDate) return "";

  const now = Date.now();
  const due = dueDate.seconds * 1000;
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) return "task-item--danger";
  if (diffDays <= 3) return "task-item--warning";
  return "";
}

function formatDueDate(dueDate?: { seconds: number }): string {
  if (!dueDate) return "";

  const now = new Date();
  const due = new Date(dueDate.seconds * 1000);
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "今日";
  if (diffDays === 1) return "明日";
  if (diffDays <= 7) return `${diffDays}日後`;

  return due.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}
</script>

<template>
  <SectionCard title="今週やること" subtitle="期限が7日以内のタスク">
    <PageSkeleton v-if="loading" variant="default" />

    <!-- 空状態：タスクがゼロ -->
    <div v-else-if="!tasks.length" class="empty-state">
      <div class="empty-state__visual">
        <svg
          class="empty-state__icon"
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="6"
            y="10"
            width="36"
            height="32"
            rx="4"
            stroke="currentColor"
            stroke-width="2"
          />
          <path d="M6 18h36" stroke="currentColor" stroke-width="2" />
          <path
            d="M14 6v8M34 6v8"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <circle
            cx="24"
            cy="30"
            r="6"
            stroke="currentColor"
            stroke-width="2"
          />
          <path
            d="M22 30l2 2 4-4"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <p class="empty-state__title">タスクがまだありません</p>
      <p class="empty-state__description">
        プロジェクトに参加してタスクを作成しましょう
      </p>
      <div class="empty-state__actions">
        <span class="empty-state__hint">
          左のプロジェクトを開いて始めましょう
        </span>
      </div>
    </div>

    <!-- 空状態：今週予定のタスクがない -->
    <div v-else-if="!upcomingTasks.length" class="empty-state">
      <div class="empty-state__visual">
        <svg
          class="empty-state__icon empty-state__icon--success"
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="24"
            cy="24"
            r="18"
            stroke="currentColor"
            stroke-width="2"
          />
          <path
            d="M16 24l6 6 12-12"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <p class="empty-state__title">今週の予定はクリア!</p>
      <p class="empty-state__description">
        期限が近いタスクがあると表示されます
      </p>
    </div>

    <!-- タスクリスト -->
    <div v-else class="task-list">
      <article
        v-for="task in displayedTasks"
        :key="task.title + task.projectId"
        class="task-item"
        :class="getUrgencyClass(task.dueDate)"
      >
        <div class="task-item__content">
          <p class="task-item__title">{{ task.title }}</p>
          <p class="task-item__meta">
            <span class="task-item__project">{{ task.projectName }}</span>
          </p>
        </div>
        <span class="task-item__due" :class="getUrgencyClass(task.dueDate)">
          {{ formatDueDate(task.dueDate) }}
        </span>
      </article>
      <p v-if="upcomingTasks.length > maxDisplayTasks" class="task-list__more">
        他 {{ upcomingTasks.length - maxDisplayTasks }} 件のタスク
      </p>
    </div>
  </SectionCard>
</template>

<style scoped>
/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--ui-space-8, 2rem) var(--ui-space-4, 1rem);
  min-height: 200px;
}

.empty-state__visual {
  margin-bottom: var(--ui-space-4, 1rem);
}

.empty-state__icon {
  width: 64px;
  height: 64px;
  color: var(--ui-text-placeholder, #94a3b8);
}

.empty-state__icon--success {
  color: var(--ui-success, #16a34a);
}

.empty-state__title {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.empty-state__description {
  margin: var(--ui-space-2, 0.5rem) 0 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  max-width: 280px;
}

.empty-state__actions {
  margin-top: var(--ui-space-4, 1rem);
}

.empty-state__hint {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1, 0.25rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-brand-600, #4f7c82);
  font-weight: var(--ui-font-medium, 500);
}

/* Task List */
.task-list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface, #ffffff);
  transition: var(--ui-transition-all);
}

.task-item:hover {
  border-color: var(--ui-brand-300, #b8e3e9);
  box-shadow: var(--ui-shadow-sm);
}

.task-item--warning {
  border-left: 3px solid var(--ui-warning, #f59e0b);
}

.task-item--danger {
  border-left: 3px solid var(--ui-danger, #dc2626);
}

.task-item__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.task-item__title {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-item__meta {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.task-item__due {
  flex-shrink: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text-muted, #64748b);
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-full, 9999px);
}

.task-item__due.task-item--warning {
  background: var(--ui-warning-light, #fef3c7);
  color: var(--ui-warning-dark, #92400e);
}

.task-item__due.task-item--danger {
  background: var(--ui-danger-light, #fee2e2);
  color: var(--ui-danger-dark, #991b1b);
}

.task-list__more {
  margin: var(--ui-space-2, 0.5rem) 0 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  text-align: center;
}
</style>

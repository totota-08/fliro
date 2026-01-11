<script setup lang="ts">
/**
 * WeeklyTasksCard - 今週のタスク状況カード
 *
 * 期限が近いタスクを表示。空状態の余白を削減。
 */
import SectionCard from "@/components/ui/SectionCard.vue";
import PageSkeleton from "@/components/loading/PageSkeleton.vue";

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
const displayedTasks = props.upcomingTasks.slice(0, maxDisplayTasks);
</script>

<template>
  <SectionCard title="今週のタスク状況" subtitle="期限が近いタスクをチェック">
    <PageSkeleton v-if="loading" variant="default" />

    <!-- 空状態：タスクがゼロ -->
    <div v-else-if="!tasks.length" class="empty-state empty-state--compact">
      <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none">
        <path
          d="M20 7L12 3L4 7M20 7L12 11M20 7V17L12 21M12 11L4 7M12 11V21M4 7V17L12 21"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <p class="empty-state__title">タスクがありません</p>
      <p class="empty-state__description">
        プロジェクトでタスクを追加しましょう。
      </p>
    </div>

    <!-- 空状態：今週予定のタスクがない -->
    <div
      v-else-if="!upcomingTasks.length"
      class="empty-state empty-state--compact"
    >
      <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none">
        <circle
          cx="11"
          cy="11"
          r="8"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <path
          d="M21 21L16.65 16.65"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
      <p class="empty-state__title">今週の予定タスクはありません</p>
      <p class="empty-state__description">
        期限のあるタスクがあると表示されます。
      </p>
    </div>

    <!-- タスクリスト -->
    <div v-else class="task-list">
      <article
        v-for="task in displayedTasks"
        :key="task.title + task.projectId"
        class="task-item"
      >
        <div class="task-item__content">
          <p class="task-item__title">{{ task.title }}</p>
          <p class="task-item__meta">
            <span class="task-item__project">{{ task.projectName }}</span>
            <span class="task-item__separator">·</span>
            <span class="task-item__due">
              {{
                new Date(task.dueDate!.seconds * 1000).toLocaleDateString(
                  "ja-JP",
                  { month: "short", day: "numeric" },
                )
              }}
            </span>
          </p>
        </div>
      </article>
      <p v-if="upcomingTasks.length > maxDisplayTasks" class="task-list__more">
        他 {{ upcomingTasks.length - maxDisplayTasks }} 件のタスク
      </p>
    </div>
  </SectionCard>
</template>

<style scoped>
/* Compact Empty State - 余白を削減 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.empty-state--compact {
  padding: var(--ui-space-6, 1.5rem) var(--ui-space-4, 1rem);
  min-height: 160px;
}

.empty-state__icon {
  width: 2.5rem;
  height: 2.5rem;
  margin-bottom: var(--ui-space-3, 0.75rem);
  color: var(--ui-text-placeholder, #94a3b8);
}

.empty-state__title {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.empty-state__description {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

/* Task List */
.task-list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.task-item {
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

.task-item__content {
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
}

.task-item__meta {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  display: flex;
  align-items: center;
  gap: var(--ui-space-1, 0.25rem);
}

.task-item__separator {
  opacity: 0.5;
}

.task-list__more {
  margin: var(--ui-space-2, 0.5rem) 0 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  text-align: center;
}
</style>

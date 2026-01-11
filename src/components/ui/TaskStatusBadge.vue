<script setup lang="ts">
/**
 * TaskStatusBadge - タスクステータス専用バッジ
 *
 * タスクのステータスを統一されたデザインで表示する。
 * アプリ全体で一貫したステータス表現を提供。
 */
import type { TaskStatus } from "@/services/taskService";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    status: TaskStatus;
    size?: "sm" | "md";
    showIcon?: boolean;
  }>(),
  {
    size: "md",
    showIcon: false,
  },
);

// ステータスから表示テキストへのマッピング
const statusLabels: Record<TaskStatus, string> = {
  todo: "未着手",
  "in-progress": "進行中",
  done: "完了",
};

const label = computed(() => statusLabels[props.status] || props.status);

// ステータスからバリアントへのマッピング
const variantClass = computed(() => {
  switch (props.status) {
    case "todo":
      return "task-status-badge--todo";
    case "in-progress":
      return "task-status-badge--progress";
    case "done":
      return "task-status-badge--done";
    default:
      return "task-status-badge--todo";
  }
});
</script>

<template>
  <span
    :class="[
      'task-status-badge',
      variantClass,
      `task-status-badge--${size}`,
      { 'task-status-badge--with-icon': showIcon },
    ]"
  >
    <svg
      v-if="showIcon && status === 'todo'"
      class="task-status-badge__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
    </svg>
    <svg
      v-else-if="showIcon && status === 'in-progress'"
      class="task-status-badge__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
    <svg
      v-else-if="showIcon && status === 'done'"
      class="task-status-badge__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
    <span class="task-status-badge__label">{{ label }}</span>
  </span>
</template>

<style scoped>
.task-status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-1, 0.25rem);
  border-radius: var(--ui-radius-full, 9999px);
  font-weight: var(--ui-font-semibold, 600);
  white-space: nowrap;
  border: 1px solid transparent;
}

/* Sizes */
.task-status-badge--sm {
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-xs, 0.75rem);
}

.task-status-badge--md {
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
}

/* Icon */
.task-status-badge__icon {
  width: 1em;
  height: 1em;
  flex-shrink: 0;
}

/* Variants */
.task-status-badge--todo {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text-muted, #64748b);
  border-color: var(--ui-border, rgba(11, 46, 51, 0.12));
}

.task-status-badge--progress {
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-700, #1a4a51);
  border-color: rgba(79, 124, 130, 0.25);
}

.task-status-badge--done {
  background: var(--ui-success-light, #dcfce7);
  color: #166534;
  border-color: rgba(22, 163, 74, 0.25);
}
</style>

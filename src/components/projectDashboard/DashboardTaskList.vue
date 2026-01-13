<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import type { TaskCategory } from "@/services/taskCategoryService";
import type { TaskDoc, TaskStatus } from "@/services/taskService";
import { computed, ref } from "vue";

interface MemberOption {
  id: string;
  name: string;
}

interface TaskFilters {
  search: string;
  status: string;
  assignee: string;
  due: string;
  category: string;
}

const props = defineProps<{
  tasks: TaskDoc[];
  members: MemberOption[];
  categories: TaskCategory[];
  modelValue: TaskFilters;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: TaskFilters];
  select: [taskId: string];
  navigate: [taskId: string];
}>();

const filters = computed({
  get: () => props.modelValue,
  set: (value: TaskFilters) => emit("update:modelValue", value),
});

// 「さらに表示」機能
const INITIAL_DISPLAY_COUNT = 10;
const LOAD_MORE_COUNT = 10;
const visibleTasksCount = ref(INITIAL_DISPLAY_COUNT);

const visibleTasks = computed(() => {
  return props.tasks.slice(0, visibleTasksCount.value);
});

const hasMoreTasks = computed(() => {
  return props.tasks.length > visibleTasksCount.value;
});

const remainingTasksCount = computed(() => {
  return props.tasks.length - visibleTasksCount.value;
});

function loadMoreTasks() {
  visibleTasksCount.value += LOAD_MORE_COUNT;
}

function updateFilter<K extends keyof TaskFilters>(
  key: K,
  value: TaskFilters[K],
) {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}

function resetFilters() {
  emit("update:modelValue", {
    search: "",
    status: "all",
    assignee: "all",
    due: "all",
    category: "all",
  });
}

function isTaskOverdue(task: TaskDoc) {
  if (!task.dueDate?.seconds) return false;
  const due = task.dueDate.seconds * 1000;
  return due < Date.now() && task.status !== "done";
}

function formatDueDate(task: TaskDoc) {
  if (!task.dueDate?.seconds) return "未設定";
  return new Date(task.dueDate.seconds * 1000).toLocaleDateString();
}

function taskStatusLabel(status: TaskStatus) {
  if (status === "in-progress") return "進行中";
  if (status === "done") return "完了";
  return "未着手";
}

function taskStatusClass(task: TaskDoc) {
  const base = `task-row__status--${task.status}`;
  return [base, { "is-overdue": isTaskOverdue(task) }];
}

function normalizeProgress(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  const clamped = Math.min(100, Math.max(0, value));
  return Math.round(clamped / 25) * 25;
}

function taskProgress(task: TaskDoc) {
  return normalizeProgress(task.progress ?? (task.status === "done" ? 100 : 0));
}

function getCategoryName(categoryId?: string | null) {
  if (!categoryId) return "未分類";
  return (
    props.categories.find((category) => category.id === categoryId)?.name ||
    "未分類"
  );
}

function displayAssignee(task: TaskDoc) {
  if (task.assigneeName) return task.assigneeName;
  if (!task.assigneeId) return "未割当";
  const member = props.members.find((m) => m.id === task.assigneeId);
  // uidがそのまま表示されないようフォールバック
  return member?.name || "不明なユーザー";
}

function handleSelect(taskId: string) {
  emit("select", taskId);
}

function handleNavigate(taskId: string) {
  emit("navigate", taskId);
}
</script>

<template>
  <div class="task-list">
    <div class="task-list__header">
      <div class="task-list__header-left">
        <h3>タスク一覧</h3>
        <p>{{ tasks.length }}件のタスク</p>
      </div>
      <div class="task-list__filters">
        <div class="task-search-wrapper">
          <svg
            class="task-search-icon"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.3-4.3"></path>
          </svg>
          <input
            type="text"
            :value="filters.search"
            class="task-search-input"
            placeholder="タスクを検索..."
            @input="
              updateFilter('search', ($event.target as HTMLInputElement).value)
            "
          />
        </div>
        <select
          :value="filters.status"
          class="task-filter-select"
          @change="
            updateFilter('status', ($event.target as HTMLSelectElement).value)
          "
        >
          <option value="all">全て</option>
          <option value="todo">未着手</option>
          <option value="in-progress">進行中</option>
          <option value="done">完了</option>
        </select>
        <select
          :value="filters.assignee"
          class="task-filter-select"
          @change="
            updateFilter('assignee', ($event.target as HTMLSelectElement).value)
          "
        >
          <option value="all">担当者</option>
          <option v-for="member in members" :key="member.id" :value="member.id">
            {{ member.name }}
          </option>
        </select>
        <select
          :value="filters.due"
          class="task-filter-select"
          @change="
            updateFilter('due', ($event.target as HTMLSelectElement).value)
          "
        >
          <option value="all">期限</option>
          <option value="today">今日</option>
          <option value="week">今週</option>
          <option value="overdue">期限切れ</option>
        </select>
        <select
          :value="filters.category"
          class="task-filter-select"
          @change="
            updateFilter('category', ($event.target as HTMLSelectElement).value)
          "
        >
          <option value="all">カテゴリ</option>
          <option value="none">未分類</option>
          <option
            v-for="category in categories"
            :key="category.id"
            :value="category.id"
          >
            {{ category.name }}
          </option>
        </select>
        <button
          type="button"
          class="filter-reset-btn"
          title="フィルターをリセット"
          @click="resetFilters"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
            <path d="M21 3v5h-5"></path>
            <path
              d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
            ></path>
            <path d="M3 21v-5h5"></path>
          </svg>
        </button>
      </div>
    </div>
    <ul class="task-list__items">
      <li
        v-for="task in visibleTasks"
        :key="task.id"
        class="task-row"
        :class="{ 'is-overdue': isTaskOverdue(task) }"
        @click="handleSelect(task.id)"
        @dblclick="handleNavigate(task.id)"
      >
        <div class="task-row__content">
          <div class="task-row__main">
            <p class="task-row__title">{{ task.title }}</p>
            <span class="task-row__category">{{
              getCategoryName(task.categoryId)
            }}</span>
          </div>
          <div class="task-row__meta">
            <span class="task-row__assignee">{{ displayAssignee(task) }}</span>
            <span class="task-row__status" :class="taskStatusClass(task)">
              {{ taskStatusLabel(task.status) }}
            </span>
          </div>
          <div class="task-row__metric task-row__metric--progress">
            <span class="task-row__metric-label">進捗</span>
            <div class="task-row__progress">
              <div class="task-row__progress-bar">
                <div
                  class="task-row__progress-fill"
                  :style="{ width: `${taskProgress(task)}%` }"
                />
              </div>
              <span class="task-row__progress-value"
                >{{ taskProgress(task) }}%</span
              >
            </div>
          </div>
          <div class="task-row__metric task-row__metric--due">
            <span class="task-row__metric-label">期限</span>
            <span
              class="task-row__due"
              :class="{ 'task-row__due--overdue': isTaskOverdue(task) }"
            >
              {{ formatDueDate(task) }}
            </span>
          </div>
        </div>
      </li>
    </ul>

    <!-- さらに表示ボタン -->
    <div v-if="hasMoreTasks" class="task-list__load-more">
      <AppButton variant="ghost" @click="loadMoreTasks">
        さらに表示 ({{ remainingTasksCount }}件)
      </AppButton>
    </div>
  </div>
</template>

<style scoped>
.task-list {
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-5, 1.25rem);
  box-shadow: var(--ui-shadow-lg);
}

.task-list__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--ui-space-4, 1rem);
  margin-bottom: var(--ui-space-4, 1rem);
  padding-bottom: var(--ui-space-4, 1rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  flex-wrap: wrap;
}

.task-list__header-left {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.task-list__header-left h3 {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text, #0b2e33);
}

.task-list__header-left p {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.task-list__filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2, 0.5rem);
  align-items: center;
}

.task-filter-select {
  min-width: 100px;
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface, #ffffff);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text, #0b2e33);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2364748b' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.25rem;
  transition: var(--ui-transition-colors);
}

.task-filter-select:hover {
  border-color: var(--ui-brand-600, #4f7c82);
}

.task-filter-select:focus {
  outline: none;
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.task-search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.task-search-icon {
  position: absolute;
  left: 0.75rem;
  color: var(--ui-text-muted, #64748b);
  pointer-events: none;
}

.task-search-input {
  min-width: 180px;
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  padding-left: 2.25rem;
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface, #ffffff);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text, #0b2e33);
  transition: var(--ui-transition-colors);
}

.task-search-input::placeholder {
  color: var(--ui-text-placeholder, #94a3b8);
}

.task-search-input:hover {
  border-color: var(--ui-brand-600, #4f7c82);
}

.task-search-input:focus {
  outline: none;
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.filter-reset-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-2, 0.5rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text-muted, #64748b);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.filter-reset-btn svg {
  display: block;
}

.filter-reset-btn:hover {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-brand-700, #1a4a51);
  border-color: var(--ui-brand-600, #4f7c82);
}

.filter-reset-btn:active {
  transform: scale(0.95);
}

.task-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.task-row {
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  cursor: pointer;
  transition: var(--ui-transition-all);
  background: var(--ui-surface, #ffffff);
}

.task-row:hover {
  border-color: var(--ui-brand-300, #b8e3e9);
  box-shadow: var(--ui-shadow-sm);
}

.task-row__content {
  display: grid;
  grid-template-columns:
    minmax(0, 1.4fr) minmax(140px, 0.8fr) minmax(150px, 0.8fr)
    minmax(110px, 0.5fr);
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
}

@media (max-width: 900px) {
  .task-row__content {
    grid-template-columns: 1fr;
    gap: var(--ui-space-2, 0.5rem);
  }
  .task-row__title {
    font-size: var(--ui-text-base, 1rem);
  }
  .task-row__status {
    justify-self: start;
  }
  .task-row__progress {
    width: 100%;
  }
  .task-row__due {
    justify-self: start;
  }
}

.task-row__main {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
  min-width: 0;
}

.task-row__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  min-width: 0;
}

.task-row__metric {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  min-width: 0;
}

.task-row__metric-label {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: var(--ui-text-muted, #94a3b8);
  text-transform: uppercase;
}

.task-row__title {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-row__assignee {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-row__category {
  font-size: var(--ui-text-xs, 0.75rem);
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-800, #134e4a);
  border-radius: var(--ui-radius-full, 9999px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.task-row__status {
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  border-radius: var(--ui-radius-full, 9999px);
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.task-row__status--todo {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text-muted, #64748b);
}

.task-row__status--in-progress {
  background: rgba(79, 124, 130, 0.2);
  color: var(--ui-brand-800, #134e4a);
}

.task-row__status--review {
  background: rgba(245, 158, 11, 0.2);
  color: #92400e;
}

.task-row__status--done {
  background: rgba(22, 163, 74, 0.2);
  color: #166534;
}

.task-row__status.is-overdue {
  background: rgba(239, 68, 68, 0.2);
  color: #991b1b;
}

.task-row__progress {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
}

.task-row__progress-bar {
  width: 60px;
  height: 6px;
  background: var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-full, 9999px);
  overflow: hidden;
}

.task-row__progress-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--ui-brand-600, #4f7c82),
    var(--ui-brand-900, #0b2e33)
  );
  border-radius: inherit;
  transition: width 0.25s ease;
}

.task-row__progress-value {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  width: 2.5rem;
  text-align: right;
}

.task-row__due {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  white-space: nowrap;
}

.task-row__due--overdue {
  color: var(--ui-danger, #ef4444);
  font-weight: var(--ui-font-semibold, 600);
}

.task-row.is-overdue {
  border-color: rgba(239, 68, 68, 0.25);
  background-color: var(--ui-danger-light, #fef2f2);
}

.task-row.is-overdue:hover {
  border-color: rgba(239, 68, 68, 0.4);
  background-color: rgba(239, 68, 68, 0.08);
}

.task-list__load-more {
  display: flex;
  justify-content: center;
  margin-top: var(--ui-space-4, 1rem);
  padding-top: var(--ui-space-4, 1rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}
</style>

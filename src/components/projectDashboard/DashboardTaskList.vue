<script setup lang="ts">
/**
 * DashboardTaskList コンポーネント
 *
 * タスク一覧の検索・フィルタリング・表示を担当。
 */
import { ROUTE_NAMES } from "@/constants/routes";
import type { TaskCategory } from "@/services/taskCategoryService";
import type { TaskDoc, TaskStatus } from "@/services/taskService";
import { computed, reactive, watch } from "vue";

interface MemberEntry {
  id: string;
  name: string;
  userId?: string;
}

interface Props {
  /** タスク一覧（フィルタリング前） */
  tasks: TaskDoc[];
  /** メンバー一覧 */
  members: MemberEntry[];
  /** カテゴリ一覧 */
  categories: TaskCategory[];
  /** 現在のユーザーID */
  currentUserId?: string | null;
  /** プロジェクトID（カテゴリ管理へのリンク用） */
  projectId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "select-task": [taskId: string];
  "navigate-task": [taskId: string];
}>();

// フィルタ状態
const filters = reactive({
  search: "",
  status: "all" as string,
  assignee: "all" as string,
  due: "all" as string,
  category: "all" as string,
  showMyTasksOnly: false,
});

// カテゴリMap（O(1)参照用）
const categoryMap = computed(() => {
  return new Map(props.categories.map((c) => [c.id, c]));
});

// フィルタリング済みタスク
const filteredTasks = computed(() => {
  let list = [...props.tasks];

  // 検索
  if (filters.search.trim()) {
    const keyword = filters.search.trim().toLowerCase();
    list = list.filter((task) => task.title.toLowerCase().includes(keyword));
  }

  // ステータス
  if (filters.status !== "all") {
    list = list.filter((task) => task.status === filters.status);
  }

  // 担当者
  if (filters.assignee !== "all") {
    list = list.filter((task) => (task.assigneeId || "") === filters.assignee);
  }

  // 期限
  if (filters.due !== "all") {
    const now = new Date();
    list = list.filter((task) => {
      if (!task.dueDate?.seconds) return false;
      const due = new Date(task.dueDate.seconds * 1000);
      if (filters.due === "today")
        return due.toDateString() === now.toDateString();
      if (filters.due === "week")
        return (
          due.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000 && due >= now
        );
      if (filters.due === "overdue") return due < now;
      return true;
    });
  }

  // カテゴリ
  if (filters.category !== "all") {
    list = list.filter(
      (task) => (task.categoryId || "none") === filters.category,
    );
  }

  // 自分のタスクのみ
  if (filters.showMyTasksOnly && props.currentUserId) {
    list = list.filter((task) => task.assigneeId === props.currentUserId);
  }

  return list;
});

// ヘルパー関数
function getCategoryName(categoryId?: string | null) {
  if (!categoryId) return "未分類";
  return categoryMap.value.get(categoryId)?.name || "未分類";
}

function getCategoryColor(categoryId?: string | null) {
  if (!categoryId) return undefined;
  return categoryMap.value.get(categoryId)?.color;
}

function getMemberName(memberId?: string | null) {
  if (!memberId) return "未割当";
  const member = props.members.find((m) => m.id === memberId);
  return member?.name || memberId;
}

function formatDueDate(task: TaskDoc) {
  if (!task.dueDate?.seconds) return "未設定";
  return new Date(task.dueDate.seconds * 1000).toLocaleDateString();
}

function isTaskOverdue(task: TaskDoc) {
  if (!task.dueDate?.seconds) return false;
  const due = task.dueDate.seconds * 1000;
  return due < Date.now() && task.status !== "done";
}

function taskStatusLabel(status: TaskStatus) {
  const labels: Record<TaskStatus, string> = {
    todo: "未着手",
    "in-progress": "進行中",
    review: "レビュー",
    done: "完了",
  };
  return labels[status] || status;
}

function taskStatusClass(task: TaskDoc) {
  return [
    `task-row__status--${task.status}`,
    { "is-overdue": isTaskOverdue(task) },
  ];
}

function normalizeProgress(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  const clamped = Math.min(100, Math.max(0, value));
  return Math.round(clamped / 25) * 25;
}

function taskProgress(task: TaskDoc) {
  return normalizeProgress(task.progress ?? (task.status === "done" ? 100 : 0));
}

function resetFilters() {
  filters.search = "";
  filters.status = "all";
  filters.assignee = "all";
  filters.due = "all";
  filters.category = "all";
  filters.showMyTasksOnly = false;
}

function handleTaskClick(taskId: string) {
  emit("select-task", taskId);
}

function handleTaskDoubleClick(taskId: string) {
  emit("navigate-task", taskId);
}

// showMyTasksOnly の変更を監視してフィルタをリセット
watch(
  () => filters.showMyTasksOnly,
  (val) => {
    if (val) {
      filters.assignee = "all";
    }
  },
);
</script>

<template>
  <section class="task-list">
    <div class="task-list__header">
      <div class="task-list__header-left">
        <h3>タスク一覧</h3>
        <p>{{ filteredTasks.length }}件のタスク</p>
      </div>
      <div class="task-list__actions">
        <label class="task-list__my-tasks-toggle">
          <input v-model="filters.showMyTasksOnly" type="checkbox" />
          <span>自分のタスクのみ</span>
        </label>
        <router-link
          :to="{ name: ROUTE_NAMES.projectCategories, params: { projectId } }"
          class="manage-categories-link"
        >
          カテゴリ管理
        </router-link>
      </div>
    </div>

    <div class="task-list__filters">
      <input
        v-model="filters.search"
        type="search"
        class="task-filter-search"
        placeholder="タスクを検索..."
      />
      <select v-model="filters.status" class="task-filter-select">
        <option value="all">全て</option>
        <option value="todo">未着手</option>
        <option value="in-progress">進行中</option>
        <option value="review">レビュー</option>
        <option value="done">完了</option>
      </select>
      <select v-model="filters.assignee" class="task-filter-select">
        <option value="all">担当者</option>
        <option v-for="member in members" :key="member.id" :value="member.id">
          {{ member.name }}
        </option>
      </select>
      <select v-model="filters.due" class="task-filter-select">
        <option value="all">期限</option>
        <option value="today">今日</option>
        <option value="week">今週</option>
        <option value="overdue">期限切れ</option>
      </select>
      <select v-model="filters.category" class="task-filter-select">
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
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
      </button>
    </div>

    <ul v-if="filteredTasks.length" class="task-list__items">
      <li
        v-for="task in filteredTasks"
        :key="task.id"
        class="task-row"
        :class="{ 'is-overdue': isTaskOverdue(task) }"
        @click="handleTaskClick(task.id)"
        @dblclick="handleTaskDoubleClick(task.id)"
      >
        <div class="task-row__content">
          <p class="task-row__title">{{ task.title }}</p>
          <span
            class="task-row__category"
            :style="
              getCategoryColor(task.categoryId)
                ? {
                    backgroundColor: getCategoryColor(task.categoryId) + '20',
                    color: getCategoryColor(task.categoryId),
                    borderColor: getCategoryColor(task.categoryId),
                  }
                : {}
            "
          >
            {{ getCategoryName(task.categoryId) }}
          </span>
          <span class="task-row__assignee">
            {{ getMemberName(task.assigneeId) }}
          </span>
          <span class="task-row__status" :class="taskStatusClass(task)">
            {{ taskStatusLabel(task.status) }}
          </span>
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
          <span
            class="task-row__due"
            :class="{ 'task-row__due--overdue': isTaskOverdue(task) }"
          >
            {{ formatDueDate(task) }}
          </span>
        </div>
      </li>
    </ul>

    <div v-else class="task-list__empty">
      <p>該当するタスクがありません</p>
    </div>
  </section>
</template>

<style scoped>
.task-list {
  border: 1px solid var(--border-color, rgba(11, 46, 51, 0.08));
  border-radius: var(--radius-lg, 1.5rem);
  background: var(--surface, #fff);
  padding: var(--gap-lg, 1.25rem);
  box-shadow: var(--shadow-sm, 0 8px 20px rgba(11, 46, 51, 0.06));
}

.task-list__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--gap-lg, 1rem);
  padding-bottom: var(--gap-lg, 1rem);
  border-bottom: 2px solid rgba(11, 46, 51, 0.08);
  gap: var(--gap-lg, 1.5rem);
  flex-wrap: wrap;
}

.task-list__header-left {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.task-list__header-left h3 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-strong, #0b2e33);
}

.task-list__header-left p {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-muted, #4f7c82);
}

.task-list__actions {
  display: flex;
  align-items: center;
  gap: var(--gap-lg, 1rem);
}

.task-list__my-tasks-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-strong, #0b2e33);
  cursor: pointer;
}

.task-list__my-tasks-toggle input {
  cursor: pointer;
}

.manage-categories-link {
  font-size: 0.9rem;
  color: var(--brand-muted, #4f7c82);
  text-decoration: none;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm, 0.5rem);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.manage-categories-link:hover {
  background: rgba(11, 46, 51, 0.05);
  color: var(--brand, #0b2e33);
}

.task-list__filters {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: var(--gap-lg, 1rem);
}

.task-filter-search {
  flex: 1;
  min-width: 200px;
  padding: 0.55rem 0.85rem;
  border-radius: var(--radius-sm, 0.7rem);
  border: 1px solid rgba(11, 46, 51, 0.12);
  background: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
}

.task-filter-search:focus {
  outline: none;
  border-color: var(--brand-muted, #4f7c82);
}

.task-filter-select {
  padding: 0.55rem 0.85rem;
  border-radius: var(--radius-sm, 0.7rem);
  border: 1px solid rgba(11, 46, 51, 0.12);
  background: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--brand, #0b2e33);
  transition: all 0.15s ease;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%230b2e33' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.7rem center;
  background-size: 10px;
  padding-right: 2.2rem;
  min-width: 100px;
}

.task-filter-select:hover {
  border-color: rgba(11, 46, 51, 0.25);
  background-color: #fff;
}

.task-filter-select:focus {
  outline: none;
  border-color: var(--brand-muted, #4f7c82);
  background-color: #fff;
}

.filter-reset-btn {
  padding: 0.55rem;
  border-radius: var(--radius-sm, 0.7rem);
  border: 1px solid rgba(11, 46, 51, 0.15);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--brand-muted, #4f7c82);
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-reset-btn svg {
  display: block;
}

.filter-reset-btn:hover {
  border-color: var(--brand-muted, #4f7c82);
  background: rgba(79, 124, 130, 0.08);
  color: var(--brand, #0b2e33);
  transform: rotate(-15deg);
}

.task-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.task-row {
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: var(--radius-sm, 0.5rem);
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.task-row:hover {
  border-color: rgba(11, 46, 51, 0.2);
  background-color: rgba(184, 227, 233, 0.1);
}

.task-row.is-overdue {
  border-color: rgba(239, 68, 68, 0.25);
  background-color: rgba(239, 68, 68, 0.05);
}

.task-row.is-overdue:hover {
  border-color: rgba(239, 68, 68, 0.4);
  background-color: rgba(239, 68, 68, 0.08);
}

.task-row__content {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 0.9fr 1.5fr 1fr;
  gap: 1rem;
  align-items: center;
}

.task-row__title {
  margin: 0;
  font-weight: 600;
  color: var(--text-strong, #0b2e33);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-row__category {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(11, 46, 51, 0.06);
  border: 1px solid transparent;
  color: var(--text-strong, #0b2e33);
  font-size: 0.8rem;
  white-space: nowrap;
}

.task-row__assignee {
  font-size: 0.85rem;
  color: var(--text-muted, #4f7c82);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-row__status {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  font-size: 0.8rem;
  font-weight: 700;
}

.task-row__status--todo {
  color: var(--text-muted, #4f7c82);
}

.task-row__status--in-progress {
  color: var(--brand, #0b2e33);
}

.task-row__status--review {
  color: #8a5a00;
}

.task-row__status--done {
  color: #166534;
}

.task-row__status.is-overdue {
  color: #991b1b;
}

.task-row__progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.task-row__progress-bar {
  flex: 1;
  height: 0.5rem;
  background: rgba(11, 46, 51, 0.1);
  border-radius: 999px;
  overflow: hidden;
}

.task-row__progress-fill {
  height: 100%;
  background: var(--brand-muted, #4f7c82);
  border-radius: inherit;
  transition: width 0.3s ease;
}

.task-row__progress-value {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-strong, #0b2e33);
  min-width: 2.5rem;
  text-align: right;
}

.task-row__due {
  font-size: 0.85rem;
  color: var(--text-muted, #4f7c82);
  text-align: right;
}

.task-row__due--overdue {
  color: #b91c1c;
  font-weight: 700;
}

.task-list__empty {
  text-align: center;
  padding: var(--gap-2xl, 3rem);
  color: var(--text-muted, #4f7c82);
}

/* Responsive */
@media (max-width: 1024px) {
  .task-row__content {
    grid-template-columns: 2fr 1fr 1fr 1fr;
  }

  .task-row__progress,
  .task-row__due {
    display: none;
  }
}

@media (max-width: 768px) {
  .task-list__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .task-list__actions {
    width: 100%;
    justify-content: space-between;
  }

  .task-list__filters {
    flex-direction: column;
    align-items: stretch;
  }

  .task-filter-search {
    min-width: auto;
    width: 100%;
  }

  .task-filter-select {
    width: 100%;
  }

  .task-row__content {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .task-row__title {
    font-size: 1rem;
  }

  .task-row__status {
    justify-content: flex-start;
  }

  .task-row__progress,
  .task-row__due {
    display: flex;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .task-row,
  .task-row__progress-fill,
  .filter-reset-btn {
    transition: none;
  }
}
</style>

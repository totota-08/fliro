<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import DashboardSidebar from "@/components/demo/DashboardSidebar.vue";

type Task = {
  id: number;
  title: string;
  project: string;
  projectColor: string;
  status: "完了" | "進行中" | "レビュー待ち" | "未着手";
  priority: "高" | "中" | "低";
  dueDate: string;
  description: string;
};

const isSidebarOpen = ref(true);
const activeTab = ref<"active" | "completed">("active");

const myTasks = ref<Task[]>([
  {
    id: 1,
    title: "ホームページのデザイン作成",
    project: "Webサイトリニューアル",
    projectColor: "task-dot--primary",
    status: "進行中",
    priority: "高",
    dueDate: "2025-01-15",
    description: "新しいホームページのモックアップを作成する",
  },
  {
    id: 2,
    title: "API仕様書のレビュー",
    project: "モバイルアプリ開発",
    projectColor: "task-dot--secondary",
    status: "レビュー待ち",
    priority: "中",
    dueDate: "2025-01-12",
    description: "バックエンドチームが作成したAPI仕様書を確認",
  },
  {
    id: 3,
    title: "ユーザーテストの実施",
    project: "Webサイトリニューアル",
    projectColor: "task-dot--primary",
    status: "未着手",
    priority: "中",
    dueDate: "2025-01-20",
    description: "5名のユーザーに対してプロトタイプのテストを実施",
  },
  {
    id: 4,
    title: "SNS投稿コンテンツ作成",
    project: "マーケティングキャンペーン",
    projectColor: "task-dot--accent",
    status: "進行中",
    priority: "高",
    dueDate: "2025-01-10",
    description: "来週のキャンペーン用のSNS投稿を3件作成",
  },
  {
    id: 5,
    title: "データベース設計",
    project: "モバイルアプリ開発",
    projectColor: "task-dot--secondary",
    status: "完了",
    priority: "高",
    dueDate: "2025-01-08",
    description: "ユーザー情報とタスク管理のためのDB設計",
  },
]);

const closeSidebar = () => {
  isSidebarOpen.value = false;
};

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

onMounted(() => {
  if (window.matchMedia("(max-width: 1200px)").matches) {
    isSidebarOpen.value = false;
  }
});

const getStatusBadgeClass = (status: Task["status"]) => {
  switch (status) {
    case "完了":
      return "badge status-done";
    case "進行中":
      return "badge status-progress";
    case "レビュー待ち":
      return "badge status-review";
    default:
      return "badge status-todo";
  }
};

const getPriorityBadgeClass = (priority: Task["priority"]) => {
  switch (priority) {
    case "高":
      return "badge priority-high";
    case "中":
      return "badge priority-medium";
    default:
      return "badge priority-low";
  }
};

const getDaysUntilDue = (dueDate: string) => {
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

type DecoratedTask = Task & {
  daysUntil: number;
  dueMessage: string;
  dueClass: "" | "due-over" | "due-soon";
};

const decorateTask = (task: Task): DecoratedTask => {
  const daysUntil = getDaysUntilDue(task.dueDate);
  let dueMessage = "";
  let dueClass: DecoratedTask["dueClass"] = "";

  if (daysUntil < 0) {
    dueMessage = `${Math.abs(daysUntil)}日遅れ`;
    dueClass = "due-over";
  } else if (daysUntil === 0) {
    dueMessage = "今日が期限";
    dueClass = "due-soon";
  } else if (daysUntil <= 3) {
    dueMessage = `あと${daysUntil}日`;
    dueClass = "due-soon";
  } else {
    dueMessage = `あと${daysUntil}日`;
  }

  return {
    ...task,
    daysUntil,
    dueMessage,
    dueClass,
  };
};

const decoratedTasks = computed(() => myTasks.value.map(decorateTask));
const activeTasks = computed(() =>
  decoratedTasks.value.filter((task) => task.status !== "完了"),
);
const completedTasks = computed(() =>
  decoratedTasks.value.filter((task) => task.status === "完了"),
);

const stats = computed(() => ({
  total: myTasks.value.length,
  progress: myTasks.value.filter((task) => task.status === "進行中").length,
  review: myTasks.value.filter((task) => task.status === "レビュー待ち").length,
  done: completedTasks.value.length,
}));
</script>

<template>
  <div :class="['demo', { 'demo--sidebar-collapsed': !isSidebarOpen }]">
    <DashboardSidebar :open="isSidebarOpen" @close="closeSidebar" />
    <div
      v-if="isSidebarOpen"
      class="demo__overlay"
      aria-hidden="true"
      @click="closeSidebar"
    />

    <div class="demo__main">
      <header class="demo__topbar">
        <div class="demo__topbar-left">
          <button
            type="button"
            class="demo__menu-button"
            @click="toggleSidebar"
          >
            <span class="sr-only">サイドバーを切り替え</span>
            <svg
              v-if="!isSidebarOpen"
              aria-hidden="true"
              class="demo__menu-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
            <svg
              v-else
              aria-hidden="true"
              class="demo__menu-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 6l12 12M18 6l-12 12"
              />
            </svg>
          </button>
          <div>
            <p class="demo__breadcrumb">デモ体験 &gt; マイタスク</p>
            <h1 class="demo__heading">Webサイトリニューアル</h1>
          </div>
        </div>
        <div class="demo__toolbar">
          <button type="button">共有</button>
          <button type="button" class="is-primary">エクスポート</button>
        </div>
      </header>

      <div class="demo__content demo__content--condensed">
        <section class="tasks-page">
          <header class="tasks-page__header">
            <div>
              <h2>マイタスク</h2>
              <p>あなたに割り当てられたタスクの一覧です</p>
            </div>
            <button type="button" class="tasks-page__filter">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M4 6h16M6 12h12M10 18h4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
              </svg>
              フィルター
            </button>
          </header>

          <section class="tasks-stats">
            <article class="tasks-stats__card">
              <p>全タスク</p>
              <strong>{{ stats.total }}</strong>
            </article>
            <article class="tasks-stats__card">
              <p>進行中</p>
              <strong class="tone-progress">{{ stats.progress }}</strong>
            </article>
            <article class="tasks-stats__card">
              <p>完了</p>
              <strong class="tone-done">{{ stats.done }}</strong>
            </article>
          </section>

          <section class="tasks-tabs">
            <div
              class="tasks-tabs__list"
              role="tablist"
              aria-label="タスクの状態"
            >
              <button
                type="button"
                class="tasks-tabs__trigger"
                :class="{ 'is-active': activeTab === 'active' }"
                role="tab"
                :aria-selected="activeTab === 'active'"
                @click="activeTab = 'active'"
              >
                進行中 ({{ activeTasks.length }})
              </button>
              <button
                type="button"
                class="tasks-tabs__trigger"
                :class="{ 'is-active': activeTab === 'completed' }"
                role="tab"
                :aria-selected="activeTab === 'completed'"
                @click="activeTab = 'completed'"
              >
                完了 ({{ completedTasks.length }})
              </button>
            </div>

            <div class="tasks-tabs__content" role="tabpanel">
              <template v-if="activeTab === 'active'">
                <article
                  v-for="task in activeTasks"
                  :key="task.id"
                  class="task-card"
                  :class="{ 'is-overdue': task.daysUntil < 0 }"
                >
                  <div class="task-card__headline">
                    <div class="task-card__project">
                      <span
                        :class="['task-dot', task.projectColor]"
                        aria-hidden="true"
                      />
                      <span>{{ task.project }}</span>
                    </div>
                    <div class="task-card__badges">
                      <span :class="getStatusBadgeClass(task.status)">{{
                        task.status
                      }}</span>
                      <span :class="getPriorityBadgeClass(task.priority)">{{
                        task.priority
                      }}</span>
                    </div>
                  </div>

                  <h3>{{ task.title }}</h3>
                  <p>{{ task.description }}</p>

                  <div class="task-card__meta">
                    <div class="task-card__meta-item">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
                          stroke-width="1.6"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                        <path
                          d="M7 10h10"
                          stroke-width="1.6"
                          stroke-linecap="round"
                        />
                        <path
                          d="M11 14h2"
                          stroke-width="1.6"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                      <span>{{ task.dueDate }}</span>
                    </div>
                    <div class="task-card__meta-item">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M12 6v6l3.5 3.5"
                          stroke-width="1.7"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                        <circle cx="12" cy="12" r="8" stroke-width="1.5" />
                      </svg>
                      <span :class="task.dueClass">{{ task.dueMessage }}</span>
                    </div>
                  </div>
                </article>
              </template>

              <template v-else>
                <article
                  v-for="task in completedTasks"
                  :key="task.id"
                  class="task-card is-completed"
                >
                  <div class="task-card__headline">
                    <div class="task-card__project">
                      <span
                        :class="['task-dot', task.projectColor]"
                        aria-hidden="true"
                      />
                      <span>{{ task.project }}</span>
                    </div>
                    <span :class="getStatusBadgeClass(task.status)">{{
                      task.status
                    }}</span>
                  </div>
                  <h3>{{ task.title }}</h3>
                  <p>{{ task.description }}</p>
                  <div class="task-card__meta">
                    <div class="task-card__meta-item">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
                          stroke-width="1.6"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                        <path
                          d="M7 10h10"
                          stroke-width="1.6"
                          stroke-linecap="round"
                        />
                      </svg>
                      <span>{{ task.dueDate }}</span>
                    </div>
                    <div class="task-card__meta-item">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M20 6 9 17l-5-5"
                          stroke-width="1.6"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                      <span>完了済み</span>
                    </div>
                  </div>
                </article>
              </template>
            </div>
          </section>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import "@/pages/demo/styles/demo-shell.css";

/* ========================================
 * Demo Content Layout
 * ======================================== */

.demo__content--condensed {
  padding: var(--ui-space-8, 2rem);
  gap: 0;
}

/* ========================================
 * Tasks Page Layout
 * ======================================== */

.tasks-page {
  display: grid;
  gap: var(--ui-space-8, 2rem);
}

.tasks-page__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4, 1rem);
}

.tasks-page__header h2 {
  margin: 0;
  font-size: clamp(1.6rem, 3vw, var(--ui-text-3xl, 1.875rem));
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.tasks-page__header p {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.tasks-page__filter {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-5, 1.25rem);
  border-radius: var(--ui-radius-lg, 1rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  background: var(--ui-brand-50, #f5fcff);
  color: var(--ui-brand-900, #0b2e33);
  cursor: pointer;
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  transition: var(--ui-transition-all, all 180ms ease);
}

.tasks-page__filter:hover {
  background: var(--ui-brand-100, #e5f6f8);
  border-color: var(--ui-border-strong, rgba(11, 46, 51, 0.2));
  box-shadow: var(--ui-shadow-md, 0 4px 12px rgba(11, 46, 51, 0.08));
}

.tasks-page__filter:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus, 0 0 0 3px rgba(79, 124, 130, 0.25));
}

.tasks-page__filter svg {
  width: 1.125rem;
  height: 1.125rem;
}

/* ========================================
 * Stats Cards
 * ======================================== */

.tasks-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--ui-space-4, 1rem);
}

.tasks-stats__card {
  padding: var(--ui-space-5, 1.25rem) var(--ui-space-6, 1.5rem);
  border-radius: var(--ui-radius-xl, 1.25rem);
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  box-shadow: var(--ui-shadow-md, 0 4px 12px rgba(11, 46, 51, 0.08));
}

.tasks-stats__card p {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.tasks-stats__card strong {
  display: block;
  margin-top: var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-3xl, 1.875rem);
  color: var(--ui-text-strong, #0f172a);
  font-weight: var(--ui-font-bold, 700);
}

.tasks-stats__card strong.tone-progress {
  color: var(--ui-brand-600, #4f7c82);
}

.tasks-stats__card strong.tone-review {
  color: var(--ui-brand-700, #1a4a51);
}

.tasks-stats__card strong.tone-done {
  color: var(--ui-success, #16a34a);
}

/* ========================================
 * Tabs
 * ======================================== */

.tasks-tabs {
  display: grid;
  gap: var(--ui-space-6, 1.5rem);
}

.tasks-tabs__list {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
  background: var(--ui-surface-glass, rgba(255, 255, 255, 0.8));
  border-radius: var(--ui-radius-full, 9999px);
  padding: var(--ui-space-1, 0.25rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.tasks-tabs__trigger {
  border: none;
  background: transparent;
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-5, 1.25rem);
  border-radius: var(--ui-radius-full, 9999px);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-muted, #64748b);
  cursor: pointer;
  transition: var(--ui-transition-all, all 180ms ease);
}

.tasks-tabs__trigger:hover {
  color: var(--ui-text-strong, #0f172a);
}

.tasks-tabs__trigger:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus, 0 0 0 3px rgba(79, 124, 130, 0.25));
}

.tasks-tabs__trigger.is-active {
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-900, #0b2e33);
  box-shadow: var(--ui-shadow-sm, 0 1px 2px rgba(11, 46, 51, 0.05));
}

.tasks-tabs__content {
  display: grid;
  gap: var(--ui-space-5, 1.25rem);
}

/* ========================================
 * Task Card
 * ======================================== */

.task-card {
  display: grid;
  gap: var(--ui-space-4, 1rem);
  padding: var(--ui-space-6, 1.5rem);
  border-radius: var(--ui-radius-xl, 1.25rem);
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  box-shadow: var(--ui-shadow-md, 0 4px 12px rgba(11, 46, 51, 0.08));
  transition: var(--ui-transition-all, all 180ms ease);
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--ui-shadow-lg, 0 12px 24px rgba(11, 46, 51, 0.1));
  border-color: var(--ui-brand-300, #b8e3e9);
}

.task-card.is-overdue {
  border-color: var(--ui-danger, #d64545);
  border-left-width: 3px;
}

.task-card.is-completed {
  opacity: 0.75;
  box-shadow: var(--ui-shadow-sm, 0 1px 2px rgba(11, 46, 51, 0.05));
}

.task-card.is-completed:hover {
  transform: none;
  box-shadow: var(--ui-shadow-sm, 0 1px 2px rgba(11, 46, 51, 0.05));
}

.task-card__headline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--ui-space-3, 0.75rem);
}

.task-card__project {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.task-card__badges {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
}

.task-card h3 {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.task-card p {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
  line-height: var(--ui-leading-relaxed, 1.625);
}

.task-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-5, 1.25rem);
  font-size: var(--ui-text-sm, 0.875rem);
}

.task-card__meta-item {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  color: var(--ui-text-muted, #64748b);
}

.task-card__meta-item svg {
  width: 1.125rem;
  height: 1.125rem;
}

/* ========================================
 * Badges
 * ======================================== */

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-full, 9999px);
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
  line-height: var(--ui-leading-normal, 1.5);
}

/* Status: Done - Green */
.status-done {
  background: var(--ui-success-light, #dcfce7);
  color: var(--ui-success-text, #166534);
  border: 1px solid var(--ui-success, #16a34a);
  border-color: rgba(22, 163, 74, 0.3);
}

/* Status: In Progress - Brand */
.status-progress {
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-900, #0b2e33);
  border: 1px solid var(--ui-brand-300, #b8e3e9);
}

/* Status: Review - Info */
.status-review {
  background: var(--ui-info-light, #e0f2fe);
  color: var(--ui-info, #0284c7);
  border: 1px solid rgba(2, 132, 199, 0.3);
}

/* Status: Todo - Neutral */
.status-todo {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text-muted, #64748b);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
}

/* Priority: High - Danger/Red */
.priority-high {
  background: var(--ui-danger-light, #fee2e2);
  color: var(--ui-danger-text, #991b1b);
  border: 1px solid rgba(214, 69, 69, 0.3);
}

/* Priority: Medium - Warning/Orange */
.priority-medium {
  background: var(--ui-warning-light, #fef3c7);
  color: var(--ui-warning-text, #7c4a00);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

/* Priority: Low - Neutral */
.priority-low {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text-muted, #64748b);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
}

/* ========================================
 * Task Project Dots
 * ======================================== */

.task-dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-brand-400, #8cb8be);
  flex-shrink: 0;
}

.task-dot--primary {
  background: var(--ui-brand-600, #4f7c82);
}

.task-dot--secondary {
  background: var(--ui-brand-400, #8cb8be);
}

.task-dot--accent {
  background: var(--ui-warning, #f59e0b);
}

/* ========================================
 * Due Date States
 * ======================================== */

.due-over {
  color: var(--ui-danger, #d64545);
  font-weight: var(--ui-font-semibold, 600);
}

.due-soon {
  color: var(--ui-warning-dark, #b45309);
  font-weight: var(--ui-font-semibold, 600);
}

/* ========================================
 * Reduced Motion Support
 * ======================================== */

@media (prefers-reduced-motion: reduce) {
  .tasks-page__filter,
  .tasks-tabs__trigger,
  .task-card {
    transition: none;
  }

  .task-card:hover {
    transform: none;
  }
}

/* ========================================
 * Responsive Styles
 * ======================================== */

@media (max-width: 1200px) {
  .demo__content--condensed {
    padding: var(--ui-space-6, 1.5rem);
  }
}

@media (max-width: 768px) {
  .demo__content--condensed {
    padding: var(--ui-space-4, 1rem);
  }

  .tasks-page__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .tasks-tabs__list {
    width: 100%;
    justify-content: space-between;
  }

  .tasks-tabs__trigger {
    flex: 1;
    text-align: center;
  }

  .task-card {
    padding: var(--ui-space-5, 1.25rem);
  }

  .task-card__headline {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

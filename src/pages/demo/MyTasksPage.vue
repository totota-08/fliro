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
              <p>レビュー待ち</p>
              <strong class="tone-review">{{ stats.review }}</strong>
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

.demo__content--condensed {
  padding: 2rem;
  gap: 0;
}

.tasks-page {
  display: grid;
  gap: 2rem;
}

.tasks-page__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.tasks-page__header h2 {
  margin: 0;
  font-size: clamp(1.6rem, 3vw, 2rem);
  font-weight: 700;
  color: var(--text-strong);
}

.tasks-page__header p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
}

.tasks-page__filter {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.2rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(11, 46, 51, 0.18);
  background: rgba(245, 252, 255, 0.6);
  color: var(--primary-strong);
  cursor: pointer;
  font-weight: 600;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.tasks-page__filter:hover {
  background: rgba(184, 227, 233, 0.2);
  border-color: rgba(11, 46, 51, 0.26);
  box-shadow: 0 12px 24px rgba(11, 46, 51, 0.15);
}

.tasks-page__filter svg {
  width: 1.1rem;
  height: 1.1rem;
}

.tasks-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.tasks-stats__card {
  padding: 1.25rem 1.5rem;
  border-radius: 1.25rem;
  background: rgba(245, 252, 255, 0.9);
  border: 1px solid rgba(11, 46, 51, 0.1);
  box-shadow: 0 16px 28px rgba(11, 46, 51, 0.12);
}

.tasks-stats__card p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.tasks-stats__card strong {
  display: block;
  margin-top: 0.5rem;
  font-size: 2rem;
  color: var(--text-strong);
  font-weight: 700;
}

.tasks-stats__card strong.tone-progress {
  color: var(--primary);
}

.tasks-stats__card strong.tone-review {
  color: #4c6b85;
}

.tasks-stats__card strong.tone-done {
  color: #1c8d72;
}

.tasks-tabs {
  display: grid;
  gap: 1.5rem;
}

.tasks-tabs__list {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255, 255, 255, 0.65);
  border-radius: 999px;
  padding: 0.4rem;
  border: 1px solid rgba(11, 46, 51, 0.08);
}

.tasks-tabs__trigger {
  border: none;
  background: transparent;
  padding: 0.55rem 1.3rem;
  border-radius: 999px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.tasks-tabs__trigger.is-active {
  background: rgba(79, 124, 130, 0.15);
  color: var(--primary-strong);
  box-shadow: 0 12px 24px rgba(11, 46, 51, 0.12);
}

.tasks-tabs__content {
  display: grid;
  gap: 1.25rem;
}

.task-card {
  display: grid;
  gap: 1rem;
  padding: 1.6rem;
  border-radius: 1.25rem;
  background: rgba(245, 252, 255, 0.95);
  border: 1px solid rgba(11, 46, 51, 0.12);
  box-shadow: 0 20px 34px rgba(11, 46, 51, 0.14);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 24px 40px rgba(11, 46, 51, 0.16);
  border-color: rgba(79, 124, 130, 0.4);
}

.task-card.is-overdue {
  border-color: rgba(220, 53, 69, 0.35);
}

.task-card.is-completed {
  opacity: 0.8;
  box-shadow: none;
}

.task-card__headline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.task-card__project {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.task-card__badges {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.task-card h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-strong);
}

.task-card p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.6;
}

.task-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  font-size: 0.9rem;
}

.task-card__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--text-muted);
}

.task-card__meta-item svg {
  width: 1.1rem;
  height: 1.1rem;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-done {
  background: rgba(42, 157, 143, 0.14);
  color: #1c8d72;
  border: 1px solid rgba(42, 157, 143, 0.3);
}

.status-progress {
  background: rgba(79, 124, 130, 0.16);
  color: var(--primary-strong);
  border: 1px solid rgba(79, 124, 130, 0.25);
}

.status-review {
  background: rgba(86, 108, 141, 0.16);
  color: #425c7b;
  border: 1px solid rgba(86, 108, 141, 0.25);
}

.status-todo {
  background: rgba(11, 46, 51, 0.08);
  color: var(--text-muted);
  border: 1px solid rgba(11, 46, 51, 0.15);
}

.priority-high {
  background: rgba(220, 53, 69, 0.15);
  color: #b02232;
  border: 1px solid rgba(220, 53, 69, 0.25);
}

.priority-medium {
  background: rgba(255, 193, 7, 0.18);
  color: #9c6d04;
  border: 1px solid rgba(255, 193, 7, 0.35);
}

.priority-low {
  background: rgba(11, 46, 51, 0.08);
  color: var(--text-muted);
  border: 1px solid rgba(11, 46, 51, 0.15);
}

.task-dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 999px;
  background: rgba(79, 124, 130, 0.4);
}

.task-dot--primary {
  background: #4f7c82;
}

.task-dot--secondary {
  background: #93b1b5;
}

.task-dot--accent {
  background: #c0a46c;
}

.due-over {
  color: #c43838;
  font-weight: 600;
}

.due-soon {
  color: #ad7a16;
  font-weight: 600;
}

@media (max-width: 1200px) {
  .demo__content--condensed {
    padding: 1.75rem;
  }
}

@media (max-width: 768px) {
  .tasks-page__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .tasks-tabs__list {
    width: 100%;
    justify-content: space-between;
  }

  .task-card {
    padding: 1.4rem;
  }
}
</style>

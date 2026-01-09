<script setup lang="ts">
import DashboardSidebar from "@/components/projectDashboard/DashboardSidebar.vue";
import AppEmptyState from "@/components/ui/AppEmptyState.vue";
import AppBadge from "@/components/ui/AppBadge.vue";
import AppButton from "@/components/ui/AppButton.vue";
import { appName } from "@/constants/appMeta";
import { buildProjectNavItems } from "@/constants/projectNav";
import { ROUTE_NAMES } from "@/constants/routes";
import { db } from "@/lib/firebase";
import { deleteTask, updateTask, type TaskDoc } from "@/services/taskService";
import { useAuthStore } from "@/store/auth";
import type { DashboardNavItem } from "@/types/projectDashboard";
import { getLogger } from "@logtape/logtape";
import { collection, getDocs } from "firebase/firestore";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const logger = getLogger("app.pages.tasks.MyTasks");

const { user, profile } = useAuthStore();
const router = useRouter();

const isSidebarOpen = ref(true);
const loading = ref(true);
const errorMessage = ref("");
const activeTab = ref<"active" | "completed">("active");
const tasks = ref<TaskDoc[]>([]);
const projects = ref<{ id: string; name: string }[]>([]);

/**
 * Sidebar 用ナビゲーション
 * projectIdがない場合は項目をdisabledにする
 */
const navItems = computed<DashboardNavItem[]>(() => {
  const firstProjectId = projects.value[0]?.id;

  if (firstProjectId) {
    return buildProjectNavItems(firstProjectId);
  }

  // プロジェクトがない場合、共通のナビ項目をdisabled状態で返す
  return buildProjectNavItems("").map((item) => {
    // マイタスクは常に有効
    if (item.key === "tasks") {
      return { ...item, to: { name: ROUTE_NAMES.myTasks } };
    }
    // 他の項目はdisabled
    return {
      ...item,
      disabled: true,
      to: undefined,
      tooltip: "プロジェクトを選択してください",
    };
  });
});

const sidebarProjects = computed(() =>
  projects.value.map((project, index) => ({
    key: project.id,
    label: project.name,
    to: {
      name: ROUTE_NAMES.projectDashboard,
      params: { projectId: project.id },
    },
    accent: ["primary", "secondary", "accent"][index % 3] as
      | "primary"
      | "secondary"
      | "accent",
  })),
);

const profileInfo = computed(() => ({
  name: profile.value?.nickname || profile.value?.fullName || `${appName} User`,
  email: profile.value?.email || "",
}));

/**
 * Firestore からタスク読み込み
 */
async function loadTasks() {
  if (!user.value) return;
  loading.value = true;
  errorMessage.value = "";
  try {
    const projectEntries: { id: string; name: string }[] = [];
    const items: TaskDoc[] = [];

    const projectsSnap = await getDocs(
      collection(db, "userProjects", user.value.uid, "projects"),
    );

    for (const docSnap of projectsSnap.docs) {
      const name = (docSnap.data().projectName as string) || "プロジェクト";
      const projectId = docSnap.id;
      projectEntries.push({ id: projectId, name });

      const taskSnap = await getDocs(
        collection(db, "projects", projectId, "tasks"),
      );
      taskSnap.forEach((taskDoc) => {
        const data = taskDoc.data() as TaskDoc;
        items.push({ ...data, id: taskDoc.id, projectId });
      });
    }

    projects.value = projectEntries;
    tasks.value = items.filter((task) => task.assigneeId === user.value?.uid);
  } catch (error) {
    logger.error`Failed to load tasks: ${error}`;
    errorMessage.value =
      "タスクを取得できませんでした。アクセス権限をご確認ください。";
  } finally {
    loading.value = false;
  }
}

/**
 * UI 用の拡張型
 */
type DisplayStatus = "完了" | "進行中" | "レビュー待ち" | "未着手";
type DisplayPriority = "高" | "中" | "低";

type DecoratedTask = TaskDoc & {
  projectName: string;
  projectColor: string;
  dueMessage: string;
  dueClass: "" | "due-over" | "due-soon";
  dueDateLabel: string;
  displayStatus: DisplayStatus;
  displayPriority: DisplayPriority;
};

/**
 * ステータス → AppBadge variant
 */
const getStatusBadgeVariant = (status: DisplayStatus): "success" | "primary" | "info" | "default" => {
  switch (status) {
    case "完了":
      return "success";
    case "進行中":
      return "primary";
    case "レビュー待ち":
      return "info";
    default:
      return "default";
  }
};

/**
 * 優先度 → AppBadge variant
 */
const getPriorityBadgeVariant = (priority: DisplayPriority): "danger" | "warning" | "default" => {
  switch (priority) {
    case "高":
      return "danger";
    case "中":
      return "warning";
    default:
      return "default";
  }
};

/**
 * 期限までの日数計算（Date → 日数）
 */
const getDaysDiff = (due: Date, base = new Date()) => {
  const diffTime = due.getTime() - base.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Firestore タスク → UI 用タスクに変換
 */
function decorate(task: TaskDoc): DecoratedTask {
  const projectIndex = projects.value.findIndex(
    (entry) => entry.id === task.projectId,
  );
  const project = projects.value[projectIndex];
  const projectName: string = project?.name ?? "プロジェクト";
  const projectColors = [
    "task-dot--primary",
    "task-dot--secondary",
    "task-dot--accent",
  ];
  const projectColor: string =
    projectIndex >= 0
      ? (projectColors[projectIndex % projectColors.length] ??
        "task-dot--primary")
      : "task-dot--primary";

  const due = (task as any).dueDate?.seconds
    ? new Date((task as any).dueDate.seconds * 1000)
    : null;

  let dueMessage = "期限未設定";
  let dueClass: DecoratedTask["dueClass"] = "";
  let dueDateLabel = "未設定";

  if (due) {
    const diff = getDaysDiff(due);
    dueDateLabel = due.toISOString().slice(0, 10);

    if (diff < 0) {
      dueMessage = `${Math.abs(diff)}日遅れ`;
      dueClass = "due-over";
    } else if (diff === 0) {
      dueMessage = "今日が期限";
      dueClass = "due-soon";
    } else {
      dueMessage = `あと${diff}日`;
      if (diff <= 3) dueClass = "due-soon";
    }
  }

  // ステータス（英語）→ 表示用日本語
  let displayStatus: DisplayStatus = "未着手";
  switch ((task as any).status) {
    case "done":
      displayStatus = "完了";
      break;
    case "in-progress":
      displayStatus = "進行中";
      break;
    case "review":
      displayStatus = "レビュー待ち";
      break;
    case "todo":
    default:
      displayStatus = "未着手";
      break;
  }

  // 優先度（想定: 'high' | 'medium' | 'low'）→ 日本語
  let displayPriority: DisplayPriority = "中";
  switch ((task as any).priority) {
    case "high":
      displayPriority = "高";
      break;
    case "low":
      displayPriority = "低";
      break;
    case "medium":
    default:
      displayPriority = "中";
      break;
  }

  return {
    ...(task as TaskDoc),
    projectName,
    projectColor,
    dueMessage,
    dueClass,
    dueDateLabel,
    displayStatus,
    displayPriority,
  };
}

const decoratedTasks = computed(() => tasks.value.map(decorate));
const activeTasks = computed(() =>
  decoratedTasks.value.filter((task) => (task as any).status !== "done"),
);
const completedTasks = computed(() =>
  decoratedTasks.value.filter((task) => (task as any).status === "done"),
);

const stats = computed(() => ({
  total: decoratedTasks.value.length,
  progress: decoratedTasks.value.filter(
    (task) => (task as any).status === "in-progress",
  ).length,
  review: decoratedTasks.value.filter(
    (task) => (task as any).status === "review",
  ).length,
  done: completedTasks.value.length,
}));

function goToTask(task: DecoratedTask) {
  router.push({
    name: ROUTE_NAMES.projectTaskDetail,
    params: { projectId: task.projectId, taskId: task.id },
  });
}

/**
 * 完了トグル & 削除
 */
async function toggleComplete(task: DecoratedTask) {
  const next = (task as any).status === "done" ? "todo" : "done";
  await updateTask(task.projectId, task.id, { status: next } as any, {
    userId: user.value?.uid ?? null,
    actorName: profile.value?.nickname || profile.value?.fullName || "",
    origin: "ui",
  });
  await loadTasks();
}

async function removeTask(task: DecoratedTask) {
  await deleteTask(task.projectId, task.id, {
    userId: user.value?.uid ?? null,
    actorName: profile.value?.nickname || profile.value?.fullName || "",
    origin: "ui",
  });
  await loadTasks();
}

/**
 * サイドバー制御
 */
const closeSidebar = () => {
  isSidebarOpen.value = false;
};

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

/**
 * 初期ロード
 */
onMounted(() => {
  if (window.matchMedia("(max-width: 1200px)").matches) {
    isSidebarOpen.value = false;
  }
  loadTasks();
});
</script>

<template>
  <div :class="['demo', { 'demo--sidebar-collapsed': !isSidebarOpen }]">
    <DashboardSidebar
      :open="isSidebarOpen"
      :nav-items="navItems"
      :projects="sidebarProjects"
      :profile="profileInfo"
      brand-subtitle="マイタスク"
      @close="closeSidebar"
    />
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
            <p class="demo__breadcrumb">{{ appName }} &gt; マイタスク</p>
            <h1 class="demo__heading">{{ profileInfo.name }}</h1>
          </div>
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
              <!-- 状態メッセージ -->
              <section v-if="loading" class="tasks-empty">
                読み込み中...
              </section>
              <AppEmptyState
                v-else-if="errorMessage"
                :title="errorMessage"
                icon="error"
              />
              <AppEmptyState
                v-else-if="activeTab === 'active' && !activeTasks.length"
                title="進行中のタスクはありません"
                description="プロジェクトダッシュボードから新しいタスクを作成しましょう。"
                icon="empty"
              >
                <template #action>
                  <AppButton
                    v-if="projects.length > 0"
                    variant="primary"
                    :to="{ name: ROUTE_NAMES.PROJECT_DASHBOARD, params: { projectId: projects[0].id } }"
                  >
                    プロジェクトを開く
                  </AppButton>
                </template>
              </AppEmptyState>
              <AppEmptyState
                v-else-if="activeTab === 'completed' && !completedTasks.length"
                title="完了したタスクはまだありません"
                description="タスクを完了すると、ここに表示されます。"
                icon="empty"
              />

              <template v-else>
                <!-- 進行中タブ -->
                <template v-if="activeTab === 'active'">
                  <article
                    v-for="task in activeTasks"
                    :key="task.id"
                    class="task-card is-clickable"
                    :class="{
                      'is-overdue': task.dueClass === 'due-over',
                    }"
                    role="button"
                    tabindex="0"
                    @click="goToTask(task)"
                    @keydown.enter.prevent="goToTask(task)"
                    @keydown.space.prevent="goToTask(task)"
                  >
                    <div class="task-card__headline">
                      <div class="task-card__project">
                        <span
                          :class="['task-dot', task.projectColor]"
                          aria-hidden="true"
                        />
                        <span>{{ task.projectName }}</span>
                      </div>
                      <div class="task-card__badges">
                        <AppBadge :variant="getStatusBadgeVariant(task.displayStatus)" size="sm">
                          {{ task.displayStatus }}
                        </AppBadge>
                        <AppBadge :variant="getPriorityBadgeVariant(task.displayPriority)" size="sm">
                          {{ task.displayPriority }}
                        </AppBadge>
                      </div>
                    </div>

                    <h3>{{ task.title }}</h3>

                    <!-- 説明は最初の50文字のみ表示 -->
                    <p v-if="task.description" class="task-card__description">
                      {{ task.description.length > 50 ? task.description.slice(0, 50) + '...' : task.description }}
                    </p>

                    <!-- 期限情報を目立たせる -->
                    <div class="task-card__due-info">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        class="task-card__due-icon"
                      >
                        <path
                          d="M12 6v6l3.5 3.5"
                          stroke-width="1.7"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                        <circle cx="12" cy="12" r="8" stroke-width="1.5" />
                      </svg>
                      <span :class="['task-card__due-text', task.dueClass]">
                        {{ task.dueMessage }}
                      </span>
                    </div>

                    <div class="task-card__actions">
                      <AppButton
                        size="sm"
                        variant="primary"
                        @click.stop="toggleComplete(task)"
                      >
                        {{
                          (task as any).status === "done"
                            ? "未完了に戻す"
                            : "完了にする"
                        }}
                      </AppButton>
                      <AppButton
                        size="sm"
                        variant="danger"
                        @click.stop="removeTask(task)"
                      >
                        削除
                      </AppButton>
                    </div>
                  </article>
                </template>

                <!-- 完了タブ -->
                <template v-else>
                  <article
                    v-for="task in completedTasks"
                    :key="task.id"
                    class="task-card is-completed is-clickable"
                    role="button"
                    tabindex="0"
                    @click="goToTask(task)"
                    @keydown.enter.prevent="goToTask(task)"
                    @keydown.space.prevent="goToTask(task)"
                  >
                    <div class="task-card__headline">
                      <div class="task-card__project">
                        <span
                          :class="['task-dot', task.projectColor]"
                          aria-hidden="true"
                        />
                        <span>{{ task.projectName }}</span>
                      </div>
                      <AppBadge :variant="getStatusBadgeVariant(task.displayStatus)" size="sm">
                        {{ task.displayStatus }}
                      </AppBadge>
                    </div>
                    <h3>{{ task.title }}</h3>

                    <!-- 説明は最初の50文字のみ表示 -->
                    <p v-if="task.description" class="task-card__description">
                      {{ task.description.length > 50 ? task.description.slice(0, 50) + '...' : task.description }}
                    </p>

                    <!-- 完了済みの表示 -->
                    <div class="task-card__due-info task-card__due-info--completed">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        class="task-card__due-icon"
                      >
                        <path
                          d="M20 6 9 17l-5-5"
                          stroke-width="1.6"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                      <span class="task-card__due-text">完了済み</span>
                    </div>

                    <div class="task-card__actions">
                      <AppButton
                        size="sm"
                        variant="secondary"
                        @click.stop="toggleComplete(task)"
                      >
                        未完了に戻す
                      </AppButton>
                      <AppButton
                        size="sm"
                        variant="danger"
                        @click.stop="removeTask(task)"
                      >
                        削除
                      </AppButton>
                    </div>
                  </article>
                </template>
              </template>
            </div>
          </section>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Layout Grid (from demo-shell.css) */
.demo {
  --sidebar-width: var(--ui-sidebar-width);
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  width: 100%;
  height: 100vh;
  gap: 0;
  background: var(--ui-surface-muted);
}

.demo--sidebar-collapsed {
  --sidebar-width: 0px;
}

@supports (height: 100dvh) {
  .demo {
    height: 100dvh;
  }
}

.demo__overlay {
  display: none;
}

.demo__main {
  display: flex;
  flex-direction: column;
  background: var(--ui-bg);
  border-left: 1px solid var(--ui-border-light);
  height: 100vh;
  overflow-y: auto;
}

@supports (height: 100dvh) {
  .demo__main {
    height: 100dvh;
  }
}

.demo__topbar {
  position: sticky;
  top: 0;
  z-index: var(--ui-z-dropdown);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-6);
  min-height: var(--ui-topbar-height);
  padding: 0 var(--ui-space-6);
  border-bottom: 1px solid var(--ui-border-light);
  background: rgba(245, 252, 255, 0.95);
  backdrop-filter: blur(6px);
}

.demo__topbar-left {
  display: flex;
  align-items: center;
  gap: var(--ui-space-5);
}

.demo__menu-button {
  display: none;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-border);
  background: transparent;
  color: var(--ui-brand-900);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.demo__menu-button:hover {
  background: var(--ui-brand-100);
  border-color: var(--ui-border-strong);
  box-shadow: var(--ui-shadow-md);
}

.demo__menu-icon {
  width: 1.4rem;
  height: 1.4rem;
}

.demo__breadcrumb {
  margin: 0;
  font-size: var(--ui-text-sm);
  color: var(--ui-text-muted);
}

.demo__heading {
  margin: 0.35rem 0 0;
  font-size: var(--ui-text-xl);
  font-weight: var(--ui-font-bold);
  color: var(--ui-text-strong);
}

.demo__content {
  padding: var(--ui-space-8);
  display: grid;
  gap: var(--ui-space-8);
}

@media (max-width: 1200px) {
  .demo {
    --sidebar-width: 0px;
    grid-template-columns: minmax(0, 1fr);
  }

  .demo__overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: var(--ui-surface-overlay);
    backdrop-filter: blur(2px);
    z-index: var(--ui-z-sidebar);
  }

  .demo__menu-button {
    display: inline-flex;
  }

  .demo__topbar {
    gap: var(--ui-space-4);
  }

  .demo__content {
    padding: var(--ui-space-6);
  }
}

@media (max-width: 768px) {
  .demo__content {
    padding: var(--ui-space-6);
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Page-specific styles */
.demo__content--condensed {
  padding: var(--ui-space-8, 2rem);
  gap: 0;
}

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
  font-size: clamp(1.5rem, 3vw, var(--ui-text-2xl, 1.5rem));
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
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-5, 1.25rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  background: var(--ui-surface, #ffffff);
  color: var(--ui-brand-900, #0b2e33);
  cursor: pointer;
  font-weight: var(--ui-font-semibold, 600);
  transition: var(--ui-transition-all);
}

.tasks-page__filter:hover {
  background: var(--ui-brand-100, #e5f6f8);
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-shadow-md);
}

.tasks-page__filter svg {
  width: 1.1rem;
  height: 1.1rem;
}

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
  box-shadow: var(--ui-shadow-lg);
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
  color: var(--ui-info, #0284c7);
}

.tasks-stats__card strong.tone-done {
  color: var(--ui-success, #16a34a);
}

.tasks-tabs {
  display: grid;
  gap: var(--ui-space-6, 1.5rem);
}

.tasks-tabs__list {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-full, 9999px);
  padding: var(--ui-space-1, 0.25rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.tasks-tabs__trigger {
  border: none;
  background: transparent;
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-5, 1.25rem);
  border-radius: var(--ui-radius-full, 9999px);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-muted, #64748b);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.tasks-tabs__trigger.is-active {
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-900, #0b2e33);
  box-shadow: var(--ui-shadow-md);
}

.tasks-tabs__content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--ui-space-4, 1rem);
}

.task-card {
  display: grid;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-lg, 1rem);
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  box-shadow: var(--ui-shadow-md);
  transition: var(--ui-transition-all);
}

.task-card.is-clickable {
  cursor: pointer;
}

.task-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--ui-shadow-lg);
  border-color: var(--ui-brand-400, #8cb8be);
}

.task-card.is-overdue {
  border-color: var(--ui-danger, #d64545);
}

.task-card.is-completed {
  opacity: 0.75;
  box-shadow: none;
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
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.task-card__badges {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
}

.task-card h3 {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.task-card p {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  line-height: var(--ui-leading-normal, 1.5);
  font-size: var(--ui-text-sm, 0.875rem);
}

/* 説明文のスタイル */
.task-card__description {
  margin: var(--ui-space-2, 0.5rem) 0 0;
  color: var(--ui-text-muted, #64748b);
  line-height: var(--ui-leading-normal, 1.5);
  font-size: var(--ui-text-sm, 0.875rem);
}

/* 期限情報を目立たせる */
.task-card__due-info {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  margin-top: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface-muted, #f1f5f9);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
}

.task-card__due-icon {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
}

.task-card__due-text {
  color: var(--ui-text, #0b2e33);
}

/* 期限切れの場合は赤く目立たせる */
.task-card__due-text.due-over {
  color: var(--ui-danger, #d64545);
}

/* 期限が近い場合は警告色 */
.task-card__due-text.due-soon {
  color: var(--ui-warning, #f59e0b);
}

/* 完了済みの場合は緑色 */
.task-card__due-info--completed {
  background: var(--ui-success-light, #dcfce7);
}

.task-card__due-info--completed .task-card__due-text {
  color: var(--ui-success, #16a34a);
}

.task-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2, 0.5rem);
}

/* ボタンスタイルは AppButton コンポーネントで管理 */

/* バッジスタイルは AppBadge コンポーネントで管理 */

.task-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-brand-400, #8cb8be);
}

.task-dot--primary {
  background: var(--ui-brand-600, #4f7c82);
}

.task-dot--secondary {
  background: var(--ui-brand-300, #b8e3e9);
}

.task-dot--accent {
  background: var(--ui-warning, #f59e0b);
}

.due-over {
  color: var(--ui-danger, #d64545);
  font-weight: var(--ui-font-semibold, 600);
}

.due-soon {
  color: var(--ui-warning, #f59e0b);
  font-weight: var(--ui-font-semibold, 600);
}

.tasks-empty {
  text-align: center;
  padding: var(--ui-space-8, 2rem) 0;
  color: var(--ui-text-muted, #64748b);
}

@media (max-width: 1200px) {
  .demo__content--condensed {
    padding: var(--ui-space-6, 1.5rem);
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

  /* タッチターゲット最適化（最小44px × 44px） */
  .task-card {
    padding: var(--ui-space-5, 1.25rem);
    min-height: 44px;
  }

  .task-card__actions {
    /* ボタンを縦並びにしてタップしやすく */
    flex-direction: column;
    width: 100%;
    gap: var(--ui-space-3, 0.75rem);
  }

  /* 期限情報を大きく見やすく */
  .task-card__due-info {
    padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
    font-size: var(--ui-text-base, 1rem);
  }

  /* 横スクロール完全排除 */
  .demo__content,
  .demo__main,
  .tasks-list {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    box-sizing: border-box;
  }
}
</style>

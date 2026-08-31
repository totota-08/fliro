<script setup lang="ts">
import DashboardSidebar from "@/components/projectDashboard/DashboardSidebar.vue";
import AppEmptyState from "@/components/ui/AppEmptyState.vue";
import { appName } from "@/constants/appMeta";
import { buildProjectNavItems } from "@/constants/projectNav";
import { ROUTE_NAMES } from "@/constants/routes";
import { db } from "@/lib/firebase";
import {
  updateTask,
  type TaskDoc,
  type TaskStatus,
} from "@/services/taskService";
import { useAuthStore } from "@/store/auth";
import type { DashboardNavItem } from "@/types/projectDashboard";
import { getLogger } from "@logtape/logtape";
import { collection, getDocs } from "firebase/firestore";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const logger = getLogger("app.pages.tasks.TaskProgress");

const { user, profile } = useAuthStore();
const router = useRouter();

const isSidebarOpen = ref(true);
const loading = ref(true);
const errorMessage = ref("");
const tasks = ref<TaskDoc[]>([]);
const projects = ref<{ id: string; name: string }[]>([]);

const PROGRESS_OPTIONS = [0, 25, 50, 75, 100] as const;
const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "未着手" },
  { value: "in-progress", label: "進行中" },
  { value: "done", label: "完了" },
];

/**
 * Sidebar 用ナビゲーション
 */
const navItems = computed<DashboardNavItem[]>(() => {
  const firstProjectId = projects.value[0]?.id;

  if (firstProjectId) {
    return buildProjectNavItems(firstProjectId);
  }

  return buildProjectNavItems("").map((item) => ({
    ...item,
    disabled: true,
    to: undefined,
    tooltip: "プロジェクトを選択してください",
  }));
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
 * プロジェクトごとにタスクをグループ化
 */
const tasksByProject = computed(() => {
  const groups: { project: { id: string; name: string }; tasks: TaskDoc[] }[] =
    [];

  for (const project of projects.value) {
    const projectTasks = tasks.value.filter(
      (task) => task.projectId === project.id && task.status !== "done",
    );
    if (projectTasks.length > 0) {
      groups.push({ project, tasks: projectTasks });
    }
  }

  return groups;
});

const activeTasks = computed(() =>
  tasks.value.filter((task) => task.status !== "done"),
);

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
 * 進捗率を更新（オプティミスティック更新）
 */
function handleProgressChange(task: TaskDoc, newProgress: number) {
  if (task.progress === newProgress) return;

  // 元の値を保存
  const previousProgress = task.progress;

  // ローカル状態を即座に更新（UIが即座に反応）
  const index = tasks.value.findIndex((t) => t.id === task.id);
  if (index !== -1 && tasks.value[index]) {
    const existing = tasks.value[index];
    tasks.value[index] = { ...existing, progress: newProgress } as TaskDoc;
  }

  // 非同期でDBに書き込み（失敗時はロールバック）
  updateTask(
    task.projectId,
    task.id,
    { progress: newProgress },
    {
      userId: user.value?.uid ?? null,
      actorName: profile.value?.nickname || profile.value?.fullName || "",
      origin: "ui",
    },
  ).catch((error) => {
    logger.error`Failed to update progress: ${error}`;
    // 失敗時は元の値に戻す
    const idx = tasks.value.findIndex((t) => t.id === task.id);
    if (idx !== -1 && tasks.value[idx]) {
      const existing = tasks.value[idx];
      tasks.value[idx] = { ...existing, progress: previousProgress } as TaskDoc;
    }
  });
}

/**
 * ステータスを更新（オプティミスティック更新）
 */
function handleStatusChange(task: TaskDoc, newStatus: TaskStatus) {
  if (task.status === newStatus) return;

  // 元の値を保存
  const previousStatus = task.status;
  const previousProgress = task.progress;

  // 完了時は進捗も100%に
  const updates: Partial<{ status: TaskStatus; progress: number }> = {
    status: newStatus,
  };
  if (newStatus === "done") {
    updates.progress = 100;
  }

  // ローカル状態を即座に更新（UIが即座に反応）
  const index = tasks.value.findIndex((t) => t.id === task.id);
  if (index !== -1 && tasks.value[index]) {
    const existing = tasks.value[index];
    tasks.value[index] = { ...existing, ...updates } as TaskDoc;
  }

  // 非同期でDBに書き込み（失敗時はロールバック）
  updateTask(task.projectId, task.id, updates, {
    userId: user.value?.uid ?? null,
    actorName: profile.value?.nickname || profile.value?.fullName || "",
    origin: "ui",
  }).catch((error) => {
    logger.error`Failed to update status: ${error}`;
    // 失敗時は元の値に戻す
    const idx = tasks.value.findIndex((t) => t.id === task.id);
    if (idx !== -1 && tasks.value[idx]) {
      const existing = tasks.value[idx];
      tasks.value[idx] = {
        ...existing,
        status: previousStatus,
        progress: previousProgress,
      } as TaskDoc;
    }
  });
}

/**
 * タスク詳細へ遷移（マイタスクでドロワーを開く）
 */
function goToTask(task: TaskDoc) {
  router.push({
    name: ROUTE_NAMES.myTasks,
    params: { projectId: task.projectId },
    query: { taskId: task.id },
  });
}

/**
 * マイタスク一覧へ遷移（最初のプロジェクトを使用）
 */
function goToMyTasks() {
  const firstProjectId = projects.value[0]?.id;
  if (firstProjectId) {
    router.push({
      name: ROUTE_NAMES.myTasks,
      params: { projectId: firstProjectId },
    });
  }
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
 * 期限表示
 */
function formatDueDate(task: TaskDoc): { label: string; class: string } {
  if (!task.dueDate?.seconds) {
    return { label: "期限未設定", class: "" };
  }

  const due = new Date(task.dueDate.seconds * 1000);
  const now = new Date();
  const diff = Math.ceil(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diff < 0) {
    return { label: `${Math.abs(diff)}日遅れ`, class: "due-over" };
  } else if (diff === 0) {
    return { label: "今日が期限", class: "due-soon" };
  } else if (diff <= 3) {
    return { label: `あと${diff}日`, class: "due-soon" };
  }
  return { label: `あと${diff}日`, class: "" };
}

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
  <div
    :class="[
      'progress-page',
      { 'progress-page--sidebar-collapsed': !isSidebarOpen },
    ]"
  >
    <DashboardSidebar
      :open="isSidebarOpen"
      :nav-items="navItems"
      :projects="sidebarProjects"
      :profile="profileInfo"
      brand-subtitle="進捗更新"
      @close="closeSidebar"
    />
    <div
      v-if="isSidebarOpen"
      class="progress-page__overlay"
      aria-hidden="true"
      @click="closeSidebar"
    />

    <div class="progress-page__main">
      <header class="progress-page__topbar">
        <div class="progress-page__topbar-left">
          <button
            type="button"
            class="progress-page__menu-button"
            @click="toggleSidebar"
          >
            <span class="sr-only">サイドバーを切り替え</span>
            <svg
              v-if="!isSidebarOpen"
              aria-hidden="true"
              class="progress-page__menu-icon"
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
              class="progress-page__menu-icon"
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
            <p class="progress-page__breadcrumb">{{ appName }} &gt; 進捗更新</p>
            <h1 class="progress-page__heading">タスク進捗を更新</h1>
          </div>
        </div>
        <button
          type="button"
          class="progress-page__nav-btn"
          @click="goToMyTasks"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <path
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <rect
              x="9"
              y="3"
              width="6"
              height="4"
              rx="1"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          マイタスク一覧
        </button>
      </header>

      <div class="progress-page__content">
        <section class="progress-page__intro">
          <p>
            自分に割り当てられたタスクの進捗率やステータスをワンクリックで更新できます。
          </p>
        </section>

        <!-- ローディング -->
        <section v-if="loading" class="progress-page__empty">
          読み込み中...
        </section>

        <!-- エラー -->
        <AppEmptyState
          v-else-if="errorMessage"
          :title="errorMessage"
          icon="error"
        />

        <!-- タスクなし -->
        <AppEmptyState
          v-else-if="activeTasks.length === 0"
          title="進行中のタスクはありません"
          description="新しいタスクが割り当てられると、ここに表示されます。"
          icon="empty"
        />

        <!-- タスクリスト -->
        <template v-else>
          <section
            v-for="group in tasksByProject"
            :key="group.project.id"
            class="progress-group"
          >
            <header class="progress-group__header">
              <h2>{{ group.project.name }}</h2>
              <span class="progress-group__count"
                >{{ group.tasks.length }}件</span
              >
            </header>

            <div class="progress-group__list">
              <article
                v-for="task in group.tasks"
                :key="task.id"
                class="progress-card"
              >
                <div class="progress-card__header">
                  <h3
                    class="progress-card__title"
                    role="button"
                    tabindex="0"
                    @click="goToTask(task)"
                    @keydown.enter.prevent="goToTask(task)"
                  >
                    {{ task.title }}
                  </h3>
                  <span
                    :class="['progress-card__due', formatDueDate(task).class]"
                  >
                    {{ formatDueDate(task).label }}
                  </span>
                </div>

                <div class="progress-card__controls">
                  <div class="progress-card__section">
                    <span class="progress-card__label">進捗率</span>
                    <div class="progress-card__pills">
                      <button
                        v-for="option in PROGRESS_OPTIONS"
                        :key="`${task.id}-progress-${option}`"
                        type="button"
                        :class="[
                          'progress-pill',
                          { 'is-active': (task.progress ?? 0) === option },
                        ]"
                        @click="handleProgressChange(task, option)"
                      >
                        {{ option }}%
                      </button>
                    </div>
                  </div>

                  <div class="progress-card__section">
                    <span class="progress-card__label">ステータス</span>
                    <div class="progress-card__pills">
                      <button
                        v-for="status in STATUS_OPTIONS"
                        :key="`${task.id}-status-${status.value}`"
                        type="button"
                        :class="[
                          'status-pill',
                          `status-pill--${status.value}`,
                          { 'is-active': task.status === status.value },
                        ]"
                        @click="handleStatusChange(task, status.value)"
                      >
                        {{ status.label }}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Layout Grid */
.progress-page {
  --sidebar-width: var(--ui-sidebar-width);
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  width: 100%;
  height: 100vh;
  gap: 0;
  background: var(--ui-surface-muted);
}

.progress-page--sidebar-collapsed {
  --sidebar-width: 0px;
}

@supports (height: 100dvh) {
  .progress-page {
    height: 100dvh;
  }
}

.progress-page__overlay {
  display: none;
}

.progress-page__main {
  display: flex;
  flex-direction: column;
  background: var(--ui-bg);
  border-left: 1px solid var(--ui-border-light);
  height: 100vh;
  overflow-y: auto;
}

@supports (height: 100dvh) {
  .progress-page__main {
    height: 100dvh;
  }
}

.progress-page__topbar {
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

.progress-page__topbar-left {
  display: flex;
  align-items: center;
  gap: var(--ui-space-5);
}

.progress-page__menu-button {
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

.progress-page__menu-button:hover {
  background: var(--ui-brand-100);
  border-color: var(--ui-border-strong);
  box-shadow: var(--ui-shadow-md);
}

.progress-page__menu-icon {
  width: 1.4rem;
  height: 1.4rem;
}

.progress-page__breadcrumb {
  margin: 0;
  font-size: var(--ui-text-sm);
  color: var(--ui-text-muted);
}

.progress-page__heading {
  margin: 0.35rem 0 0;
  font-size: var(--ui-text-xl);
  font-weight: var(--ui-font-bold);
  color: var(--ui-text-strong);
}

.progress-page__nav-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2) var(--ui-space-4);
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-border);
  background: var(--ui-surface);
  color: var(--ui-brand-900);
  cursor: pointer;
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-medium);
  transition: var(--ui-transition-all);
}

.progress-page__nav-btn:hover {
  background: var(--ui-brand-100);
  border-color: var(--ui-brand-600);
}

.progress-page__nav-btn svg {
  width: 1rem;
  height: 1rem;
}

.progress-page__content {
  padding: var(--ui-space-8);
  display: grid;
  gap: var(--ui-space-6);
}

.progress-page__intro {
  padding: var(--ui-space-4) var(--ui-space-5);
  background: var(--ui-brand-100);
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--ui-brand-200);
}

.progress-page__intro p {
  margin: 0;
  color: var(--ui-brand-800);
  font-size: var(--ui-text-sm);
}

.progress-page__empty {
  text-align: center;
  padding: var(--ui-space-8) 0;
  color: var(--ui-text-muted);
}

/* Project Group */
.progress-group {
  display: grid;
  gap: var(--ui-space-4);
}

.progress-group__header {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
}

.progress-group__header h2 {
  margin: 0;
  font-size: var(--ui-text-lg);
  font-weight: var(--ui-font-bold);
  color: var(--ui-text-strong);
}

.progress-group__count {
  padding: var(--ui-space-1) var(--ui-space-3);
  background: var(--ui-surface-muted);
  border-radius: var(--ui-radius-full);
  font-size: var(--ui-text-xs);
  color: var(--ui-text-muted);
  font-weight: var(--ui-font-medium);
}

.progress-group__list {
  display: grid;
  gap: var(--ui-space-3);
}

/* Task Card */
.progress-card {
  padding: var(--ui-space-5);
  background: var(--ui-surface);
  border: 1px solid var(--ui-border-light);
  border-radius: var(--ui-radius-xl);
  box-shadow: var(--ui-shadow-md);
  transition: var(--ui-transition-all);
}

.progress-card:hover {
  border-color: var(--ui-brand-400);
  box-shadow: var(--ui-shadow-lg);
}

.progress-card.is-updating {
  opacity: 0.7;
  pointer-events: none;
}

.progress-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-space-4);
  margin-bottom: var(--ui-space-4);
}

.progress-card__title {
  margin: 0;
  font-size: var(--ui-text-base);
  font-weight: var(--ui-font-bold);
  color: var(--ui-text-strong);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.progress-card__title:hover {
  color: var(--ui-brand-600);
  text-decoration: underline;
}

.progress-card__due {
  flex-shrink: 0;
  font-size: var(--ui-text-xs);
  color: var(--ui-text-muted);
}

.progress-card__due.due-over {
  color: var(--ui-danger);
  font-weight: var(--ui-font-semibold);
}

.progress-card__due.due-soon {
  color: var(--ui-warning);
  font-weight: var(--ui-font-semibold);
}

.progress-card__controls {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

.progress-card__section {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.progress-card__label {
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-semibold);
  color: var(--ui-text-muted);
}

.progress-card__pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}

/* Progress Pills */
.progress-pill {
  padding: var(--ui-space-2) var(--ui-space-3);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-full);
  background: var(--ui-surface);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-semibold);
  color: var(--ui-text-muted);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.progress-pill:hover:not(:disabled) {
  border-color: var(--ui-brand-500);
  color: var(--ui-brand-500);
}

.progress-pill.is-active {
  background: var(--ui-brand-500);
  border-color: var(--ui-brand-500);
  color: var(--ui-surface);
}

.progress-pill:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Status Pills */
.status-pill {
  padding: var(--ui-space-2) var(--ui-space-3);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-full);
  background: var(--ui-surface);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-semibold);
  color: var(--ui-text-muted);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.status-pill:hover:not(:disabled) {
  opacity: 0.8;
}

.status-pill:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.status-pill--todo.is-active {
  background: var(--ui-surface-muted);
  border-color: var(--ui-border);
  color: var(--ui-text);
}

.status-pill--in-progress.is-active {
  background: var(--ui-brand-100);
  border-color: var(--ui-brand-500);
  color: var(--ui-brand-700);
}

.status-pill--review.is-active {
  background: var(--ui-info-light);
  border-color: var(--ui-info);
  color: var(--ui-info);
}

.status-pill--done.is-active {
  background: var(--ui-success-light);
  border-color: var(--ui-success);
  color: var(--ui-success);
}

/* Responsive */
@media (max-width: 1200px) {
  .progress-page {
    --sidebar-width: 0px;
    grid-template-columns: minmax(0, 1fr);
  }

  .progress-page__overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: var(--ui-surface-overlay);
    backdrop-filter: blur(2px);
    z-index: var(--ui-z-sidebar);
  }

  .progress-page__menu-button {
    display: inline-flex;
  }

  .progress-page__topbar {
    gap: var(--ui-space-4);
  }

  .progress-page__content {
    padding: var(--ui-space-6);
  }
}

@media (max-width: 768px) {
  .progress-page__topbar {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-3);
    padding: var(--ui-space-4);
  }

  .progress-page__nav-btn {
    width: 100%;
    justify-content: center;
  }

  .progress-card__header {
    flex-direction: column;
    gap: var(--ui-space-2);
  }

  .progress-card__controls {
    gap: var(--ui-space-3);
  }

  .progress-card__pills {
    gap: var(--ui-space-1);
  }

  .progress-pill,
  .status-pill {
    padding: var(--ui-space-1) var(--ui-space-2);
    font-size: 0.7rem;
  }
}
</style>

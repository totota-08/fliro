<script setup lang="ts">
import TaskDrawer from "@/components/tasks/TaskDrawer.vue";
import AppEmptyState from "@/components/ui/AppEmptyState.vue";
import AppBadge from "@/components/ui/AppBadge.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppTasksSkeleton from "@/components/ui/AppTasksSkeleton.vue";
import SwipeableTaskCard from "@/components/mobile/SwipeableTaskCard.vue";
import { usePageTitle } from "@/composables/usePageTitle";
import PullToRefresh from "@/components/mobile/PullToRefresh.vue";
import { ROUTE_NAMES } from "@/constants/routes";
import { db } from "@/lib/firebase";
import { deleteTask, updateTask, type TaskDoc } from "@/services/taskService";
import { useAuthStore } from "@/store/auth";
import { useTaskDrawerRouteSync } from "@/composables/useTaskDrawerRouteSync";
import { getLogger } from "@logtape/logtape";
import { collection, getDocs } from "firebase/firestore";
import { computed, onMounted, ref, onBeforeUnmount } from "vue";
import { useRouter, useRoute } from "vue-router";

const logger = getLogger("app.pages.tasks.MyTasks");

const { user, profile } = useAuthStore();
const router = useRouter();
const route = useRoute();

// ページタイトル設定
usePageTitle("マイタスク", "あなたに割り当てられたタスク");

// ルートパラメータからプロジェクトIDを取得
const projectId = computed(() => String(route.params.projectId || ""));

// TaskDrawer のURL同期
const {
  taskId: selectedTaskId,
  openTask,
  closeTask,
} = useTaskDrawerRouteSync(router, route);

const loading = ref(true);
const errorMessage = ref("");
const activeTab = ref<"active" | "completed">("active");
const tasks = ref<TaskDoc[]>([]);
const projectName = ref("");

// フィルター関連
const showFilterPopover = ref(false);
const filterPriority = ref<"all" | "high" | "medium" | "low">("all");
const filterDueDate = ref<"all" | "overdue" | "today" | "week" | "none">("all");

// モバイル検出
const isMobile = ref(false);
const checkMobile = () => {
  isMobile.value = window.matchMedia("(max-width: 768px)").matches;
};

/**
 * Firestore からタスク読み込み（現在のプロジェクトのみ）
 */
async function loadTasks() {
  if (!user.value || !projectId.value) return;
  loading.value = true;
  errorMessage.value = "";
  try {
    // プロジェクト情報を取得
    const projectDoc = await getDocs(
      collection(db, "userProjects", user.value.uid, "projects"),
    );
    const projectData = projectDoc.docs.find((d) => d.id === projectId.value);
    projectName.value =
      (projectData?.data().projectName as string) || "プロジェクト";

    // 現在のプロジェクトのタスクのみ取得
    const taskSnap = await getDocs(
      collection(db, "projects", projectId.value, "tasks"),
    );
    const items: TaskDoc[] = [];
    taskSnap.forEach((taskDoc) => {
      const data = taskDoc.data() as TaskDoc;
      items.push({ ...data, id: taskDoc.id, projectId: projectId.value });
    });

    // 自分に割り当てられたタスクのみフィルタ
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
const getStatusBadgeVariant = (
  status: DisplayStatus,
): "success" | "primary" | "info" | "default" => {
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
const getPriorityBadgeVariant = (
  priority: DisplayPriority,
): "danger" | "warning" | "default" => {
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
  const displayProjectName: string = projectName.value || "プロジェクト";
  const projectColor: string = "task-dot--primary";

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
    projectName: displayProjectName,
    projectColor,
    dueMessage,
    dueClass,
    dueDateLabel,
    displayStatus,
    displayPriority,
  };
}

const decoratedTasks = computed(() => tasks.value.map(decorate));

/**
 * フィルター適用ロジック
 */
function applyFilters(taskList: DecoratedTask[]): DecoratedTask[] {
  return taskList.filter((task) => {
    // 優先度フィルター
    if (filterPriority.value !== "all") {
      if ((task as any).priority !== filterPriority.value) {
        return false;
      }
    }

    // 期限フィルター
    if (filterDueDate.value !== "all") {
      const due = (task as any).dueDate?.seconds
        ? new Date((task as any).dueDate.seconds * 1000)
        : null;

      switch (filterDueDate.value) {
        case "overdue":
          if (!due || getDaysDiff(due) >= 0) return false;
          break;
        case "today":
          if (!due || getDaysDiff(due) !== 0) return false;
          break;
        case "week": {
          if (!due) return false;
          const diff = getDaysDiff(due);
          if (diff < 0 || diff > 7) return false;
          break;
        }
        case "none":
          if (due) return false;
          break;
      }
    }

    return true;
  });
}

const activeTasks = computed(() =>
  applyFilters(
    decoratedTasks.value.filter((task) => (task as any).status !== "done"),
  ),
);
const completedTasks = computed(() =>
  applyFilters(
    decoratedTasks.value.filter((task) => (task as any).status === "done"),
  ),
);

const stats = computed(() => ({
  total: decoratedTasks.value.length,
  progress: decoratedTasks.value.filter(
    (task) => (task as any).status === "in-progress",
  ).length,
  done: completedTasks.value.length,
}));

// フィルターがアクティブかどうか
const hasActiveFilters = computed(
  () => filterPriority.value !== "all" || filterDueDate.value !== "all",
);

// フィルターをクリア
function clearFilters() {
  filterPriority.value = "all";
  filterDueDate.value = "all";
}

// フィルターポップオーバーを切り替え
function toggleFilterPopover() {
  showFilterPopover.value = !showFilterPopover.value;
}

// フィルターポップオーバーを閉じる
function closeFilterPopover() {
  showFilterPopover.value = false;
}

// タスクをドロワーで開く
function goToTask(task: DecoratedTask) {
  openTask(task.id);
}

// 選択中タスクのprojectIdを取得
const selectedTaskProjectId = computed(() => {
  if (!selectedTaskId.value) return "";
  const task = tasks.value.find((t) => t.id === selectedTaskId.value);
  return task?.projectId || "";
});

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
 * TaskDrawerからのオプティミスティック更新を処理
 */
function handleTaskUpdated(taskId: string, updates: Partial<TaskDoc>) {
  const index = tasks.value.findIndex((t) => t.id === taskId);
  if (index !== -1 && tasks.value[index]) {
    const existing = tasks.value[index];
    tasks.value[index] = { ...existing, ...updates } as TaskDoc;
  }
}

/**
 * プルトゥーリフレッシュハンドラ（モバイル用）
 */
async function handleRefresh() {
  await loadTasks();
}

/**
 * 初期ロード
 */
onMounted(() => {
  checkMobile();
  window.addEventListener("resize", checkMobile);
  loadTasks();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", checkMobile);
});
</script>

<template>
  <div class="my-tasks-page">
    <div class="my-tasks-page__content">
      <section class="tasks-page">
        <header class="tasks-page__header">
          <div>
            <h2>マイタスク</h2>
            <p>あなたに割り当てられたタスクの一覧です</p>
          </div>
          <div class="tasks-page__actions">
            <div class="tasks-page__filter-wrapper">
              <button
                type="button"
                class="tasks-page__filter"
                :class="{ 'is-active': hasActiveFilters }"
                @click="toggleFilterPopover"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M4 6h16M6 12h12M10 18h4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                  />
                </svg>
                フィルター
                <span v-if="hasActiveFilters" class="tasks-page__filter-badge"
                  >ON</span
                >
              </button>

              <!-- フィルターポップオーバー -->
              <div v-if="showFilterPopover" class="filter-popover">
                <div class="filter-popover__header">
                  <h4>フィルター</h4>
                  <button
                    type="button"
                    class="filter-popover__close"
                    @click="closeFilterPopover"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        d="M6 6l12 12M18 6l-12 12"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.8"
                      />
                    </svg>
                  </button>
                </div>

                <div class="filter-popover__section">
                  <label class="filter-popover__label">優先度</label>
                  <div class="filter-popover__options">
                    <button
                      type="button"
                      class="filter-popover__option"
                      :class="{ 'is-selected': filterPriority === 'all' }"
                      @click="filterPriority = 'all'"
                    >
                      すべて
                    </button>
                    <button
                      type="button"
                      class="filter-popover__option filter-popover__option--danger"
                      :class="{ 'is-selected': filterPriority === 'high' }"
                      @click="filterPriority = 'high'"
                    >
                      高
                    </button>
                    <button
                      type="button"
                      class="filter-popover__option filter-popover__option--warning"
                      :class="{ 'is-selected': filterPriority === 'medium' }"
                      @click="filterPriority = 'medium'"
                    >
                      中
                    </button>
                    <button
                      type="button"
                      class="filter-popover__option"
                      :class="{ 'is-selected': filterPriority === 'low' }"
                      @click="filterPriority = 'low'"
                    >
                      低
                    </button>
                  </div>
                </div>

                <div class="filter-popover__section">
                  <label class="filter-popover__label">期限</label>
                  <div class="filter-popover__options">
                    <button
                      type="button"
                      class="filter-popover__option"
                      :class="{ 'is-selected': filterDueDate === 'all' }"
                      @click="filterDueDate = 'all'"
                    >
                      すべて
                    </button>
                    <button
                      type="button"
                      class="filter-popover__option filter-popover__option--danger"
                      :class="{ 'is-selected': filterDueDate === 'overdue' }"
                      @click="filterDueDate = 'overdue'"
                    >
                      期限切れ
                    </button>
                    <button
                      type="button"
                      class="filter-popover__option filter-popover__option--warning"
                      :class="{ 'is-selected': filterDueDate === 'today' }"
                      @click="filterDueDate = 'today'"
                    >
                      今日
                    </button>
                    <button
                      type="button"
                      class="filter-popover__option"
                      :class="{ 'is-selected': filterDueDate === 'week' }"
                      @click="filterDueDate = 'week'"
                    >
                      1週間以内
                    </button>
                    <button
                      type="button"
                      class="filter-popover__option"
                      :class="{ 'is-selected': filterDueDate === 'none' }"
                      @click="filterDueDate = 'none'"
                    >
                      期限なし
                    </button>
                  </div>
                </div>

                <div v-if="hasActiveFilters" class="filter-popover__footer">
                  <button
                    type="button"
                    class="filter-popover__clear"
                    @click="clearFilters"
                  >
                    フィルターをクリア
                  </button>
                </div>
              </div>

              <!-- ポップオーバー背景オーバーレイ -->
              <div
                v-if="showFilterPopover"
                class="filter-popover__backdrop"
                @click="closeFilterPopover"
              />
            </div>
          </div>
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

          <!-- モバイル: PullToRefreshでラップ -->
          <PullToRefresh
            v-if="isMobile"
            class="tasks-tabs__content"
            role="tabpanel"
            @refresh="handleRefresh"
          >
            <!-- 状態メッセージ -->
            <AppTasksSkeleton v-if="loading" :count="5" />
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
                  v-if="projectId"
                  variant="primary"
                  :to="{
                    name: ROUTE_NAMES.projectDashboard,
                    params: { projectId: projectId },
                  }"
                >
                  ダッシュボードを開く
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
              <!-- 進行中タブ（モバイル: SwipeableTaskCard） -->
              <template v-if="activeTab === 'active'">
                <SwipeableTaskCard
                  v-for="task in activeTasks"
                  :key="task.id"
                  :task="task"
                  @complete="toggleComplete(task)"
                  @delete="removeTask(task)"
                  @click="goToTask(task)"
                />
              </template>

              <!-- 完了タブ（モバイル: SwipeableTaskCard） -->
              <template v-else>
                <SwipeableTaskCard
                  v-for="task in completedTasks"
                  :key="task.id"
                  :task="task"
                  @complete="toggleComplete(task)"
                  @delete="removeTask(task)"
                  @click="goToTask(task)"
                />
              </template>
            </template>
          </PullToRefresh>

          <!-- デスクトップ: 通常表示 -->
          <div v-else class="tasks-tabs__content" role="tabpanel">
            <!-- 状態メッセージ -->
            <AppTasksSkeleton v-if="loading" :count="5" />
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
                  v-if="projectId"
                  variant="primary"
                  :to="{
                    name: ROUTE_NAMES.projectDashboard,
                    params: { projectId: projectId },
                  }"
                >
                  ダッシュボードを開く
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
              <!-- 進行中タブ（デスクトップ: 従来のカード） -->
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
                      <AppBadge
                        :variant="getStatusBadgeVariant(task.displayStatus)"
                        size="sm"
                      >
                        {{ task.displayStatus }}
                      </AppBadge>
                      <AppBadge
                        :variant="getPriorityBadgeVariant(task.displayPriority)"
                        size="sm"
                      >
                        {{ task.displayPriority }}
                      </AppBadge>
                    </div>
                  </div>

                  <h3>{{ task.title }}</h3>

                  <!-- 説明は最初の50文字のみ表示 -->
                  <p v-if="task.description" class="task-card__description">
                    {{
                      task.description.length > 50
                        ? task.description.slice(0, 50) + "..."
                        : task.description
                    }}
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
                    <AppBadge
                      :variant="getStatusBadgeVariant(task.displayStatus)"
                      size="sm"
                    >
                      {{ task.displayStatus }}
                    </AppBadge>
                  </div>
                  <h3>{{ task.title }}</h3>

                  <!-- 説明は最初の50文字のみ表示 -->
                  <p v-if="task.description" class="task-card__description">
                    {{
                      task.description.length > 50
                        ? task.description.slice(0, 50) + "..."
                        : task.description
                    }}
                  </p>

                  <!-- 完了済みの表示 -->
                  <div
                    class="task-card__due-info task-card__due-info--completed"
                  >
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

    <!-- タスクドロワー -->
    <Teleport to="body">
      <TaskDrawer
        :project-id="selectedTaskProjectId"
        :task-id="selectedTaskId"
        :tasks="tasks"
        @close="closeTask"
        @task-updated="handleTaskUpdated"
      />
    </Teleport>
  </div>
</template>

<style scoped>
/* Page Layout */
.my-tasks-page {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6, 1.5rem);
  padding: var(--ui-space-6, 1.5rem);
}

.my-tasks-page__content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6, 1.5rem);
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

.tasks-page__actions {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
  flex-wrap: wrap;
}

.tasks-page__action-btn {
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
  font-size: var(--ui-text-sm, 0.875rem);
  transition: var(--ui-transition-all);
}

.tasks-page__action-btn:hover {
  background: var(--ui-brand-100, #e5f6f8);
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-shadow-md);
}

.tasks-page__action-btn--primary {
  background: var(--ui-brand-600, #4f7c82);
  border-color: var(--ui-brand-600, #4f7c82);
  color: var(--ui-surface, #ffffff);
}

.tasks-page__action-btn--primary:hover {
  background: var(--ui-brand-700, #3d6166);
  border-color: var(--ui-brand-700, #3d6166);
}

.tasks-page__action-btn svg {
  width: 1.1rem;
  height: 1.1rem;
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
  font-size: var(--ui-text-sm, 0.875rem);
  transition: var(--ui-transition-all);
  min-height: var(--ui-touch-target-min, 44px);
}

.tasks-page__filter:hover {
  background: var(--ui-brand-100, #e5f6f8);
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-shadow-md);
}

.tasks-page__filter:active {
  background: var(--ui-brand-200, #cceef2);
  border-color: var(--ui-brand-700, #3d6166);
  transform: scale(0.98);
}

.tasks-page__filter svg {
  width: 1.1rem;
  height: 1.1rem;
}

.tasks-page__filter.is-active {
  background: var(--ui-brand-100, #e5f6f8);
  border-color: var(--ui-brand-600, #4f7c82);
}

.tasks-page__filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.125rem 0.375rem;
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-bold, 700);
  background: var(--ui-brand-600, #4f7c82);
  color: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-full, 9999px);
  margin-left: var(--ui-space-1, 0.25rem);
}

.tasks-page__filter-wrapper {
  position: relative;
}

/* フィルターポップオーバー */
.filter-popover {
  position: absolute;
  top: calc(100% + var(--ui-space-2, 0.5rem));
  right: 0;
  z-index: var(--ui-z-dropdown, 100);
  min-width: 280px;
  padding: var(--ui-space-4, 1rem);
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  box-shadow: var(--ui-shadow-xl);
}

.filter-popover__backdrop {
  position: fixed;
  inset: 0;
  z-index: calc(var(--ui-z-dropdown, 100) - 1);
  background: transparent;
}

.filter-popover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--ui-space-4, 1rem);
  padding-bottom: var(--ui-space-3, 0.75rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.filter-popover__header h4 {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.filter-popover__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--ui-touch-target-min, 44px);
  height: var(--ui-touch-target-min, 44px);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--ui-text-muted, #64748b);
  border-radius: var(--ui-radius-md, 0.75rem);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.filter-popover__close:hover {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text-strong, #0f172a);
}

.filter-popover__close svg {
  width: 1rem;
  height: 1rem;
}

.filter-popover__section {
  margin-bottom: var(--ui-space-4, 1rem);
}

.filter-popover__section:last-of-type {
  margin-bottom: 0;
}

.filter-popover__label {
  display: block;
  margin-bottom: var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-muted, #64748b);
}

.filter-popover__options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2, 0.5rem);
}

.filter-popover__option {
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text, #0b2e33);
  background: var(--ui-surface-muted, #f1f5f9);
  border: 1px solid transparent;
  border-radius: var(--ui-radius-md, 0.75rem);
  cursor: pointer;
  transition: var(--ui-transition-all);
  min-height: var(--ui-touch-target-min, 44px);
}

.filter-popover__option:hover {
  background: var(--ui-brand-100, #e5f6f8);
  border-color: var(--ui-brand-300, #b8e3e9);
}

.filter-popover__option.is-selected {
  background: var(--ui-brand-600, #4f7c82);
  color: var(--ui-surface, #ffffff);
  border-color: var(--ui-brand-600, #4f7c82);
}

.filter-popover__option--danger.is-selected {
  background: var(--ui-danger, #d64545);
  border-color: var(--ui-danger, #d64545);
}

.filter-popover__option--warning.is-selected {
  background: var(--ui-warning, #f59e0b);
  border-color: var(--ui-warning, #f59e0b);
}

.filter-popover__footer {
  margin-top: var(--ui-space-4, 1rem);
  padding-top: var(--ui-space-3, 0.75rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.filter-popover__clear {
  width: 100%;
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-muted, #64748b);
  background: transparent;
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.filter-popover__clear:hover {
  background: var(--ui-surface-muted, #f1f5f9);
  border-color: var(--ui-border-strong, rgba(11, 46, 51, 0.2));
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
  min-height: var(--ui-touch-target-min, 44px);
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
  .my-tasks-page,
  .my-tasks-page__content,
  .tasks-list {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    box-sizing: border-box;
  }
}
</style>

<script setup lang="ts">
import DashboardInsights from "@/components/projectDashboard/DashboardInsights.vue";
import DashboardSummaryCards, {
  type SummaryCard,
} from "@/components/projectDashboard/DashboardSummaryCards.vue";
import DashboardTaskList from "@/components/projectDashboard/DashboardTaskList.vue";
import NotificationBar from "@/components/projectDashboard/NotificationBar.vue";
import ProjectSidebar from "@/components/projectDashboard/ProjectSidebar.vue";
import { useNotificationCenter } from "@/composables/useNotificationCenter";
import { useUserDisplay } from "@/composables/useUserDisplay";
import { appName, appVersion } from "@/constants/appMeta";
import { ROUTE_NAMES } from "@/constants/routes";
import { db } from "@/lib/firebase";
import { listenProjectChat, type ChatMessage } from "@/services/projectChat";
import type { ProjectMember } from "@/services/projectMembers";
import {
  listenTaskCategories,
  type TaskCategory,
} from "@/services/taskCategoryService";
import {
  createTask,
  listenTasks,
  type TaskDoc,
  type TaskStatus,
} from "@/services/taskService";
import { useAuthStore } from "@/store/auth";
import type { ProjectDoc } from "@/types/project";
import { getLogger } from "@logtape/logtape";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";

const logger = getLogger("app.pages.projects.ProjectDashboard");

const route = useRoute();
const router = useRouter();
const { user, profile } = useAuthStore();
const projectId = ref(String(route.params.projectId || ""));

type MemberEntry = ProjectMember & {
  id: string;
  name: string;
  lastAccessedAt?: { seconds: number; nanoseconds: number };
};

type DashboardNotification = {
  id: string;
  message: string;
  dismissible: boolean;
};

const project = ref<ProjectDoc | null>(null);
const members = ref<MemberEntry[]>([]);
const { getDisplayName } = useUserDisplay(members);
const tasks = ref<TaskDoc[]>([]);
const categories = ref<TaskCategory[]>([]);
const { notifications: notificationsBar } = useNotificationCenter();
const selectedTask = ref<TaskDoc | null>(null);
const chatMessages = ref<ChatMessage[]>([]);
const chatLoading = ref(true);
const notifications = ref<DashboardNotification[]>([]);
const dismissedNotificationIds = ref<Set<string>>(new Set());
const isSidebarOpen = ref(true);
const isTaskModalOpen = ref(false);
const isDescriptionExpanded = ref(false);
const insightsCollapsed = ref(false);

const PROGRESS_OPTIONS = [0, 25, 50, 75, 100] as const;

const taskForm = reactive({
  title: "",
  description: "",
  dueDate: "",
  assigneeId: "",
  categoryId: "",
  progress: 0,
});

let stopTasks: (() => void) | null = null;
let stopProject: (() => void) | null = null;
let stopMembers: (() => void) | null = null;
let stopChat: (() => void) | null = null;
let stopCategories: (() => void) | null = null;

// サマリーカード
const summaryCards = computed<SummaryCard[]>(() => {
  const total = tasks.value.length;
  const done = tasks.value.filter((task) => task.status === "done").length;
  const inProgress = tasks.value.filter(
    (task) => task.status === "in-progress",
  ).length;
  const overdue = tasks.value.filter((task) => isTaskOverdue(task)).length;

  return [
    {
      id: "done",
      label: "完了タスク",
      value: String(done),
      caption: `全${total}件中${done}件が完了`,
      icon: "check",
    },
    {
      id: "active",
      label: "進行中",
      value: String(inProgress),
      caption: "現在作業中のタスク数",
      icon: "activity",
    },
    {
      id: "overdue",
      label: "期限切れ",
      value: String(overdue),
      caption: "期限を超過したタスク",
      tone: overdue > 0 ? "alert" : "neutral",
      icon: "alert",
    },
  ];
});

// ヘルパー関数
function isTaskOverdue(task: TaskDoc) {
  if (!task.dueDate?.seconds) return false;
  const due = task.dueDate.seconds * 1000;
  return due < Date.now() && task.status !== "done";
}

function normalizeProgress(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  const clamped = Math.min(100, Math.max(0, value));
  return Math.round(clamped / 25) * 25;
}

function formatStatus(status: TaskStatus) {
  const map: Record<TaskStatus, string> = {
    todo: "未着手",
    "in-progress": "進行中",
    review: "レビュー",
    done: "完了",
  };
  return map[status] || status;
}

// 通知評価
function evaluateNotifications() {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const userAssignments = tasks.value.filter(
    (task) => task.assigneeId === user.value?.uid,
  );
  const dueSoon = tasks.value.filter(
    (task) =>
      task.dueDate?.seconds &&
      task.dueDate.seconds * 1000 - now <= oneDay &&
      task.dueDate.seconds * 1000 > now,
  );
  const overdueCount = tasks.value.filter((task) => isTaskOverdue(task)).length;

  const alerts: DashboardNotification[] = [];
  if (
    userAssignments.length &&
    !dismissedNotificationIds.value.has("assigned")
  ) {
    alerts.push({
      id: "assigned",
      message: `あなたに割り当てられたタスクが ${userAssignments.length} 件あります`,
      dismissible: true,
    });
  }
  if (dueSoon.length && !dismissedNotificationIds.value.has("due-soon")) {
    alerts.push({
      id: "due-soon",
      message: `期限が迫っているタスク: ${dueSoon.length} 件`,
      dismissible: true,
    });
  }
  if (overdueCount) {
    alerts.push({
      id: "overdue",
      message: `期限切れのタスクが ${overdueCount} 件あります`,
      dismissible: false,
    });
  }
  notifications.value = alerts;
}

function dismissNotification(id: string) {
  const note = notifications.value.find((entry) => entry.id === id);
  if (!note || !note.dismissible) return;
  const next = new Set(dismissedNotificationIds.value);
  next.add(id);
  dismissedNotificationIds.value = next;
  notifications.value = notifications.value.filter((entry) => entry.id !== id);
}

// データ監視
function watchProject() {
  stopProject = onSnapshot(doc(db, "projects", projectId.value), (snapshot) => {
    if (!snapshot.exists()) return;
    project.value = snapshot.data() as ProjectDoc;
  });
  stopMembers = onSnapshot(
    collection(db, "projects", projectId.value, "members"),
    async (snapshot) => {
      const promises = snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const memberId = data.userId || docSnap.id;
        let name = data.nickname || data.fullName;

        if (!name) {
          try {
            const profileSnap = await getDoc(doc(db, "profiles", memberId));
            if (profileSnap.exists()) {
              const profileData = profileSnap.data();
              name = profileData.nickname || profileData.fullName;
            }
          } catch (e) {
            logger.error`Failed to fetch profile for ${memberId}: ${e}`;
          }
        }

        return {
          id: memberId,
          name: name || docSnap.id,
          userId: memberId,
          role: (data.role as ProjectMember["role"]) || "member",
          projectRole:
            (data.projectRole as ProjectMember["projectRole"]) || "member",
          nickname: data.nickname,
          fullName: data.fullName,
          displayName: data.nickname || data.fullName || name || docSnap.id,
          email: data.email,
          lastAccessedAt: data.lastAccessedAt,
        };
      });

      members.value = await Promise.all(promises);
    },
  );
}

function watchTasks() {
  stopTasks = listenTasks(projectId.value, (list) => {
    tasks.value = list;
    evaluateNotifications();
  });
}

function watchCategories() {
  stopCategories = listenTaskCategories(projectId.value, (list) => {
    categories.value = list;
  });
}

function watchChat() {
  chatLoading.value = true;
  stopChat = listenProjectChat(
    projectId.value,
    (messages) => {
      chatMessages.value = messages;
      chatLoading.value = false;
    },
    (error) => {
      logger.error`Failed to load chat: ${error}`;
      chatLoading.value = false;
    },
  );
}

function resetWatchers() {
  stopTasks?.();
  stopProject?.();
  stopMembers?.();
  stopChat?.();
  stopCategories?.();
  watchProject();
  watchTasks();
  watchCategories();
  watchChat();
}

// タスクモーダル
function resetTaskForm() {
  taskForm.title = "";
  taskForm.description = "";
  taskForm.dueDate = "";
  taskForm.assigneeId = "";
  taskForm.categoryId = "";
  taskForm.progress = 0;
}

function closeTaskModal() {
  isTaskModalOpen.value = false;
  resetTaskForm();
}

function getMemberNameById(id?: string | null) {
  if (!id) return "";
  const member = members.value.find((entry) => entry.id === id);
  return member?.name || getDisplayName(id) || "";
}

async function submitTaskForm() {
  if (!user.value || !taskForm.title.trim()) return;
  const assigneeId = taskForm.assigneeId || null;
  const normalizedProgress = normalizeProgress(taskForm.progress);

  let initialStatus: TaskStatus = "todo";
  if (normalizedProgress === 100) initialStatus = "done";
  else if (normalizedProgress > 0) initialStatus = "in-progress";

  await createTask(
    projectId.value,
    {
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      dueDate: taskForm.dueDate ? new Date(taskForm.dueDate) : null,
      categoryId: taskForm.categoryId || null,
      assigneeId,
      assigneeName: assigneeId ? getMemberNameById(assigneeId) : null,
      progress: normalizedProgress,
      status: initialStatus,
    },
    user.value.uid,
    {
      origin: "ui",
      actorId: user.value.uid,
      actorName:
        profile.value?.nickname || profile.value?.fullName || user.value.uid,
    },
  );
  closeTaskModal();
}

// タスク選択・ナビゲーション
function selectTaskById(taskId: string) {
  const match = tasks.value.find((task) => task.id === taskId);
  if (match) selectedTask.value = match;
}

function navigateToTaskDetail(taskId: string) {
  if (!projectId.value) return;
  router.push({
    name: ROUTE_NAMES.projectTaskDetail,
    params: { projectId: projectId.value, taskId },
  });
}

// サイドバー
function closeSidebar() {
  isSidebarOpen.value = false;
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value;
}

onMounted(() => {
  if (window.matchMedia("(max-width: 1200px)").matches) {
    isSidebarOpen.value = false;
  }
  resetWatchers();
});

watch(
  () => route.params.projectId,
  (newId) => {
    if (!newId) return;
    projectId.value = String(newId);
    resetWatchers();
  },
);

onBeforeUnmount(() => {
  stopTasks?.();
  stopProject?.();
  stopMembers?.();
  stopChat?.();
  stopCategories?.();
});
</script>

<template>
  <div :class="['demo', { 'demo--sidebar-collapsed': !isSidebarOpen }]">
    <ProjectSidebar
      :open="isSidebarOpen"
      :project-id="projectId"
      brand-subtitle="プロジェクト"
      @close="closeSidebar"
    />
    <div v-if="isSidebarOpen" class="demo__overlay" @click="closeSidebar" />

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
          </button>
          <div>
            <p class="demo__breadcrumb">{{ appName }} &gt; ダッシュボード</p>
            <h1 class="demo__heading">{{ project?.name || "プロジェクト" }}</h1>
          </div>
        </div>
        <div class="demo__toolbar">
          <span class="demo__version" v-if="appVersion">{{ appVersion }}</span>
        </div>
      </header>

      <div class="demo__content">
        <!-- Alerts -->
        <section v-if="notifications.length" class="dashboard__alerts">
          <div
            v-for="note in notifications"
            :key="note.id"
            class="dashboard__alert"
          >
            <p>{{ note.message }}</p>
            <button
              v-if="note.dismissible"
              type="button"
              class="dashboard__alert-close"
              aria-label="通知を閉じる"
              @click.stop="dismissNotification(note.id)"
            >
              &times;
            </button>
          </div>
        </section>
        <NotificationBar :notifications="notificationsBar" />

        <!-- Summary Cards -->
        <DashboardSummaryCards
          :title="project?.name || 'ダッシュボード'"
          :description="''"
          :cards="summaryCards"
          :rotate="false"
          :show-header="false"
        />

        <!-- Insights (折りたたみ可能) -->
        <DashboardInsights
          :tasks="tasks"
          v-model:collapsed="insightsCollapsed"
        />

        <!-- Task List -->
        <DashboardTaskList
          :tasks="tasks"
          :members="members"
          :categories="categories"
          :current-user-id="user?.uid"
          :project-id="projectId"
          @select-task="selectTaskById"
          @navigate-task="navigateToTaskDetail"
        />
      </div>
    </div>

    <!-- タスク作成モーダル -->
    <div v-if="isTaskModalOpen" class="task-modal">
      <div class="task-modal__card">
        <header>
          <h3>新規タスク</h3>
          <button type="button" @click="closeTaskModal">&times;</button>
        </header>
        <form class="task-modal__form" @submit.prevent="submitTaskForm">
          <label>
            タイトル
            <input
              v-model="taskForm.title"
              type="text"
              placeholder="例）デザインレビュー"
              required
            />
          </label>
          <label>
            説明
            <textarea
              v-model="taskForm.description"
              rows="3"
              placeholder="タスクの詳細を入力"
            ></textarea>
          </label>
          <label>
            期限
            <input v-model="taskForm.dueDate" type="date" />
          </label>
          <label>
            カテゴリ
            <select v-model="taskForm.categoryId">
              <option value="">カテゴリなし</option>
              <option
                v-for="category in categories"
                :key="category.id"
                :value="category.id"
              >
                {{ category.name }}
              </option>
            </select>
          </label>
          <label>
            担当者
            <select v-model="taskForm.assigneeId">
              <option value="">未割当</option>
              <option
                v-for="member in members"
                :key="member.id"
                :value="member.id"
              >
                {{ member.name }}
              </option>
            </select>
          </label>
          <section class="task-modal__section">
            <div class="task-modal__range-header">
              <p class="label">進捗率</p>
              <span class="hint">{{ taskForm.progress }}%</span>
            </div>
            <div class="progress-picker">
              <button
                v-for="option in PROGRESS_OPTIONS"
                :key="`modal-progress-${option}`"
                type="button"
                :class="[
                  'progress-pill',
                  { 'is-active': taskForm.progress === option },
                ]"
                @click="taskForm.progress = option"
              >
                {{ option }}%
              </button>
            </div>
          </section>

          <footer>
            <button type="button" class="ghost" @click="closeTaskModal">
              キャンセル
            </button>
            <button type="submit">作成</button>
          </footer>
        </form>
      </div>
    </div>

    <!-- タスクドロワー -->
    <transition name="task-drawer">
      <div v-if="selectedTask" class="task-drawer">
        <div class="task-drawer__overlay" @click="selectedTask = null" />
        <aside class="task-drawer__panel">
          <header class="task-drawer__header">
            <div>
              <p class="task-drawer__eyebrow">タスク概要</p>
              <h3>
                <router-link
                  :to="{
                    name: ROUTE_NAMES.projectTaskDetail,
                    params: { projectId: projectId, taskId: selectedTask.id },
                    query: { from: 'dashboard' },
                  }"
                  class="task-drawer__title-link"
                >
                  {{ selectedTask.title }}
                </router-link>
              </h3>
              <p class="task-drawer__helper">
                詳細は別ページで確認・議論できます
              </p>
            </div>
            <button
              type="button"
              class="drawer-close"
              @click="selectedTask = null"
            >
              &times;
            </button>
          </header>

          <div class="drawer-content">
            <section class="task-drawer__section">
              <p class="label">ステータス</p>
              <div class="readonly-value">
                <span :class="['status-badge', selectedTask.status]">
                  {{ formatStatus(selectedTask.status) }}
                </span>
                <span class="muted" style="margin-left: 8px">
                  {{ selectedTask.progress || 0 }}%
                </span>
              </div>
            </section>

            <section class="task-drawer__section">
              <p class="label">担当者</p>
              <div class="readonly-value">
                {{ selectedTask.assigneeName || "未割当" }}
              </div>
            </section>

            <section class="task-drawer__section">
              <p class="label">期限</p>
              <div class="readonly-value">
                {{
                  selectedTask.dueDate
                    ? new Date(
                        selectedTask.dueDate.seconds * 1000,
                      ).toLocaleDateString()
                    : "未設定"
                }}
              </div>
            </section>

            <section class="task-drawer__section">
              <p class="label">説明</p>
              <div
                class="description-preview"
                :class="{ 'is-expanded': isDescriptionExpanded }"
              >
                {{ selectedTask.description || "説明はありません" }}
              </div>
              <button
                v-if="
                  (selectedTask.description || '').split('\n').length > 5 ||
                  (selectedTask.description || '').length > 200
                "
                type="button"
                class="description-toggle"
                @click="isDescriptionExpanded = !isDescriptionExpanded"
              >
                {{ isDescriptionExpanded ? "閉じる" : "もっと見る" }}
              </button>
            </section>
          </div>

          <footer class="task-drawer__sticky-footer">
            <router-link
              :to="{
                name: ROUTE_NAMES.projectTaskDetail,
                params: { projectId: projectId, taskId: selectedTask.id },
                query: { from: 'dashboard' },
              }"
              class="cta-button"
            >
              詳細ページを開く
            </router-link>
          </footer>
        </aside>
      </div>
    </transition>
  </div>
</template>

<style scoped>
@import "@/pages/demo/styles/demo-shell.css";

.demo__version {
  padding: 0.35rem 0.65rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(11, 46, 51, 0.12);
  background: rgba(11, 46, 51, 0.05);
  font-weight: 700;
  font-size: 0.95rem;
  color: #0b2e33;
}

.demo__content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.muted {
  color: var(--text-muted, #4f7c82);
}

/* Alerts */
.dashboard__alerts {
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
  border-radius: 1rem;
  padding: 0.4rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.dashboard__alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.45rem 0.35rem 0.45rem 0.5rem;
}

.dashboard__alert p {
  margin: 0;
  color: #92400e;
  font-weight: 600;
}

.dashboard__alert-close {
  border: none;
  background: transparent;
  color: #b45309;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0.25rem 0.35rem;
  line-height: 1;
  border-radius: 0.5rem;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.dashboard__alert-close:hover {
  background: rgba(244, 172, 67, 0.25);
  color: #92400e;
}

/* Task Modal */
.task-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 60;
}

.task-modal__card {
  width: min(520px, 100%);
  background: #fff;
  border-radius: 1.25rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: 0 24px 48px rgba(11, 46, 51, 0.2);
}

.task-modal__card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.task-modal__card header h3 {
  margin: 0;
}

.task-modal__card header button {
  border: none;
  background: transparent;
  font-size: 1.25rem;
  cursor: pointer;
}

.task-modal__form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.task-modal__form label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-weight: 500;
  color: var(--text-strong, #0b2e33);
}

.task-modal__form input,
.task-modal__form textarea,
.task-modal__form select {
  width: 100%;
  border-radius: 0.8rem;
  border: 1px solid #d1dae8;
  padding: 0.65rem 0.85rem;
}

.task-modal__form footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.task-modal__form footer button {
  border: none;
  border-radius: 0.8rem;
  padding: 0.6rem 1.2rem;
  cursor: pointer;
  font-weight: 600;
}

.task-modal__form footer .ghost {
  background: rgba(11, 46, 51, 0.08);
  color: #0b2e33;
}

.task-modal__form footer button:last-child {
  background: #0b2e33;
  color: #fff;
}

.task-modal__section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.task-modal__range-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-modal__range-header .label {
  margin: 0;
  font-weight: 500;
}

.task-modal__range-header .hint {
  font-size: 0.8rem;
  color: var(--text-muted, #4f7c82);
}

.progress-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.4rem;
}

.progress-pill {
  border: 1px solid rgba(11, 46, 51, 0.2);
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
  background: transparent;
  cursor: pointer;
  font-size: 0.8rem;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

.progress-pill.is-active {
  background: #4f7c82;
  color: #fff;
  border-color: #4f7c82;
}

/* Task Drawer */
.task-drawer-enter-active,
.task-drawer-leave-active {
  transition: opacity 0.2s ease;
}

.task-drawer-enter-from,
.task-drawer-leave-to {
  opacity: 0;
}

.task-drawer-enter-from .task-drawer__panel,
.task-drawer-leave-to .task-drawer__panel {
  transform: translateX(20%);
  opacity: 0;
}

.task-drawer {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  z-index: 80;
}

.task-drawer__overlay {
  flex: 1;
  background: rgba(0, 0, 0, 0.35);
}

.task-drawer__panel {
  width: clamp(280px, 85vw, 420px);
  background: #f5fcff;
  border-left: 1px solid rgba(11, 46, 51, 0.08);
  box-shadow: -4px 0 15px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  transform: translateX(0);
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
}

.task-drawer__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.task-drawer__eyebrow {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  color: var(--text-muted, #4f7c82);
  text-transform: uppercase;
}

.task-drawer__header h3 {
  margin: 0.2rem 0 0;
}

.task-drawer__title-link {
  text-decoration: none;
  color: inherit;
}

.task-drawer__title-link:hover {
  color: #0d9488;
  text-decoration: underline;
}

.task-drawer__helper {
  font-size: 11px;
  color: #64748b;
  margin: 4px 0 0 0;
}

.drawer-close {
  border: 1px solid rgba(11, 46, 51, 0.12);
  background: #fff;
  border-radius: 12px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  font-weight: 900;
  color: #0b2e33;
  display: grid;
  place-items: center;
  font-size: 20px;
}

.drawer-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  overflow-y: auto;
  min-height: 0;
}

.task-drawer__section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.task-drawer__section .label {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted, #4f7c82);
}

.readonly-value {
  padding: 8px 0;
  color: #334155;
  font-size: 15px;
  display: flex;
  align-items: center;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.status-badge.todo {
  background: rgba(11, 46, 51, 0.08);
  color: var(--text-strong, #0b2e33);
}

.status-badge.in-progress {
  background: rgba(79, 124, 130, 0.2);
  color: #0b2e33;
}

.status-badge.review {
  background: rgba(255, 202, 99, 0.25);
  color: #915a00;
}

.status-badge.done {
  background: rgba(34, 197, 94, 0.25);
  color: #166534;
}

.description-preview {
  white-space: pre-wrap;
  color: #475569;
  font-size: 14px;
  line-height: 1.5;
  max-height: 100px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.6);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(11, 46, 51, 0.08);
  transition: max-height 0.3s ease;
}

.description-preview.is-expanded {
  max-height: 500px;
  overflow-y: auto;
}

.description-toggle {
  background: none;
  border: none;
  color: #0d9488;
  font-size: 12px;
  cursor: pointer;
  padding: 4px 0;
  margin-top: 4px;
  font-weight: 600;
}

.description-toggle:hover {
  text-decoration: underline;
}

.task-drawer__sticky-footer {
  margin-top: auto;
  padding: 16px 0;
  border-top: 1px solid rgba(11, 46, 51, 0.08);
  display: flex;
  justify-content: center;
}

.cta-button {
  display: flex;
  width: 100%;
  justify-content: center;
  align-items: center;
  padding: 10px 16px;
  border: 1px solid #0d9488;
  border-radius: 8px;
  color: #0d9488;
  font-weight: 600;
  text-decoration: none;
  font-size: 14px;
  background: white;
  transition: all 0.2s;
}

.cta-button:hover {
  background: #f0fdfa;
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

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .task-drawer-enter-active,
  .task-drawer-leave-active,
  .task-drawer__panel,
  .description-preview {
    transition: none;
  }
}
</style>

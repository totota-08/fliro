<script setup lang="ts">
import DashboardInsights from "@/components/projectDashboard/DashboardInsights.vue";
import DashboardSummaryCards, {
  type SummaryCard,
} from "@/components/projectDashboard/DashboardSummaryCards.vue";
import DashboardTaskList from "@/components/projectDashboard/DashboardTaskList.vue";
import NotificationBar from "@/components/projectDashboard/NotificationBar.vue";
import ProjectSidebar from "@/components/projectDashboard/ProjectSidebar.vue";
import TaskCreateModal, {
  type TaskFormData,
} from "@/components/tasks/TaskCreateModal.vue";
import TaskPreviewDrawer from "@/components/tasks/TaskPreviewDrawer.vue";
import { useNotificationCenter } from "@/composables/useNotificationCenter";
import { useUserDisplay } from "@/composables/useUserDisplay";
import { appName, appVersion } from "@/constants/appMeta";
import { ROUTE_NAMES } from "@/constants/routes";
import { db } from "@/lib/firebase";
import {
  // addMessageReaction,
  // deleteProjectMessage,
  listenProjectChat,
  // sendProjectMessage,
  // updateProjectMessage,
  type ChatMessage,
} from "@/services/projectChat";
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
const taskView = ref<"all" | "mine">("all");
const selectedTask = ref<TaskDoc | null>(null);
const chatMessages = ref<ChatMessage[]>([]);
const chatLoading = ref(true);
const notifications = ref<DashboardNotification[]>([]);
const dismissedNotificationIds = ref<Set<string>>(new Set());
const filters = reactive({
  search: "",
  status: "all",
  assignee: "all",
  due: "all",
  category: "all",
});
const showMyTasksOnly = ref(false);
const isSidebarOpen = ref(true);
const isTaskModalOpen = ref(false);
const insightsCollapsed = ref(true); // デフォルトで折りたたむ（Now First設計）

let stopTasks: (() => void) | null = null;
let stopProject: (() => void) | null = null;
let stopMembers: (() => void) | null = null;
let stopChat: (() => void) | null = null;
let stopCategories: (() => void) | null = null;

const filteredTasks = computed(() => {
  let list = [...tasks.value];
  if (filters.search.trim()) {
    const keyword = filters.search.trim().toLowerCase();
    list = list.filter((task) => task.title.toLowerCase().includes(keyword));
  }
  if (filters.status !== "all") {
    list = list.filter((task) => task.status === filters.status);
  }
  if (filters.assignee !== "all") {
    list = list.filter((task) => (task.assigneeId || "") === filters.assignee);
  }
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
  if (filters.category !== "all") {
    list = list.filter(
      (task) => (task.categoryId || "none") === filters.category,
    );
  }
  if (taskView.value === "mine" && user.value) {
    list = list.filter((task) => task.assigneeId === user.value?.uid);
  }
  return list;
});

// "Now First" 設計: アクション指向のサマリーカード
const summaryCards = computed<SummaryCard[]>(() => {
  const total = tasks.value.length;
  const done = tasks.value.filter((task) => task.status === "done").length;

  // 期限切れタスク
  const overdue = tasks.value.filter((task) => isTaskOverdue(task)).length;

  // 直近3日以内に期限が来るタスク
  const now = Date.now();
  const soonThreshold = 3 * 24 * 60 * 60 * 1000;
  const dueSoon = tasks.value.filter((task) => {
    if (!task.dueDate?.seconds || task.status === "done") return false;
    const dueTime = task.dueDate.seconds * 1000;
    return dueTime > now && dueTime - now <= soonThreshold;
  }).length;

  // 進行中タスク
  const inProgress = tasks.value.filter(
    (task) => task.status === "in-progress",
  ).length;

  const cards: SummaryCard[] = [];

  // 期限切れがある場合は最優先で表示
  if (overdue > 0) {
    cards.push({
      id: "overdue",
      label: "期限切れ",
      value: String(overdue),
      caption: "すぐに対応が必要",
      tone: "alert",
      icon: "alert",
    });
  }

  // 直近期限タスク
  cards.push({
    id: "due-soon",
    label: "直近の期限",
    value: String(dueSoon),
    caption: "3日以内に期限",
    tone: dueSoon > 0 ? "alert" : "neutral",
    icon: "activity",
  });

  // 進行中
  cards.push({
    id: "active",
    label: "進行中",
    value: String(inProgress),
    caption: "現在作業中",
    icon: "activity",
  });

  // 完了状況
  cards.push({
    id: "done",
    label: "完了",
    value: `${done}/${total}`,
    caption: "タスク完了数",
    tone: done === total && total > 0 ? "success" : "neutral",
    icon: "check",
  });

  return cards;
});

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

// const chatPreviewMessages = computed<PreviewChatMessage[]>(() =>
//   chatMessages.value.map((message) => ({
//     id: message.id,
//     author: message.author || message.senderName || 'Unknown',
//     time: message.createdAt
//       ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
//       : '--:--',
//     message: message.text,
//     reactions: message.reactionSummary || [],
//     senderId: message.senderId,
//     linkedTaskId: message.linkedTaskId,
//     isTask: message.isTask,
//   })),
// )

// const onlineMemberCount = computed(() => members.value.filter((member) => isMemberRecentlyActive(member)).length)
// const memberPreviewList = computed(() =>
//   members.value.slice(0, 4).map((member) => ({
//     ...member,
//     statusLabel: memberStatusLabel(member),
//     statusClass: memberStatusClass(member),
//   })),
// )

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

watch(
  taskView,
  (mode) => {
    showMyTasksOnly.value = mode === "mine";
  },
  { immediate: true },
);

watch(showMyTasksOnly, (flag) => {
  taskView.value = flag ? "mine" : "all";
});

function watchProject() {
  stopProject = onSnapshot(doc(db, "projects", projectId.value), (snapshot) => {
    if (!snapshot.exists()) return;
    project.value = snapshot.data() as ProjectDoc;
  });
  stopMembers = onSnapshot(
    collection(db, "projects", projectId.value, "members"),
    async (snapshot) => {
      const promises = snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data() as any;
        const memberId = data.userId || docSnap.id;
        let name = data.nickname || data.fullName;

        if (!name) {
          try {
            const profileSnap = await getDoc(doc(db, "profiles", memberId));
            if (profileSnap.exists()) {
              const profile = profileSnap.data();
              name = profile.nickname || profile.fullName;
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

function closeTaskModal() {
  isTaskModalOpen.value = false;
}

function getMemberNameById(id?: string | null) {
  if (!id) return "";
  const member = members.value.find((entry) => entry.id === id);
  return member?.name || getDisplayName(id) || "";
}

async function handleTaskSubmit(data: TaskFormData) {
  if (!user.value || !data.title.trim()) return;
  const assigneeId = data.assigneeId || null;
  const normalizedProgress = normalizeProgress(data.progress);

  let initialStatus: TaskStatus = "todo";
  if (normalizedProgress === 100) initialStatus = "done";
  else if (normalizedProgress > 0) initialStatus = "in-progress";

  await createTask(
    projectId.value,
    {
      title: data.title.trim(),
      description: data.description.trim(),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      categoryId: data.categoryId || null,
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

// async function sendChatMessage(text: string) {
//   if (!user.value) return
//   await sendProjectMessage(
//     projectId.value,
//     user.value.uid,
//     profile.value?.nickname || profile.value?.fullName || 'User',
//     text,
//     'general',
//   )
// }

// async function reactToChatMessage(payload: { messageId: string; emoji: string }) {
//   if (!user.value || !payload.messageId || !payload.emoji) return
//   await addMessageReaction(projectId.value, payload.messageId, payload.emoji, user.value.uid)
// }

// async function handleUpdateMessage(payload: { messageId: string; text: string }) {
//   if (!user.value || !payload.messageId || !payload.text) return
//   await updateProjectMessage(projectId.value, payload.messageId, payload.text)
// }

// async function handleDeleteMessage(messageId: string) {
//   if (!user.value || !messageId) return
//   await deleteProjectMessage(projectId.value, messageId)
// }

// async function handleConvertToTask(payload: { messageId: string; text: string }) {
//   if (!user.value) return
//   const taskId = await createTask(projectId.value, { title: payload.text }, user.value.uid)
//   await updateProjectMessage(projectId.value, payload.messageId, undefined, taskId)
// }

// async function handleLinkTask(payload: { messageId: string; taskId: string }) {
//   if (!user.value) return
//   await updateProjectMessage(projectId.value, payload.messageId, undefined, payload.taskId)
// }

// function isMemberRecentlyActive(member: MemberEntry) {
//   if (!member.lastAccessedAt?.seconds) return false
//   const lastAccess = member.lastAccessedAt.seconds * 1000
//   return Date.now() - lastAccess < 1000 * 60 * 60 * 4
// }

// function memberStatusLabel(member: MemberEntry) {
//   if (!member.lastAccessedAt?.seconds) return 'オフライン'
//   const lastAccess = member.lastAccessedAt.seconds * 1000
//   const diff = Date.now() - lastAccess
//   if (diff < 1000 * 60 * 5) return 'オンライン'
//   if (diff < 1000 * 60 * 60) return '離席中'
//   return 'オフライン'
// }

// function memberStatusClass(member: MemberEntry) {
//   const status = memberStatusLabel(member)
//   if (status === 'オンライン') return 'online'
//   if (status === '離席中') return 'away'
//   return 'offline'
// }

// function getMemberInitials(name: string) {
//   if (!name) return '??'
//   const trimmed = name.trim()
//   if (trimmed.length <= 2) {
//     return trimmed
//   }
//   return trimmed.slice(0, 2).toUpperCase()
// }

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
        <section v-if="notifications.length" class="dashboard__alerts">
          <div
            v-for="note in notifications"
            :key="note.id"
            class="dashboard__alert"
          >
            <p>⚡ {{ note.message }}</p>
            <button
              v-if="note.dismissible"
              type="button"
              class="dashboard__alert-close"
              aria-label="通知を閉じる"
              @click.stop="dismissNotification(note.id)"
            >
              ×
            </button>
          </div>
        </section>
        <NotificationBar :notifications="notificationsBar" />

        <!-- サマリーカード: Now First設計でアクション指向 -->
        <DashboardSummaryCards
          :title="project?.name || 'ダッシュボード'"
          :description="''"
          :cards="summaryCards"
          :rotate="false"
          :show-header="false"
        />

        <!-- インサイト: デフォルトで折りたたみ（詳細は展開して確認） -->
        <DashboardInsights
          :tasks="tasks"
          v-model:collapsed="insightsCollapsed"
        />

        <div class="demo__grid">
          <section class="demo__primary">
            <DashboardTaskList
              v-model="filters"
              :tasks="filteredTasks"
              :members="members"
              :categories="categories"
              @select="selectTaskById"
              @navigate="navigateToTaskDetail"
            />
          </section>

          <!-- Temporarily commented out
          <aside class="demo__secondary">
            <div class="secondary-tabs">
              <button
                type="button"
                :class="['secondary-tab', { 'is-active': secondaryTab === 'chat' }]"
                @click="secondaryTab = 'chat'"
              >
                チャット
              </button>
              <button
                type="button"
                :class="['secondary-tab', { 'is-active': secondaryTab === 'members' }]"
                @click="secondaryTab = 'members'"
              >
                メンバー
              </button>
            </div>

            <div v-if="secondaryTab === 'chat'">
              <div class="chat-preview__header">
                <h3>チームチャット</h3>
                <p>最新メッセージはダッシュボードから直接確認できます。</p>
              </div>
              <TeamChatPreview
                :messages="chatPreviewMessages"
                :online-count="members.length"
                :show-composer="true"
                :loading="chatLoading"
                :current-user-id="user?.uid"
                :current-user-name="profile?.nickname || profile?.fullName"
                :tasks="tasks"
                @send="sendChatMessage"
                @react="reactToChatMessage"
                @update="handleUpdateMessage"
                @delete="handleDeleteMessage"
                @convert-task="handleConvertToTask"
                @link-task="handleLinkTask"
              />
            </div>

            <div v-else class="member-preview">
              <div class="member-preview__header">
                <div>
                  <h3>チームメンバー</h3>
                  <p>{{ members.length }}名のメンバーを素早く確認できます。</p>
                </div>
                <AppButton
                  class="member-preview__cta"
                  variant="outline"
                  :to="{ name: ROUTE_NAMES.projectMembers, params: { projectId } }"
                >
                  メンバー管理へ
                </AppButton>
              </div>

              <div class="member-preview__stats">
                <div>
                  <p>総メンバー</p>
                  <strong>{{ members.length }}</strong>
                </div>
                <div>
                  <p>オンライン</p>
                  <strong>{{ onlineMemberCount }}</strong>
                </div>
              </div>

              <ul class="member-preview__list">
                <li v-for="member in memberPreviewList" :key="member.id">
                  <div class="member-chip">
                    <div class="member-chip__avatar" aria-hidden="true">{{ getMemberInitials(member.name) }}</div>
                    <div>
                      <p class="member-chip__name">{{ member.name }}</p>
                      <p class="member-chip__meta">{{ member.role || 'member' }}・{{ member.statusLabel }}</p>
                    </div>
                  </div>
                  <span class="member-chip__status" :class="`status-${member.statusClass}`">{{ member.statusLabel }}</span>
                </li>
              </ul>
            </div>
          </aside>
          -->
        </div>
      </div>
    </div>

    <TaskCreateModal
      :open="isTaskModalOpen"
      :categories="categories"
      :members="members"
      @close="closeTaskModal"
      @submit="handleTaskSubmit"
    />

    <TaskPreviewDrawer
      :task="selectedTask"
      :project-id="projectId"
      @close="selectedTask = null"
    />
  </div>
</template>

<style scoped>
@import "@/pages/demo/styles/demo-shell.css";

.demo__version {
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  background: var(--ui-surface-muted, #f1f5f9);
  font-weight: var(--ui-font-bold, 700);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-brand-900, #0b2e33);
}

.demo__content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6, 1.5rem);
}

.demo__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--ui-space-7, 1.75rem);
}

.muted {
  color: var(--ui-text-muted, #64748b);
}

.top-actions {
  display: flex;
  gap: var(--ui-space-3, 0.75rem);
  align-items: center;
}

.top-actions__new {
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: none;
  background: var(--ui-brand-900, #0b2e33);
  color: var(--ui-surface, #ffffff);
  font-weight: var(--ui-font-semibold, 600);
  box-shadow: var(--ui-shadow-md);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.top-actions__new:hover {
  transform: translateY(-1px);
  box-shadow: var(--ui-shadow-lg);
}

.top-actions__new:focus {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1, 0.25rem);
  font-weight: var(--ui-font-semibold, 600);
}

.dashboard__alerts {
  background: var(--ui-warning-light, #fef3c7);
  border-left: 4px solid var(--ui-warning, #f59e0b);
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.dashboard__alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-1, 0.25rem)
    var(--ui-space-2, 0.5rem) var(--ui-space-2, 0.5rem);
}

.dashboard__alert p {
  margin: 0;
  color: #92400e;
  font-weight: var(--ui-font-semibold, 600);
}

.dashboard__alert-close {
  border: none;
  background: transparent;
  color: #b45309;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-bold, 700);
  cursor: pointer;
  padding: var(--ui-space-1, 0.25rem);
  line-height: 1;
  border-radius: var(--ui-radius-sm, 0.5rem);
  transition: var(--ui-transition-colors);
}

.dashboard__alert-close:hover {
  background: rgba(244, 172, 67, 0.25);
  color: #92400e;
}

.demo__primary {
  display: grid;
  gap: var(--ui-space-8, 2rem);
}

.demo__secondary {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5, 1.25rem);
}

.secondary-tabs {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
}

.secondary-tab {
  flex: 1;
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-brand-600, #4f7c82);
  transition: var(--ui-transition-all);
}

.secondary-tab.is-active {
  background: var(--ui-brand-900, #0b2e33);
  color: var(--ui-surface, #ffffff);
  border-color: var(--ui-brand-900, #0b2e33);
  box-shadow: var(--ui-shadow-lg);
}

.member-preview {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-xl, 1.25rem);
  padding: var(--ui-space-5, 1.25rem);
  background: #fffdf8;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.member-preview__header {
  display: flex;
  justify-content: space-between;
  gap: var(--ui-space-4, 1rem);
  align-items: center;
}

.member-preview__header h3 {
  margin: 0;
}

.member-preview__header p {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.member-preview__cta {
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  font-size: var(--ui-text-sm, 0.875rem);
}

.member-preview__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-space-3, 0.75rem);
}

.member-preview__stats div {
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  background: rgba(184, 227, 233, 0.3);
}

.member-preview__stats p {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.member-preview__stats strong {
  font-size: var(--ui-text-2xl, 1.5rem);
  color: var(--ui-brand-900, #0b2e33);
}

.member-preview__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.member-chip {
  display: flex;
  gap: var(--ui-space-3, 0.75rem);
  align-items: center;
}

.member-chip__avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--ui-radius-full, 9999px);
  background: rgba(79, 124, 130, 0.15);
  color: var(--ui-brand-900, #0b2e33);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--ui-font-bold, 700);
}

.member-chip__name {
  margin: 0;
  font-weight: var(--ui-font-semibold, 600);
}

.member-chip__meta {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.member-chip__status {
  margin-left: auto;
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
}

.member-chip__status.status-online {
  color: var(--ui-success, #16a34a);
}

.member-chip__status.status-away {
  color: #b07816;
}

.member-chip__status.status-offline {
  color: var(--ui-text-muted, #64748b);
}

.task-list {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-xl, 1.25rem);
  background: var(--ui-surface, #ffffff);
  padding: var(--ui-space-5, 1.25rem);
  box-shadow: var(--ui-shadow-lg);
}

.task-list__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--ui-space-4, 1rem);
  padding-bottom: var(--ui-space-4, 1rem);
  border-bottom: 2px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  gap: var(--ui-space-6, 1.5rem);
  flex-wrap: wrap;
}

.task-list__header-left {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.task-list__header-left h3 {
  margin: 0;
  font-size: var(--ui-text-xl, 1.25rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.task-list__header-left p {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text-muted, #64748b);
}

.task-list__filters {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
  align-items: center;
  flex-wrap: nowrap;
}

.task-filter-select {
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  background: rgba(255, 255, 255, 0.8);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-brand-900, #0b2e33);
  transition: var(--ui-transition-all);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%230b2e33' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right var(--ui-space-3, 0.75rem) center;
  background-size: 10px;
  padding-right: 2.2rem;
  min-width: 110px;
}

.task-filter-select:hover {
  border-color: var(--ui-border-focus, #4f7c82);
  background-color: var(--ui-surface, #ffffff);
}

.task-filter-select:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  background-color: var(--ui-surface, #ffffff);
  box-shadow: var(--ui-ring-focus);
}

.filter-reset-btn {
  padding: var(--ui-space-2, 0.5rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ui-brand-600, #4f7c82);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.filter-reset-btn svg {
  display: block;
}

.filter-reset-btn:hover {
  border-color: var(--ui-brand-600, #4f7c82);
  background: rgba(79, 124, 130, 0.08);
  color: var(--ui-brand-900, #0b2e33);
  transform: rotate(-15deg);
}

.filter-reset-btn:active {
  transform: scale(0.95) rotate(-15deg);
}

.task-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.task-row {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-sm, 0.5rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.task-row:hover {
  border-color: var(--ui-border, rgba(11, 46, 51, 0.12));
  background-color: rgba(184, 227, 233, 0.1);
}

.task-row__content {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 0.9fr 1.5fr 1fr;
  gap: var(--ui-space-4, 1rem);
  align-items: center;
}

@media (max-width: 768px) {
  .task-row__content {
    grid-template-columns: 1fr;
    gap: var(--ui-space-2, 0.5rem);
  }

  .task-row__title {
    font-size: var(--ui-text-lg, 1.125rem);
  }

  .task-row__status {
    justify-content: flex-start;
  }

  .task-row__progress {
    margin-top: var(--ui-space-1, 0.25rem);
  }

  .task-row__due {
    text-align: left;
    font-size: var(--ui-text-sm, 0.875rem);
  }
}

.task-row__title {
  margin: 0;
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
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
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1, 0.25rem);
  padding: 4px 8px;
  border-radius: var(--ui-radius-full, 9999px);
  background: rgba(11, 46, 51, 0.06);
  color: var(--ui-text-strong, #0f172a);
  font-size: var(--ui-text-sm, 0.875rem);
  white-space: nowrap;
}

.task-row__status {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  min-width: auto;
  padding: 0;
  border-radius: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-bold, 700);
  letter-spacing: 0.01em;
  border: none;
  background: transparent;
  transition: var(--ui-transition-colors);
}

.task-row__status--todo {
  color: var(--ui-text-muted, #64748b);
}

.task-row__status--in-progress {
  color: var(--ui-brand-900, #0b2e33);
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
  gap: var(--ui-space-2, 0.5rem);
}

.task-row__progress-bar {
  flex: 1;
  height: var(--ui-space-2, 0.5rem);
  background: rgba(11, 46, 51, 0.1);
  border-radius: var(--ui-radius-full, 9999px);
  overflow: hidden;
}

.task-row__progress-fill {
  height: 100%;
  background: var(--ui-brand-600, #4f7c82);
  border-radius: inherit;
  transition: width 0.3s ease;
}

.task-row__progress-value {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
  min-width: 3rem;
  text-align: right;
}

.task-row__due {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  text-align: right;
}

.task-row__due--overdue {
  color: var(--ui-danger, #ef4444);
  font-weight: var(--ui-font-bold, 700);
}

.task-row.is-overdue {
  border-color: rgba(239, 68, 68, 0.25);
  background-color: var(--ui-danger-light, #fef2f2);
}

.task-row.is-overdue:hover {
  border-color: rgba(239, 68, 68, 0.4);
  background-color: rgba(239, 68, 68, 0.08);
}

.status-pill {
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  border-radius: var(--ui-radius-full, 9999px);
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
}

.status-pill--todo {
  background: var(--ui-border-light, rgba(11, 46, 51, 0.08));
  color: var(--ui-text-strong, #0f172a);
}

.status-pill--progress {
  background: rgba(79, 124, 130, 0.2);
  color: var(--ui-brand-900, #0b2e33);
}

.status-pill--review {
  background: rgba(255, 202, 99, 0.25);
  color: #915a00;
}

.status-pill--done {
  background: var(--ui-success-light, #dcfce7);
  color: #166534;
}

.ai-panel {
  margin-top: var(--ui-space-6, 1.5rem);
  padding: var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-lg, 1rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
  background: var(--ui-surface, #ffffff);
}

.chat-preview__header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--ui-space-1, 0.25rem);
  margin-bottom: var(--ui-space-3, 0.75rem);
}

.chat-preview__header p {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.ai-panel textarea,
.ai-panel input {
  width: 100%;
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  padding: var(--ui-space-3, 0.75rem);
}

.ai-panel textarea:focus,
.ai-panel input:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.ai-panel button {
  align-self: flex-start;
  border: none;
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  background: var(--ui-brand-900, #0b2e33);
  color: var(--ui-surface, #ffffff);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.ai-panel button:hover {
  background: var(--ui-brand-800, #1a4a52);
}

.ai-response {
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem);
  min-height: 80px;
}

.task-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-4, 1rem);
  z-index: var(--ui-z-modal, 50);
}

.task-modal__card {
  width: min(520px, 100%);
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-xl, 1.25rem);
  padding: var(--ui-space-6, 1.5rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
  box-shadow: var(--ui-shadow-xl);
}

.task-modal__card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.task-modal__card button {
  border: none;
  background: transparent;
  font-size: var(--ui-text-xl, 1.25rem);
  cursor: pointer;
}

.task-modal__form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.task-modal__form input,
.task-modal__form textarea,
.task-modal__form select {
  width: 100%;
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  padding: var(--ui-space-3, 0.75rem);
}

.task-modal__form input:focus,
.task-modal__form textarea:focus,
.task-modal__form select:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.task-modal__form footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-3, 0.75rem);
}

.task-modal__form footer button {
  border: none;
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-5, 1.25rem);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.task-modal__form footer .ghost {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-brand-900, #0b2e33);
}

.task-modal__form footer button:last-child {
  background: var(--ui-brand-900, #0b2e33);
  color: var(--ui-surface, #ffffff);
}

.task-modal__range-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-modal__range-header .hint {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.progress-picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2, 0.5rem);
  margin-top: var(--ui-space-2, 0.5rem);
}

.progress-pill {
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-full, 9999px);
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  background: transparent;
  cursor: pointer;
  font-size: var(--ui-text-xs, 0.75rem);
  transition: var(--ui-transition-all);
}

.progress-pill.is-active {
  background: var(--ui-brand-600, #4f7c82);
  color: var(--ui-surface, #ffffff);
  border-color: var(--ui-brand-600, #4f7c82);
}

.task-modal__thread-toggle {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-4, 1rem);
  background: var(--ui-surface-muted, #f1f5f9);
}

.thread-toggle {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-3, 0.75rem);
  cursor: pointer;
}

.thread-toggle input {
  margin-top: var(--ui-space-1, 0.25rem);
}

.thread-toggle__title {
  margin: 0;
  font-weight: var(--ui-font-semibold, 600);
}

.thread-toggle__description {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

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
  z-index: var(--ui-z-modal, 50);
}

.task-drawer__overlay {
  flex: 1;
  background: rgba(0, 0, 0, 0.35);
}

.task-drawer__panel {
  width: clamp(280px, 85vw, 420px);
  background: var(--ui-surface, #ffffff);
  box-shadow: var(--ui-shadow-xl);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
  padding: var(--ui-space-6, 1.5rem);
  transform: translateX(0);
  transition: var(--ui-transition-all);
}

.task-drawer__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-drawer__eyebrow {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  letter-spacing: 0.08em;
  color: var(--ui-text-muted, #64748b);
  text-transform: uppercase;
}

.task-drawer__header h3 {
  margin: var(--ui-space-1, 0.25rem) 0 0;
}

.task-drawer__section {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.task-drawer__section .label {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.task-drawer__section textarea,
.task-drawer__section input,
.task-drawer__section select {
  width: 100%;
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem);
}

.task-drawer__section textarea:focus,
.task-drawer__section input:focus,
.task-drawer__section select:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.thread-section .thread-create-btn {
  border: 1px dashed var(--ui-brand-600, #4f7c82);
  background: rgba(79, 124, 130, 0.08);
  color: var(--ui-brand-900, #0b2e33);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.thread-section .thread-create-btn:hover {
  background: rgba(79, 124, 130, 0.15);
}

.thread-form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.thread-form input {
  border-radius: var(--ui-radius-md, 0.75rem);
}

.thread-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-2, 0.5rem);
}

.thread-actions button {
  border: none;
  border-radius: var(--ui-radius-sm, 0.5rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.thread-actions .ghost {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text, #0b2e33);
}

.thread-actions button:last-child {
  background: var(--ui-brand-600, #4f7c82);
  color: var(--ui-surface, #ffffff);
}

.thread-status {
  background: var(--ui-success-light, #dcfce7);
  border: 1px solid #bbf7d0;
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
}

.thread-status .thread-name {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-weight: var(--ui-font-semibold, 600);
}

.task-drawer__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-2, 0.5rem);
}

.task-drawer__footer button {
  border: none;
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  background: var(--ui-brand-900, #0b2e33);
  color: var(--ui-surface, #ffffff);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.task-drawer__footer .ghost {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-brand-900, #0b2e33);
}

.task-drawer__footer .danger {
  background: var(--ui-danger, #ef4444);
}

/* Task Drawer Tabs */
.drawer-tabs {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
  padding-bottom: var(--ui-space-3, 0.75rem);
  border-bottom: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  margin-bottom: var(--ui-space-4, 1rem);
}

.drawer-tab {
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-brand-900, #0b2e33);
  font-weight: var(--ui-font-bold, 700);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-full, 9999px);
  cursor: pointer;
  transition: var(--ui-transition-all);
  font-size: var(--ui-text-sm, 0.875rem);
}

.drawer-tab.active {
  background: var(--ui-brand-900, #0b2e33);
  color: var(--ui-surface, #ffffff);
  border-color: var(--ui-brand-900, #0b2e33);
}

.drawer-tab:hover:not(.active) {
  background: rgba(11, 46, 51, 0.08);
}

.drawer-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5, 1.25rem);
  overflow-y: auto;
  min-height: 0;
}

.drawer-content.no-padding {
  padding: 0;
  gap: 0;
}

.drawer-close {
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-md, 0.75rem);
  width: 36px;
  height: 36px;
  cursor: pointer;
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-brand-900, #0b2e33);
  display: grid;
  place-items: center;
  font-size: var(--ui-text-xl, 1.25rem);
  transition: var(--ui-transition-all);
}

.drawer-close:hover {
  border-color: var(--ui-brand-600, #4f7c82);
  color: var(--ui-brand-600, #4f7c82);
}

.empty-placeholder {
  padding: var(--ui-space-5, 1.25rem);
  border: 1px dashed var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-lg, 1rem);
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text-muted, #64748b);
  text-align: center;
  font-weight: var(--ui-font-bold, 700);
}

.task-drawer__title-link {
  text-decoration: none;
  color: inherit;
  display: flex;
  align-items: baseline;
  gap: var(--ui-space-1, 0.25rem);
  transition: var(--ui-transition-colors);
}

.task-drawer__title-link:hover {
  color: var(--ui-brand-600, #4f7c82);
  text-decoration: underline;
}

.task-drawer__helper {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  margin: var(--ui-space-1, 0.25rem) 0 0 0;
}

.task-drawer__panel {
  background: var(--ui-surface-elevated, #f8fafc) !important;
  border-left: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  box-shadow: var(--ui-shadow-lg);
}

.readonly-value {
  padding: var(--ui-space-2, 0.5rem) 0;
  color: var(--ui-text, #0b2e33);
  font-size: var(--ui-text-base, 1rem);
  display: flex;
  align-items: center;
}

.description-preview {
  white-space: pre-wrap;
  color: var(--ui-text, #0b2e33);
  font-size: var(--ui-text-sm, 0.875rem);
  line-height: var(--ui-leading-relaxed, 1.625);
  max-height: 100px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.6);
  padding: var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  transition: max-height 0.3s ease;
}

.description-preview.is-expanded {
  max-height: 500px;
  overflow-y: auto;
}

.description-toggle {
  background: none;
  border: none;
  color: var(--ui-brand-600, #4f7c82);
  font-size: var(--ui-text-xs, 0.75rem);
  cursor: pointer;
  padding: var(--ui-space-1, 0.25rem) 0;
  margin-top: var(--ui-space-1, 0.25rem);
  font-weight: var(--ui-font-semibold, 600);
  transition: var(--ui-transition-colors);
}

.description-toggle:hover {
  text-decoration: underline;
}

.task-drawer__sticky-footer {
  margin-top: auto;
  padding: var(--ui-space-4, 1rem) var(--ui-space-6, 1.5rem);
  background: var(--ui-surface-elevated, #f8fafc);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  display: flex;
  justify-content: center;
  position: sticky;
  bottom: 0;
}

.cta-button {
  display: flex;
  width: 100%;
  justify-content: center;
  align-items: center;
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border: 1px solid var(--ui-brand-600, #4f7c82);
  border-radius: var(--ui-radius-md, 0.75rem);
  color: var(--ui-brand-600, #4f7c82);
  font-weight: var(--ui-font-semibold, 600);
  text-decoration: none;
  font-size: var(--ui-text-sm, 0.875rem);
  background: var(--ui-surface, #ffffff);
  transition: var(--ui-transition-all);
}

.cta-button:hover {
  background: rgba(79, 124, 130, 0.08);
}
</style>

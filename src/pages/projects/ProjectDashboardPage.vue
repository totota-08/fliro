<script setup lang="ts">
import { isTaskOverdue } from "@/utils/taskUi";
import DashboardInsights from "@/components/projectDashboard/DashboardInsights.vue";
import DashboardSummaryCards, {
  type SummaryCard,
} from "@/components/projectDashboard/DashboardSummaryCards.vue";
import DashboardTaskList, {
  type TaskFilters,
} from "@/components/projectDashboard/DashboardTaskList.vue";
import NotificationBar from "@/components/projectDashboard/NotificationBar.vue";
import TaskDrawer from "@/components/tasks/TaskDrawer.vue";
import { useNotificationCenter } from "@/composables/useNotificationCenter";
import { usePageTitle } from "@/composables/usePageTitle";
import { useTaskDrawerRouteSync } from "@/composables/useTaskDrawerRouteSync";
import { db } from "@/lib/firebase";
import {
  getDashboardSettings,
  getDefaultInsightCards,
  saveDashboardSettings,
  type DashboardCardConfig,
  type InsightCardConfig,
} from "@/services/dashboardSettingsService";
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
import { listenTasks, updateTask, type TaskDoc } from "@/services/taskService";
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

// TaskDrawer のURL同期
const {
  taskId: selectedTaskId,
  openTask,
  closeTask,
} = useTaskDrawerRouteSync(router, route);

type MemberEntry = ProjectMember & {
  id: string;
  name: string;
  lastAccessedAt?: { seconds: number; nanoseconds: number };
};

const project = ref<ProjectDoc | null>(null);
const members = ref<MemberEntry[]>([]);
const tasks = ref<TaskDoc[]>([]);
const categories = ref<TaskCategory[]>([]);
const { notifications: notificationsBar } = useNotificationCenter();

// ページタイトル設定
const { setTitle } = usePageTitle("ダッシュボード", "プロジェクトの概要");
watch(
  project,
  (p) => {
    if (p?.name) setTitle(p.name);
  },
  { immediate: true },
);
const taskView = ref<"all" | "mine">("all");
const chatMessages = ref<ChatMessage[]>([]);
const chatLoading = ref(true);

// O(1) 参照用のMap
const membersById = computed(() => {
  const map = new Map<string, MemberEntry>();
  for (const member of members.value) {
    map.set(member.id, member);
  }
  return map;
});

const categoriesById = computed(() => {
  const map = new Map<string, TaskCategory>();
  for (const category of categories.value) {
    map.set(category.id, category);
  }
  return map;
});
const filters = reactive({
  search: "",
  status: "all",
  priority: "all",
  assignee: "all",
  due: "all",
  category: "all",
});
// Dashboard card customization
const cardConfig = ref<DashboardCardConfig[]>([]);
const insightCardConfig = ref<InsightCardConfig[]>([]);

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
  if (filters.priority !== "all") {
    list = list.filter(
      (task) => (task.priority || "medium") === filters.priority,
    );
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
    value: String(done),
    caption: "完了タスク数",
    tone: done === total && total > 0 ? "success" : "neutral",
    icon: "check",
  });

  return cards;
});

// Load dashboard card configuration
async function loadCardConfig() {
  if (!user.value) return;
  try {
    const settings = await getDashboardSettings(
      user.value.uid,
      projectId.value,
    );
    cardConfig.value = settings.cards;
    insightCardConfig.value = settings.insightCards ?? getDefaultInsightCards();
  } catch (error) {
    logger.error`Failed to load dashboard settings: ${error}`;
    // Use default config on error
    cardConfig.value = [
      { id: "overdue", type: "overdue", position: 0, visible: true },
      { id: "due-soon", type: "due-soon", position: 1, visible: true },
      { id: "active", type: "active", position: 2, visible: true },
      { id: "done", type: "done", position: 3, visible: true },
    ];
    insightCardConfig.value = getDefaultInsightCards();
  }
}

// Handle card config update from DashboardSummaryCards
async function handleCardConfigUpdate(newConfig: DashboardCardConfig[]) {
  cardConfig.value = newConfig;
  if (!user.value) return;

  try {
    await saveDashboardSettings(user.value.uid, projectId.value, newConfig);
  } catch (error) {
    logger.error`Failed to save dashboard settings: ${error}`;
  }
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

        // uidがそのまま表示されないようフォールバック
        const fallbackName = name || `メンバー#${memberId.slice(-1)}`;

        return {
          id: memberId,
          name: fallbackName,
          userId: memberId,
          role: (data.role as ProjectMember["role"]) || "member",
          projectRole:
            (data.projectRole as ProjectMember["projectRole"]) || "member",
          nickname: data.nickname,
          fullName: data.fullName,
          displayName: data.nickname || data.fullName || fallbackName,
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
  loadCardConfig();
}

// タスクをドロワーで開く（selectとnavigateを統一）
function selectTaskById(taskId: string) {
  openTask(taskId);
}

function navigateToTaskDetail(taskId: string) {
  openTask(taskId);
}

async function handleTaskComplete(task: TaskDoc) {
  if (!user.value) return;
  try {
    await updateTask(
      projectId.value,
      task.id,
      { status: "done" },
      {
        userId: user.value.uid,
        actorName: profile.value?.nickname || profile.value?.fullName || "User",
        origin: "ui",
      },
    );
  } catch (error) {
    logger.error`Failed to complete task: ${error}`;
  }
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

onMounted(() => {
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
  <div class="dashboard-page">
    <div class="dashboard__content">
      <NotificationBar :notifications="notificationsBar" />

      <DashboardInsights
        :tasks="tasks"
        :card-config="insightCardConfig"
        v-model:collapsed="insightsCollapsed"
      />

      <DashboardSummaryCards
        :title="project?.name || 'ダッシュボード'"
        :description="''"
        :cards="summaryCards"
        :rotate="false"
        :show-header="true"
        :customizable="false"
        :card-config="cardConfig"
        @update:card-config="handleCardConfigUpdate"
      />

      <DashboardTaskList
        :model-value="filters"
        @update:model-value="(val: TaskFilters) => Object.assign(filters, val)"
        :tasks="filteredTasks"
        :members="members"
        :categories="categories"
        @select="selectTaskById"
        @navigate="navigateToTaskDetail"
        @complete="handleTaskComplete"
      />
    </div>

    <Teleport to="body">
      <TaskDrawer
        :project-id="projectId"
        :task-id="selectedTaskId"
        :tasks="tasks"
        :categories-by-id="categoriesById"
        :members-by-id="membersById"
        :members="members"
        @close="closeTask"
        @task-updated="handleTaskUpdated"
      />
    </Teleport>
  </div>
</template>

<style scoped>
/* Dashboard Page Layout */
.dashboard-page {
  padding: var(--ui-space-6, 1.5rem);
}

/* Dashboard Content Layout */
.dashboard__content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6);
}

/* Dashboard Version Badge */
.dashboard__version {
  padding: var(--ui-space-1) var(--ui-space-3);
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-border);
  background: var(--ui-surface-muted);
  font-weight: var(--ui-font-bold);
  font-size: var(--ui-text-sm);
  color: var(--ui-brand-900);
  flex-shrink: 0;
}

/* モバイル: サイドバー非表示時の余白確保 */
@media (max-width: 768px) {
  .dashboard-page {
    padding: var(--ui-space-4, 1rem);
    min-height: calc(100vh - 4rem);
  }
}
</style>

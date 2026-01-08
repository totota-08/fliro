<script setup lang="ts">
import DashboardInsights from "@/components/projectDashboard/DashboardInsights.vue";
import DashboardSummaryCards, {
  type SummaryCard,
} from "@/components/projectDashboard/DashboardSummaryCards.vue";
import DashboardTaskList from "@/components/projectDashboard/DashboardTaskList.vue";
import NotificationBar from "@/components/projectDashboard/NotificationBar.vue";
import TaskCreateModal, {
  type TaskFormData,
} from "@/components/tasks/TaskCreateModal.vue";
import TaskPreviewDrawer from "@/components/tasks/TaskPreviewDrawer.vue";
import { useNotificationCenter } from "@/composables/useNotificationCenter";
import { useProjectShellData } from "@/composables/useProjectShellData";
import { useUserDisplay } from "@/composables/useUserDisplay";
import { appName, appVersion } from "@/constants/appMeta";
import ProjectAppShell from "@/layouts/ProjectAppShell.vue";
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
const filters = reactive({
  search: "",
  status: "all",
  assignee: "all",
  due: "all",
  category: "all",
});
const showMyTasksOnly = ref(false);
const isTaskModalOpen = ref(false);

// ProjectAppShell用のデータを取得
const { navItems, sidebarProjects, profileInfo } =
  useProjectShellData(projectId);
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
    value: String(done),
    caption: "完了タスク数",
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
  <ProjectAppShell
    :project-id="projectId"
    :nav-items="navItems"
    :sidebar-projects="sidebarProjects"
    :profile-info="profileInfo"
  >
    <template #headerTitle>
      <p class="project-app-shell__breadcrumb">
        {{ appName }} &gt; ダッシュボード
      </p>
      <h1 class="project-app-shell__heading">
        {{ project?.name || "プロジェクト" }}
      </h1>
    </template>
    <template #headerActions>
      <span class="dashboard__version" v-if="appVersion">{{ appVersion }}</span>
    </template>

    <div class="dashboard__content">
      <NotificationBar :notifications="notificationsBar" />

      <DashboardSummaryCards
        :title="project?.name || 'ダッシュボード'"
        :description="''"
        :cards="summaryCards"
        :rotate="false"
        :show-header="false"
      />

      <DashboardInsights :tasks="tasks" v-model:collapsed="insightsCollapsed" />

      <DashboardTaskList
        v-model="filters"
        :tasks="filteredTasks"
        :members="members"
        :categories="categories"
        @select="selectTaskById"
        @navigate="navigateToTaskDetail"
      />
    </div>
  </ProjectAppShell>

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
</template>

<style scoped>
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
}
</style>

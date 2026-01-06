<script setup lang="ts">
import DashboardSummaryCards, {
  type SummaryCard,
} from "@/components/projectDashboard/DashboardSummaryCards.vue";
import NotificationBar from "@/components/projectDashboard/NotificationBar.vue";
import ProjectSidebar from "@/components/projectDashboard/ProjectSidebar.vue";
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
const isDescriptionExpanded = ref(false);

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
  if (showMyTasksOnly.value && user.value) {
    list = list.filter((task) => task.assigneeId === user.value?.uid);
  }
  if (taskView.value === "mine" && user.value) {
    list = list.filter((task) => task.assigneeId === user.value?.uid);
  }
  return list;
});

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

const gaugeRadius = 80;
const gaugeCircumference = Math.PI * gaugeRadius;

const overallProgress = computed(() => {
  const total = tasks.value.length;
  if (!total) return 0;
  const totalProgress = tasks.value.reduce((sum, task) => {
    return sum + (task.progress ?? (task.status === "done" ? 100 : 0));
  }, 0);
  return Math.round(totalProgress / total);
});

const statusCounts = computed(() => {
  const counts: Record<TaskStatus, number> = {
    todo: 0,
    "in-progress": 0,
    review: 0,
    done: 0,
  };
  tasks.value.forEach((task) => {
    counts[task.status] = (counts[task.status] || 0) + 1;
  });
  return counts;
});

const maxStatusCount = computed(() => {
  const values = Object.values(statusCounts.value);
  return Math.max(1, ...values);
});

const healthScore = computed(() => {
  const overdue = tasks.value.filter((task) => isTaskOverdue(task)).length;
  const now = Date.now();
  const soonThreshold = 3 * 24 * 60 * 60 * 1000;
  const dueSoon = tasks.value.filter(
    (task) =>
      task.dueDate?.seconds &&
      task.dueDate.seconds * 1000 - now <= soonThreshold &&
      task.dueDate.seconds * 1000 > now,
  ).length;
  const progressPenalty = Math.max(0, 70 - overallProgress.value) * 0.4;
  let score = 100;
  score -= overdue * 12;
  score -= dueSoon * 5;
  score -= progressPenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
});

const healthColor = computed(() => {
  if (healthScore.value >= 80) return "#16a34a";
  if (healthScore.value >= 60) return "#f59e0b";
  if (healthScore.value >= 40) return "#f97316";
  return "#ef4444";
});

const gaugeDashoffset = computed(
  () => gaugeCircumference * (1 - healthScore.value / 100),
);
const healthNeedleRotation = computed(
  () => -90 + (healthScore.value / 100) * 180,
);

const gaugeSegments = [
  { id: "danger", color: "#ef4444", size: 40 },
  { id: "warn", color: "#f97316", size: 20 },
  { id: "caution", color: "#f59e0b", size: 20 },
  { id: "good", color: "#16a34a", size: 20 },
];

const gaugeSegmentStyles = computed(() => {
  let offset = 0;
  return gaugeSegments.map((segment) => {
    const len = gaugeCircumference * (segment.size / 100);
    const style = {
      stroke: segment.color,
      strokeDasharray: `${len} ${gaugeCircumference - len}`,
      strokeDashoffset: `${-offset}`,
    };
    offset += len;
    return style;
  });
});

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
  if (status === "in-progress") return "進行中";
  if (status === "review") return "レビュー";
  if (status === "done") return "完了";
  return "未着手";
}

function taskStatusClass(task: TaskDoc) {
  const base = `task-row__status--${task.status}`;
  return [base, { "is-overdue": isTaskOverdue(task) }];
}

function normalizeProgress(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  const clamped = Math.min(100, Math.max(0, value));
  return Math.round(clamped / 25) * 25;
}

function taskProgress(task: TaskDoc) {
  return normalizeProgress(task.progress ?? (task.status === "done" ? 100 : 0));
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

function resetFilters() {
  filters.search = "";
  filters.status = "all";
  filters.assignee = "all";
  filters.due = "all";
  filters.category = "all";
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

function displayAssignee(task: TaskDoc) {
  if (task.assigneeName) return task.assigneeName;
  const memberName = getMemberNameById(task.assigneeId || "");
  return memberName || task.assigneeId || "未割当";
}

function getCategoryName(categoryId?: string | null) {
  if (!categoryId) return "未分類";
  return (
    categories.value.find((category) => category.id === categoryId)?.name ||
    "未分類"
  );
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

function formatStatus(status: TaskStatus) {
  const map: Record<TaskStatus, string> = {
    todo: "未着手",
    "in-progress": "進行中",
    review: "レビュー",
    done: "完了",
  };
  return map[status] || status;
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

        <section class="dashboard__charts">
          <div class="chart-card chart-card--donut">
            <header class="chart-card__header">
              <p class="chart-card__eyebrow">全体の進捗</p>
              <h3>プロジェクト進捗</h3>
              <span class="chart-card__meta">{{ tasks.length }}件のタスク</span>
            </header>
            <span class="chart-card__metric">{{ overallProgress }}%</span>
            <div class="progress-chart">
              <div class="progress-chart__track">
                <div
                  class="progress-chart__fill"
                  :style="{ width: `${overallProgress}%` }"
                />
              </div>
              <div class="progress-chart__labels">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          <div class="chart-card chart-card--bars">
            <header class="chart-card__header">
              <p class="chart-card__eyebrow">タスクの状況</p>
              <h3>ステータス別タスク数</h3>
            </header>
            <ul class="status-bars">
              <li class="status-bars__row">
                <div class="status-bars__label">
                  <span>未着手</span>
                  <strong>{{ statusCounts.todo }}</strong>
                </div>
                <div class="status-bars__track">
                  <div
                    class="status-bars__fill status-bars__fill--todo"
                    :style="{
                      width: `${Math.max((statusCounts.todo / maxStatusCount) * 100, 6)}%`,
                    }"
                  />
                </div>
              </li>
              <li class="status-bars__row">
                <div class="status-bars__label">
                  <span>進行中</span>
                  <strong>{{ statusCounts["in-progress"] }}</strong>
                </div>
                <div class="status-bars__track">
                  <div
                    class="status-bars__fill status-bars__fill--progress"
                    :style="{
                      width: `${Math.max((statusCounts['in-progress'] / maxStatusCount) * 100, 6)}%`,
                    }"
                  />
                </div>
              </li>
              <li class="status-bars__row">
                <div class="status-bars__label">
                  <span>レビュー</span>
                  <strong>{{ statusCounts.review }}</strong>
                </div>
                <div class="status-bars__track">
                  <div
                    class="status-bars__fill status-bars__fill--review"
                    :style="{
                      width: `${Math.max((statusCounts.review / maxStatusCount) * 100, 6)}%`,
                    }"
                  />
                </div>
              </li>
              <li class="status-bars__row">
                <div class="status-bars__label">
                  <span>完了</span>
                  <strong>{{ statusCounts.done }}</strong>
                </div>
                <div class="status-bars__track">
                  <div
                    class="status-bars__fill status-bars__fill--done"
                    :style="{
                      width: `${Math.max((statusCounts.done / maxStatusCount) * 100, 6)}%`,
                    }"
                  />
                </div>
              </li>
            </ul>
          </div>

          <div class="chart-card chart-card--gauge">
            <header class="chart-card__header">
              <p class="chart-card__eyebrow">プロジェクトの危険度</p>
              <h3>ヘルススコア</h3>
              <span class="chart-card__meta">期限・進捗から算出</span>
            </header>
            <span class="chart-card__metric chart-card__metric--health"
              >{{ healthScore }}%</span
            >
            <div class="gauge-chart">
              <svg viewBox="0 0 200 120">
                <path
                  class="gauge-chart__base"
                  d="M20 120 A80 80 0 0 1 180 120"
                />
                <path
                  v-for="(segment, index) in gaugeSegments"
                  :key="segment.id"
                  class="gauge-chart__segment"
                  d="M20 120 A80 80 0 0 1 180 120"
                  :style="gaugeSegmentStyles[index]"
                />
                <path
                  class="gauge-chart__value-path"
                  d="M20 120 A80 80 0 0 1 180 120"
                  :style="{
                    strokeDasharray: `${gaugeCircumference}`,
                    strokeDashoffset: `${gaugeDashoffset}`,
                    stroke: healthColor,
                  }"
                />
                <polygon
                  class="gauge-chart__needle"
                  points="100,28 96,120 104,120"
                  :transform="`rotate(${healthNeedleRotation} 100 120)`"
                />
                <circle
                  class="gauge-chart__needle-hub"
                  cx="100"
                  cy="120"
                  r="6"
                />
              </svg>
              <div class="gauge-chart__legend">
                <span class="gauge-chart__legend-item">
                  <span
                    class="gauge-chart__legend-dot gauge-chart__legend-dot--danger"
                    aria-hidden="true"
                  ></span>
                  危険
                </span>
                <span class="gauge-chart__legend-item">
                  <span
                    class="gauge-chart__legend-dot gauge-chart__legend-dot--warn"
                    aria-hidden="true"
                  ></span>
                  要対応
                </span>
                <span class="gauge-chart__legend-item">
                  <span
                    class="gauge-chart__legend-dot gauge-chart__legend-dot--caution"
                    aria-hidden="true"
                  ></span>
                  注意
                </span>
                <span class="gauge-chart__legend-item">
                  <span
                    class="gauge-chart__legend-dot gauge-chart__legend-dot--good"
                    aria-hidden="true"
                  ></span>
                  良好
                </span>
              </div>
            </div>
          </div>
        </section>

        <DashboardSummaryCards
          :title="project?.name || 'ダッシュボード'"
          :description="''"
          :cards="summaryCards"
          :rotate="false"
          :show-header="false"
        />
        <div class="demo__grid">
          <section class="demo__primary">
            <div class="task-list">
              <div class="task-list__header">
                <div class="task-list__header-left">
                  <h3>タスク一覧</h3>
                  <p>{{ filteredTasks.length }}件のタスク</p>
                </div>
                <div class="task-list__filters">
                  <select v-model="filters.status" class="task-filter-select">
                    <option value="all">全て</option>
                    <option value="todo">未着手</option>
                    <option value="in-progress">進行中</option>
                    <option value="done">完了</option>
                  </select>
                  <select v-model="filters.assignee" class="task-filter-select">
                    <option value="all">担当者</option>
                    <option
                      v-for="member in members"
                      :key="member.id"
                      :value="member.id"
                    >
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
                    @click="resetFilters"
                    title="フィルターをリセット"
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
                      <path
                        d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
                      ></path>
                      <path d="M21 3v5h-5"></path>
                      <path
                        d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
                      ></path>
                      <path d="M3 21v-5h5"></path>
                    </svg>
                  </button>
                </div>
              </div>
              <ul class="task-list__items">
                <li
                  v-for="task in filteredTasks"
                  :key="task.id"
                  class="task-row"
                  :class="{ 'is-overdue': isTaskOverdue(task) }"
                  @click="selectTaskById(task.id)"
                  @dblclick="navigateToTaskDetail(task.id)"
                >
                  <div class="task-row__content">
                    <p class="task-row__title">{{ task.title }}</p>
                    <span class="task-row__category">{{
                      getCategoryName(task.categoryId)
                    }}</span>
                    <span class="task-row__assignee">{{
                      displayAssignee(task)
                    }}</span>
                    <span
                      class="task-row__status"
                      :class="taskStatusClass(task)"
                    >
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
            </div>
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

    <div v-if="isTaskModalOpen" class="task-modal">
      <div class="task-modal__card">
        <header>
          <h3>新規タスク</h3>
          <button type="button" @click="closeTaskModal">×</button>
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
                  {{ selectedTask.title }} ↗
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
              ×
            </button>
          </header>

          <div class="drawer-content">
            <section class="task-drawer__section">
              <p class="label">ステータス</p>
              <div class="readonly-value">
                <span :class="['status-badge', selectedTask.status]">
                  {{ formatStatus(selectedTask.status) }}
                </span>
                <span class="muted" style="margin-left: 8px"
                  >{{ selectedTask.progress }}%</span
                >
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
              詳細ページを開く →
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

.dashboard__charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--ui-space-4, 1rem);
  align-items: stretch;
}

.chart-card {
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-4, 1rem) var(--ui-space-5, 1.25rem);
  box-shadow: var(--ui-shadow-lg);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
  position: relative;
}

.chart-card__header {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.chart-card__header h3 {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  color: var(--ui-brand-900, #0b2e33);
}

.chart-card__eyebrow {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.chart-card__meta {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.chart-card__metric {
  position: absolute;
  top: var(--ui-space-3, 0.75rem);
  right: var(--ui-space-4, 1rem);
  background: var(--ui-brand-900, #0b2e33);
  color: var(--ui-surface, #ffffff);
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-full, 9999px);
  font-weight: var(--ui-font-bold, 700);
  font-size: var(--ui-text-base, 1rem);
  box-shadow: var(--ui-shadow-md);
}

.chart-card__metric--health {
  background: var(--ui-brand-600, #4f7c82);
}

.progress-chart {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
  margin-top: var(--ui-space-1, 0.25rem);
}

.progress-chart__track {
  height: 14px;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-border-light, rgba(11, 46, 51, 0.08));
  overflow: hidden;
}

.progress-chart__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    var(--ui-brand-600, #4f7c82),
    var(--ui-brand-900, #0b2e33)
  );
  transition: width 0.3s ease;
}

.progress-chart__labels {
  display: flex;
  justify-content: space-between;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.status-bars {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.status-bars__row {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.status-bars__label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-brand-900, #0b2e33);
}

.status-bars__label strong {
  font-size: var(--ui-text-base, 1rem);
}

.status-bars__track {
  background: var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-full, 9999px);
  overflow: hidden;
  height: 0.6rem;
}

.status-bars__fill {
  height: 100%;
  border-radius: inherit;
  transition: width 0.3s ease;
}

.status-bars__fill--todo {
  background: rgba(11, 46, 51, 0.28);
}

.status-bars__fill--progress {
  background: var(--ui-brand-600, #4f7c82);
}

.status-bars__fill--review {
  background: var(--ui-warning, #f59e0b);
}

.status-bars__fill--done {
  background: var(--ui-success, #16a34a);
}

.gauge-chart {
  position: relative;
  padding: var(--ui-space-1, 0.25rem) 0.1rem;
}

.gauge-chart svg {
  width: 100%;
  height: 160px;
}

.gauge-chart__base {
  fill: none;
  stroke: var(--ui-border-light, rgba(11, 46, 51, 0.08));
  stroke-width: 20;
  stroke-linecap: round;
}

.gauge-chart__segment {
  fill: none;
  stroke-width: 20;
  stroke-linecap: butt;
  opacity: 0.25;
}

.gauge-chart__value-path {
  fill: none;
  stroke: var(--ui-brand-600, #4f7c82);
  stroke-width: 20;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.4s ease;
}

.gauge-chart__needle {
  fill: var(--ui-text-strong, #0f172a);
  transition: transform 0.35s ease;
}

.gauge-chart__needle-hub {
  fill: var(--ui-surface, #ffffff);
  stroke: var(--ui-brand-900, #0b2e33);
  stroke-width: 2;
}

.gauge-chart__legend {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--ui-space-1, 0.25rem);
  text-align: left;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  margin-top: var(--ui-space-1, 0.25rem);
}

.gauge-chart__legend-item {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1, 0.25rem);
  white-space: nowrap;
}

.gauge-chart__legend-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--ui-radius-full, 9999px);
  display: inline-block;
}

.gauge-chart__legend-dot--danger {
  background: var(--ui-danger, #ef4444);
}

.gauge-chart__legend-dot--warn {
  background: #f97316;
}

.gauge-chart__legend-dot--caution {
  background: var(--ui-warning, #f59e0b);
}

.gauge-chart__legend-dot--good {
  background: var(--ui-success, #16a34a);
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

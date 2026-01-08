<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import { ROUTE_NAMES } from "@/constants/routes";
import { useProjectIdRoute } from "@/composables/useProjectIdRoute";
import { useProjectShellData } from "@/composables/useProjectShellData";
import ProjectAppShell from "@/layouts/ProjectAppShell.vue";
import { listenProjectChat, type ChatMessage } from "@/services/projectChat";
import {
  listenProjectMembers,
  type ProjectMember,
} from "@/services/projectMembers";
import { listenTimeline, type TimelinePost } from "@/services/timelineService";
import { listenTasks, type TaskDoc } from "@/services/taskService";
import { useAuthStore } from "@/store/auth";
import { getLogger } from "@logtape/logtape";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

type NotificationType = "mention" | "deadline" | "assignment";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  createdAt: number;
  link?: { name: string; params?: Record<string, string> };
};

const logger = getLogger("app.pages.projects.Notifications");
const router = useRouter();
const { user, profile } = useAuthStore();
const { projectId } = useProjectIdRoute();
const tasks = ref<TaskDoc[]>([]);
const timeline = ref<TimelinePost[]>([]);
const chatMessages = ref<ChatMessage[]>([]);
const members = ref<ProjectMember[]>([]);
const permissionState = ref<NotificationPermission>(
  typeof Notification !== "undefined" ? Notification.permission : "default",
);
const notifiedIds = new Set<string>();
let notificationsBootstrapped = false;

let stopTasks: (() => void) | null = null;
let stopTimeline: (() => void) | null = null;
let stopChat: (() => void) | null = null;
let stopMembers: (() => void) | null = null;

// ProjectAppShell用のデータ
const { navItems, sidebarProjects, profileInfo } =
  useProjectShellData(projectId);

const notifications = computed<NotificationItem[]>(() => {
  const me = user.value?.uid;
  const displayName = profile.value?.nickname || profile.value?.fullName || "";
  const list: NotificationItem[] = [];
  const now = Date.now();
  const windowMs = 1000 * 60 * 60 * 48;
  const settings = notificationSettings.value;

  // Deadline alerts
  tasks.value
    .filter((task) => task.dueDate?.seconds)
    .forEach((task) => {
      const due = task.dueDate!.seconds * 1000;
      if (due >= now && due - now <= windowMs && settings.deadline) {
        list.push({
          id: `deadline-${task.id}`,
          title: "締切が近いタスク",
          body: `「${task.title}」の期限が近づいています`,
          type: "deadline",
          createdAt: due,
          link: { name: ROUTE_NAMES.myTasks },
        });
      }
    });

  // Assignment notifications
  tasks.value
    .filter((task) => me && task.assigneeId === me)
    .forEach((task) => {
      const ts =
        (task.updatedAt && "seconds" in task.updatedAt
          ? task.updatedAt.seconds * 1000
          : now) ?? now;
      if (!settings.assignment) return;
      list.push({
        id: `assignment-${task.id}`,
        title: "タスクがアサインされました",
        body: `あなたに「${task.title}」が割り当てられました`,
        type: "assignment",
        createdAt: ts,
        link: { name: ROUTE_NAMES.myTasks },
      });
    });

  // Timeline mentions
  timeline.value.forEach((post) => {
    const mentionTarget = displayName ? `@${displayName}` : "";
    if (
      mentionTarget &&
      post.body?.includes(mentionTarget) &&
      settings.mention
    ) {
      const ts =
        post.createdAt && "seconds" in post.createdAt
          ? post.createdAt.seconds * 1000
          : now;
      list.push({
        id: `timeline-${post.id}`,
        title: "ログでのメンション",
        body: post.body,
        type: "mention",
        createdAt: ts,
        link: {
          name: ROUTE_NAMES.projectDashboard,
          params: { projectId: projectId.value },
        },
      });
    }
  });

  // Chat mentions
  chatMessages.value.forEach((msg) => {
    const mentionIds = msg.mentions || [];
    const mentionTexts = [displayName]
      .filter(Boolean)
      .map((name) => `@${name}`);
    const hasMention =
      (me && mentionIds.includes(me)) ||
      mentionTexts.some((text) => (msg.text || "").includes(text));
    if (hasMention && settings.mention) {
      list.push({
        id: `chat-${msg.id}`,
        title: "スレッドであなたがメンションされました",
        body: msg.text || "メッセージを確認してください",
        type: "mention",
        createdAt: msg.createdAt || now,
        link: {
          name: ROUTE_NAMES.projectThreads,
          params: { projectId: projectId.value },
        },
      });
    }
  });

  return list.sort((a, b) => b.createdAt - a.createdAt);
});

const groupedNotifications = computed(() => {
  const groups: Record<NotificationType, NotificationItem[]> = {
    mention: [],
    deadline: [],
    assignment: [],
  };
  notifications.value.forEach((item) => {
    groups[item.type].push(item);
  });
  return groups;
});

watch(
  notifications,
  (items) => {
    if (typeof Notification === "undefined") return;
    if (permissionState.value !== "granted") return;
    if (!notificationsBootstrapped) {
      items.forEach((item) => notifiedIds.add(item.id));
      notificationsBootstrapped = true;
      return;
    }
    items.forEach((item) => {
      if (notifiedIds.has(item.id)) return;
      notifiedIds.add(item.id);
      try {
        new Notification(item.title, { body: item.body });
      } catch (error) {
        logger.warn`ブラウザ通知の表示に失敗しました: ${error}`;
      }
    });
  },
  { immediate: true },
);

function requestPushPermission() {
  if (typeof Notification === "undefined") return;
  Notification.requestPermission().then((permission) => {
    permissionState.value = permission;
  });
}

type NotificationSettings = {
  mention: boolean;
  deadline: boolean;
  assignment: boolean;
};

const NOTIFICATION_SETTINGS_KEY = "fliro_notification_settings";

const notificationSettings = ref<NotificationSettings>({
  mention: true,
  deadline: true,
  assignment: true,
});

function loadSettings() {
  try {
    const raw = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (raw) {
      notificationSettings.value = {
        ...notificationSettings.value,
        ...(JSON.parse(raw) as NotificationSettings),
      };
    }
  } catch (error) {
    logger.warn`Failed to load notification settings: ${error}`;
  }
}

function persistSettings() {
  try {
    localStorage.setItem(
      NOTIFICATION_SETTINGS_KEY,
      JSON.stringify(notificationSettings.value),
    );
  } catch (error) {
    logger.warn`Failed to save notification settings: ${error}`;
  }
}

function openNotification(item: NotificationItem) {
  if (!item.link) return;
  router.push(item.link);
}

function resetWatchers() {
  stopTasks?.();
  stopTimeline?.();
  stopChat?.();
  stopMembers?.();
  stopTasks = listenTasks(projectId.value, (list) => (tasks.value = list));
  stopTimeline = listenTimeline(
    projectId.value,
    (list) => (timeline.value = list),
  );
  stopChat = listenProjectChat(
    projectId.value,
    (messages) => (chatMessages.value = messages),
    (error) => logger.error`Failed to load chat: ${error}`,
  );
  stopMembers = listenProjectMembers(
    projectId.value,
    (list) => (members.value = list),
  );
}

onMounted(() => {
  loadSettings();
  resetWatchers();
});

watch(projectId, (newId, oldId) => {
  if (!newId || newId === oldId) return;
  resetWatchers();
});

onBeforeUnmount(() => {
  stopTasks?.();
  stopTimeline?.();
  stopChat?.();
  stopMembers?.();
});
</script>

<template>
  <ProjectAppShell
    :project-id="projectId"
    :nav-items="navItems"
    :sidebar-projects="sidebarProjects"
    :profile-info="profileInfo"
    brand-subtitle="通知センター"
  >
    <template #headerTitle>
      <p class="project-app-shell__breadcrumb">プロジェクト &gt; 通知</p>
      <h1 class="project-app-shell__heading">通知センター</h1>
    </template>
    <template #headerActions>
      <AppButton variant="secondary" @click="requestPushPermission">
        {{
          permissionState === "granted"
            ? "ブラウザ通知: ON"
            : "ブラウザ通知を有効化"
        }}
      </AppButton>
    </template>

    <div class="notify-content">
      <section class="notify-settings">
        <header class="notify-settings__header">
          <div>
            <p class="eyebrow">設定</p>
            <h2>通知の種類</h2>
            <p class="muted">バックログ風にON/OFFを切り替えられます。</p>
          </div>
        </header>
        <div class="notify-settings__toggles">
          <label class="toggle">
            <input
              v-model="notificationSettings.mention"
              type="checkbox"
              @change="persistSettings"
            />
            <div>
              <p>メンション通知</p>
              <p class="muted">スレッド/ログの@メンションを通知</p>
            </div>
          </label>
          <label class="toggle">
            <input
              v-model="notificationSettings.deadline"
              type="checkbox"
              @change="persistSettings"
            />
            <div>
              <p>締切通知</p>
              <p class="muted">48時間以内のタスク締切を通知</p>
            </div>
          </label>
          <label class="toggle">
            <input
              v-model="notificationSettings.assignment"
              type="checkbox"
              @change="persistSettings"
            />
            <div>
              <p>アサイン通知</p>
              <p class="muted">自分に割り当てられたタスクの通知</p>
            </div>
          </label>
        </div>
      </section>

      <section class="notify-card">
        <header class="notify-card__header">
          <div>
            <p class="eyebrow">メンション/締切/アサイン</p>
            <h2>最近の通知</h2>
            <p class="muted">
              スレッド、ログ、タスクからの重要なお知らせをまとめました。
            </p>
          </div>
        </header>

        <div class="notify-grid">
          <div class="notify-column">
            <h3>メンション</h3>
            <p class="muted">あなた宛てのメッセージ</p>
            <div v-if="!groupedNotifications.mention.length" class="empty">
              メンションはありません。
            </div>
            <article
              v-for="item in groupedNotifications.mention"
              :key="item.id"
              class="notify-item"
              @click="openNotification(item)"
            >
              <div class="notify-item__meta">
                <span class="chip">mention</span>
                <span class="muted">{{
                  new Date(item.createdAt).toLocaleString()
                }}</span>
              </div>
              <p class="notify-item__title">{{ item.title }}</p>
              <p class="notify-item__body">{{ item.body }}</p>
            </article>
          </div>

          <div class="notify-column">
            <h3>締切</h3>
            <p class="muted">期限が迫るタスク</p>
            <div v-if="!groupedNotifications.deadline.length" class="empty">
              締切通知はありません。
            </div>
            <article
              v-for="item in groupedNotifications.deadline"
              :key="item.id"
              class="notify-item"
              @click="openNotification(item)"
            >
              <div class="notify-item__meta">
                <span class="chip chip--accent">deadline</span>
                <span class="muted">{{
                  new Date(item.createdAt).toLocaleString()
                }}</span>
              </div>
              <p class="notify-item__title">{{ item.title }}</p>
              <p class="notify-item__body">{{ item.body }}</p>
            </article>
          </div>

          <div class="notify-column">
            <h3>アサイン</h3>
            <p class="muted">担当になったタスク</p>
            <div v-if="!groupedNotifications.assignment.length" class="empty">
              アサイン通知はありません。
            </div>
            <article
              v-for="item in groupedNotifications.assignment"
              :key="item.id"
              class="notify-item"
              @click="openNotification(item)"
            >
              <div class="notify-item__meta">
                <span class="chip chip--soft">assignment</span>
                <span class="muted">{{
                  new Date(item.createdAt).toLocaleString()
                }}</span>
              </div>
              <p class="notify-item__title">{{ item.title }}</p>
              <p class="notify-item__body">{{ item.body }}</p>
            </article>
          </div>
        </div>
      </section>
    </div>
  </ProjectAppShell>
</template>

<style scoped>
.notify-content {
  padding: 0 var(--ui-space-6, 1.5rem) var(--ui-space-8, 2rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.notify-card {
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-5, 1.25rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.notify-settings {
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-5, 1.25rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.notify-settings__toggles {
  display: grid;
  gap: var(--ui-space-3, 0.75rem);
}

.toggle {
  display: flex;
  gap: var(--ui-space-3, 0.75rem);
  align-items: center;
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem);
  transition: var(--ui-transition-colors);
}

.toggle:hover {
  border-color: var(--ui-border, rgba(11, 46, 51, 0.12));
}

.toggle input {
  width: 18px;
  height: 18px;
  accent-color: var(--ui-brand-600, #4f7c82);
}

.toggle p {
  margin: 0;
}

.toggle p:first-of-type {
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.notify-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.notify-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--ui-space-4, 1rem);
}

.notify-column h3 {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.muted {
  color: var(--ui-text-muted, #64748b);
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
}

.eyebrow {
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ui-text-muted, #64748b);
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
}

.notify-item {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
  cursor: pointer;
  background: var(--ui-surface, #ffffff);
  transition: var(--ui-transition-all);
}

.notify-item:hover {
  border-color: var(--ui-border, rgba(11, 46, 51, 0.12));
  box-shadow: var(--ui-shadow-sm);
}

.notify-item__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--ui-text-sm, 0.875rem);
}

.notify-item__title {
  margin: 0;
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.notify-item__body {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  line-height: var(--ui-leading-normal, 1.5);
  font-size: var(--ui-text-sm, 0.875rem);
}

.chip {
  border-radius: var(--ui-radius-full, 9999px);
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
  background: var(--ui-border-light, rgba(11, 46, 51, 0.08));
  color: var(--ui-brand-900, #0b2e33);
}

.chip--accent {
  background: var(--ui-success-light, #dcfce7);
  color: var(--ui-success, #16a34a);
}

.chip--soft {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text-muted, #64748b);
}

.empty {
  border: 1px dashed var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  background: var(--ui-surface-muted, #f1f5f9);
  text-align: center;
  font-size: var(--ui-text-sm, 0.875rem);
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

@media (max-width: 768px) {
  .notify-content {
    padding: 0 var(--ui-space-4, 1rem) var(--ui-space-8, 2rem);
  }
}
</style>

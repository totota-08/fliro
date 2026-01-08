<script setup lang="ts">
import UserAvatar from "@/components/common/UserAvatar.vue";
import TaskForm from "@/components/tasks/TaskForm.vue";
import TaskStatusBadge from "@/components/ui/TaskStatusBadge.vue";
import { useProjectAccess } from "@/composables/useProjectAccess";
import { ProjectPermission } from "@/constants/permissions";
import { ROUTE_NAMES } from "@/constants/routes";
import { fetchProject } from "@/firebase/projectService";
import {
  listenProjectMembers,
  type ProjectMember,
} from "@/services/projectMembers";
import {
  listenTaskDiscussion,
  sendTaskDiscussionMessage,
  type TaskDiscussionMessage,
} from "@/services/taskDiscussionService";
import {
  listenTask,
  updateTask,
  type TaskDoc,
  type CreateTaskPayload,
} from "@/services/taskService";
import {
  listenTaskCategories,
  type TaskCategory,
} from "@/services/taskCategoryService";
import { useAuthStore } from "@/store/auth";
import type { ProjectDoc } from "@/types/project";
import { getLogger } from "@logtape/logtape";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const logger = getLogger("app.pages.projects.ProjectTaskDetailPage");
const route = useRoute();
const router = useRouter();
const { user, profile } = useAuthStore();

const projectId = ref(String(route.params.projectId));
const taskId = ref(String(route.params.taskId));
const project = ref<ProjectDoc | null>(null);

// 権限チェック
const { can } = useProjectAccess(projectId);
const canEditTask = computed(() => can(ProjectPermission.MANAGE_TASKS));

const task = ref<TaskDoc | null>(null);
const messages = ref<TaskDiscussionMessage[]>([]);
const input = ref("");
const sending = ref(false);
const messageLimit = ref(20);
const categories = ref<TaskCategory[]>([]);
const members = ref<ProjectMember[]>([]);
const isEditModalOpen = ref(false);
const isSubmitting = ref(false);

let stopTask: (() => void) | null = null;
let stopDiscussion: (() => void) | null = null;
let stopCategories: (() => void) | null = null;
let stopMembers: (() => void) | null = null;

// Computed for TaskForm
const formCategories = computed(() =>
  categories.value.map((c) => ({ id: c.id, name: c.name })),
);

const formMembers = computed(() =>
  members.value.map((m) => ({
    id: m.userId,
    name: m.displayName || m.nickname || m.fullName || m.userId,
  })),
);

// Derived State
const decisions = computed(() =>
  messages.value.filter((m) => m.type === "decision"),
);
const discussionMessages = computed(() => messages.value); // All messages in discussion for now
const visibleMessages = computed(() => {
  const list = discussionMessages.value;
  if (list.length <= messageLimit.value) return list;
  return list.slice(-messageLimit.value);
});

// Activity Log Simulation
const activityLog = computed(() => {
  if (!task.value) return [];
  const logs = [];
  if (task.value.createdAt) {
    logs.push({
      label: "Created",
      date: task.value.createdAt.seconds * 1000,
      user: task.value.createdBy, // We only have ID, simpler to just say "Created"
    });
  }
  if (
    task.value.updatedAt &&
    task.value.updatedAt.seconds !== task.value.createdAt?.seconds
  ) {
    logs.push({
      label: "Updated",
      date: task.value.updatedAt.seconds * 1000,
    });
  }
  return logs.sort((a, b) => b.date - a.date);
});

const categoryLabel = computed(() => {
  if (!task.value?.categoryId) return "未分類";
  const matched = categories.value.find(
    (category) => category.id === task.value?.categoryId,
  );
  return matched?.name || task.value?.categoryName || "未分類";
});

// Methods
function goBack() {
  if (route.query.from === "dashboard") {
    router.push({
      name: ROUTE_NAMES.projectDashboard,
      params: { projectId: projectId.value },
    });
  } else {
    router.back();
  }
}

function formatDate(dateWrapper: any) {
  if (!dateWrapper?.seconds) return "";
  return new Date(dateWrapper.seconds * 1000).toLocaleDateString();
}

async function handleSendMessage() {
  const text = input.value.trim();
  if (!text || !user.value || !task.value) return;

  sending.value = true;
  try {
    await sendTaskDiscussionMessage(projectId.value, taskId.value, {
      text,
      senderId: user.value!.uid,
      senderName: profile.value?.nickname || profile.value?.fullName || "User",
    });
    input.value = "";
  } catch (e) {
    logger.error`Failed to send message: ${e}`;
  } finally {
    sending.value = false;
  }
}

function handleComposerKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
}

function showMoreMessages() {
  messageLimit.value += 20;
}

function openEditModal() {
  isEditModalOpen.value = true;
}

function closeEditModal() {
  isEditModalOpen.value = false;
}

async function handleEditSubmit(payload: CreateTaskPayload) {
  if (!user.value || !task.value) return;

  isSubmitting.value = true;
  try {
    await updateTask(projectId.value, taskId.value, payload, {
      userId: user.value.uid,
      actorName: profile.value?.nickname || profile.value?.fullName || "User",
      origin: "ui",
    });
    closeEditModal();
  } catch (e) {
    logger.error`Failed to update task: ${e}`;
  } finally {
    isSubmitting.value = false;
  }
}

function isDecideCommand(text: string | undefined) {
  if (!text) return false;
  return text.trim().startsWith("/decide");
}

// Lifecycle
onMounted(async () => {
  project.value = await fetchProject(projectId.value);

  stopTask = listenTask(projectId.value, taskId.value, (doc) => {
    task.value = doc;
  });

  stopDiscussion = listenTaskDiscussion(
    projectId.value,
    taskId.value,
    (msgs) => {
      messages.value = msgs;
    },
  );

  stopCategories = listenTaskCategories(projectId.value, (list) => {
    categories.value = list;
  });

  stopMembers = listenProjectMembers(projectId.value, (list) => {
    members.value = list;
  });
});

onBeforeUnmount(() => {
  stopTask?.();
  stopDiscussion?.();
  stopCategories?.();
  stopMembers?.();
});
</script>

<template>
  <div class="task-page">
    <div class="task-container">
      <!-- Header -->
      <header class="task-header">
        <button @click="goBack" class="back-link">← ダッシュボード</button>
        <div class="header-content" v-if="task">
          <div class="title-row">
            <h1 class="task-title">{{ task.title }}</h1>
            <TaskStatusBadge :status="task.status" />
            <button
              v-if="canEditTask"
              class="edit-button"
              type="button"
              @click="openEditModal"
            >
              編集
            </button>
          </div>
          <div class="meta-row meta-row-mobile">
            <div class="meta-item">
              <span class="label">担当</span>
              <span class="value">{{ task.assigneeName || "未割り当て" }}</span>
            </div>
            <div class="meta-item">
              <span class="label">期限</span>
              <span class="value">{{
                formatDate(task.dueDate) || "期限なし"
              }}</span>
            </div>
            <div class="meta-item">
              <span class="label">カテゴリ</span>
              <span class="value">{{ categoryLabel }}</span>
            </div>
          </div>
        </div>
      </header>

      <main class="task-content">
        <div class="task-grid">
          <div class="main-column">
            <!-- 1. Overview -->
            <section class="section overview">
              <h2 class="section-title">概要</h2>
              <div class="section-body">
                <p v-if="task?.description" class="description">
                  {{ task.description }}
                </p>
                <p v-else class="empty-text">説明はまだありません。</p>
              </div>
            </section>

            <!-- 2. Decision -->
            <section
              class="section decision"
              :class="{ 'has-decisions': decisions.length > 0 }"
            >
              <h2 class="section-title">決定</h2>
              <div class="section-body decision-list">
                <div v-if="decisions.length === 0" class="bot-message">
                  🤖 決定はまだありません。<code>/decide</code> で記録できます。
                </div>
                <div v-for="d in decisions" :key="d.id" class="decision-card">
                  <div class="decision-icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      role="presentation"
                      focusable="false"
                      class="decision-icon-svg"
                    >
                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="4"
                        ry="4"
                        fill="url(#decisionGradient)"
                      />
                      <path
                        d="M17 9l-6 6-3-3"
                        fill="none"
                        stroke="#ffffff"
                        stroke-width="2.2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <defs>
                        <linearGradient
                          id="decisionGradient"
                          x1="3"
                          y1="3"
                          x2="21"
                          y2="21"
                          gradientUnits="userSpaceOnUse"
                        >
                          <stop stop-color="#16a34a" />
                          <stop offset="1" stop-color="#0d9488" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <div class="decision-content">
                    <p class="decision-text">{{ d.text }}</p>
                    <span class="decision-meta"
                      >{{ d.senderName }} •
                      {{
                        d.createdAt
                          ? new Date(d.createdAt).toLocaleDateString()
                          : ""
                      }}</span
                    >
                  </div>
                </div>
              </div>
            </section>

            <!-- 3. Discussion -->
            <section class="section discussion">
              <p class="discussion-label">議論のログ</p>
              <div class="section-body">
                <div class="messages">
                  <button
                    v-if="discussionMessages.length > visibleMessages.length"
                    class="load-more"
                    type="button"
                    @click="showMoreMessages"
                  >
                    古いメッセージを表示（+20）
                  </button>
                  <div
                    v-for="msg in visibleMessages"
                    :key="msg.id"
                    class="msg-row"
                  >
                    <UserAvatar
                      :name="msg.senderName"
                      :size="40"
                      class="avatar"
                    />
                    <div
                      class="msg-body"
                      :class="{ 'system-log': isDecideCommand(msg.text) }"
                    >
                      <div class="msg-header">
                        <span class="sender">{{ msg.senderName }}</span>
                        <span class="time">{{
                          msg.createdAt
                            ? new Date(msg.createdAt).toLocaleString()
                            : ""
                        }}</span>
                      </div>
                      <div v-if="!isDecideCommand(msg.text)" class="msg-text">
                        {{ msg.text }}
                      </div>
                      <div v-else class="system-text">決定を記録しました</div>
                    </div>
                  </div>
                </div>
                <div class="composer-shell">
                  <div class="composer">
                    <textarea
                      v-model="input"
                      @keydown="handleComposerKeydown"
                      class="msg-input msg-textarea"
                      placeholder="メッセージを入力… /decide で決定を記録"
                      rows="2"
                    ></textarea>
                    <button
                      class="send-button"
                      type="button"
                      :disabled="!input.trim() || sending"
                      @click="handleSendMessage"
                    >
                      送信
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside class="sidebar">
            <div class="sidebar-inner">
              <section class="section summary-card">
                <h2 class="section-title">サマリー</h2>
                <div v-if="task" class="summary-grid">
                  <div class="summary-item">
                    <span class="label">ステータス</span>
                    <span class="summary-value">
                      <TaskStatusBadge :status="task.status" />
                    </span>
                  </div>
                  <div class="summary-item">
                    <span class="label">担当</span>
                    <span class="summary-value">{{
                      task.assigneeName || "未割り当て"
                    }}</span>
                  </div>
                  <div class="summary-item">
                    <span class="label">期限</span>
                    <span class="summary-value">{{
                      formatDate(task.dueDate) || "期限なし"
                    }}</span>
                  </div>
                </div>
                <p v-else class="empty-text">タスク詳細を読み込み中...</p>
              </section>

              <section class="section activity sidebar-card">
                <h2 class="section-title">アクティビティログ</h2>
                <div class="section-body">
                  <ul class="activity-list">
                    <li
                      v-for="(log, i) in activityLog"
                      :key="i"
                      class="activity-item"
                    >
                      <span class="activity-dot"></span>
                      <span class="activity-label">{{ log.label }}</span>
                      <span class="activity-date">{{
                        new Date(log.date).toLocaleString()
                      }}</span>
                    </li>
                    <li
                      v-if="activityLog.length === 0"
                      class="activity-item empty-activity"
                    >
                      <span class="activity-dot"></span>
                      <span class="activity-label"
                        >まだアクティビティはありません</span
                      >
                    </li>
                  </ul>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </main>
    </div>

    <!-- Edit Modal -->
    <Teleport to="body">
      <div
        v-if="isEditModalOpen"
        class="modal-overlay"
        @click.self="closeEditModal"
      >
        <TaskForm
          :task="task"
          :categories="formCategories"
          :members="formMembers"
          :submitting="isSubmitting"
          @submit="handleEditSubmit"
          @cancel="closeEditModal"
        />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Page Layout */
.task-page {
  min-height: 100vh;
  background: linear-gradient(120deg, var(--ui-bg), var(--ui-brand-100));
  color: var(--ui-text);
  font-family: var(--ui-font-sans);
  display: flex;
  justify-content: center;
  padding: var(--ui-space-10) var(--ui-space-5);
}

.task-container {
  width: 100%;
  max-width: 1152px;
  background: var(--ui-surface);
  border-radius: var(--ui-radius-2xl);
  box-shadow: var(--ui-shadow-xl);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Header */
.task-header {
  padding: var(--ui-space-8) var(--ui-space-10);
  border-bottom: 1px solid var(--ui-border-light);
  background: var(--ui-surface);
}

.header-content {
  margin-top: var(--ui-space-4);
}

.back-link {
  background: transparent;
  border: 1px solid transparent;
  color: var(--ui-brand-600);
  cursor: pointer;
  padding: var(--ui-space-2) var(--ui-space-3);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-semibold);
  border-radius: var(--ui-radius-sm);
  transition: var(--ui-transition-all);
  display: inline-flex;
  align-items: center;
}
.back-link:hover {
  background: rgba(79, 124, 130, 0.1);
  color: var(--ui-brand-900);
}

.title-row {
  display: flex;
  align-items: center;
  gap: var(--ui-space-4);
  margin-bottom: var(--ui-space-5);
}

.task-title {
  font-size: var(--ui-text-3xl);
  font-weight: var(--ui-font-bold);
  color: var(--ui-text-strong);
  margin: 0;
  letter-spacing: -0.5px;
  line-height: var(--ui-leading-tight);
}

.meta-row {
  display: flex;
  gap: var(--ui-space-6);
  flex-wrap: wrap;
  align-items: center;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.meta-item .label,
.summary-item .label {
  font-size: var(--ui-text-xs);
  text-transform: uppercase;
  color: var(--ui-text-muted);
  font-weight: var(--ui-font-bold);
  letter-spacing: 0.5px;
}

.meta-item .value {
  font-size: var(--ui-text-base);
  color: var(--ui-text);
  font-weight: var(--ui-font-medium);
}

.meta-row-mobile {
  margin-top: var(--ui-space-2);
}

@media (min-width: 1024px) {
  .meta-row-mobile {
    display: none;
  }
}

/* Content Body */
.task-content {
  padding: var(--ui-space-10);
}

.task-grid {
  display: grid;
  gap: var(--ui-space-8);
}

@media (min-width: 1024px) {
  .task-grid {
    grid-template-columns: minmax(0, 1fr) 320px;
    align-items: start;
  }
}

.main-column {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-10);
}

.sidebar {
  width: 100%;
}

.sidebar-inner {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6);
}

@media (min-width: 1024px) {
  .sidebar-inner {
    position: sticky;
    top: var(--ui-space-6);
  }
}

.summary-card,
.sidebar-card {
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  padding: var(--ui-space-5);
  box-shadow: var(--ui-shadow-md);
}

.summary-grid {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

.summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
}

.summary-value {
  font-size: var(--ui-text-base);
  color: var(--ui-text-strong);
  font-weight: var(--ui-font-semibold);
}

/* Sections */
.section-title {
  font-size: var(--ui-text-lg);
  font-weight: var(--ui-font-bold);
  color: var(--ui-text-strong);
  margin: 0 0 var(--ui-space-4) 0;
}

.section-body {
  line-height: var(--ui-leading-relaxed);
}

.discussion-label {
  margin: 0 0 var(--ui-space-3);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-semibold);
  color: var(--ui-text-muted);
}

.description {
  font-size: var(--ui-text-base);
  color: var(--ui-text);
  white-space: pre-wrap;
}

.empty-text {
  color: var(--ui-text-muted);
  font-style: italic;
}

/* Decision Section Emphasis */
.section.decision {
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  padding: var(--ui-space-5);
  position: relative;
  overflow: hidden;
}

.section.decision::before {
  content: "";
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 4px;
  border-radius: 4px;
  background: var(--ui-success-light);
}

.section.decision.has-decisions::before {
  background: linear-gradient(180deg, var(--ui-success), var(--ui-brand-600));
  opacity: 0.2;
}

.section.decision .section-title {
  color: var(--ui-success-text);
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  margin-left: var(--ui-space-1);
}

.decision-list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  margin-bottom: var(--ui-space-2);
  margin-left: var(--ui-space-1);
}

.bot-message {
  background: var(--ui-surface-muted);
  padding: var(--ui-space-3);
  border-radius: var(--ui-radius-sm);
  color: var(--ui-text-strong);
  font-size: var(--ui-text-sm);
  border: 1px solid var(--ui-border);
}

.decision-card {
  display: flex;
  gap: var(--ui-space-3);
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  padding: var(--ui-space-3);
  border-radius: var(--ui-radius-md);
  box-shadow: none;
  align-items: flex-start;
}

.decision-icon {
  font-size: var(--ui-text-2xl);
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
}

.decision-icon-svg {
  width: 24px;
  height: 24px;
}

.decision-text {
  margin: 0 0 var(--ui-space-2) 0;
  font-weight: var(--ui-font-semibold);
  color: var(--ui-success-text);
  font-size: var(--ui-text-base);
}

.decision-meta {
  font-size: var(--ui-text-sm);
  color: var(--ui-success);
  opacity: 0.8;
  font-weight: var(--ui-font-medium);
}

/* Discussion */
.messages {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6);
  margin-bottom: var(--ui-space-6);
  padding-bottom: var(--ui-space-3);
  max-height: 60vh;
  overflow-y: auto;
  padding-right: var(--ui-space-1);
}

.load-more {
  align-self: flex-start;
  padding: var(--ui-space-1) var(--ui-space-3);
  border-radius: var(--ui-radius-sm);
  border: 1px solid var(--ui-border);
  background: var(--ui-surface-muted);
  color: var(--ui-text);
  font-weight: var(--ui-font-semibold);
  font-size: var(--ui-text-sm);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.load-more:hover {
  background: var(--ui-brand-100);
  border-color: var(--ui-border-strong);
}

.msg-row {
  display: flex;
  gap: var(--ui-space-4);
  align-items: flex-start;
}

.msg-row .avatar {
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: var(--ui-radius-full);
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}

.msg-row :deep(.avatar-initials) {
  font-weight: var(--ui-font-bold);
  white-space: nowrap;
  line-height: 1;
}

.msg-body {
  flex: 1;
  max-width: 70ch;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  padding: var(--ui-space-3) var(--ui-space-4);
}

.msg-header {
  display: flex;
  align-items: baseline;
  gap: var(--ui-space-2);
  margin-bottom: var(--ui-space-1);
}

.msg-header .sender {
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-bold);
  color: var(--ui-text-strong);
}

.msg-header .time {
  font-size: var(--ui-text-xs);
  color: var(--ui-text-muted);
}

.msg-text {
  font-size: var(--ui-text-base);
  line-height: var(--ui-leading-relaxed);
  color: var(--ui-text);
}

.system-log {
  background: var(--ui-surface-muted);
  border-color: var(--ui-border);
}

.system-text {
  font-size: var(--ui-text-sm);
  color: var(--ui-text-muted);
  font-weight: var(--ui-font-semibold);
}

.composer-shell {
  position: sticky;
  bottom: 0;
  background: var(--ui-bg);
  margin: 0;
  padding: var(--ui-space-4) 0 var(--ui-space-2) 0;
  border-top: 1px solid var(--ui-border);
  box-shadow: var(--ui-shadow-sm);
}

.composer {
  display: flex;
  gap: var(--ui-space-3);
  align-items: flex-end;
  background: var(--ui-surface);
  padding: var(--ui-space-3);
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-border);
  box-shadow: var(--ui-shadow-sm);
}

.msg-input {
  width: 100%;
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  font-size: var(--ui-text-base);
  outline: none;
  background: var(--ui-surface);
  transition: var(--ui-transition-all);
}

.msg-textarea {
  resize: none;
  min-height: 48px;
  line-height: var(--ui-leading-normal);
}

.msg-input:focus {
  border-color: var(--ui-border-focus);
  box-shadow: var(--ui-ring-focus);
}

.msg-input::placeholder {
  color: var(--ui-text-placeholder);
}

.send-button {
  min-width: 96px;
  height: 44px;
  padding: 0 var(--ui-space-5);
  border: none;
  border-radius: var(--ui-radius-md);
  font-size: var(--ui-text-base);
  font-weight: var(--ui-font-bold);
  color: var(--ui-text-inverse);
  background: var(--ui-brand-600);
  cursor: pointer;
  transition: var(--ui-transition-all);
  box-shadow: var(--ui-shadow-btn-primary);
}

.send-button:hover:enabled {
  transform: translateY(-1px);
  background: var(--ui-brand-900);
  box-shadow: var(--ui-shadow-btn-hover);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

/* Activity Log */
.activity-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6);
}
.activity-list::before {
  content: "";
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 3px;
  width: 2px;
  background: var(--ui-surface-muted);
}

.activity-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--ui-space-4);
  font-size: var(--ui-text-sm);
  color: var(--ui-text-muted);
  padding-left: var(--ui-space-4);
}

.activity-dot {
  position: absolute;
  left: 0;
  width: 8px;
  height: 8px;
  background: var(--ui-border-strong);
  border-radius: 50%;
  border: 2px solid var(--ui-surface);
  box-shadow: 0 0 0 1px var(--ui-border-strong);
}

.activity-label {
  font-weight: var(--ui-font-semibold);
  color: var(--ui-text);
}

.empty-activity {
  color: var(--ui-text-muted);
}

.empty-activity .activity-label {
  color: var(--ui-text-muted);
}

.empty-activity .activity-dot {
  background: var(--ui-border);
  box-shadow: 0 0 0 1px var(--ui-border);
}

/* Edit Button */
.edit-button {
  padding: var(--ui-space-1) var(--ui-space-4);
  border-radius: var(--ui-radius-full);
  border: 1px solid var(--ui-border);
  background: var(--ui-surface);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-semibold);
  color: var(--ui-brand-500);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.edit-button:hover {
  background: var(--ui-surface-muted);
  border-color: var(--ui-brand-500);
}

.edit-button:focus {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

/* Modal Overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--ui-overlay-bg);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--ui-z-modal);
  padding: var(--ui-space-4);
}

@media (prefers-reduced-motion: no-preference) {
  .modal-overlay {
    animation: fadeIn 0.15s ease-out;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>

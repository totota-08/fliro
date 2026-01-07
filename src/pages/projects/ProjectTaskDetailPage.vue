<script setup lang="ts">
import UserAvatar from "@/components/common/UserAvatar.vue";
import TaskForm from "@/components/tasks/TaskForm.vue";
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
  type TaskStatus,
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

function formatStatus(status: TaskStatus) {
  const map: Record<TaskStatus, string> = {
    todo: "未着手",
    "in-progress": "進行中",
    review: "レビュー",
    done: "完了",
  };
  return map[status] || status;
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
            <span class="status-badge" :class="task.status">{{
              formatStatus(task.status)
            }}</span>
            <button class="edit-button" type="button" @click="openEditModal">
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
                      <span class="status-badge" :class="task.status">
                        {{ formatStatus(task.status) }}
                      </span>
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
  background: linear-gradient(120deg, #f5fcff, #eef6f8);
  color: #1a1a1a;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial,
    sans-serif;
  display: flex;
  justify-content: center;
  padding: 40px 20px;
}

.task-container {
  width: 100%;
  max-width: 1152px;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Header */
.task-header {
  padding: 32px 40px;
  border-bottom: 1px solid #f0f0f0;
  background: #fff;
}

.header-content {
  margin-top: 16px;
}

.back-link {
  background: transparent;
  border: 1px solid transparent;
  color: #4f7c82;
  cursor: pointer;
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
}
.back-link:hover {
  background: rgba(79, 124, 130, 0.1);
  color: #0b2e33;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.task-title {
  font-size: 28px;
  font-weight: 800;
  color: #1e293b;
  margin: 0;
  letter-spacing: -0.5px;
  line-height: 1.3;
}

.status-badge {
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 999px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
/* Default to soft green as requested for generic badges if needed, or stick to map */
.status-badge {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #dcfce7;
}
/* Overrides */
.status-badge.todo {
  background: #f8fafc;
  color: #64748b;
  border-color: #e2e8f0;
}
.status-badge.in-progress {
  background: #eff6ff;
  color: #2563eb;
  border-color: #dbeafe;
}
.status-badge.review {
  background: #fff7ed;
  color: #ea580c;
  border-color: #ffedd5;
}
.status-badge.done {
  background: #f0fdf4;
  color: #166534;
  border-color: #dcfce7;
}

.meta-row {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  align-items: center;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.meta-item .label,
.summary-item .label {
  font-size: 12px;
  text-transform: uppercase;
  color: #94a3b8;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.meta-item .value {
  font-size: 15px;
  color: #334155;
  font-weight: 500;
}

.meta-row-mobile {
  margin-top: 8px;
}

@media (min-width: 1024px) {
  .meta-row-mobile {
    display: none;
  }
}

/* Content Body */
.task-content {
  padding: 40px;
}

.task-grid {
  display: grid;
  gap: 32px;
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
  gap: 40px;
}

.sidebar {
  width: 100%;
}

.sidebar-inner {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

@media (min-width: 1024px) {
  .sidebar-inner {
    position: sticky;
    top: 24px;
  }
}

.summary-card,
.sidebar-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
}

.summary-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.summary-value {
  font-size: 15px;
  color: #1f2937;
  font-weight: 600;
}

/* Sections */
.section-title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 16px 0;
}

.section-body {
  line-height: 1.6;
}

.discussion-label {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
}

.description {
  font-size: 16px;
  color: #475569;
  white-space: pre-wrap;
}

.empty-text {
  color: #94a3b8;
  font-style: italic;
}

/* Decision Section Emphasis */
.section.decision {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 18px;
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
  background: #e2f5ee;
}

.section.decision.has-decisions::before {
  background: linear-gradient(180deg, #22c55e, #0d9488);
  opacity: 0.2;
}

.section.decision .section-title {
  color: #14532d;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 6px;
}

.decision-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 8px;
  margin-left: 6px;
}

.bot-message {
  background: #f8fafc;
  padding: 14px;
  border-radius: 8px;
  color: #0f172a;
  font-size: 14px;
  border: 1px solid #e2e8f0;
}

.decision-card {
  display: flex;
  gap: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  padding: 14px;
  border-radius: 10px;
  box-shadow: none;
  align-items: flex-start;
}

.decision-icon {
  font-size: 24px;
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
  margin: 0 0 8px 0;
  font-weight: 600;
  color: #14532d;
  font-size: 16px;
}

.decision-meta {
  font-size: 13px;
  color: #15803d;
  opacity: 0.8;
  font-weight: 500;
}

/* Discussion */
.messages {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 24px;
  padding-bottom: 12px;
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 6px;
}

.load-more {
  align-self: flex-start;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;
}

.load-more:hover {
  background: #eef2f7;
  border-color: #cbd5e1;
}

.msg-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.msg-row .avatar {
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 9999px;
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}

.msg-row :deep(.avatar-initials) {
  font-weight: 700;
  white-space: nowrap;
  line-height: 1;
}

.msg-body {
  flex: 1;
  max-width: 70ch;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 14px;
}

.msg-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 6px;
}

.msg-header .sender {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.msg-header .time {
  font-size: 12px;
  color: #94a3b8;
}

.msg-text {
  font-size: 15px;
  line-height: 1.6;
  color: #475569;
}

.system-log {
  background: #f8fafc;
  border-color: #e2e8f0;
}

.system-text {
  font-size: 14px;
  color: #64748b;
  font-weight: 600;
}

.composer-shell {
  position: sticky;
  bottom: 0;
  background: #f9fdfb;
  margin: 0;
  padding: 16px 0 8px 0;
  border-top: 1px solid #e2e8f0;
  box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.02);
}

.composer {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  background: #fff;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.02);
}

.msg-input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 15px;
  outline: none;
  background: #fff;
  transition: all 0.2s;
}

.msg-textarea {
  resize: none;
  min-height: 48px;
  line-height: 1.5;
}

.msg-input:focus {
  border-color: #0d9488; /* Teal-600 */
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12);
}

.msg-input::placeholder {
  color: #94a3b8;
}

.send-button {
  min-width: 96px;
  height: 44px;
  padding: 0 18px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #0d9488, #14b8a6);
  cursor: pointer;
  transition:
    transform 0.1s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
  box-shadow: 0 10px 24px rgba(13, 148, 136, 0.2);
}

.send-button:hover:enabled {
  transform: translateY(-1px);
  box-shadow: 0 12px 26px rgba(13, 148, 136, 0.24);
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
  gap: 24px;
}
.activity-list::before {
  content: "";
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 3px;
  width: 2px;
  background: #f1f5f9;
}

.activity-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
  color: #64748b;
  padding-left: 16px;
}

.activity-dot {
  position: absolute;
  left: 0;
  width: 8px;
  height: 8px;
  background: #cbd5e1;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #cbd5e1;
}

.activity-label {
  font-weight: 600;
  color: #475569;
}

.empty-activity {
  color: #94a3b8;
}

.empty-activity .activity-label {
  color: #94a3b8;
}

.empty-activity .activity-dot {
  background: #e2e8f0;
  box-shadow: 0 0 0 1px #e2e8f0;
}

/* Edit Button */
.edit-button {
  padding: 6px 16px;
  border-radius: var(--ui-radius-full, 9999px);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  background: var(--ui-surface, #ffffff);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-brand-500, #4f7c82);
  cursor: pointer;
  transition: var(--ui-transition-colors, all 0.15s ease);
}

.edit-button:hover {
  background: var(--ui-surface-muted, #f1f5f9);
  border-color: var(--ui-brand-500, #4f7c82);
}

.edit-button:focus {
  outline: none;
  box-shadow: var(--ui-ring-focus, 0 0 0 3px rgba(79, 124, 130, 0.2));
}

/* Modal Overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: var(--ui-space-4, 1rem);
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

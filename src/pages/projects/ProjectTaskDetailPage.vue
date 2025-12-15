<script setup lang="ts">
import UserAvatar from "@/components/common/UserAvatar.vue";
import { ROUTE_NAMES } from "@/constants/routes";
import { fetchProject } from "@/firebase/projectService";
import {
  listenTaskDiscussion,
  sendTaskDiscussionMessage,
  type TaskDiscussionMessage,
} from "@/services/taskDiscussionService";
import {
  listenTask,
  type TaskDoc,
  type TaskStatus,
} from "@/services/taskService";
import { useAuthStore } from "@/store/auth";
import type { ProjectDoc } from "@/types/project";
import { getLogger } from "@logtape/logtape";
import { storeToRefs } from "pinia";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const logger = getLogger("app.pages.projects.ProjectTaskDetailPage");
const route = useRoute();
const router = useRouter();
const { user, profile } = storeToRefs(useAuthStore());

const projectId = ref(String(route.params.projectId));
const taskId = ref(String(route.params.taskId));
const project = ref<ProjectDoc | null>(null);
const task = ref<TaskDoc | null>(null);
const messages = ref<TaskDiscussionMessage[]>([]);
const input = ref("");
const sending = ref(false);

let stopTask: (() => void) | null = null;
let stopDiscussion: (() => void) | null = null;

// Derived State
const decisions = computed(() =>
  messages.value.filter((m) => m.type === "decision"),
);
const discussionMessages = computed(() => messages.value); // All messages in discussion for now

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

// Methods
function goBack() {
  router.push({
    name: ROUTE_NAMES.projectDashboard,
    params: { projectId: projectId.value },
  });
}

function formatStatus(status: TaskStatus) {
  const map: Record<TaskStatus, string> = {
    todo: "To Do",
    "in-progress": "In Progress",
    review: "Review",
    done: "Done",
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
      senderId: user.value.uid,
      senderName: profile.value?.nickname || profile.value?.fullName || "User",
    });
    input.value = "";
  } catch (e) {
    logger.error`Failed to send message: ${e}`;
  } finally {
    sending.value = false;
  }
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
});

onBeforeUnmount(() => {
  stopTask?.();
  stopDiscussion?.();
});
</script>

<template>
  <div class="task-page">
    <div class="task-container">
      <!-- Header -->
      <header class="task-header">
        <button @click="goBack" class="back-link">← Dashboard</button>
        <div class="header-content" v-if="task">
          <div class="title-row">
            <h1 class="task-title">{{ task.title }}</h1>
            <span class="status-badge" :class="task.status">{{
              formatStatus(task.status)
            }}</span>
          </div>
          <div class="meta-row">
            <div class="meta-item">
              <span class="label">Assignee</span>
              <span class="value">{{ task.assigneeName || "Unassigned" }}</span>
            </div>
            <div class="meta-item">
              <span class="label">Due Date</span>
              <span class="value">{{
                formatDate(task.dueDate) || "No Date"
              }}</span>
            </div>
          </div>
        </div>
      </header>

      <main class="task-content">
        <!-- 1. Overview -->
        <section class="section overview">
          <h2 class="section-title">Overview</h2>
          <div class="section-body">
            <p v-if="task?.description" class="description">
              {{ task.description }}
            </p>
            <p v-else class="empty-text">No description provided.</p>
          </div>
        </section>

        <!-- 2. Decision -->
        <section class="section decision">
          <h2 class="section-title">Decisions</h2>
          <div class="section-body decision-list">
            <div v-if="decisions.length === 0" class="bot-message">
              🤖 No final decisions yet. Use <code>/decide</code> to log one.
            </div>
            <div v-for="d in decisions" :key="d.id" class="decision-card">
              <div class="decision-icon">✅</div>
              <div class="decision-content">
                <p class="decision-text">{{ d.text }}</p>
                <span class="decision-meta"
                  >{{ d.senderName }} •
                  {{ new Date(d.createdAt).toLocaleDateString() }}</span
                >
              </div>
            </div>
          </div>
        </section>

        <!-- 3. Discussion -->
        <section class="section discussion">
          <h2 class="section-title">Discussion</h2>
          <div class="section-body">
            <div class="messages">
              <div
                v-for="msg in discussionMessages"
                :key="msg.id"
                class="msg-row"
              >
                <UserAvatar :name="msg.senderName" size="sm" class="avatar" />
                <div class="msg-bubble">
                  <div class="msg-header">
                    <span class="sender">{{ msg.senderName }}</span>
                    <span class="time">{{
                      new Date(msg.createdAt).toLocaleString()
                    }}</span>
                  </div>
                  <div class="msg-text">{{ msg.text }}</div>
                </div>
              </div>
            </div>
            <div class="composer">
              <input
                v-model="input"
                @keydown.enter="handleSendMessage"
                placeholder="Type a message or /decide..."
                class="msg-input"
              />
            </div>
          </div>
        </section>

        <!-- 4. Activity Log -->
        <section class="section activity">
          <h2 class="section-title">Activity Log</h2>
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
            </ul>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.task-page {
  min-height: 100vh;
  background: #fff;
  color: #1a1a1a;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial,
    sans-serif;
  display: flex;
  justify-content: center;
}

.task-container {
  width: 100%;
  max-width: 900px;
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  gap: 60px;
}

/* Header */
.header-content {
  margin-top: 20px;
}

.back-link {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 0;
  font-size: 14px;
  transition: color 0.2s;
}
.back-link:hover {
  color: #000;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.task-title {
  font-size: 32px;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.5px;
}

.status-badge {
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid #eee;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.status-badge.todo {
  background: #fafafa;
  color: #666;
}
.status-badge.in-progress {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #dbeafe;
}
.status-badge.review {
  background: #fdf4ff;
  color: #a21caf;
  border-color: #fce7f3;
}
.status-badge.done {
  background: #f0fdf4;
  color: #15803d;
  border-color: #dcfce7;
}

.meta-row {
  display: flex;
  gap: 40px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-item .label {
  font-size: 11px;
  text-transform: uppercase;
  color: #999;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.meta-item .value {
  font-size: 15px;
  color: #333;
}

/* Sections */
.section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 40px;
  border-bottom: 1px solid #f5f5f5;
}
.section:last-child {
  border-bottom: none;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.description {
  font-size: 16px;
  line-height: 1.6;
  color: #444;
  white-space: pre-wrap;
}

.empty-text {
  color: #999;
  font-style: italic;
}

/* Decision */
.decision-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bot-message {
  background: #f9f9f9;
  padding: 16px;
  border-radius: 8px;
  color: #666;
  font-size: 14px;
}

.decision-card {
  display: flex;
  gap: 12px;
  background: #f0fdf4;
  border: 1px solid #dcfce7;
  padding: 16px;
  border-radius: 8px;
}

.decision-icon {
  font-size: 20px;
}

.decision-text {
  margin: 0 0 4px 0;
  font-weight: 500;
  color: #14532d;
}

.decision-meta {
  font-size: 12px;
  color: #166534;
  opacity: 0.8;
}

/* Discussion */
.messages {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}

.msg-row {
  display: flex;
  gap: 12px;
}

.avatar {
  margin-top: 4px;
}

.msg-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}

.msg-header .sender {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.msg-header .time {
  font-size: 11px;
  color: #999;
}

.msg-text {
  font-size: 15px;
  line-height: 1.5;
  color: #444;
  white-space: pre-wrap;
}

.msg-input {
  width: 100%;
  padding: 16px;
  border: 1px solid #eee;
  border-radius: 12px;
  font-size: 15px;
  outline: none;
  transition:
    box-shadow 0.2s,
    border-color 0.2s;
}
.msg-input:focus {
  border-color: #ddd;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

/* Activity Log */
.activity-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #666;
}

.activity-dot {
  width: 6px;
  height: 6px;
  background: #ddd;
  border-radius: 50%;
}

.activity-label {
  font-weight: 500;
}

.activity-date {
  color: #999;
  font-size: 13px;
}
</style>

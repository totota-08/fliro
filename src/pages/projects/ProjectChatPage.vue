<script setup lang="ts">
import { commands, executeCommand } from "@/commands";
import UserAvatar from "@/components/common/UserAvatar.vue";
import ProjectSidebar from "@/components/projectDashboard/ProjectSidebar.vue";
import { ROUTE_NAMES } from "@/constants/routes";
import { fetchProject } from "@/firebase/projectService";
import { db } from "@/lib/firebase";
import {
  listenProjectChat,
  sendProjectMessage,
  type ChatMessage,
} from "@/services/projectChat";
import {
  listenProjectMembers,
  type ProjectMember,
} from "@/services/projectMembers";
import { useAuthStore } from "@/store/auth";
import type { ProjectDoc } from "@/types/project";
import { getLogger } from "@logtape/logtape";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";

const logger = getLogger("app.pages.projects.ProjectChat");

type ChatChannel = {
  id: string;
  name: string;
  description?: string;
  type: "general" | "custom";
  createdBy?: string;
  isPublic?: boolean;
  allowedUserIds?: string[];
};

const defaultChannel: ChatChannel = {
  id: "general",
  name: "全体",
  description: "全メンバーと共有するチャネル",
  type: "general",
};

const route = useRoute();
const router = useRouter();
const { user, profile } = useAuthStore();
const projectId = ref(String(route.params.projectId || ""));
const messages = ref<ChatMessage[]>([]);
const input = ref("");
const project = ref<ProjectDoc | null>(null);
const projectMembers = ref<ProjectMember[]>([]);
const customChannels = ref<ChatChannel[]>([]);
const chatContainer = ref<HTMLElement | null>(null);
const composerInput = ref<HTMLInputElement | null>(null);
const activeChannelId = ref("general");

// Command Autocomplete
const showCommandSuggestions = ref(false);
const availableCommands = computed(() =>
  commands.flatMap((c) =>
    c.suggestions?.length
      ? c.suggestions.map((s) => ({
          label: s.name,
          description: s.description,
          example: s.example ?? c.example,
        }))
      : [
          {
            label: c.name,
            description: c.description,
            example: c.example,
          },
        ],
  ),
);

const filteredCommands = computed(() => {
  if (!input.value.startsWith("/")) return [];
  const query = input.value.toLowerCase();
  return availableCommands.value.filter((cmd) => cmd.label.startsWith(query));
});

watch(input, (val) => {
  if (val.startsWith("/") && !val.includes(" ")) {
    showCommandSuggestions.value = true;
  } else {
    showCommandSuggestions.value = false;
  }
});

function selectCommand(cmd: string) {
  if (cmd === "/news") {
    // /news command doesn't need arguments usually, so maybe just set it?
    // User might validly just hit enter.
    input.value = `${cmd}`;
  } else {
    input.value = `${cmd} `;
  }
  showCommandSuggestions.value = false;
  showCommandSuggestions.value = false;
  composerInput.value?.focus();
}
// UI state
const customThreadFormOpen = ref(false);
const customThreadForm = ref({ name: "", description: "" });
let unsubscribeChat: (() => void) | null = null;
let unsubscribeMembers: (() => void) | null = null;
let unsubscribeCustomChannels: (() => void) | null = null;

// Channel Logic
const channels = computed<ChatChannel[]>(() => {
  return [defaultChannel, ...customChannels.value];
});

const currentChannel = computed<ChatChannel>(() => {
  return (
    channels.value.find((c) => c.id === activeChannelId.value) || defaultChannel
  );
});

const currentChannelMessages = computed(() =>
  messages.value.filter(
    (m) => (m.channelId || "general") === activeChannelId.value,
  ),
);

function selectChannel(id: string) {
  if (activeChannelId.value === id) return;
  activeChannelId.value = id;
}

// Watchers
function watchChat() {
  unsubscribeChat = listenProjectChat(projectId.value, (list) => {
    messages.value = list;
    scrollToBottom();
  });
}

function watchMembers() {
  unsubscribeMembers = listenProjectMembers(projectId.value, (list) => {
    projectMembers.value = list;
  });
}

function watchCustomChannels() {
  unsubscribeCustomChannels?.();
  if (!projectId.value) return;
  const q = query(
    collection(db, "projects", projectId.value, "threads"),
    orderBy("createdAt", "asc"),
  );
  unsubscribeCustomChannels = onSnapshot(q, (snapshot) => {
    const list: ChatChannel[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        name: data.name || "未命名スレッド",
        description: data.description || "",
        type: "custom",
        createdBy: data.createdBy,
        isPublic: data.isPublic !== false,
      });
    });
    customChannels.value = list;
  });
}

function stopWatchers() {
  unsubscribeChat?.();
  unsubscribeMembers?.();
  unsubscribeCustomChannels?.();
  unsubscribeChat = null;
  unsubscribeMembers = null;
  unsubscribeCustomChannels = null;
}

async function refreshProjectContext() {
  stopWatchers();
  messages.value = [];
  projectMembers.value = [];
  customChannels.value = [];
  project.value = null;

  if (!projectId.value) return;

  try {
    project.value = await fetchProject(projectId.value);
  } catch (error) {
    logger.error`Failed to load project: ${error}`;
    return;
  }

  watchChat();
  watchMembers();
  watchCustomChannels();
}

// Actions
// Actions
async function handleSend() {
  const text = input.value.trim();
  if (!text || !user.value) return;

  // Check for commands
  if (text.startsWith("/")) {
    const result = await executeCommand(text, {
      projectId: projectId.value,
      userId: user.value.uid,
      activeChannelId: activeChannelId.value,
      members: projectMembers.value,
    });

    if (result.handled) {
      if (result.result) {
        // Send bot message based on command result
        await sendProjectMessage(
          projectId.value,
          "system",
          "Fliro Bot",
          result.result.message || "コマンドを実行しました",
          activeChannelId.value,
          undefined,
          { isBot: true, linkedTaskId: result.result.linkedTaskId },
        );
      }
      input.value = "";
      scrollToBottom();
      return;
    }
  }

  try {
    await sendProjectMessage(
      projectId.value,
      user.value.uid,
      profile.value?.nickname || profile.value?.fullName || "ユーザー",
      text,
      activeChannelId.value, // Explicitly set channelId
    );
    input.value = "";
    scrollToBottom();
  } catch (e) {
    logger.error`Failed to send message: ${e}`;
  }
}

function openTask(taskId: string) {
  router.push({
    name: ROUTE_NAMES.projectTaskDetail,
    params: { projectId: projectId.value, taskId },
  });
}

async function createCustomThread() {
  const name = customThreadForm.value.name.trim();
  if (!name || !user.value) return;

  try {
    const docRef = await addDoc(
      collection(db, "projects", projectId.value, "threads"),
      {
        name,
        description: customThreadForm.value.description.trim(),
        createdBy: user.value.uid,
        userId: user.value.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isPublic: true,
      },
    );
    activeChannelId.value = docRef.id;
    customThreadFormOpen.value = false;
    customThreadForm.value = { name: "", description: "" };
  } catch (e) {
    logger.error`Failed to create thread: ${e}`;
  }
}

async function deleteCustomThread(threadId: string) {
  if (!confirm("本当にこのスレッドを削除しますか？")) return;
  try {
    await deleteDoc(doc(db, "projects", projectId.value, "threads", threadId));
    if (activeChannelId.value === threadId) {
      activeChannelId.value = "general";
    }
  } catch (e) {
    logger.error`Failed to delete thread: ${e}`;
  }
}

function scrollToBottom() {
  nextTick(() => {
    // Use requestAnimationFrame to ensure layout is done
    requestAnimationFrame(() => {
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
      }
    });
  });
}

function formatTime(createdAt: ChatMessage["createdAt"]) {
  if (!createdAt) return "";
  let date: Date;
  if (typeof createdAt === "number" || typeof createdAt === "string") {
    date = new Date(createdAt);
  } else if ((createdAt as any) instanceof Date) {
    date = createdAt;
  } else if ((createdAt as any).toDate) {
    date = (createdAt as any).toDate();
  } else {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatMessage(text: string) {
  if (!text) return "";
  // 1. Escape HTML
  let formatted = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Parse Markdown Links [Text](URL)
  formatted = formatted.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#0ea5e9;text-decoration:underline;">$1</a>',
  );

  // 3. New lines to <br>
  formatted = formatted.replace(/\n/g, "<br>");

  return formatted;
}

// Lifecycle
onMounted(() => {
  if (projectId.value) {
    void refreshProjectContext();
  }
});

watch(
  () => route.params.projectId,
  (newId) => {
    const nextId = newId ? String(newId) : "";
    if (nextId === projectId.value) return;
    projectId.value = nextId;
    void refreshProjectContext();
  },
);

onBeforeUnmount(() => {
  stopWatchers();
});

watch(activeChannelId, () => {
  scrollToBottom();
});

// Fallback if active channel deleted
watch(channels, (list) => {
  if (list.length > 0 && !list.find((c) => c.id === activeChannelId.value)) {
    activeChannelId.value = "general";
  }
});
</script>

<template>
  <div class="chat-page">
    <ProjectSidebar
      :open="true"
      :project-id="projectId"
      brand-subtitle="プロジェクト"
    />

    <div class="main-area">
      <header class="top-bar">
        <div class="bar-left">
          <!-- Placeholder for sidebar toggle if needed -->
          <h2 class="page-title">{{ project?.name || "プロジェクト" }}</h2>
        </div>
      </header>

      <div class="content-grid">
        <!-- Threads Panel -->
        <aside class="threads-panel">
          <div class="panel-section">
            <h3 class="section-title">チャンネル</h3>
            <button
              class="channel-item"
              :class="{ active: activeChannelId === 'general' }"
              @click="selectChannel('general')"
            >
              # {{ defaultChannel.name }}
            </button>
          </div>

          <div class="panel-section">
            <div class="section-header">
              <h3 class="section-title">カスタムスレッド</h3>
              <button
                class="add-btn"
                @click="customThreadFormOpen = true"
                title="新規スレッド"
              >
                +
              </button>
            </div>
            <div v-if="customThreadFormOpen" class="thread-form">
              <input
                v-model="customThreadForm.name"
                placeholder="スレッド名"
                class="thread-input"
              />
              <div class="form-actions">
                <button
                  @click="customThreadFormOpen = false"
                  class="cancel-btn"
                >
                  ×
                </button>
                <button @click="createCustomThread" class="confirm-btn">
                  作成
                </button>
              </div>
            </div>
            <div class="thread-list">
              <div
                v-for="th in customChannels"
                :key="th.id"
                class="channel-item"
                :class="{ active: activeChannelId === th.id }"
                @click="selectChannel(th.id)"
              >
                <span class="channel-name"># {{ th.name }}</span>
                <button
                  v-if="th.createdBy === user?.uid"
                  class="delete-thread-btn"
                  @click.stop="deleteCustomThread(th.id)"
                  title="削除"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </aside>

        <!-- Chat Area -->
        <main class="chat-main">
          <header class="chat-header">
            <h3># {{ currentChannel.name }}</h3>
            <p v-if="currentChannel.description" class="desc">
              {{ currentChannel.description }}
            </p>
          </header>

          <div class="msg-list" ref="chatContainer">
            <div v-if="currentChannelMessages.length === 0" class="empty-state">
              <p>メッセージはまだありません。</p>
            </div>
            <div
              v-for="msg in currentChannelMessages"
              :key="msg.id"
              class="msg-row"
              :class="{ 'is-bot': msg.isBot }"
            >
              <UserAvatar
                v-if="!msg.isBot"
                :url="null"
                :name="msg.senderName || 'ゲスト'"
                class="avatar"
              />
              <div v-else class="bot-avatar">🤖</div>

              <div class="msg-content">
                <div class="msg-meta">
                  <span class="sender">{{ msg.senderName }}</span>
                  <span class="time">{{ formatTime(msg.createdAt) }}</span>
                </div>
                <div class="msg-text" v-html="formatMessage(msg.text)"></div>
                <button
                  v-if="msg.linkedTaskId"
                  class="open-task-btn"
                  @click="openTask(msg.linkedTaskId)"
                >
                  タスクを開く
                </button>
              </div>
            </div>
          </div>

          <div class="composer">
            <div
              v-if="showCommandSuggestions && filteredCommands.length > 0"
              class="suggestions-list"
            >
              <button
                v-for="cmd in filteredCommands"
                :key="cmd.label"
                class="suggestion-item"
                @click="selectCommand(cmd.label)"
              >
                <div class="cmd-row">
                  <span class="cmd-label">{{ cmd.label }}</span>
                  <span class="cmd-desc">{{ cmd.description }}</span>
                </div>
                <div v-if="cmd.example" class="cmd-example">
                  例: {{ cmd.example }}
                </div>
              </button>
            </div>
            <input
              ref="composerInput"
              v-model="input"
              @keydown.enter="handleSend"
              placeholder="メッセージを送信..."
              class="composer-input"
            />
            <button
              @click="handleSend"
              class="send-btn"
              :disabled="!input.trim()"
            >
              送信
            </button>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-page {
  height: 100vh;
  display: flex;
  background: #f8fafc;
  overflow: hidden;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 40;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
}

.top-bar {
  height: 60px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.page-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.content-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 260px 1fr;
  min-height: 0;
}

/* Threads Panel */
.threads-panel {
  background: #f1f5f9;
  border-right: 1px solid #e2e8f0;
  padding: 20px 12px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
}

.section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  margin-bottom: 8px;
  padding-left: 8px;
}

.channel-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  color: #334155;
  font-weight: 500;
  font-size: 14px;
}

.channel-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.channel-item.active {
  background: #e2e8f0;
  color: #0f172a;
  font-weight: 700;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.add-btn {
  border: none;
  background: transparent;
  font-size: 18px;
  color: #64748b;
  cursor: pointer;
  padding: 0 8px;
}

.thread-form {
  margin-bottom: 10px;
  padding: 8px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
}

.thread-input {
  width: 100%;
  border: 1px solid #e2e8f0;
  padding: 6px;
  border-radius: 4px;
  margin-bottom: 6px;
  font-size: 13px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.channel-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-thread-btn {
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 4px;
}
.delete-thread-btn:hover {
  color: #ef4444;
}

/* Chat Main */
.chat-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.chat-header {
  height: 60px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 20px;
  border-bottom: 1px solid #e2e8f0;
}

.chat-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.chat-header .desc {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}

.msg-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #fff;
}

.empty-state {
  margin-top: 40px;
  text-align: center;
  color: #94a3b8;
}

.msg-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e2e8f0;
}

.bot-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #f0fdf4;
  display: grid;
  place-items: center;
  font-size: 20px;
  border: 1px solid #bbf7d0;
}

.msg-row.is-bot {
  background: #fcfcfc;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #f1f5f9;
}

.msg-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.msg-meta {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 2px;
}

.sender {
  font-weight: 700;
  font-size: 14px;
  color: #0f172a;
}

.time {
  font-size: 11px;
  color: #94a3b8;
}

.msg-text {
  font-size: 15px;
  line-height: 1.5;
  color: #334155;
  white-space: pre-wrap;
  word-break: break-word;
}

.open-task-btn {
  margin-top: 6px;
  font-size: 12px;
  padding: 4px 10px;
  background: #e2e8f0;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  cursor: pointer;
  color: #334155;
  font-weight: 600;
  display: inline-block;
  align-self: flex-start;
}
.open-task-btn:hover {
  background: #cbd5e1;
}

.composer {
  padding: 20px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  gap: 12px;
  background: #fff;
  position: relative;
}

.composer-input {
  flex: 1;
  padding: 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.composer-input:focus {
  border-color: #0f172a;
}

.send-btn {
  padding: 0 20px;
  background: #0f172a;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  height: 44px; /* Match input height roughly */
  transition: opacity 0.2s;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 768px) {
  .content-grid {
    grid-template-columns: 1fr;
    /* Usually sidebar covers or simple toggle, keeping simple for now */
  }
  .threads-panel {
    display: none; /* Hide threads list on mobile for simplicity in this MVP */
  }
}

.suggestions-list {
  position: absolute;
  bottom: 100%;
  left: 20px;
  max-width: 400px;
  max-height: 300px;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  z-index: 10;
  margin-bottom: 8px;
  overflow-y: auto;
}

.suggestion-item {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover {
  background: #f8fafc;
}

.cmd-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.cmd-label {
  font-weight: 700;
  font-size: 14px;
  color: #0f172a;
}

.cmd-desc {
  font-size: 12px;
  color: #64748b;
}

.cmd-example {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}
</style>

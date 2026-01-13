<script setup lang="ts">
import { commands, executeCommand } from "@/commands";
import UserAvatar from "@/components/common/UserAvatar.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppDrawer from "@/components/ui/AppDrawer.vue";
import AppEmptyState from "@/components/ui/AppEmptyState.vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppTextarea from "@/components/ui/AppTextarea.vue";
import { usePageTitle } from "@/composables/usePageTitle";
import TaskDrawer from "@/components/tasks/TaskDrawer.vue";
import { useProjectIdRoute } from "@/composables/useProjectIdRoute";
import { useTaskDrawerRouteSync } from "@/composables/useTaskDrawerRouteSync";
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
import { listenTasks, type TaskDoc } from "@/services/taskService";
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
import { useRouter, useRoute } from "vue-router";

const logger = getLogger("app.pages.projects.ProjectChat");

const route = useRoute();

type ChatChannel = {
  id: string;
  name: string;
  description?: string;
  type: "general" | "custom" | "task";
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

const router = useRouter();
const { user, profile } = useAuthStore();
const { projectId } = useProjectIdRoute();

// TaskDrawer のURL同期
const {
  taskId: selectedTaskId,
  openTask,
  closeTask,
} = useTaskDrawerRouteSync(router, route);

const messages = ref<ChatMessage[]>([]);
const input = ref("");
const project = ref<ProjectDoc | null>(null);

// ページタイトル設定
const { setTitle } = usePageTitle("スレッド", "チームのディスカッション");
watch(
  project,
  (p) => {
    if (p?.name) setTitle(p.name);
  },
  { immediate: true },
);
const projectMembers = ref<ProjectMember[]>([]);
const tasks = ref<TaskDoc[]>([]);
const customChannels = ref<ChatChannel[]>([]);
const chatContainer = ref<HTMLElement | null>(null);
const composerInput = ref<HTMLInputElement | null>(null);
const activeChannelId = ref("general");

// Command Autocomplete
const showCommandSuggestions = ref(false);
const availableCommands = computed(() => {
  const humorousEnabled =
    project.value?.settings?.humorousCommandsEnabled ?? false;

  return commands
    .filter((c) => {
      // Flilo Bot は humorousCommandsEnabled がtrueの場合のみ表示
      if (c.name === "Flilo Bot") {
        return humorousEnabled;
      }
      return true;
    })
    .flatMap((c) =>
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
    );
});

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
  composerInput.value?.focus();
}
// UI state
const customThreadFormOpen = ref(false);
const customThreadForm = ref({ name: "", description: "" });
const isCreateThreadDisabled = computed(
  () => !customThreadForm.value.name.trim(),
);
const showAllTaskChannels = ref(false); // タスク一覧の「すべて表示」フラグ
const showMobileThreads = ref(false); // モバイル用スレッドドロワー
const MAX_VISIBLE_TASK_CHANNELS = 8;
let unsubscribeChat: (() => void) | null = null;
let unsubscribeMembers: (() => void) | null = null;
let unsubscribeCustomChannels: (() => void) | null = null;
let unsubscribeTasks: (() => void) | null = null;

// Channel Logic
const taskChannels = computed<ChatChannel[]>(() =>
  tasks.value
    .filter((task) => task.hasThread !== false)
    .map((task) => ({
      id: task.id,
      name: task.threadName || task.title || "無題のタスク",
      description: task.status,
      type: "task",
    })),
);

// 表示するタスクチャンネル（最大8件、またはすべて）
const visibleTaskChannels = computed(() => {
  if (showAllTaskChannels.value) {
    return taskChannels.value;
  }
  return taskChannels.value.slice(0, MAX_VISIBLE_TASK_CHANNELS);
});

// 隠れているタスクの数
const hiddenTaskCount = computed(() => {
  return Math.max(0, taskChannels.value.length - MAX_VISIBLE_TASK_CHANNELS);
});

const channels = computed<ChatChannel[]>(() => {
  return [defaultChannel, ...taskChannels.value, ...customChannels.value];
});

const currentChannel = computed<ChatChannel>(() => {
  return (
    channels.value.find((c) => c.id === activeChannelId.value) || defaultChannel
  );
});

const currentChannelMessages = computed(() => {
  if (currentChannel.value.type === "task") {
    return messages.value.filter(
      (m) => m.linkedTaskId === currentChannel.value.id,
    );
  }
  return messages.value.filter(
    (m) =>
      (m.channelId || "general") === activeChannelId.value && !m.linkedTaskId,
  );
});

function selectChannel(id: string) {
  if (activeChannelId.value === id) return;
  activeChannelId.value = id;
}

// モバイルドロワーでのチャンネル選択（選択後にドロワーを閉じる）
function selectChannelWithClose(id: string) {
  selectChannel(id);
  showMobileThreads.value = false;
}

function toggleMobileThreads() {
  showMobileThreads.value = !showMobileThreads.value;
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

function watchTasks() {
  unsubscribeTasks = listenTasks(projectId.value, (list) => {
    tasks.value = list;
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
  unsubscribeTasks?.();
  unsubscribeChat = null;
  unsubscribeMembers = null;
  unsubscribeCustomChannels = null;
  unsubscribeTasks = null;
}

async function refreshProjectContext() {
  stopWatchers();
  messages.value = [];
  projectMembers.value = [];
  tasks.value = [];
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
  watchTasks();
  watchCustomChannels();
}

// Actions
// Actions
async function handleSend() {
  const text = input.value.trim();
  if (!text || !user.value) return;
  const activeTaskId =
    currentChannel.value.type === "task" ? currentChannel.value.id : null;

  // Check for commands
  if (text.startsWith("/")) {
    const result = await executeCommand(text, {
      projectId: projectId.value,
      userId: user.value.uid,
      activeChannelId: activeChannelId.value,
      members: projectMembers.value,
      humorousCommandsEnabled:
        project.value?.settings?.humorousCommandsEnabled ?? false,
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
          {
            isBot: true,
            linkedTaskId: activeTaskId || result.result.linkedTaskId,
            isTask: Boolean(activeTaskId),
          },
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
      undefined,
      activeTaskId ? { linkedTaskId: activeTaskId, isTask: true } : undefined,
    );
    input.value = "";
    scrollToBottom();
  } catch (e) {
    logger.error`Failed to send message: ${e}`;
  }
}

// タスクをドロワーで開く（openTaskは composable から取得済み）
function handleOpenTask(taskId: string) {
  openTask(taskId);
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

function taskStatusLabel(status?: string) {
  if (status === "todo") return "未着手";
  if (status === "in-progress") return "進行中";
  if (status === "done") return "完了";
  return "未設定";
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
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>',
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

watch(projectId, () => {
  void refreshProjectContext();
});

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
  <div class="project-chat-page">
    <div class="chat-content">
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
              <h3 class="section-title">タスク</h3>
              <span class="section-count">{{ taskChannels.length }}</span>
            </div>
            <div class="thread-list thread-list--scrollable">
              <button
                v-for="taskChannel in visibleTaskChannels"
                :key="taskChannel.id"
                class="channel-item"
                :class="{ active: activeChannelId === taskChannel.id }"
                @click="selectChannel(taskChannel.id)"
              >
                <span class="channel-name"># {{ taskChannel.name }}</span>
                <span class="task-status">{{
                  taskStatusLabel(taskChannel.description)
                }}</span>
              </button>
              <!-- 「すべて表示」ボタン -->
              <button
                v-if="hiddenTaskCount > 0 && !showAllTaskChannels"
                type="button"
                class="show-all-btn"
                @click="showAllTaskChannels = true"
              >
                他 {{ hiddenTaskCount }} 件を表示...
              </button>
              <button
                v-if="
                  showAllTaskChannels &&
                  taskChannels.length > MAX_VISIBLE_TASK_CHANNELS
                "
                type="button"
                class="show-all-btn"
                @click="showAllTaskChannels = false"
              >
                折りたたむ
              </button>
            </div>
            <p v-if="!taskChannels.length" class="empty-text">
              タスクのスレッドがありません。
            </p>
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
              <AppInput
                v-model="customThreadForm.name"
                placeholder="スレッド名（必須）"
                size="sm"
              />
              <AppTextarea
                v-model="customThreadForm.description"
                placeholder="説明（任意）"
                :rows="2"
                resize="none"
              />
              <div class="form-actions">
                <AppButton
                  variant="ghost"
                  size="sm"
                  @click="customThreadFormOpen = false"
                >
                  キャンセル
                </AppButton>
                <AppButton
                  variant="primary"
                  size="sm"
                  :disabled="isCreateThreadDisabled"
                  @click="createCustomThread"
                >
                  作成
                </AppButton>
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
            <AppEmptyState
              v-if="currentChannelMessages.length === 0"
              title="メッセージはまだありません"
              description="最初のメッセージを送信して会話を始めましょう。"
              icon="empty"
            />
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
                  @click="handleOpenTask(msg.linkedTaskId)"
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

    <!-- モバイル用スレッド切替FABボタン -->
    <button
      type="button"
      class="mobile-threads-fab"
      aria-label="スレッド一覧を開く"
      @click="toggleMobileThreads"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>

    <!-- モバイル用スレッドドロワー -->
    <AppDrawer
      :open="showMobileThreads"
      title="スレッド"
      width="280px"
      class="mobile-threads-drawer"
      @close="showMobileThreads = false"
    >
      <div class="mobile-threads-content">
        <!-- チャンネル -->
        <div class="panel-section">
          <h3 class="section-title">チャンネル</h3>
          <button
            class="channel-item"
            :class="{ active: activeChannelId === 'general' }"
            @click="selectChannelWithClose('general')"
          >
            # {{ defaultChannel.name }}
          </button>
        </div>

        <!-- タスク -->
        <div class="panel-section">
          <div class="section-header">
            <h3 class="section-title">タスク</h3>
            <span class="section-count">{{ taskChannels.length }}</span>
          </div>
          <div class="thread-list thread-list--scrollable">
            <button
              v-for="taskChannel in visibleTaskChannels"
              :key="taskChannel.id"
              class="channel-item"
              :class="{ active: activeChannelId === taskChannel.id }"
              @click="selectChannelWithClose(taskChannel.id)"
            >
              <span class="channel-name"># {{ taskChannel.name }}</span>
              <span class="task-status">{{
                taskStatusLabel(taskChannel.description)
              }}</span>
            </button>
            <button
              v-if="hiddenTaskCount > 0 && !showAllTaskChannels"
              type="button"
              class="show-all-btn"
              @click="showAllTaskChannels = true"
            >
              他 {{ hiddenTaskCount }} 件を表示...
            </button>
            <button
              v-if="
                showAllTaskChannels &&
                taskChannels.length > MAX_VISIBLE_TASK_CHANNELS
              "
              type="button"
              class="show-all-btn"
              @click="showAllTaskChannels = false"
            >
              折りたたむ
            </button>
          </div>
          <p v-if="!taskChannels.length" class="empty-text">
            タスクのスレッドがありません。
          </p>
        </div>

        <!-- カスタムスレッド -->
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
            <AppInput
              v-model="customThreadForm.name"
              placeholder="スレッド名（必須）"
              size="sm"
            />
            <AppTextarea
              v-model="customThreadForm.description"
              placeholder="説明（任意）"
              :rows="2"
              resize="none"
            />
            <div class="form-actions">
              <AppButton
                variant="ghost"
                size="sm"
                @click="customThreadFormOpen = false"
              >
                キャンセル
              </AppButton>
              <AppButton
                variant="primary"
                size="sm"
                :disabled="isCreateThreadDisabled"
                @click="createCustomThread"
              >
                作成
              </AppButton>
            </div>
          </div>
          <div class="thread-list">
            <button
              v-for="th in customChannels"
              :key="th.id"
              class="channel-item"
              :class="{ active: activeChannelId === th.id }"
              @click="selectChannelWithClose(th.id)"
            >
              <span class="channel-name"># {{ th.name }}</span>
            </button>
          </div>
        </div>
      </div>
    </AppDrawer>

    <!-- TaskDrawer (Teleport to body) -->
    <Teleport to="body">
      <TaskDrawer
        :project-id="projectId"
        :task-id="selectedTaskId"
        :tasks="tasks"
        @close="closeTask"
      />
    </Teleport>
  </div>
</template>

<style scoped>
/* Page Layout - 画面いっぱいに配置 */
.project-chat-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

/* Chat Content */
.chat-content {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  height: 100%;
}

.content-grid {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(240px, 260px) 1fr;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

/* Threads Panel */
.threads-panel {
  background: var(--ui-surface-muted);
  border-right: 1px solid var(--ui-border-light);
  padding: var(--ui-space-5) var(--ui-space-3);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6);
  overflow-y: auto;
  min-width: 240px;
  flex-shrink: 0;
}

.section-title {
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-bold);
  text-transform: uppercase;
  color: var(--ui-text-muted);
  margin-bottom: var(--ui-space-2);
  padding-left: var(--ui-space-2);
}

.channel-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: var(--ui-space-2) var(--ui-space-3);
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  color: var(--ui-text);
  font-weight: var(--ui-font-medium);
  font-size: var(--ui-text-sm);
}

.channel-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.channel-item.active {
  background: var(--ui-border-light);
  color: var(--ui-text-strong);
  font-weight: var(--ui-font-bold);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-count {
  font-size: var(--ui-text-xs);
  color: var(--ui-text-subtle);
  padding-right: var(--ui-space-2);
}

.add-btn {
  border: none;
  background: transparent;
  font-size: var(--ui-text-lg);
  color: var(--ui-text-muted);
  cursor: pointer;
  padding: 0 var(--ui-space-2);
}

.thread-form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  margin-bottom: var(--ui-space-2);
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  background: var(--ui-surface);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-2);
}

.channel-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-thread-btn {
  border: none;
  background: transparent;
  color: var(--ui-text-subtle);
  cursor: pointer;
  font-size: var(--ui-text-base);
  line-height: 1;
  padding: 0 var(--ui-space-1);
}
.delete-thread-btn:hover {
  color: var(--ui-danger-500);
}

.task-status {
  font-size: var(--ui-text-xs);
  color: var(--ui-text-muted);
}

.empty-text {
  font-size: var(--ui-text-xs);
  color: var(--ui-text-subtle);
  padding: var(--ui-space-1) var(--ui-space-2);
}

/* タスク一覧のスクロール可能エリア */
.thread-list--scrollable {
  max-height: 300px;
  overflow-y: auto;
}

/* 「すべて表示」ボタン */
.show-all-btn {
  display: block;
  width: 100%;
  padding: var(--ui-space-2) var(--ui-space-3);
  margin-top: var(--ui-space-1);
  border: none;
  background: transparent;
  color: var(--ui-brand-600);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-medium);
  cursor: pointer;
  text-align: left;
  transition: var(--ui-transition-colors);
}

.show-all-btn:hover {
  background: rgba(0, 0, 0, 0.04);
  text-decoration: underline;
}

/* Chat Main */
.chat-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
}

.chat-header {
  flex-shrink: 0;
  height: 60px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 var(--ui-space-5);
  border-bottom: 1px solid var(--ui-border-light);
}

.chat-header h3 {
  margin: 0;
  font-size: var(--ui-text-base);
  font-weight: var(--ui-font-bold);
  color: var(--ui-text-strong);
}

.chat-header .desc {
  margin: 0;
  font-size: var(--ui-text-xs);
  color: var(--ui-text-muted);
}

.msg-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--ui-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  background: var(--ui-surface);
}

.empty-state {
  margin-top: var(--ui-space-10);
  text-align: center;
  color: var(--ui-text-subtle);
}

.msg-row {
  display: flex;
  gap: var(--ui-space-3);
  align-items: flex-start;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--ui-border-light);
}

.bot-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--ui-success-50);
  display: grid;
  place-items: center;
  font-size: var(--ui-text-xl);
  border: 1px solid var(--ui-success-200);
}

.msg-row.is-bot {
  background: var(--ui-surface-muted);
  padding: var(--ui-space-2) var(--ui-space-3);
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-border-light);
}

.msg-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.msg-meta {
  display: flex;
  gap: var(--ui-space-2);
  align-items: baseline;
  margin-bottom: 2px;
}

.sender {
  font-weight: var(--ui-font-bold);
  font-size: var(--ui-text-sm);
  color: var(--ui-text-strong);
}

.time {
  font-size: var(--ui-text-xs);
  color: var(--ui-text-subtle);
}

.msg-text {
  font-size: var(--ui-text-base);
  line-height: var(--ui-leading-relaxed);
  color: var(--ui-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.open-task-btn {
  margin-top: var(--ui-space-1);
  font-size: var(--ui-text-xs);
  padding: var(--ui-space-1) var(--ui-space-2);
  background: var(--ui-border-light);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-sm);
  cursor: pointer;
  color: var(--ui-text);
  font-weight: var(--ui-font-semibold);
  display: inline-block;
  align-self: flex-start;
}
.open-task-btn:hover {
  background: var(--ui-border);
}

.composer {
  flex-shrink: 0;
  padding: var(--ui-space-5);
  border-top: 1px solid var(--ui-border-light);
  display: flex;
  gap: var(--ui-space-3);
  background: var(--ui-surface);
  position: relative;
}

.composer-input {
  flex: 1;
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  font-size: var(--ui-text-sm);
  outline: none;
  transition: var(--ui-transition-colors);
}

.composer-input:focus {
  border-color: var(--ui-brand-600);
  box-shadow: var(--ui-ring-focus);
}

.send-btn {
  padding: 0 var(--ui-space-5);
  background: var(--ui-brand-600);
  color: var(--ui-text-inverse);
  border: none;
  border-radius: var(--ui-radius-md);
  font-weight: var(--ui-font-bold);
  cursor: pointer;
  height: 44px;
  transition: var(--ui-transition-colors);
}

.send-btn:hover {
  background: var(--ui-brand-700);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Task Panel */
.task-panel {
  border-left: 1px solid var(--ui-border-light);
  background: var(--ui-surface-muted);
  padding: var(--ui-space-5) var(--ui-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
  overflow-y: auto;
}

.task-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.task-panel__header h3 {
  margin: 0;
  font-size: var(--ui-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ui-text-muted);
}

.task-panel__link {
  border: none;
  background: transparent;
  color: var(--ui-brand-600);
  font-weight: var(--ui-font-semibold);
  cursor: pointer;
  font-size: var(--ui-text-sm);
}

.task-panel__link:hover {
  text-decoration: underline;
}

.task-panel__title {
  margin: 0;
  font-size: var(--ui-text-lg);
  color: var(--ui-text-strong);
}

.task-panel__meta {
  margin: 0;
  font-size: var(--ui-text-sm);
  color: var(--ui-text);
}

.task-panel__badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--ui-space-2);
  border-radius: var(--ui-radius-full);
  background: var(--ui-border-light);
  color: var(--ui-text-strong);
  font-weight: var(--ui-font-semibold);
  font-size: var(--ui-text-xs);
}

.task-panel__desc {
  margin: 0;
  font-size: var(--ui-text-sm);
  color: var(--ui-text);
  white-space: pre-line;
}

.task-panel__empty {
  font-size: var(--ui-text-sm);
  color: var(--ui-text-subtle);
}

/* Responsive */
@media (max-width: 1100px) {
  .content-grid {
    grid-template-columns: minmax(220px, 240px) 1fr;
  }
  .task-panel {
    display: none;
  }
}

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
  left: var(--ui-space-5);
  max-width: 400px;
  max-height: 300px;
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  box-shadow: var(--ui-shadow-lg);
  overflow: hidden;
  z-index: var(--ui-z-dropdown);
  margin-bottom: var(--ui-space-2);
  overflow-y: auto;
}

.suggestion-item {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: var(--ui-space-2) var(--ui-space-3);
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  border-bottom: 1px solid var(--ui-border-light);
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover {
  background: var(--ui-surface-muted);
}

.cmd-row {
  display: flex;
  align-items: baseline;
  gap: var(--ui-space-2);
}

.cmd-label {
  font-weight: var(--ui-font-bold);
  font-size: var(--ui-text-sm);
  color: var(--ui-text-strong);
}

.cmd-desc {
  font-size: var(--ui-text-xs);
  color: var(--ui-text-muted);
}

.cmd-example {
  font-size: var(--ui-text-xs);
  color: var(--ui-text-subtle);
  margin-top: 2px;
}

/* Mobile Threads FAB */
.mobile-threads-fab {
  display: none;
  position: fixed;
  bottom: var(--ui-space-6);
  left: var(--ui-space-4);
  width: 56px;
  height: 56px;
  border-radius: var(--ui-radius-full);
  background: var(--ui-brand-600);
  color: var(--ui-text-inverse);
  border: none;
  box-shadow: var(--ui-shadow-lg);
  cursor: pointer;
  z-index: var(--ui-z-sticky);
  align-items: center;
  justify-content: center;
  transition: var(--ui-transition-all);
}

.mobile-threads-fab svg {
  width: 24px;
  height: 24px;
}

.mobile-threads-fab:hover {
  background: var(--ui-brand-700);
  transform: scale(1.05);
}

.mobile-threads-fab:active {
  transform: scale(0.95);
}

@media (max-width: 768px) {
  .mobile-threads-fab {
    display: flex;
  }
}

/* Mobile Drawer Content */
.mobile-threads-content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6);
  padding: var(--ui-space-2);
}

/* Mobile Drawer を左からスライドさせる */
.mobile-threads-drawer :deep(.app-drawer__overlay) {
  justify-content: flex-start;
}

.mobile-threads-drawer :deep(.app-drawer__panel) {
  border-radius: 0 var(--ui-radius-lg) var(--ui-radius-lg) 0;
}

.mobile-threads-drawer :deep(.app-drawer-enter-from .app-drawer__panel),
.mobile-threads-drawer :deep(.app-drawer-leave-to .app-drawer__panel) {
  transform: translateX(-100%);
}

.mobile-threads-drawer :deep(.app-drawer-enter-to .app-drawer__panel),
.mobile-threads-drawer :deep(.app-drawer-leave-from .app-drawer__panel) {
  transform: translateX(0);
}

/* Chat link styles (for v-html content) */
.msg-text :deep(.chat-link) {
  color: var(--ui-info, #0284c7);
  text-decoration: underline;
}

.msg-text :deep(.chat-link:hover) {
  color: var(--ui-brand-600, #4f7c82);
}
</style>

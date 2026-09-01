<script setup lang="ts">
import { commands, executeCommand } from "@/commands";
import {
  ChatMessageEditor,
  ChatMessageItem,
  ChatReplyIndicator,
} from "@/components/chat";
import TaskDrawer from "@/components/tasks/TaskDrawer.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppCheckbox from "@/components/ui/AppCheckbox.vue";
import AppDrawer from "@/components/ui/AppDrawer.vue";
import AppEmptyState from "@/components/ui/AppEmptyState.vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppModal from "@/components/ui/AppModal.vue";
import AppTextarea from "@/components/ui/AppTextarea.vue";
import { usePageTitle } from "@/composables/usePageTitle";
import { useProjectIdRoute } from "@/composables/useProjectIdRoute";
import { useTaskDrawerRouteSync } from "@/composables/useTaskDrawerRouteSync";
import { fetchProject } from "@/firebase/projectService";
import { db } from "@/lib/firebase";
import {
  deleteProjectMessage,
  listenProjectChat,
  sendProjectMessage,
  toggleMessageReaction,
  updateProjectMessage,
  type ChatMessage,
} from "@/services/projectChat";
import {
  listenProjectMembers,
  type ProjectMember,
} from "@/services/projectMembers";
import { listenProjectRoles, type ProjectRole } from "@/services/rolesService";
import {
  listenTasks,
  updateTaskThreadArchived,
  type TaskDoc,
} from "@/services/taskService";
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
  updateDoc,
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

const route = useRoute();

type ChatChannel = {
  id: string;
  name: string;
  description?: string;
  type: "general" | "custom" | "task";
  createdBy?: string;
  isPublic?: boolean;
  allowedUserIds?: string[];
  allowedRoles?: string[]; // 送信許可されたロールのリスト（空なら全員許可）
  settingsAllowedRoles?: string[]; // 設定編集を許可されたロールのリスト（空なら admin/owner/作成者のみ）
  archived?: boolean; // アーカイブフラグ
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

// 編集・返信状態管理
const editingMessageId = ref<string | null>(null);
const editingText = ref("");
const replyingToId = ref<string | null>(null);
const copiedMessageId = ref<string | null>(null); // コピー成功時のフィードバック用

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
const projectRoles = ref<ProjectRole[]>([]);
const chatContainer = ref<HTMLElement | null>(null);
const composerInput = ref<HTMLInputElement | null>(null);
const activeChannelId = ref("general");

// カスタムスレッド設定モーダル
const showThreadSettings = ref(false);
const threadSettingsForm = ref({
  name: "",
  description: "",
  allowedRoles: [] as string[],
  settingsAllowedRoles: [] as string[],
});
const showArchiveConfirm = ref(false);
const isSavingSettings = ref(false);

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
const customThreadForm = ref({
  name: "",
  description: "",
  allowedRoles: [] as string[],
  settingsAllowedRoles: [] as string[],
});
const isCreateThreadDisabled = computed(
  () => !customThreadForm.value.name.trim(),
);
const showAllTaskChannels = ref(false); // タスク一覧の「すべて表示」フラグ
const showArchivedTaskChannels = ref(false); // アーカイブ済みタスクの表示フラグ
const showMobileThreads = ref(false); // モバイル用スレッドドロワー
const MAX_VISIBLE_TASK_CHANNELS = 8;
let unsubscribeChat: (() => void) | null = null;
let unsubscribeMembers: (() => void) | null = null;
let unsubscribeCustomChannels: (() => void) | null = null;
let unsubscribeTasks: (() => void) | null = null;
let unsubscribeRoles: (() => void) | null = null;

// アーカイブ済みカスタムスレッド表示フラグ
const showArchivedCustomChannels = ref(false);

// アクティブなカスタムスレッド（アーカイブされていないもの）
const activeCustomChannels = computed<ChatChannel[]>(() =>
  customChannels.value.filter((ch) => !ch.archived),
);

// アーカイブされたカスタムスレッド
const archivedCustomChannels = computed<ChatChannel[]>(() =>
  customChannels.value.filter((ch) => ch.archived),
);

// Channel Logic
// 全タスクチャンネル（アーカイブフラグを含む）
const allTaskChannels = computed<ChatChannel[]>(() =>
  tasks.value
    .filter((task) => task.hasThread !== false)
    .map((task) => ({
      id: task.id,
      name: task.threadName || task.title || "無題のタスク",
      description: task.status,
      type: "task" as const,
      archived: task.threadArchived === true || task.status === "done",
    })),
);

// アクティブなタスクチャンネル（アーカイブされていないもの）
const activeTaskChannels = computed<ChatChannel[]>(() =>
  allTaskChannels.value.filter((ch) => !ch.archived),
);

// アーカイブされたタスクチャンネル
const archivedTaskChannels = computed<ChatChannel[]>(() =>
  allTaskChannels.value.filter((ch) => ch.archived),
);

// 表示用（後方互換性のため taskChannels を維持）
const taskChannels = computed<ChatChannel[]>(() => allTaskChannels.value);

// 表示するアクティブタスクチャンネル（最大8件、またはすべて）
const visibleActiveTaskChannels = computed(() => {
  if (showAllTaskChannels.value) {
    return activeTaskChannels.value;
  }
  return activeTaskChannels.value.slice(0, MAX_VISIBLE_TASK_CHANNELS);
});

// 隠れているアクティブタスクの数
const hiddenActiveTaskCount = computed(() => {
  return Math.max(
    0,
    activeTaskChannels.value.length - MAX_VISIBLE_TASK_CHANNELS,
  );
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
  unsubscribeChat?.();
  unsubscribeChat = listenProjectChat(projectId.value, (list) => {
    messages.value = list;
    scrollToBottom();
  });
}

function watchMembers() {
  unsubscribeMembers?.();
  unsubscribeMembers = listenProjectMembers(projectId.value, (list) => {
    projectMembers.value = list;
  });
}

function watchTasks() {
  unsubscribeTasks?.();
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
        allowedRoles: data.allowedRoles || [],
        settingsAllowedRoles: data.settingsAllowedRoles || [],
        archived: data.archived === true,
      });
    });
    customChannels.value = list;
  });
}

function watchRoles() {
  unsubscribeRoles?.();
  if (!projectId.value) return;
  unsubscribeRoles = listenProjectRoles(projectId.value, (list) => {
    projectRoles.value = list;
  });
}

function stopWatchers() {
  unsubscribeChat?.();
  unsubscribeMembers?.();
  unsubscribeCustomChannels?.();
  unsubscribeTasks?.();
  unsubscribeRoles?.();
  unsubscribeChat = null;
  unsubscribeMembers = null;
  unsubscribeCustomChannels = null;
  unsubscribeTasks = null;
  unsubscribeRoles = null;
}

async function refreshProjectContext() {
  stopWatchers();
  messages.value = [];
  projectMembers.value = [];
  tasks.value = [];
  customChannels.value = [];
  project.value = null;

  const id = projectId.value;
  if (!id) return;

  try {
    const fetched = await fetchProject(id);
    // await 中に別プロジェクトへ切り替わっていたら、この呼び出しの結果は捨てる
    if (id !== projectId.value) return;
    project.value = fetched;
  } catch (error) {
    logger.error`Failed to load project: ${error}`;
    return;
  }

  watchChat();
  watchMembers();
  watchTasks();
  watchCustomChannels();
  watchRoles();
}

// Actions
// Actions
// IME変換確定のEnter（isComposing / keyCode 229）では送信しない
function handleComposerEnter(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229) return;
  handleSend();
}

async function handleSend() {
  const text = input.value.trim();
  if (!text || !user.value) return;
  // 送信中の二重送信を防ぐため先にクリアする（失敗時は復元）
  input.value = "";
  const replyTo = replyingToId.value;
  replyingToId.value = null;
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
            // タスクスレッド外で linkedTaskId を付けると通常チャンネルの
            // フィルタで確認メッセージが非表示になるため、スレッド内のみ付与
            linkedTaskId: activeTaskId ?? undefined,
            isTask: Boolean(activeTaskId),
          },
        );
      }
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
      replyTo ?? undefined, // 返信先ID
      activeTaskId ? { linkedTaskId: activeTaskId, isTask: true } : undefined,
    );
    scrollToBottom();
  } catch (e) {
    input.value = text;
    replyingToId.value = replyTo;
    logger.error`Failed to send message: ${e}`;
  }
}

// タスクをドロワーで開く（openTaskは composable から取得済み）
function handleOpenTask(taskId: string) {
  openTask(taskId);
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

// タスクスレッドのアーカイブ状態を切り替える
async function toggleTaskArchive(taskId: string, currentArchived: boolean) {
  try {
    await updateTaskThreadArchived(projectId.value, taskId, !currentArchived);
    logger.debug`Task ${taskId} archive status toggled to ${!currentArchived}`;
  } catch (e) {
    logger.error`Failed to toggle task archive status: ${e}`;
  }
}

// 現在のチャンネルがアーカイブされているかどうか
const isCurrentChannelArchived = computed(() => {
  if (currentChannel.value.type !== "task") return false;
  const task = tasks.value.find((t) => t.id === currentChannel.value.id);
  return task?.threadArchived === true || task?.status === "done";
});

function closeThreadModal() {
  customThreadFormOpen.value = false;
  customThreadForm.value = {
    name: "",
    description: "",
    allowedRoles: [],
    settingsAllowedRoles: [],
  };
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
        allowedRoles: customThreadForm.value.allowedRoles,
        settingsAllowedRoles: customThreadForm.value.settingsAllowedRoles,
      },
    );
    activeChannelId.value = docRef.id;
    closeThreadModal();
  } catch (e) {
    logger.error`Failed to create thread: ${e}`;
  }
}

// スレッド作成フォームの送信権限ロール切り替え
function toggleCreateFormRole(roleId: string) {
  const idx = customThreadForm.value.allowedRoles.indexOf(roleId);
  if (idx === -1) {
    customThreadForm.value.allowedRoles.push(roleId);
  } else {
    customThreadForm.value.allowedRoles.splice(idx, 1);
  }
}

// スレッド作成フォームの設定編集権限ロール切り替え
function toggleCreateFormSettingsRole(roleId: string) {
  const idx = customThreadForm.value.settingsAllowedRoles.indexOf(roleId);
  if (idx === -1) {
    customThreadForm.value.settingsAllowedRoles.push(roleId);
  } else {
    customThreadForm.value.settingsAllowedRoles.splice(idx, 1);
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

// メッセージへスクロール
function scrollToMessage(messageId: string) {
  nextTick(() => {
    const element = document.querySelector(`[data-message-id="${messageId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      // ハイライト効果
      element.classList.add("highlight");
      setTimeout(() => element.classList.remove("highlight"), 2000);
    }
  });
}

// === メッセージアクションハンドラ ===

// リアクション
async function handleReact(payload: { messageId: string; emoji: string }) {
  if (!user.value?.uid) return;
  try {
    await toggleMessageReaction(
      projectId.value,
      payload.messageId,
      payload.emoji,
      user.value.uid,
    );
  } catch (e) {
    logger.error`Failed to toggle reaction: ${e}`;
  }
}

// 返信開始
function handleStartReply(messageId: string) {
  replyingToId.value = messageId;
  composerInput.value?.focus();
}

// 返信キャンセル
function handleCancelReply() {
  replyingToId.value = null;
}

// 編集開始
function handleStartEdit(messageId: string) {
  const message = messagesById.value.get(messageId);
  if (!message) return;
  editingMessageId.value = messageId;
  editingText.value = message.text;
}

// 編集保存
async function handleSaveEdit(text: string) {
  if (!editingMessageId.value) return;
  try {
    await updateProjectMessage(projectId.value, editingMessageId.value, text);
    editingMessageId.value = null;
    editingText.value = "";
  } catch (e) {
    logger.error`Failed to update message: ${e}`;
  }
}

// 編集キャンセル
function handleCancelEdit() {
  editingMessageId.value = null;
  editingText.value = "";
}

// コピー
function handleCopy(text: string) {
  // 一時的なフィードバック（必要に応じてトースト通知に置き換え）
  copiedMessageId.value = text;
  setTimeout(() => {
    copiedMessageId.value = null;
  }, 2000);
}

// 削除
async function handleDelete(messageId: string) {
  if (!confirm("このメッセージを削除しますか？")) return;
  try {
    await deleteProjectMessage(projectId.value, messageId);
  } catch (e) {
    logger.error`Failed to delete message: ${e}`;
  }
}

function taskStatusLabel(status?: string) {
  if (status === "todo") return "未着手";
  if (status === "in-progress") return "進行中";
  if (status === "done") return "完了";
  return "未設定";
}

// カスタムスレッド設定関連
function openThreadSettings() {
  if (currentChannel.value.type !== "custom") return;
  threadSettingsForm.value = {
    name: currentChannel.value.name,
    description: currentChannel.value.description || "",
    allowedRoles: [...(currentChannel.value.allowedRoles || [])],
    settingsAllowedRoles: [
      ...(currentChannel.value.settingsAllowedRoles || []),
    ],
  };
  showThreadSettings.value = true;
}

function closeThreadSettings() {
  showThreadSettings.value = false;
  showArchiveConfirm.value = false;
}

async function saveThreadSettings() {
  if (!currentChannel.value || currentChannel.value.type !== "custom") return;
  isSavingSettings.value = true;
  try {
    const threadRef = doc(
      db,
      "projects",
      projectId.value,
      "threads",
      currentChannel.value.id,
    );
    await updateDoc(threadRef, {
      name: threadSettingsForm.value.name.trim() || "未命名スレッド",
      description: threadSettingsForm.value.description.trim(),
      allowedRoles: threadSettingsForm.value.allowedRoles,
      settingsAllowedRoles: threadSettingsForm.value.settingsAllowedRoles,
      updatedAt: serverTimestamp(),
    });
    closeThreadSettings();
  } catch (e) {
    logger.error`Failed to save thread settings: ${e}`;
  } finally {
    isSavingSettings.value = false;
  }
}

async function archiveThread() {
  if (!currentChannel.value || currentChannel.value.type !== "custom") return;
  isSavingSettings.value = true;
  try {
    const threadRef = doc(
      db,
      "projects",
      projectId.value,
      "threads",
      currentChannel.value.id,
    );
    await updateDoc(threadRef, {
      archived: true,
      updatedAt: serverTimestamp(),
    });
    closeThreadSettings();
    activeChannelId.value = "general";
  } catch (e) {
    logger.error`Failed to archive thread: ${e}`;
  } finally {
    isSavingSettings.value = false;
  }
}

async function unarchiveThread(threadId: string) {
  isSavingSettings.value = true;
  try {
    const threadRef = doc(db, "projects", projectId.value, "threads", threadId);
    await updateDoc(threadRef, {
      archived: false,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    logger.error`Failed to unarchive thread: ${e}`;
  } finally {
    isSavingSettings.value = false;
  }
}

function toggleAllowedRole(roleId: string) {
  const idx = threadSettingsForm.value.allowedRoles.indexOf(roleId);
  if (idx === -1) {
    threadSettingsForm.value.allowedRoles.push(roleId);
  } else {
    threadSettingsForm.value.allowedRoles.splice(idx, 1);
  }
}

function toggleSettingsAllowedRole(roleId: string) {
  const idx = threadSettingsForm.value.settingsAllowedRoles.indexOf(roleId);
  if (idx === -1) {
    threadSettingsForm.value.settingsAllowedRoles.push(roleId);
  } else {
    threadSettingsForm.value.settingsAllowedRoles.splice(idx, 1);
  }
}

// メッセージをIDで高速検索
const messagesById = computed(() => {
  const map = new Map<string, ChatMessage>();
  messages.value.forEach((m) => map.set(m.id, m));
  return map;
});

// 返信先メッセージ
const replyingToMessage = computed(() => {
  if (!replyingToId.value) return null;
  return messagesById.value.get(replyingToId.value) ?? null;
});

// 現在のユーザーがOwner/Adminか
const isCurrentUserAdmin = computed(() => {
  if (!user.value?.uid) return false;
  const member = projectMembers.value.find((m) => m.userId === user.value?.uid);
  if (!member) return false;
  return member.role === "owner" || member.role === "admin";
});

// 現在のユーザーがスレッド設定を編集できるか（Admin/Owner、作成者、または許可されたカスタムロール）
const canEditThreadSettings = computed(() => {
  if (currentChannel.value.type !== "custom") return false;
  if (!user.value?.uid) return false;
  // Admin/Ownerは常に編集可能
  if (isCurrentUserAdmin.value) return true;
  // 作成者は常に編集可能
  if (currentChannel.value.createdBy === user.value.uid) return true;
  // settingsAllowedRolesが設定されている場合、そのロールを持つユーザーも編集可能
  const settingsAllowedRoles = currentChannel.value.settingsAllowedRoles || [];
  if (settingsAllowedRoles.length === 0) return false;
  const userMember = projectMembers.value.find(
    (m) => m.userId === user.value?.uid,
  );
  if (!userMember) return false;
  const memberRoles = userMember.roles || [];
  return settingsAllowedRoles.some((roleId) => memberRoles.includes(roleId));
});

// メッセージの返信先情報を取得
function getReplyToInfo(message: ChatMessage) {
  if (!message.replyToId) return { text: undefined, sender: undefined };
  const replyTo = messagesById.value.get(message.replyToId);
  if (!replyTo) return { text: undefined, sender: undefined };
  return {
    text:
      replyTo.text?.slice(0, 100) + (replyTo.text?.length > 100 ? "..." : ""),
    sender: replyTo.senderName,
  };
}

// 現在のユーザーがメッセージを送信可能かどうか
const canSendMessage = computed(() => {
  // generalチャンネルは全員送信可能
  if (currentChannel.value.type === "general") return true;
  // タスクチャンネルは全員送信可能
  if (currentChannel.value.type === "task") return true;
  // カスタムチャンネルはallowedRolesをチェック
  const allowedRoles = currentChannel.value.allowedRoles || [];
  if (allowedRoles.length === 0) return true; // 空の場合は全員許可
  // ユーザーのロールを取得
  const userMember = projectMembers.value.find(
    (m) => m.userId === user.value?.uid,
  );
  if (!userMember) return false;
  // ユーザーのロール配列でチェック
  const memberRoles = userMember.roles || [];
  return allowedRoles.some((roleId) => memberRoles.includes(roleId));
});

// スワイプ検出用の状態
const touchStartX = ref(0);
const touchStartY = ref(0);
const SWIPE_THRESHOLD = 50;
const SWIPE_ANGLE_THRESHOLD = 30; // 角度制限（度）

function handleTouchStart(e: TouchEvent) {
  const touch = e.touches[0];
  if (!touch) return;
  touchStartX.value = touch.clientX;
  touchStartY.value = touch.clientY;
}

function handleTouchEnd(e: TouchEvent) {
  const touch = e.changedTouches[0];
  if (!touch) return;
  const touchEndX = touch.clientX;
  const touchEndY = touch.clientY;
  const diffX = touchStartX.value - touchEndX;
  const diffY = touchStartY.value - touchEndY;

  // 角度をチェック（水平方向のスワイプのみ検出）
  const angle = Math.abs(Math.atan2(diffY, diffX) * (180 / Math.PI));
  const isHorizontalSwipe =
    angle < SWIPE_ANGLE_THRESHOLD || angle > 180 - SWIPE_ANGLE_THRESHOLD;

  // 右から左へのスワイプ（画面右端から開始）
  if (
    diffX > SWIPE_THRESHOLD &&
    isHorizontalSwipe &&
    touchStartX.value > window.innerWidth * 0.7
  ) {
    showMobileThreads.value = true;
  }
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
              <span class="section-count">{{ activeTaskChannels.length }}</span>
            </div>
            <!-- アクティブなタスクチャンネル -->
            <div class="thread-list thread-list--scrollable">
              <button
                v-for="taskChannel in visibleActiveTaskChannels"
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
                v-if="hiddenActiveTaskCount > 0 && !showAllTaskChannels"
                type="button"
                class="show-all-btn"
                @click="showAllTaskChannels = true"
              >
                他 {{ hiddenActiveTaskCount }} 件を表示...
              </button>
              <button
                v-if="
                  showAllTaskChannels &&
                  activeTaskChannels.length > MAX_VISIBLE_TASK_CHANNELS
                "
                type="button"
                class="show-all-btn"
                @click="showAllTaskChannels = false"
              >
                折りたたむ
              </button>
            </div>
            <p v-if="!activeTaskChannels.length" class="empty-text">
              アクティブなタスクスレッドがありません。
            </p>

            <!-- アーカイブ済みタスクチャンネル -->
            <div
              v-if="archivedTaskChannels.length > 0"
              class="archived-section"
            >
              <button
                type="button"
                class="archived-toggle-btn"
                @click="showArchivedTaskChannels = !showArchivedTaskChannels"
              >
                <svg
                  class="archived-toggle-icon"
                  :class="{ 'is-open': showArchivedTaskChannels }"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  width="14"
                  height="14"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
                <span>アーカイブ済み ({{ archivedTaskChannels.length }})</span>
              </button>
              <div v-if="showArchivedTaskChannels" class="thread-list">
                <button
                  v-for="taskChannel in archivedTaskChannels"
                  :key="taskChannel.id"
                  class="channel-item channel-item--archived"
                  :class="{ active: activeChannelId === taskChannel.id }"
                  @click="selectChannel(taskChannel.id)"
                >
                  <span class="channel-name"># {{ taskChannel.name }}</span>
                  <span class="task-status task-status--archived">完了</span>
                </button>
              </div>
            </div>
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
            <!-- アクティブなカスタムスレッド -->
            <div class="thread-list">
              <div
                v-for="th in activeCustomChannels"
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
            <p v-if="!activeCustomChannels.length" class="empty-text">
              スレッドがありません
            </p>

            <!-- アーカイブ済みカスタムスレッド -->
            <div
              v-if="archivedCustomChannels.length > 0"
              class="archived-section"
            >
              <button
                type="button"
                class="archived-toggle-btn"
                @click="
                  showArchivedCustomChannels = !showArchivedCustomChannels
                "
              >
                <svg
                  class="archived-toggle-icon"
                  :class="{ 'is-open': showArchivedCustomChannels }"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  width="14"
                  height="14"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
                <span
                  >アーカイブ済み ({{ archivedCustomChannels.length }})</span
                >
              </button>
              <div v-if="showArchivedCustomChannels" class="thread-list">
                <div
                  v-for="th in archivedCustomChannels"
                  :key="th.id"
                  class="channel-item channel-item--archived"
                  :class="{ active: activeChannelId === th.id }"
                  @click="selectChannel(th.id)"
                >
                  <span class="channel-name"># {{ th.name }}</span>
                  <button
                    class="unarchive-btn"
                    @click.stop="unarchiveThread(th.id)"
                    title="アーカイブ解除"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      width="14"
                      height="14"
                    >
                      <path
                        d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"
                      />
                      <path d="M3 3v5h5" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <!-- Chat Area -->
        <main
          class="chat-main"
          @touchstart="handleTouchStart"
          @touchend="handleTouchEnd"
        >
          <header class="chat-header">
            <div class="chat-header__main">
              <div class="chat-header__title-row">
                <h3># {{ currentChannel.name }}</h3>
                <span
                  v-if="isCurrentChannelArchived"
                  class="archived-badge"
                  title="このスレッドはアーカイブされています"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    width="12"
                    height="12"
                  >
                    <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
                  </svg>
                  アーカイブ
                </span>
              </div>
              <p v-if="currentChannel.description" class="desc">
                {{ currentChannel.description }}
              </p>
            </div>
            <div class="chat-header__actions">
              <!-- モバイル用スレッド一覧ボタン -->
              <button
                type="button"
                class="chat-header__threads-btn"
                aria-label="スレッド一覧を開く"
                @click="toggleMobileThreads"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  width="20"
                  height="20"
                >
                  <path
                    d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                  />
                  <line x1="9" y1="10" x2="15" y2="10" />
                </svg>
              </button>
              <!-- カスタムスレッド設定ボタン（Admin/Owner または作成者のみ） -->
              <button
                v-if="canEditThreadSettings"
                class="chat-header__settings-btn"
                @click="openThreadSettings"
                title="スレッド設定"
                aria-label="スレッド設定を開く"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  width="18"
                  height="18"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path
                    d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
                  />
                </svg>
              </button>
              <!-- タスクスレッド復元ボタン -->
              <button
                v-if="
                  currentChannel.type === 'task' && isCurrentChannelArchived
                "
                class="chat-header__restore-btn"
                @click="toggleTaskArchive(currentChannel.id, true)"
                title="アーカイブを解除"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  width="16"
                  height="16"
                >
                  <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                復元
              </button>
              <!-- タスクを開くボタン -->
              <button
                v-if="currentChannel.type === 'task'"
                class="chat-header__task-btn"
                @click="handleOpenTask(currentChannel.id)"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  width="16"
                  height="16"
                >
                  <path
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                タスクを開く
              </button>
            </div>
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
              :data-message-id="msg.id"
            >
              <!-- 編集モード -->
              <div v-if="editingMessageId === msg.id" class="msg-editing">
                <ChatMessageEditor
                  :initial-text="editingText"
                  :is-editing="true"
                  @save="handleSaveEdit"
                  @cancel="handleCancelEdit"
                />
              </div>
              <!-- 通常表示 -->
              <ChatMessageItem
                v-else
                :message="msg"
                :current-user-id="user?.uid"
                :is-admin="isCurrentUserAdmin"
                :reply-to-text="getReplyToInfo(msg).text"
                :reply-to-sender="getReplyToInfo(msg).sender"
                @react="handleReact"
                @reply="handleStartReply"
                @edit="handleStartEdit"
                @copy="handleCopy"
                @delete="handleDelete"
                @scroll-to-reply="scrollToMessage"
              />
            </div>
          </div>

          <div
            class="composer"
            :class="{ 'composer--disabled': !canSendMessage }"
          >
            <div v-if="!canSendMessage" class="composer-restriction-notice">
              このスレッドへの投稿は特定のロールに制限されています
            </div>
            <template v-else>
              <!-- 返信先表示 -->
              <ChatReplyIndicator
                v-if="replyingToMessage"
                :sender-name="replyingToMessage.senderName || '不明'"
                :message-text="
                  replyingToMessage.text?.slice(0, 100) +
                  (replyingToMessage.text?.length > 100 ? '...' : '')
                "
                @cancel="handleCancelReply"
                @click="scrollToMessage(replyingToId!)"
              />
              <div class="composer-row">
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
                  @keydown.enter="handleComposerEnter"
                  :placeholder="
                    replyingToMessage ? '返信を入力...' : 'メッセージを送信...'
                  "
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
            </template>
          </div>
        </main>
      </div>
    </div>

    <!-- モバイル用スレッドドロワー（右からスライド） -->
    <AppDrawer
      :open="showMobileThreads"
      title="スレッド"
      width="280px"
      class="mobile-threads-drawer-right"
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
            <span class="section-count">{{ activeTaskChannels.length }}</span>
          </div>
          <!-- アクティブなタスクチャンネル -->
          <div class="thread-list thread-list--scrollable">
            <button
              v-for="taskChannel in visibleActiveTaskChannels"
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
              v-if="hiddenActiveTaskCount > 0 && !showAllTaskChannels"
              type="button"
              class="show-all-btn"
              @click="showAllTaskChannels = true"
            >
              他 {{ hiddenActiveTaskCount }} 件を表示...
            </button>
            <button
              v-if="
                showAllTaskChannels &&
                activeTaskChannels.length > MAX_VISIBLE_TASK_CHANNELS
              "
              type="button"
              class="show-all-btn"
              @click="showAllTaskChannels = false"
            >
              折りたたむ
            </button>
          </div>
          <p v-if="!activeTaskChannels.length" class="empty-text">
            アクティブなタスクスレッドがありません。
          </p>

          <!-- アーカイブ済みタスクチャンネル（モバイル） -->
          <div v-if="archivedTaskChannels.length > 0" class="archived-section">
            <button
              type="button"
              class="archived-toggle-btn"
              @click="showArchivedTaskChannels = !showArchivedTaskChannels"
            >
              <svg
                class="archived-toggle-icon"
                :class="{ 'is-open': showArchivedTaskChannels }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                width="14"
                height="14"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              <span>アーカイブ済み ({{ archivedTaskChannels.length }})</span>
            </button>
            <div v-if="showArchivedTaskChannels" class="thread-list">
              <button
                v-for="taskChannel in archivedTaskChannels"
                :key="taskChannel.id"
                class="channel-item channel-item--archived"
                :class="{ active: activeChannelId === taskChannel.id }"
                @click="selectChannelWithClose(taskChannel.id)"
              >
                <span class="channel-name"># {{ taskChannel.name }}</span>
                <span class="task-status task-status--archived">完了</span>
              </button>
            </div>
          </div>
        </div>

        <!-- カスタムスレッド -->
        <div class="panel-section">
          <h3 class="section-title">カスタムスレッド</h3>
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
          <!-- モバイル用スレッド作成ボタン -->
          <button
            class="mobile-add-thread-btn"
            @click="customThreadFormOpen = true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              width="16"
              height="16"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            新しいスレッドを作成
          </button>
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
        @task-updated="handleTaskUpdated"
      />
    </Teleport>

    <!-- スレッド作成モーダル -->
    <AppModal
      :open="customThreadFormOpen"
      title="新規スレッドを作成"
      size="md"
      @close="closeThreadModal"
    >
      <div class="thread-modal-form">
        <div class="form-field">
          <label class="form-label"
            >スレッド名 <span class="required">*</span></label
          >
          <AppInput
            v-model="customThreadForm.name"
            placeholder="スレッド名を入力"
          />
        </div>
        <div class="form-field">
          <label class="form-label">説明</label>
          <AppTextarea
            v-model="customThreadForm.description"
            placeholder="スレッドの説明（任意）"
            :rows="3"
            resize="none"
          />
        </div>
        <!-- ロールベースの送信権限 -->
        <div class="form-field">
          <label class="form-label">送信権限（任意）</label>
          <p class="form-hint">
            特定のロールのメンバーのみがメッセージを送信できるように制限できます。
            何も選択しない場合は全員が送信可能です。
          </p>
          <div class="role-checkboxes">
            <div
              v-for="role in projectRoles"
              :key="role.id"
              class="role-checkbox-item"
            >
              <AppCheckbox
                :model-value="customThreadForm.allowedRoles.includes(role.id)"
                :label="role.name"
                @update:model-value="toggleCreateFormRole(role.id)"
              />
            </div>
            <p v-if="!projectRoles.length" class="empty-text">
              ロールが設定されていません
            </p>
          </div>
        </div>
        <!-- ロールベースの設定編集権限 -->
        <div class="form-field">
          <label class="form-label">設定編集権限（任意）</label>
          <p class="form-hint">
            特定のロールのメンバーにスレッド設定の編集を許可できます。
            Admin・オーナー・作成者は常に編集可能です。
          </p>
          <div class="role-checkboxes">
            <div
              v-for="role in projectRoles"
              :key="role.id"
              class="role-checkbox-item"
            >
              <AppCheckbox
                :model-value="
                  customThreadForm.settingsAllowedRoles.includes(role.id)
                "
                :label="role.name"
                @update:model-value="toggleCreateFormSettingsRole(role.id)"
              />
            </div>
            <p v-if="!projectRoles.length" class="empty-text">
              ロールが設定されていません
            </p>
          </div>
        </div>
      </div>
      <template #footer>
        <AppButton variant="ghost" @click="closeThreadModal">
          キャンセル
        </AppButton>
        <AppButton
          variant="primary"
          :disabled="isCreateThreadDisabled"
          @click="createCustomThread"
        >
          作成
        </AppButton>
      </template>
    </AppModal>

    <!-- スレッド設定モーダル -->
    <AppModal
      :open="showThreadSettings"
      title="スレッド設定"
      size="md"
      @close="closeThreadSettings"
    >
      <div class="thread-settings-form">
        <!-- スレッド名 -->
        <div class="form-field">
          <label class="form-label">スレッド名</label>
          <AppInput
            v-model="threadSettingsForm.name"
            placeholder="スレッド名を入力"
          />
        </div>

        <!-- 説明 -->
        <div class="form-field">
          <label class="form-label">説明</label>
          <AppTextarea
            v-model="threadSettingsForm.description"
            placeholder="スレッドの説明（任意）"
            :rows="3"
            resize="none"
          />
        </div>

        <!-- ロールベースの送信権限 -->
        <div class="form-field">
          <label class="form-label">送信権限</label>
          <p class="form-hint">
            特定のロールのメンバーのみがメッセージを送信できるように制限できます。
            何も選択しない場合は全員が送信可能です。
          </p>
          <div class="role-checkboxes">
            <div
              v-for="role in projectRoles"
              :key="role.id"
              class="role-checkbox-item"
            >
              <AppCheckbox
                :model-value="threadSettingsForm.allowedRoles.includes(role.id)"
                :label="role.name"
                @update:model-value="toggleAllowedRole(role.id)"
              />
            </div>
            <p v-if="!projectRoles.length" class="empty-text">
              ロールが設定されていません
            </p>
          </div>
        </div>

        <!-- ロールベースの設定編集権限 -->
        <div class="form-field">
          <label class="form-label">設定編集権限</label>
          <p class="form-hint">
            特定のロールのメンバーにスレッド設定の編集を許可できます。
            Admin・オーナー・作成者は常に編集可能です。
          </p>
          <div class="role-checkboxes">
            <div
              v-for="role in projectRoles"
              :key="role.id"
              class="role-checkbox-item"
            >
              <AppCheckbox
                :model-value="
                  threadSettingsForm.settingsAllowedRoles.includes(role.id)
                "
                :label="role.name"
                @update:model-value="toggleSettingsAllowedRole(role.id)"
              />
            </div>
            <p v-if="!projectRoles.length" class="empty-text">
              ロールが設定されていません
            </p>
          </div>
        </div>

        <!-- アーカイブセクション -->
        <div class="form-field form-field--danger">
          <label class="form-label">アーカイブ</label>
          <p class="form-hint">
            アーカイブすると、このスレッドは一覧から非表示になります。
            後からアーカイブを解除できます。
          </p>
          <div v-if="!showArchiveConfirm">
            <AppButton
              variant="outline"
              size="sm"
              @click="showArchiveConfirm = true"
            >
              スレッドをアーカイブ
            </AppButton>
          </div>
          <div v-else class="archive-confirm">
            <p class="archive-confirm-text">
              本当にこのスレッドをアーカイブしますか？
            </p>
            <div class="archive-confirm-actions">
              <AppButton
                variant="ghost"
                size="sm"
                @click="showArchiveConfirm = false"
              >
                キャンセル
              </AppButton>
              <AppButton
                variant="danger"
                size="sm"
                :disabled="isSavingSettings"
                @click="archiveThread"
              >
                アーカイブする
              </AppButton>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <AppButton variant="ghost" @click="closeThreadSettings">
          キャンセル
        </AppButton>
        <AppButton
          variant="primary"
          :disabled="isSavingSettings || !threadSettingsForm.name.trim()"
          @click="saveThreadSettings"
        >
          保存
        </AppButton>
      </template>
    </AppModal>
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

/* アーカイブ済みタスクのステータス */
.task-status--archived {
  color: var(--ui-text-subtle);
}

/* アーカイブされたチャンネルアイテム */
.channel-item--archived {
  opacity: 0.7;
  color: var(--ui-text-muted);
}

.channel-item--archived .channel-name {
  color: var(--ui-text-muted);
}

.channel-item--archived:hover {
  opacity: 0.85;
}

.channel-item--archived.active {
  opacity: 1;
  background: var(--ui-surface-muted);
}

/* アーカイブセクション */
.archived-section {
  margin-top: var(--ui-space-3);
  padding-top: var(--ui-space-2);
  border-top: 1px solid var(--ui-border-light);
}

.archived-toggle-btn {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  width: 100%;
  padding: var(--ui-space-2) var(--ui-space-2);
  border: none;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-medium);
  cursor: pointer;
  text-align: left;
  transition: var(--ui-transition-colors);
}

.archived-toggle-btn:hover {
  color: var(--ui-text);
  background: rgba(0, 0, 0, 0.02);
}

.archived-toggle-icon {
  flex-shrink: 0;
  transition: transform var(--ui-duration-fast) var(--ui-ease-standard);
}

.archived-toggle-icon.is-open {
  transform: rotate(90deg);
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
  min-height: 60px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  padding: var(--ui-space-3) var(--ui-space-5);
  border-bottom: 1px solid var(--ui-border-light);
}

.chat-header__main {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  flex: 1;
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

.chat-header__task-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2) var(--ui-space-3);
  background: var(--ui-brand-100);
  color: var(--ui-brand-700);
  border: 1px solid var(--ui-brand-300);
  border-radius: var(--ui-radius-md);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-semibold);
  cursor: pointer;
  white-space: nowrap;
  transition: var(--ui-transition-colors);
}

.chat-header__task-btn:hover {
  background: var(--ui-brand-200);
  border-color: var(--ui-brand-400);
}

.chat-header__task-btn svg {
  flex-shrink: 0;
}

/* チャットヘッダーのタイトル行 */
.chat-header__title-row {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

/* チャットヘッダーのアクションボタン群 */
.chat-header__actions {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

/* アーカイブバッジ */
.archived-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  padding: 2px var(--ui-space-2);
  background: var(--ui-surface-muted);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-full);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-medium);
  color: var(--ui-text-muted);
}

.archived-badge svg {
  flex-shrink: 0;
}

/* 復元ボタン */
.chat-header__restore-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2) var(--ui-space-3);
  background: var(--ui-success-light);
  color: var(--ui-success-text);
  border: 1px solid var(--ui-success-200);
  border-radius: var(--ui-radius-md);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-semibold);
  cursor: pointer;
  white-space: nowrap;
  transition: var(--ui-transition-colors);
}

.chat-header__restore-btn:hover {
  background: var(--ui-success-200);
  border-color: var(--ui-success);
}

.chat-header__restore-btn svg {
  flex-shrink: 0;
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

/* モバイル用スレッド一覧ボタン（chat-header内） */
.chat-header__threads-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  background: var(--ui-brand-100);
  color: var(--ui-brand-700);
  border: 1px solid var(--ui-brand-300);
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.chat-header__threads-btn:hover {
  background: var(--ui-brand-200);
  border-color: var(--ui-brand-400);
}

.chat-header__threads-btn:active {
  transform: scale(0.95);
}

.chat-header__threads-btn svg {
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .chat-header__threads-btn {
    display: flex;
  }
}

/* モバイル用スレッド作成ボタン */
.mobile-add-thread-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-2);
  width: 100%;
  margin-top: var(--ui-space-3);
  padding: var(--ui-space-3);
  border: 1px dashed var(--ui-border);
  border-radius: var(--ui-radius-md);
  background: transparent;
  color: var(--ui-text-muted);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-medium);
  cursor: pointer;
  transition: var(--ui-transition-colors);
  min-height: 44px;
}

.mobile-add-thread-btn:hover {
  border-color: var(--ui-brand-500);
  color: var(--ui-brand-600);
  background: var(--ui-brand-50);
}

.mobile-add-thread-btn:active {
  background: var(--ui-brand-100);
  transform: scale(0.98);
}

/* Mobile Drawer Content */
.mobile-threads-content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6);
  padding: var(--ui-space-2);
}

/* Mobile Drawer を右からスライドさせる */
.mobile-threads-drawer-right :deep(.app-drawer__overlay) {
  justify-content: flex-end;
}

.mobile-threads-drawer-right :deep(.app-drawer__panel) {
  border-radius: var(--ui-radius-lg) 0 0 var(--ui-radius-lg);
}

/* Chat link styles (for v-html content) */
.msg-text :deep(.chat-link) {
  color: var(--ui-info, #0284c7);
  text-decoration: underline;
}

.msg-text :deep(.chat-link:hover) {
  color: var(--ui-brand-600, #4f7c82);
}

/* Thread Create Modal Form */
.thread-modal-form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.form-label {
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-medium);
  color: var(--ui-text-strong);
}

.form-label .required {
  color: var(--ui-danger);
}

/* Thread Settings Modal */
.thread-settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5);
}

.form-hint {
  font-size: var(--ui-text-xs);
  color: var(--ui-text-muted);
  margin: 0;
}

.role-checkboxes {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  margin-top: var(--ui-space-2);
}

.role-checkbox-item {
  display: flex;
  align-items: center;
}

.form-field--danger {
  padding-top: var(--ui-space-4);
  border-top: 1px solid var(--ui-border-light);
}

.archive-confirm {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
}

.archive-confirm-text {
  font-size: var(--ui-text-sm);
  color: var(--ui-text);
  margin: 0;
}

.archive-confirm-actions {
  display: flex;
  gap: var(--ui-space-2);
}

/* Settings button in header */
.chat-header__settings-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  background: transparent;
  color: var(--ui-text-muted);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.chat-header__settings-btn:hover {
  background: var(--ui-surface-muted);
  color: var(--ui-text);
  border-color: var(--ui-border-light);
}

/* Archived channel styles */
.channel-item--archived {
  opacity: 0.6;
}

.archived-section {
  margin-top: var(--ui-space-3);
  padding-top: var(--ui-space-2);
}

.archived-toggle-btn {
  display: flex;
  align-items: center;
  gap: var(--ui-space-1);
  width: 100%;
  padding: var(--ui-space-2);
  background: transparent;
  border: none;
  color: var(--ui-text-muted);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-medium);
  cursor: pointer;
  text-align: left;
  transition: var(--ui-transition-colors);
}

.archived-toggle-btn:hover {
  color: var(--ui-text);
}

.archived-toggle-icon {
  transition: transform 0.2s ease;
}

.archived-toggle-icon.is-open {
  transform: rotate(90deg);
}

.task-status--archived {
  color: var(--ui-text-subtle);
}

.unarchive-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--ui-text-subtle);
  cursor: pointer;
  border-radius: var(--ui-radius-sm);
  transition: var(--ui-transition-colors);
}

.unarchive-btn:hover {
  background: var(--ui-surface-muted);
  color: var(--ui-brand-600);
}

/* Composer restriction notice */
.composer--disabled {
  justify-content: center;
}

.composer-restriction-notice {
  padding: var(--ui-space-3) var(--ui-space-4);
  background: var(--ui-warning-50);
  border: 1px solid var(--ui-warning-200);
  border-radius: var(--ui-radius-md);
  color: var(--ui-warning-700);
  font-size: var(--ui-text-sm);
  text-align: center;
}

/* メッセージ編集モード */
.msg-editing {
  padding: var(--ui-space-3);
  margin: var(--ui-space-2) 0;
  background: var(--ui-surface-muted);
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-brand-200);
}

/* メッセージハイライト（返信先スクロール時） */
[data-message-id].highlight {
  animation: message-highlight 2s ease-out;
}

@keyframes message-highlight {
  0% {
    background: var(--ui-brand-100);
  }
  100% {
    background: transparent;
  }
}

/* Composer 返信表示時のレイアウト調整 */
.composer {
  flex-direction: column;
}

.composer > :deep(.reply-indicator) {
  margin-bottom: var(--ui-space-2);
}

.composer-row {
  display: flex;
  gap: var(--ui-space-3);
  align-items: center;
}
</style>

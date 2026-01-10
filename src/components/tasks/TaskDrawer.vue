<script setup lang="ts">
/**
 * TaskDrawer - 統一タスクドロワー
 *
 * MyTasksを基準に、全ページで同じUIでタスク詳細を表示。
 * 3タブ構成: 概要 / スレッド / ログ
 * 軽編集可能（ステータス/担当/期限/進捗）
 */
import { computed, ref, watch, onBeforeUnmount } from "vue";
import AppDrawer from "@/components/ui/AppDrawer.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppEmptyState from "@/components/ui/AppEmptyState.vue";
import TaskStatusBadge from "@/components/ui/TaskStatusBadge.vue";
import UserAvatar from "@/components/common/UserAvatar.vue";
import type { TaskDoc, TaskStatus } from "@/services/taskService";
import { updateTask } from "@/services/taskService";
import type { TaskCategory } from "@/services/taskCategoryService";
import type { ProjectMember } from "@/services/projectMembers";
import {
  listenTaskDiscussion,
  sendTaskDiscussionMessage,
  type TaskDiscussionMessage,
} from "@/services/taskDiscussionService";
import { listenProjectEvents } from "@/services/projectActivityLogService";
import type { ProjectEvent } from "@/types/projectEvent";
import { useAuthStore } from "@/store/auth";
import {
  getStatusLabel,
  getDueMessage,
  getDueClass,
  formatDueDate,
  formatDueDateISO,
  formatDateTime,
  normalizeProgress,
} from "@/utils/taskUi";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.components.tasks.TaskDrawer");

const props = defineProps<{
  projectId: string;
  taskId: string | null;
  tasks: TaskDoc[];
  categoriesById?: Map<string, TaskCategory>;
  membersById?: Map<string, ProjectMember>;
  members?: ProjectMember[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const { user, profile } = useAuthStore();
const activeTab = ref<"overview" | "thread" | "log">("overview");
const threadMessages = ref<TaskDiscussionMessage[]>([]);
const activityLogs = ref<ProjectEvent[]>([]);
const messageInput = ref("");
const isEditing = ref(false);

// Edit form state
const editForm = ref({
  status: "" as TaskStatus,
  assigneeId: "" as string | null,
  dueDate: "",
  progress: 0,
});

let unsubscribeThread: (() => void) | null = null;
let unsubscribeLogs: (() => void) | null = null;

const isOpen = computed(() => props.taskId !== null);

const task = computed(() => {
  if (!props.taskId) return null;
  return props.tasks.find((t) => t.id === props.taskId) || null;
});

const categoryName = computed(() => {
  if (!task.value?.categoryId || !props.categoriesById) return null;
  return props.categoriesById.get(task.value.categoryId)?.name || null;
});

const membersList = computed(() => {
  if (props.members) return props.members;
  if (props.membersById) return Array.from(props.membersById.values());
  return [];
});

// タスクに関連するログのみフィルタリング
const taskRelatedLogs = computed(() => {
  if (!task.value) return [];
  return activityLogs.value.filter((log) => {
    const payload = log.payload as Record<string, any>;
    return payload?.taskId === task.value?.id;
  });
});

// タスクが変わったらタブをリセットし、購読を更新
watch(
  () => props.taskId,
  (newTaskId) => {
    activeTab.value = "overview";
    isEditing.value = false;
    messageInput.value = "";

    // 購読解除
    unsubscribeThread?.();
    unsubscribeLogs?.();
    unsubscribeThread = null;
    unsubscribeLogs = null;

    if (newTaskId && props.projectId) {
      // スレッド購読
      unsubscribeThread = listenTaskDiscussion(
        props.projectId,
        newTaskId,
        (messages) => {
          threadMessages.value = messages;
        },
      );

      // アクティビティログ購読
      unsubscribeLogs = listenProjectEvents(
        props.projectId,
        (events) => {
          activityLogs.value = events;
        },
        { limitSize: 100 },
      );
    }
  },
  { immediate: true },
);

// 編集モードに入るときにフォームを初期化
watch(isEditing, (editing) => {
  if (editing && task.value) {
    editForm.value = {
      status: task.value.status,
      assigneeId: task.value.assigneeId || null,
      dueDate: formatDueDateISO(task.value.dueDate),
      progress: task.value.progress ?? 0,
    };
  }
});

onBeforeUnmount(() => {
  unsubscribeThread?.();
  unsubscribeLogs?.();
});

function handleClose() {
  emit("close");
}

async function handleSaveEdit() {
  if (!task.value || !props.projectId) return;

  try {
    const updates: Partial<{
      status: TaskStatus;
      assigneeId: string | null;
      assigneeName: string | null;
      dueDate: Date | null;
      progress: number;
    }> = {};

    // ステータスの変更
    if (editForm.value.status !== task.value.status) {
      updates.status = editForm.value.status;
    }

    // 担当者の変更
    if (editForm.value.assigneeId !== (task.value.assigneeId || null)) {
      updates.assigneeId = editForm.value.assigneeId;
      if (editForm.value.assigneeId && props.membersById) {
        const member = props.membersById.get(editForm.value.assigneeId);
        updates.assigneeName =
          member?.displayName || member?.nickname || member?.fullName || null;
      } else {
        updates.assigneeName = null;
      }
    }

    // 期限の変更
    const newDueDateStr = editForm.value.dueDate;
    const currentDueDateStr = formatDueDateISO(task.value.dueDate);
    if (newDueDateStr !== currentDueDateStr) {
      updates.dueDate = newDueDateStr ? new Date(newDueDateStr) : null;
    }

    // 進捗の変更
    const normalizedProgress = normalizeProgress(editForm.value.progress);
    if (normalizedProgress !== (task.value.progress ?? 0)) {
      updates.progress = normalizedProgress;
    }

    if (Object.keys(updates).length > 0) {
      await updateTask(props.projectId, task.value.id, updates, {
        userId: user.value?.uid ?? null,
        actorName:
          profile.value?.nickname || profile.value?.fullName || "Unknown",
        origin: "ui",
      });
    }

    isEditing.value = false;
  } catch (error) {
    logger.error`Failed to update task: ${error}`;
  }
}

function handleCancelEdit() {
  isEditing.value = false;
}

async function handleSendMessage() {
  if (!messageInput.value.trim() || !task.value || !user.value) return;

  try {
    await sendTaskDiscussionMessage(props.projectId, task.value.id, {
      text: messageInput.value.trim(),
      senderId: user.value.uid,
      senderName:
        profile.value?.nickname || profile.value?.fullName || "ユーザー",
    });
    messageInput.value = "";
  } catch (error) {
    logger.error`Failed to send message: ${error}`;
  }
}

function formatEventType(event: ProjectEvent): string {
  const typeMap: Record<string, string> = {
    "task.created": "タスク作成",
    "task.updated": "タスク更新",
    "task.deleted": "タスク削除",
    "task.status_changed": "ステータス変更",
    "task.progress_changed": "進捗更新",
    "task.assigned": "担当者変更",
    "task.due_changed": "期限変更",
    "decision.made": "決定事項",
  };
  return typeMap[event.type] || event.type;
}

function formatEventDetail(event: ProjectEvent): string {
  const payload = event.payload as Record<string, any>;
  switch (event.type) {
    case "task.status_changed":
      return `${getStatusLabel(payload.fromStatus)} → ${getStatusLabel(payload.toStatus)}`;
    case "task.progress_changed":
      return `${payload.fromProgress}% → ${payload.toProgress}%`;
    case "task.assigned":
      return `${payload.fromAssigneeName || "未割当"} → ${payload.toAssigneeName || "未割当"}`;
    case "decision.made":
      return payload.text || "";
    default:
      return "";
  }
}
</script>

<template>
  <AppDrawer
    :open="isOpen"
    width="clamp(320px, 32vw, 440px)"
    @close="handleClose"
  >
    <template #header>
      <div v-if="task" class="task-drawer__header">
        <div class="task-drawer__header-top">
          <p class="task-drawer__eyebrow">タスク詳細</p>
          <TaskStatusBadge :status="task.status" />
        </div>
        <h3 class="task-drawer__title">{{ task.title }}</h3>
        <p v-if="categoryName" class="task-drawer__category">
          {{ categoryName }}
        </p>
      </div>
    </template>

    <div v-if="task" class="task-drawer__content">
      <!-- タブナビゲーション -->
      <div class="task-drawer__tabs" role="tablist">
        <button
          type="button"
          class="task-drawer__tab"
          :class="{ 'is-active': activeTab === 'overview' }"
          role="tab"
          :aria-selected="activeTab === 'overview'"
          @click="activeTab = 'overview'"
        >
          概要
        </button>
        <button
          type="button"
          class="task-drawer__tab"
          :class="{ 'is-active': activeTab === 'thread' }"
          role="tab"
          :aria-selected="activeTab === 'thread'"
          @click="activeTab = 'thread'"
        >
          スレッド
          <span v-if="threadMessages.length" class="task-drawer__tab-badge">
            {{ threadMessages.length }}
          </span>
        </button>
        <button
          type="button"
          class="task-drawer__tab"
          :class="{ 'is-active': activeTab === 'log' }"
          role="tab"
          :aria-selected="activeTab === 'log'"
          @click="activeTab = 'log'"
        >
          ログ
        </button>
      </div>

      <!-- 概要タブ -->
      <div
        v-if="activeTab === 'overview'"
        class="task-drawer__panel"
        role="tabpanel"
      >
        <template v-if="!isEditing">
          <!-- 読み取り専用モード -->
          <section class="task-drawer__section">
            <p class="task-drawer__label">ステータス</p>
            <div class="task-drawer__value">
              <TaskStatusBadge :status="task.status" />
              <span class="task-drawer__progress"
                >{{ task.progress ?? 0 }}%</span
              >
            </div>
          </section>

          <section class="task-drawer__section">
            <p class="task-drawer__label">担当者</p>
            <div class="task-drawer__value">
              {{ task.assigneeName || "未割当" }}
            </div>
          </section>

          <section class="task-drawer__section">
            <p class="task-drawer__label">期限</p>
            <div class="task-drawer__value">
              <span :class="['task-drawer__due', getDueClass(task)]">
                {{ formatDueDate(task.dueDate) }}
              </span>
              <span
                v-if="task.dueDate?.seconds"
                class="task-drawer__due-message"
                :class="getDueClass(task)"
              >
                {{ getDueMessage(task) }}
              </span>
            </div>
          </section>

          <section v-if="task.description" class="task-drawer__section">
            <p class="task-drawer__label">説明</p>
            <div class="task-drawer__description">
              {{ task.description }}
            </div>
          </section>

          <div class="task-drawer__actions">
            <AppButton variant="secondary" size="sm" @click="isEditing = true">
              編集
            </AppButton>
          </div>
        </template>

        <template v-else>
          <!-- 編集モード -->
          <section class="task-drawer__section">
            <label class="task-drawer__label" for="edit-status"
              >ステータス</label
            >
            <select
              id="edit-status"
              v-model="editForm.status"
              class="task-drawer__input"
            >
              <option value="todo">未着手</option>
              <option value="in-progress">進行中</option>
              <option value="review">レビュー待ち</option>
              <option value="done">完了</option>
            </select>
          </section>

          <section class="task-drawer__section">
            <label class="task-drawer__label" for="edit-assignee">担当者</label>
            <select
              id="edit-assignee"
              v-model="editForm.assigneeId"
              class="task-drawer__input"
            >
              <option :value="null">未割当</option>
              <option
                v-for="member in membersList"
                :key="member.userId"
                :value="member.userId"
              >
                {{
                  member.displayName ||
                  member.nickname ||
                  member.fullName ||
                  member.userId
                }}
              </option>
            </select>
          </section>

          <section class="task-drawer__section">
            <label class="task-drawer__label" for="edit-due">期限</label>
            <input
              id="edit-due"
              v-model="editForm.dueDate"
              type="date"
              class="task-drawer__input"
            />
          </section>

          <section class="task-drawer__section">
            <label class="task-drawer__label" for="edit-progress">進捗</label>
            <div class="task-drawer__progress-input">
              <input
                id="edit-progress"
                v-model.number="editForm.progress"
                type="range"
                min="0"
                max="100"
                step="25"
                class="task-drawer__range"
              />
              <span class="task-drawer__progress-value"
                >{{ editForm.progress }}%</span
              >
            </div>
          </section>

          <div class="task-drawer__actions">
            <AppButton variant="secondary" size="sm" @click="handleCancelEdit">
              キャンセル
            </AppButton>
            <AppButton variant="primary" size="sm" @click="handleSaveEdit">
              保存
            </AppButton>
          </div>
        </template>
      </div>

      <!-- スレッドタブ -->
      <div
        v-if="activeTab === 'thread'"
        class="task-drawer__panel task-drawer__panel--thread"
        role="tabpanel"
      >
        <div class="task-drawer__thread-messages">
          <AppEmptyState
            v-if="!threadMessages.length"
            title="まだ投稿がありません"
            description="このタスクについて議論を始めましょう。"
            icon="empty"
          />
          <div
            v-for="msg in threadMessages"
            :key="msg.id"
            class="task-drawer__message"
            :class="{ 'is-decision': msg.type === 'decision' }"
          >
            <UserAvatar
              :url="null"
              :name="msg.senderName"
              class="task-drawer__message-avatar"
            />
            <div class="task-drawer__message-content">
              <div class="task-drawer__message-meta">
                <span class="task-drawer__message-sender">{{
                  msg.senderName
                }}</span>
                <span class="task-drawer__message-time">{{
                  formatDateTime(msg.createdAt)
                }}</span>
              </div>
              <p class="task-drawer__message-text">{{ msg.text }}</p>
            </div>
          </div>
        </div>

        <div class="task-drawer__composer">
          <input
            v-model="messageInput"
            type="text"
            class="task-drawer__composer-input"
            placeholder="メッセージを入力... (/decide で決定事項)"
            @keydown.enter="handleSendMessage"
          />
          <AppButton
            variant="primary"
            size="sm"
            :disabled="!messageInput.trim()"
            @click="handleSendMessage"
          >
            送信
          </AppButton>
        </div>
      </div>

      <!-- ログタブ -->
      <div
        v-if="activeTab === 'log'"
        class="task-drawer__panel"
        role="tabpanel"
      >
        <AppEmptyState
          v-if="!taskRelatedLogs.length"
          title="アクティビティがありません"
          description="このタスクの変更履歴がここに表示されます。"
          icon="empty"
        />
        <div
          v-for="log in taskRelatedLogs"
          :key="log.id"
          class="task-drawer__log-item"
        >
          <div class="task-drawer__log-header">
            <span class="task-drawer__log-type">{{
              formatEventType(log)
            }}</span>
            <span class="task-drawer__log-time">{{
              formatDateTime(log.createdAt)
            }}</span>
          </div>
          <p class="task-drawer__log-actor">{{ log.actorName }}</p>
          <p v-if="formatEventDetail(log)" class="task-drawer__log-detail">
            {{ formatEventDetail(log) }}
          </p>
        </div>
      </div>
    </div>
  </AppDrawer>
</template>

<style scoped>
.task-drawer__header {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.task-drawer__header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2);
}

.task-drawer__eyebrow {
  margin: 0;
  font-size: var(--ui-text-xs);
  letter-spacing: 0.08em;
  color: var(--ui-text-muted);
  text-transform: uppercase;
}

.task-drawer__title {
  margin: var(--ui-space-1) 0 0;
  font-size: var(--ui-text-lg);
  font-weight: var(--ui-font-bold);
  color: var(--ui-text-strong);
  line-height: var(--ui-leading-tight);
}

.task-drawer__category {
  margin: var(--ui-space-1) 0 0;
  font-size: var(--ui-text-sm);
  color: var(--ui-text-muted);
}

.task-drawer__content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

/* タブ */
.task-drawer__tabs {
  display: flex;
  gap: var(--ui-space-1);
  padding: var(--ui-space-1);
  background: var(--ui-surface-muted);
  border-radius: var(--ui-radius-md);
}

.task-drawer__tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-1);
  padding: var(--ui-space-2) var(--ui-space-3);
  border: none;
  background: transparent;
  border-radius: var(--ui-radius-sm);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-medium);
  color: var(--ui-text-muted);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.task-drawer__tab:hover {
  color: var(--ui-text);
}

.task-drawer__tab.is-active {
  background: var(--ui-surface);
  color: var(--ui-text-strong);
  font-weight: var(--ui-font-semibold);
  box-shadow: var(--ui-shadow-sm);
}

.task-drawer__tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 var(--ui-space-1);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-bold);
  background: var(--ui-brand-100);
  color: var(--ui-brand-700);
  border-radius: var(--ui-radius-full);
}

/* パネル */
.task-drawer__panel {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

.task-drawer__panel--thread {
  flex: 1;
  min-height: 0;
}

/* セクション */
.task-drawer__section {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.task-drawer__label {
  margin: 0;
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-medium);
  color: var(--ui-text-muted);
}

.task-drawer__value {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  font-size: var(--ui-text-base);
  color: var(--ui-text);
}

.task-drawer__progress {
  font-size: var(--ui-text-sm);
  color: var(--ui-text-muted);
}

.task-drawer__due {
  color: var(--ui-text);
}

.task-drawer__due.due-over {
  color: var(--ui-danger);
  font-weight: var(--ui-font-semibold);
}

.task-drawer__due.due-soon {
  color: var(--ui-warning);
  font-weight: var(--ui-font-semibold);
}

.task-drawer__due-message {
  font-size: var(--ui-text-sm);
  color: var(--ui-text-muted);
}

.task-drawer__due-message.due-over {
  color: var(--ui-danger);
}

.task-drawer__due-message.due-soon {
  color: var(--ui-warning);
}

.task-drawer__description {
  padding: var(--ui-space-3);
  background: var(--ui-surface-muted);
  border-radius: var(--ui-radius-md);
  font-size: var(--ui-text-sm);
  line-height: var(--ui-leading-relaxed);
  color: var(--ui-text);
  white-space: pre-wrap;
}

/* 編集フォーム */
.task-drawer__input {
  width: 100%;
  padding: var(--ui-space-2) var(--ui-space-3);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  font-size: var(--ui-text-sm);
  color: var(--ui-text);
  background: var(--ui-surface);
  transition: var(--ui-transition-colors);
}

.task-drawer__input:focus {
  outline: none;
  border-color: var(--ui-brand-600);
  box-shadow: var(--ui-ring-focus);
}

.task-drawer__progress-input {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
}

.task-drawer__range {
  flex: 1;
  height: 6px;
  accent-color: var(--ui-brand-600);
}

.task-drawer__progress-value {
  min-width: 3rem;
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-semibold);
  color: var(--ui-text);
  text-align: right;
}

/* アクション */
.task-drawer__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-2);
  margin-top: var(--ui-space-2);
}

/* スレッド */
.task-drawer__thread-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3);
  min-height: 200px;
  max-height: 400px;
}

.task-drawer__message {
  display: flex;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2);
  border-radius: var(--ui-radius-md);
  transition: var(--ui-transition-colors);
}

.task-drawer__message:hover {
  background: var(--ui-surface-muted);
}

.task-drawer__message.is-decision {
  background: var(--ui-success-light, #dcfce7);
  border: 1px solid var(--ui-success-200, #bbf7d0);
}

.task-drawer__message-avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.task-drawer__message-content {
  flex: 1;
  min-width: 0;
}

.task-drawer__message-meta {
  display: flex;
  align-items: baseline;
  gap: var(--ui-space-2);
  margin-bottom: 2px;
}

.task-drawer__message-sender {
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-semibold);
  color: var(--ui-text-strong);
}

.task-drawer__message-time {
  font-size: var(--ui-text-xs);
  color: var(--ui-text-subtle);
}

.task-drawer__message-text {
  margin: 0;
  font-size: var(--ui-text-sm);
  line-height: var(--ui-leading-relaxed);
  color: var(--ui-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.task-drawer__composer {
  display: flex;
  gap: var(--ui-space-2);
  padding-top: var(--ui-space-3);
  border-top: 1px solid var(--ui-border-light);
}

.task-drawer__composer-input {
  flex: 1;
  padding: var(--ui-space-2) var(--ui-space-3);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  font-size: var(--ui-text-sm);
  outline: none;
  transition: var(--ui-transition-colors);
}

.task-drawer__composer-input:focus {
  border-color: var(--ui-brand-600);
  box-shadow: var(--ui-ring-focus);
}

/* ログ */
.task-drawer__log-item {
  padding: var(--ui-space-3);
  background: var(--ui-surface-muted);
  border-radius: var(--ui-radius-md);
}

.task-drawer__log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--ui-space-1);
}

.task-drawer__log-type {
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-semibold);
  color: var(--ui-text-strong);
}

.task-drawer__log-time {
  font-size: var(--ui-text-xs);
  color: var(--ui-text-subtle);
}

.task-drawer__log-actor {
  margin: 0;
  font-size: var(--ui-text-xs);
  color: var(--ui-text-muted);
}

.task-drawer__log-detail {
  margin: var(--ui-space-1) 0 0;
  font-size: var(--ui-text-sm);
  color: var(--ui-text);
}

/* 詳細リンク */
.task-drawer__detail-link {
  display: inline-flex;
  align-items: center;
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-medium);
  color: var(--ui-brand-600);
  text-decoration: none;
  transition: var(--ui-transition-colors);
}

.task-drawer__detail-link:hover {
  color: var(--ui-brand-700);
  text-decoration: underline;
}

/* prefers-reduced-motion対応 */
@media (prefers-reduced-motion: reduce) {
  .task-drawer__tab,
  .task-drawer__message,
  .task-drawer__input,
  .task-drawer__composer-input {
    transition: none;
  }
}
</style>

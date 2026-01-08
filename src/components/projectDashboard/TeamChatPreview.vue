<script setup lang="ts">
import type { TaskDoc } from "@/services/taskService";
import type { PreviewChatMessage } from "@/types/projectDashboard";
import { computed, reactive, ref, toRefs } from "vue";

const props = defineProps<{
  messages: PreviewChatMessage[];
  onlineCount?: number;
  showComposer?: boolean;
  loading?: boolean;
  currentUserId?: string | null;
  currentUserName?: string | null;
  tasks?: TaskDoc[];
}>();

const emit = defineEmits<{
  (e: "send", text: string): void;
  (e: "react", payload: { messageId: string; emoji: string }): void;
  (e: "update", payload: { messageId: string; text: string }): void;
  (e: "delete", messageId: string): void;
  (e: "convert-task", payload: { messageId: string; text: string }): void;
  (e: "link-task", payload: { messageId: string; taskId: string }): void;
}>();

const chatMessages = computed(() => props.messages || []);
const availableTasks = computed(() => props.tasks || []);
const composerEnabled = computed(() => props.showComposer !== false);
const { onlineCount, loading, currentUserName } = toRefs(props);

const input = ref("");
const editingMessageId = ref<string | null>(null);
const editingText = ref("");
const reactionPalette = ["👍", "🎉", "🔥", "❤️", "💡"];
const linkSelections = reactive<Record<string, string>>({});

function send() {
  const text = input.value.trim();
  if (!text) return;
  emit("send", text);
  input.value = "";
}

function startEdit(message: PreviewChatMessage) {
  editingMessageId.value = message.id;
  editingText.value = message.message;
}

function saveEdit() {
  if (!editingMessageId.value) return;
  const text = editingText.value.trim();
  if (!text) {
    cancelEdit();
    return;
  }
  emit("update", { messageId: editingMessageId.value, text });
  cancelEdit();
}

function cancelEdit() {
  editingMessageId.value = null;
  editingText.value = "";
}

function reactTo(messageId: string, emoji: string) {
  if (!emoji) return;
  emit("react", { messageId, emoji });
}

function deleteMessage(messageId: string) {
  emit("delete", messageId);
}

function convertToTask(message: PreviewChatMessage) {
  emit("convert-task", { messageId: message.id, text: message.message });
}

function linkTask(messageId: string, taskId: string) {
  if (!taskId) return;
  linkSelections[messageId] = taskId;
  emit("link-task", { messageId, taskId });
}

function taskTitle(taskId?: string | null) {
  if (!taskId) return "";
  const match = availableTasks.value.find((task) => task.id === taskId);
  return match?.title || "";
}

function canEdit(message: PreviewChatMessage) {
  if (!props.currentUserId) return false;
  if (!message.senderId) return true;
  return message.senderId === props.currentUserId;
}
</script>

<template>
  <section class="chat">
    <header class="chat__header">
      <div>
        <h3>チームチャット</h3>
        <p v-if="onlineCount !== undefined">{{ onlineCount }}人がオンライン</p>
        <p v-else>チームの最新メッセージを表示します</p>
      </div>
      <span v-if="loading" class="chat__badge">同期中...</span>
    </header>

    <ul v-if="chatMessages.length" class="chat__messages">
      <li v-for="message in chatMessages" :key="message.id">
        <header class="chat__message-header">
          <div>
            <span class="chat__author">{{ message.author }}</span>
            <time>{{ message.time }}</time>
          </div>
          <span v-if="message.linkedTaskId" class="chat__task-pill">
            #{{ taskTitle(message.linkedTaskId) || message.linkedTaskId }}
          </span>
        </header>

        <div v-if="editingMessageId === message.id" class="chat__editor">
          <textarea v-model="editingText" rows="2" />
          <div class="chat__editor-actions">
            <button type="button" class="ghost" @click="cancelEdit">
              キャンセル
            </button>
            <button type="button" @click="saveEdit">保存</button>
          </div>
        </div>
        <p v-else class="chat__body">{{ message.message }}</p>

        <div class="chat__meta">
          <div v-if="message.reactions?.length" class="chat__reactions">
            <button
              v-for="reaction in message.reactions"
              :key="`${message.id}-${reaction.emoji}`"
              type="button"
              @click="reactTo(message.id, reaction.emoji)"
            >
              <span>{{ reaction.emoji }}</span>
              <span class="chat__reaction-count">{{ reaction.count }}</span>
            </button>
          </div>
          <div class="chat__actions">
            <span class="chat__hint">リアクション</span>
            <button
              v-for="emoji in reactionPalette"
              :key="`${message.id}-${emoji}`"
              type="button"
              class="ghost"
              @click="reactTo(message.id, emoji)"
            >
              {{ emoji }}
            </button>
            <button type="button" class="ghost" @click="convertToTask(message)">
              タスク化
            </button>
            <label v-if="availableTasks.length" class="chat__task-linker">
              <span>リンク</span>
              <select
                :value="
                  message.linkedTaskId || linkSelections[message.id] || ''
                "
                @change="
                  linkTask(
                    message.id,
                    ($event.target as HTMLSelectElement).value,
                  )
                "
              >
                <option value="">未リンク</option>
                <option
                  v-for="task in availableTasks"
                  :key="task.id"
                  :value="task.id"
                >
                  {{ task.title }}
                </option>
              </select>
            </label>
            <button
              v-if="canEdit(message)"
              type="button"
              class="ghost"
              @click="startEdit(message)"
            >
              編集
            </button>
            <button
              v-if="canEdit(message)"
              type="button"
              class="ghost danger"
              @click="deleteMessage(message.id)"
            >
              削除
            </button>
          </div>
        </div>
      </li>
    </ul>
    <div v-else class="chat__empty">
      <p>メッセージがまだありません。最初のメッセージを送信してみましょう。</p>
    </div>

    <div v-if="composerEnabled" class="chat__composer">
      <textarea
        v-model="input"
        rows="2"
        :placeholder="
          currentUserName
            ? `${currentUserName}として送信`
            : 'メッセージを入力...'
        "
        @keyup.enter.exact.prevent="send"
      />
      <div class="chat__composer-actions">
        <button type="button" class="ghost" @click="input = ''">クリア</button>
        <button type="button" @click="send">送信</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--ui-border-light);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-lg);
  overflow: hidden;
  padding: var(--ui-space-4) var(--ui-space-5);
  gap: var(--ui-space-3);
}

.chat__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chat__header h3 {
  margin: 0;
  font-size: var(--ui-text-lg);
  font-weight: var(--ui-font-bold);
  color: var(--ui-text-strong);
}

.chat__header p {
  margin: var(--ui-space-1) 0 0;
  font-size: var(--ui-text-sm);
  color: var(--ui-text-muted);
}

.chat__badge {
  padding: var(--ui-space-1) var(--ui-space-2);
  border-radius: var(--ui-radius-full);
  background: var(--ui-brand-100);
  color: var(--ui-brand-700);
  font-weight: var(--ui-font-semibold);
  font-size: var(--ui-text-sm);
}

.chat__messages {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--ui-space-3);
  max-height: 420px;
  overflow-y: auto;
}

.chat__messages li {
  border: 1px solid var(--ui-brand-200);
  border-radius: var(--ui-radius-lg);
  padding: var(--ui-space-3) var(--ui-space-4);
  background: var(--ui-brand-50);
  display: grid;
  gap: var(--ui-space-1);
}

.chat__message-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-2);
  font-size: var(--ui-text-sm);
  color: var(--ui-text-muted);
}

.chat__author {
  font-weight: var(--ui-font-bold);
  color: var(--ui-text-strong);
  margin-right: var(--ui-space-1);
}

.chat__task-pill {
  border-radius: var(--ui-radius-full);
  background: var(--ui-brand-900);
  color: var(--ui-text-inverse);
  padding: var(--ui-space-1) var(--ui-space-2);
  font-size: var(--ui-text-xs);
  white-space: nowrap;
}

.chat__body {
  margin: 0;
  line-height: var(--ui-leading-relaxed);
  color: var(--ui-text);
}

.chat__meta {
  display: grid;
  gap: var(--ui-space-1);
}

.chat__reactions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}

.chat__reactions button {
  border: 1px solid var(--ui-brand-300);
  border-radius: var(--ui-radius-full);
  padding: var(--ui-space-1) var(--ui-space-2);
  background: var(--ui-surface);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  font-weight: var(--ui-font-semibold);
}

.chat__reaction-count {
  font-size: var(--ui-text-sm);
  color: var(--ui-brand-700);
}

.chat__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-1);
}

.chat__actions button {
  border: 1px solid var(--ui-brand-200);
  background: var(--ui-surface);
  padding: var(--ui-space-1) var(--ui-space-2);
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  font-weight: var(--ui-font-semibold);
  color: var(--ui-brand-900);
}

.chat__actions button.ghost {
  background: var(--ui-surface);
}

.chat__actions button.danger {
  color: var(--ui-danger-600);
  border-color: var(--ui-danger-300);
}

.chat__hint {
  font-size: var(--ui-text-sm);
  color: var(--ui-text-muted);
  margin-right: var(--ui-space-1);
}

.chat__task-linker {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
  font-size: var(--ui-text-sm);
  color: var(--ui-text-muted);
}

.chat__task-linker select {
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-brand-300);
  padding: var(--ui-space-1) var(--ui-space-2);
  background: var(--ui-surface);
}

.chat__empty {
  border: 1px dashed var(--ui-brand-300);
  border-radius: var(--ui-radius-lg);
  padding: var(--ui-space-4);
  color: var(--ui-text-muted);
  background: var(--ui-surface);
}

.chat__composer {
  display: grid;
  gap: var(--ui-space-2);
  border-top: 1px solid var(--ui-border-light);
  padding-top: var(--ui-space-3);
}

.chat__composer textarea {
  width: 100%;
  border-radius: var(--ui-radius-lg);
  border: 1px solid var(--ui-brand-300);
  padding: var(--ui-space-3);
  resize: vertical;
  min-height: 68px;
}

.chat__composer-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-2);
}

.chat__composer-actions button {
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-brand-300);
  padding: var(--ui-space-2) var(--ui-space-4);
  cursor: pointer;
  font-weight: var(--ui-font-bold);
}

.chat__composer-actions button:last-child {
  background: var(--ui-brand-600);
  color: var(--ui-text-inverse);
  border-color: var(--ui-brand-600);
}

.chat__composer-actions button:last-child:hover {
  background: var(--ui-brand-700);
}

.chat__editor {
  display: grid;
  gap: var(--ui-space-2);
}

.chat__editor textarea {
  width: 100%;
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-brand-300);
  padding: var(--ui-space-2) var(--ui-space-3);
  min-height: 60px;
}

.chat__editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-1);
}

.chat__editor-actions button {
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-brand-300);
  padding: var(--ui-space-1) var(--ui-space-3);
  cursor: pointer;
  font-weight: var(--ui-font-bold);
}

.chat__editor-actions button:last-child {
  background: var(--ui-brand-600);
  color: var(--ui-text-inverse);
  border-color: var(--ui-brand-600);
}

@media (max-width: 768px) {
  .chat {
    padding: var(--ui-space-4);
  }

  .chat__actions {
    gap: var(--ui-space-1);
  }

  .chat__actions button {
    padding: var(--ui-space-1) var(--ui-space-2);
  }
}
</style>

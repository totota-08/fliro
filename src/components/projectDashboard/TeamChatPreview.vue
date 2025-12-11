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
  border-radius: 1.25rem;
  border: 1px solid var(--border-light, #d1dae8);
  background: var(--surface-elevated, #fff);
  box-shadow: 0 18px 28px rgba(11, 46, 51, 0.12);
  overflow: hidden;
  padding: 1rem 1.25rem 1.25rem;
  gap: 0.75rem;
}

.chat__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chat__header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-strong, #0b2e33);
}

.chat__header p {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  color: var(--text-muted, #6b7280);
}

.chat__badge {
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  background: rgba(79, 124, 130, 0.12);
  color: #2f5d63;
  font-weight: 600;
  font-size: 0.85rem;
}

.chat__messages {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.9rem;
  max-height: 420px;
  overflow-y: auto;
}

.chat__messages li {
  border: 1px solid rgba(79, 124, 130, 0.15);
  border-radius: 1rem;
  padding: 0.85rem 0.95rem;
  background: rgba(184, 227, 233, 0.22);
  display: grid;
  gap: 0.35rem;
}

.chat__message-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-muted, #6b7280);
}

.chat__author {
  font-weight: 700;
  color: var(--text-strong, #0b2e33);
  margin-right: 0.4rem;
}

.chat__task-pill {
  border-radius: 999px;
  background: #0b2e33;
  color: #fff;
  padding: 0.25rem 0.65rem;
  font-size: 0.8rem;
  white-space: nowrap;
}

.chat__body {
  margin: 0;
  line-height: 1.6;
  color: var(--text, #0f172a);
}

.chat__meta {
  display: grid;
  gap: 0.45rem;
}

.chat__reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chat__reactions button {
  border: 1px solid rgba(79, 124, 130, 0.35);
  border-radius: 999px;
  padding: 0.25rem 0.55rem;
  background: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
}

.chat__reaction-count {
  font-size: 0.85rem;
  color: #2f5d63;
}

.chat__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.chat__actions button {
  border: 1px solid rgba(79, 124, 130, 0.25);
  background: #fff;
  padding: 0.35rem 0.65rem;
  border-radius: 0.7rem;
  cursor: pointer;
  font-weight: 600;
  color: #0b2e33;
}

.chat__actions button.ghost {
  background: rgba(255, 255, 255, 0.7);
}

.chat__actions button.danger {
  color: #b42318;
  border-color: rgba(180, 35, 24, 0.45);
}

.chat__hint {
  font-size: 0.85rem;
  color: var(--text-muted, #6b7280);
  margin-right: 0.35rem;
}

.chat__task-linker {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  color: var(--text-muted, #6b7280);
}

.chat__task-linker select {
  border-radius: 0.65rem;
  border: 1px solid rgba(79, 124, 130, 0.35);
  padding: 0.35rem 0.5rem;
  background: #fff;
}

.chat__empty {
  border: 1px dashed rgba(79, 124, 130, 0.35);
  border-radius: 1rem;
  padding: 1rem;
  color: var(--text-muted, #6b7280);
  background: rgba(255, 255, 255, 0.7);
}

.chat__composer {
  display: grid;
  gap: 0.5rem;
  border-top: 1px solid rgba(11, 46, 51, 0.08);
  padding-top: 0.75rem;
}

.chat__composer textarea {
  width: 100%;
  border-radius: 0.9rem;
  border: 1px solid rgba(79, 124, 130, 0.35);
  padding: 0.75rem 0.85rem;
  resize: vertical;
  min-height: 68px;
}

.chat__composer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.chat__composer-actions button {
  border-radius: 0.8rem;
  border: 1px solid rgba(79, 124, 130, 0.35);
  padding: 0.55rem 1rem;
  cursor: pointer;
  font-weight: 700;
}

.chat__composer-actions button:last-child {
  background: #0b2e33;
  color: #fff;
  border-color: #0b2e33;
}

.chat__editor {
  display: grid;
  gap: 0.5rem;
}

.chat__editor textarea {
  width: 100%;
  border-radius: 0.85rem;
  border: 1px solid rgba(79, 124, 130, 0.35);
  padding: 0.65rem 0.75rem;
  min-height: 60px;
}

.chat__editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
}

.chat__editor-actions button {
  border-radius: 0.8rem;
  border: 1px solid rgba(79, 124, 130, 0.35);
  padding: 0.45rem 0.8rem;
  cursor: pointer;
  font-weight: 700;
}

.chat__editor-actions button:last-child {
  background: #0b2e33;
  color: #fff;
  border-color: #0b2e33;
}

@media (max-width: 768px) {
  .chat {
    padding: 1rem;
  }

  .chat__actions {
    gap: 0.25rem;
  }

  .chat__actions button {
    padding: 0.3rem 0.5rem;
  }
}
</style>

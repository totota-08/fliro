<script setup lang="ts">
import type { TaskDoc } from '@/services/taskService'
import type { PreviewChatMessage } from '@/types/projectDashboard'
import { computed, reactive, ref, toRefs } from 'vue'

const props = defineProps<{
  messages: PreviewChatMessage[]
  onlineCount?: number
  showComposer?: boolean
  loading?: boolean
  currentUserId?: string | null
  currentUserName?: string | null
  tasks?: TaskDoc[]
}>()

const emit = defineEmits<{
  (e: 'send', text: string): void
  (e: 'react', payload: { messageId: string; emoji: string }): void
  (e: 'update', payload: { messageId: string; text: string }): void
  (e: 'delete', messageId: string): void
  (e: 'convert-task', payload: { messageId: string; text: string }): void
  (e: 'link-task', payload: { messageId: string; taskId: string }): void
}>()

const chatMessages = computed(() => props.messages || [])
const availableTasks = computed(() => props.tasks || [])
const composerEnabled = computed(() => props.showComposer !== false)
const { onlineCount, loading, currentUserName } = toRefs(props)

const input = ref('')
const editingMessageId = ref<string | null>(null)
const editingText = ref('')
const reactionPalette = ['👍', '🎉', '🔥', '❤️', '💡']
const linkSelections = reactive<Record<string, string>>({})

function send() {
  const text = input.value.trim()
  if (!text) return
  emit('send', text)
  input.value = ''
}

function startEdit(message: PreviewChatMessage) {
  editingMessageId.value = message.id
  editingText.value = message.message
}

function saveEdit() {
  if (!editingMessageId.value) return
  const text = editingText.value.trim()
  if (!text) {
    cancelEdit()
    return
  }
  emit('update', { messageId: editingMessageId.value, text })
  cancelEdit()
}

function cancelEdit() {
  editingMessageId.value = null
  editingText.value = ''
}

function reactTo(messageId: string, emoji: string) {
  if (!emoji) return
  emit('react', { messageId, emoji })
}

function deleteMessage(messageId: string) {
  emit('delete', messageId)
}

function convertToTask(message: PreviewChatMessage) {
  emit('convert-task', { messageId: message.id, text: message.message })
}

function linkTask(messageId: string, taskId: string) {
  if (!taskId) return
  linkSelections[messageId] = taskId
  emit('link-task', { messageId, taskId })
}

function taskTitle(taskId?: string | null) {
  if (!taskId) return ''
  const match = availableTasks.value.find((task) => task.id === taskId)
  return match?.title || ''
}

function canEdit(message: PreviewChatMessage) {
  if (!props.currentUserId) return false
  if (!message.senderId) return true
  return message.senderId === props.currentUserId
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
            <button type="button" class="ghost" @click="cancelEdit">キャンセル</button>
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
            <button type="button" class="ghost" @click="convertToTask(message)">タスク化</button>
            <label v-if="availableTasks.length" class="chat__task-linker">
              <span>リンク</span>
              <select
                :value="message.linkedTaskId || linkSelections[message.id] || ''"
                @change="linkTask(message.id, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">未リンク</option>
                <option v-for="task in availableTasks" :key="task.id" :value="task.id">
                  {{ task.title }}
                </option>
              </select>
            </label>
            <button v-if="canEdit(message)" type="button" class="ghost" @click="startEdit(message)">編集</button>
            <button v-if="canEdit(message)" type="button" class="ghost danger" @click="deleteMessage(message.id)">
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
        :placeholder="currentUserName ? `${currentUserName}として送信` : 'メッセージを入力...'"
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
}

.chat__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.chat__header h3 {
  margin: 0;
}

.chat__header p {
  margin: 0.25rem 0 0;
  color: #64748b;
  font-size: 0.9rem;
}

.chat__badge {
  background: #fef3c7;
  color: #92400e;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  font-weight: 700;
}

.chat__messages {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.chat__message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}

.chat__author {
  font-weight: 700;
  color: #0f172a;
}

.chat__body {
  margin: 0.2rem 0 0.4rem;
  color: #0f172a;
  line-height: 1.5;
}

.chat__meta {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.chat__reactions {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.chat__reactions button {
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #f8fafc;
  padding: 0.3rem 0.65rem;
  cursor: pointer;
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
}

.chat__reaction-count {
  font-size: 0.85rem;
  color: #475569;
}

.chat__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.chat__hint {
  color: #94a3b8;
  font-size: 0.85rem;
}

.chat__actions button {
  border: 1px solid #e2e8f0;
  border-radius: 0.65rem;
  padding: 0.3rem 0.7rem;
  background: #fff;
  cursor: pointer;
}

.chat__actions button.ghost {
  background: rgba(15, 23, 42, 0.03);
}

.chat__actions button.danger {
  color: #b91c1c;
  border-color: rgba(185, 28, 28, 0.35);
}

.chat__task-linker {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.chat__task-linker select {
  border-radius: 0.65rem;
  border: 1px solid #e2e8f0;
  padding: 0.25rem 0.5rem;
}

.chat__task-pill {
  background: rgba(15, 23, 42, 0.06);
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-weight: 700;
  color: #0f172a;
}

.chat__editor textarea {
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid #d1dae8;
  padding: 0.5rem 0.65rem;
}

.chat__editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.35rem;
}

.chat__composer {
  margin-top: 0.8rem;
  border-top: 1px solid #e2e8f0;
  padding-top: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chat__composer textarea {
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid #d1dae8;
  padding: 0.55rem 0.75rem;
}

.chat__composer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.chat__composer-actions button {
  border: 1px solid #e2e8f0;
  border-radius: 0.7rem;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
}

.chat__composer-actions button.ghost {
  background: rgba(15, 23, 42, 0.05);
}

.chat__empty {
  text-align: center;
  padding: 0.75rem;
  color: #6b7280;
  border: 1px dashed #e2e8f0;
  border-radius: 0.9rem;
}
</style>

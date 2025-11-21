<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import { ROUTE_NAMES } from '@/constants/routes'
import { database } from '@/firebase/config'
import {
    addMessageReaction,
    deleteProjectMessage,
    listenProjectChat,
    sendProjectMessage,
    updateProjectMessage,
    type ChatMessage,
} from '@/services/projectChat'
import { createTask, listenTasks, type TaskDoc } from '@/services/taskService'
import { useAuthStore } from '@/store/auth'
import { ref as dbRef, update } from 'firebase/database'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const { user, profile } = useAuthStore()
const projectId = String(route.params.projectId)
const messages = ref<ChatMessage[]>([])
const input = ref('')
const tasks = ref<TaskDoc[]>([])
const taskMap = computed(() => Object.fromEntries(tasks.value.map((task) => [task.id, task.title])))
const reactionOptions = ['👍', '🎉', '❤️', '🔥', '😄']
const openReactionFor = ref<string | null>(null)
const defaultReaction = '👍'
const chatContainer = ref<HTMLElement | null>(null)
const editingMessageId = ref<string | null>(null)
const editingText = ref('')

let unsubscribeTasks: (() => void) | null = null
let unsubscribeChat: (() => void) | null = null

function watchChat() {
  unsubscribeChat = listenProjectChat(projectId, (list) => {
    messages.value = list
    scrollToBottom()
  })
}

function watchTasks() {
  unsubscribeTasks = listenTasks(projectId, (list) => {
    tasks.value = list
  })
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

async function sendMessage() {
  if (!input.value.trim() || !user.value) return
  await sendProjectMessage(
    projectId,
    user.value.uid,
    profile.value?.nickname || profile.value?.fullName || 'User',
    input.value.trim(),
  )
  input.value = ''
  scrollToBottom()
}

async function convertToTask(messageId: string, text: string) {
  if (!user.value) return
  const taskId = await createTask(projectId, { title: text }, user.value.uid)
  await update(dbRef(database, `projects/${projectId}/realtimeChat/${messageId}`), { linkedTaskId: taskId })
}

async function linkTask(messageId: string, taskId: string) {
  await update(dbRef(database, `projects/${projectId}/realtimeChat/${messageId}`), { linkedTaskId: taskId })
}

async function reactToMessage(messageId: string, emoji: string) {
  if (!user.value || !messageId || !emoji) return
  await addMessageReaction(projectId, messageId, emoji, user.value.uid)
}

function toggleReactionPicker(messageId: string) {
  openReactionFor.value = openReactionFor.value === messageId ? null : messageId
}

function startEditing(message: ChatMessage) {
  editingMessageId.value = message.id
  editingText.value = message.text
}

function cancelEditing() {
  editingMessageId.value = null
  editingText.value = ''
}

async function saveEditing() {
  if (!editingMessageId.value || !editingText.value.trim()) return
  await updateProjectMessage(projectId, editingMessageId.value, editingText.value)
  cancelEditing()
}

async function deleteMessage(messageId: string) {
  if (!confirm('このメッセージを削除してもよろしいですか？')) return
  await deleteProjectMessage(projectId, messageId)
}

onMounted(() => {
  watchTasks()
  watchChat()
})

onBeforeUnmount(() => {
  unsubscribeTasks?.()
  unsubscribeChat?.()
})
</script>

<template>
  <div class="chat-shell">
    <header>
      <div>
        <p>プロジェクトチャット</p>
        <h1>{{ projectId }}</h1>
      </div>
      <AppButton :to="{ name: ROUTE_NAMES.projectDashboard, params: { projectId } }">ダッシュボードへ戻る</AppButton>
    </header>

    <section class="chat-box" ref="chatContainer">
      <article
        v-for="message in messages"
        :key="message.id"
        class="chat-message"
      >
        <div class="chat-message__avatar">{{ (message.author || 'U').charAt(0).toUpperCase() }}</div>
        <div class="chat-message__content" @dblclick="reactToMessage(message.id, defaultReaction)">
          <header class="chat-message__header">
            <div class="chat-message__meta">
              <h3 class="chat-message__author">{{ message.author }}</h3>
              <time v-if="message.createdAt" class="chat-message__time">{{ new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</time>
            </div>
            <div class="chat-message__controls">
              <button
                type="button"
                class="chat-message__reaction-button"
                @click.stop="toggleReactionPicker(message.id)"
              >
                ＋ リアクション
              </button>
              <div v-if="user && (message.senderId === user.uid || message.author === (profile?.nickname || profile?.fullName))" class="chat-message__owner-actions">
                <button type="button" @click="startEditing(message)">編集</button>
                <button type="button" @click="deleteMessage(message.id)">削除</button>
              </div>
            </div>
          </header>
          
          <div v-if="editingMessageId === message.id" class="chat-message__editor">
            <input v-model="editingText" type="text" @keydown.enter="saveEditing" />
            <div class="chat-message__editor-actions">
              <button type="button" @click="saveEditing">保存</button>
              <button type="button" @click="cancelEditing">キャンセル</button>
            </div>
          </div>
          <p v-else class="chat-message__text">{{ message.text }}</p>

          <div v-if="message.reactionSummary?.length" class="chat-reaction-summary">
            <button
              v-for="reaction in message.reactionSummary"
              :key="`${message.id}-${reaction.emoji}`"
              type="button"
              @click="reactToMessage(message.id, reaction.emoji)"
            >
              {{ reaction.emoji }} <span>{{ reaction.count }}</span>
            </button>
          </div>
          <div v-if="openReactionFor === message.id" class="chat-reaction-picker">
            <p>リアクションを選択</p>
            <div class="chat-reaction-grid">
              <button
                v-for="emoji in reactionOptions"
                :key="`${message.id}-picker-${emoji}`"
                type="button"
                @click="reactToMessage(message.id, emoji)"
              >
                {{ emoji }}
              </button>
            </div>
          </div>
          <div class="chat-actions">
            <button type="button" @click="convertToTask(message.id, message.text)">タスク化</button>
            <select @change="linkTask(message.id, ($event.target as HTMLSelectElement).value)">
              <option value="">タスクに紐付け</option>
              <option v-for="task in tasks" :key="task.id" :value="task.id">{{ task.title }}</option>
            </select>
            <span v-if="message.linkedTaskId">紐付け済み: {{ taskMap[message.linkedTaskId] || message.linkedTaskId }}</span>
          </div>
        </div>
      </article>
    </section>

    <form class="chat-form" @submit.prevent="sendMessage">
      <input v-model="input" type="text" placeholder="メッセージを入力" />
      <button type="submit">送信</button>
    </form>
  </div>
</template>

<style scoped>
.chat-shell {
  min-height: 100vh;
  padding: 2rem clamp(1rem, 4vw, 4rem);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: linear-gradient(135deg, #f7fbfc, #edf4f6);
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 1rem;
  border: 1px solid #e2edef;
}

.chat-box {
  flex: 1;
  border: 1px solid #e2edef;
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: radial-gradient(circle at 10% 20%, rgba(147, 177, 181, 0.12), transparent 35%),
    radial-gradient(circle at 82% 12%, rgba(79, 124, 130, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.2));
  overflow-y: auto;
  box-shadow: 0 16px 24px rgba(11, 46, 51, 0.08);
}

.chat-message {
  display: flex;
  gap: 0.85rem;
  align-items: flex-start;
}

.chat-message__avatar {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(160deg, #b8e3e9, #4f7c82);
  color: #0b2e33;
  font-weight: 700;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.chat-message__content {
  flex: 1;
  background: #ffffff;
  border: 1px solid #d7e2ef;
  border-radius: 16px;
  padding: 1rem 1.1rem;
  box-shadow: 0 12px 24px rgba(11, 46, 51, 0.12);
}

.chat-message__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.chat-message__meta {
  display: flex;
  gap: 0.6rem;
  align-items: baseline;
}

.chat-message__author {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: #0b2e33;
}

.chat-message__time {
  font-size: 0.78rem;
  color: #6d8a92;
}

.chat-message__text {
  margin: 0;
  line-height: 1.55;
  color: #0b2e33;
}

.chat-message__controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chat-message__reaction-button {
  border: 1px dashed #c3d6db;
  background: rgba(184, 227, 233, 0.22);
  color: #4f7c82;
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.chat-message__reaction-button:hover {
  background: rgba(184, 227, 233, 0.35);
  color: #0b2e33;
}

.chat-message__owner-actions {
  display: flex;
  gap: 0.25rem;
}

.chat-message__owner-actions button {
  border: 1px solid #d7e2ef;
  background: rgba(184, 227, 233, 0.2);
  color: #4f7c82;
  border-radius: 8px;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.chat-message__owner-actions button:hover {
  background: rgba(184, 227, 233, 0.35);
  color: #0b2e33;
}

.chat-message__editor {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chat-message__editor input {
  border: 1px solid #d7e2ef;
  border-radius: 8px;
  padding: 0.6rem;
  width: 100%;
  font-size: 0.9rem;
  background: #f7fbfc;
}

.chat-message__editor-actions {
  display: flex;
  gap: 0.5rem;
}

.chat-message__editor-actions button {
  border: none;
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.chat-message__editor-actions button:first-child {
  background: linear-gradient(135deg, #4f7c82, #9acfd7);
  color: #0b2e33;
  font-weight: 600;
}

.chat-message__editor-actions button:first-child:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(79, 124, 130, 0.25);
}

.chat-message__editor-actions button:last-child {
  background: #f7fbfc;
  color: #6d8a92;
  border: 1px solid #d7e2ef;
}

.chat-reaction-summary {
  margin-top: 0.65rem;
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.chat-reaction-summary button {
  border: 1px solid #d7e2ef;
  background: rgba(184, 227, 233, 0.35);
  border-radius: 999px;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
  color: #0b2e33;
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  font-weight: 600;
}

.chat-reaction-picker {
  margin-top: 0.5rem;
  background: rgba(184, 227, 233, 0.2);
  border: 1px solid #d7e2ef;
  border-radius: 12px;
  padding: 0.65rem;
  box-shadow: 0 12px 22px rgba(11, 46, 51, 0.12);
}

.chat-reaction-picker p {
  margin: 0 0 0.35rem;
  color: #4f6b73;
  font-size: 0.85rem;
}

.chat-reaction-grid {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.chat-reaction-picker button {
  border: 1px solid #d7e2ef;
  background: #ffffff;
  border-radius: 8px;
  padding: 0.4rem 0.55rem;
  cursor: pointer;
  color: #0b2e33;
  transition: transform 0.12s ease, background 0.12s ease;
}

.chat-reaction-picker button:hover {
  background: #f0f7f8;
  transform: translateY(-1px);
}

.chat-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e2edef;
}

.chat-actions button,
.chat-actions select {
  border: 1px solid #d7e2ef;
  background: #f7fbfc;
  color: #4f7c82;
  border-radius: 8px;
  padding: 0.35rem 0.65rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.chat-form {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 1rem;
  border: 1px solid #e2edef;
}

.chat-form input {
  flex: 1;
  border-radius: 12px;
  border: 1px solid #d7e2ef;
  padding: 0.85rem 1rem;
  background: #ffffff;
  font-size: 0.95rem;
}

.chat-form button {
  background: linear-gradient(135deg, #4f7c82, #9acfd7);
  border: none;
  color: #0b2e33;
  padding: 0.85rem 1.2rem;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chat-form button:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(79, 124, 130, 0.35);
}
</style>

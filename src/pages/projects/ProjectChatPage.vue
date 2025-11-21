<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ref as dbRef, update } from 'firebase/database'
import { database } from '@/firebase/config'
import { useAuthStore } from '@/store/auth'
import { listenTasks, createTask, type TaskDoc } from '@/services/taskService'
import { ROUTE_NAMES } from '@/constants/routes'
import AppButton from '@/components/ui/AppButton.vue'
import { listenProjectChat, sendProjectMessage, addMessageReaction, type ChatMessage } from '@/services/projectChat'

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
let unsubscribeTasks: (() => void) | null = null
let unsubscribeChat: (() => void) | null = null

function watchChat() {
  unsubscribeChat = listenProjectChat(projectId, (list) => {
    messages.value = list
  })
}

function watchTasks() {
  unsubscribeTasks = listenTasks(projectId, (list) => {
    tasks.value = list
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

    <section class="chat-box">
      <article
        v-for="message in messages"
        :key="message.id"
        class="chat-message"
        @dblclick="reactToMessage(message.id, defaultReaction)"
      >
        <header class="chat-message__header">
          <div>
            <h3>{{ message.author }}</h3>
            <time v-if="message.createdAt">{{ new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</time>
          </div>
          <button
            type="button"
            class="chat-message__reaction-button"
            @click.stop="toggleReactionPicker(message.id)"
          >
            ＋
          </button>
        </header>
        <p>{{ message.text }}</p>
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
          <button
            v-for="emoji in reactionOptions"
            :key="`${message.id}-picker-${emoji}`"
            type="button"
            @click="reactToMessage(message.id, emoji)"
          >
            {{ emoji }}
          </button>
        </div>
        <div class="chat-actions">
          <button type="button" @click="convertToTask(message.id, message.text)">タスク化</button>
          <select @change="linkTask(message.id, ($event.target as HTMLSelectElement).value)">
            <option value="">タスクに紐付け</option>
            <option v-for="task in tasks" :key="task.id" :value="task.id">{{ task.title }}</option>
          </select>
          <span v-if="message.linkedTaskId">紐付け済み: {{ taskMap[message.linkedTaskId] || message.linkedTaskId }}</span>
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
  gap: 1rem;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-box {
  flex: 1;
  border: 1px solid #d7e2ef;
  border-radius: 1rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: #fff;
}

.chat-message {
  border: 1px solid #d7e2ef;
  border-radius: 1rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: rgba(184, 227, 233, 0.2);
}

.chat-message__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.chat-message__header h3 {
  margin: 0;
}

.chat-message__header time {
  font-size: 0.85rem;
  color: #6b7280;
}

.chat-message__reaction-button {
  border: none;
  border-radius: 0.6rem;
  background: rgba(11, 46, 51, 0.1);
  width: 2rem;
  height: 2rem;
  cursor: pointer;
  color: #0b2e33;
  font-size: 1rem;
}

.chat-reaction-summary {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.chat-reaction-summary button {
  border: none;
  border-radius: 999px;
  background: rgba(11, 46, 51, 0.08);
  padding: 0.2rem 0.6rem;
  cursor: pointer;
}

.chat-reaction-summary span {
  font-weight: 600;
}

.chat-reaction-picker {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.chat-reaction-picker button {
  border: none;
  background: rgba(11, 46, 51, 0.05);
  border-radius: 0.6rem;
  padding: 0.2rem 0.5rem;
  cursor: pointer;
}

.chat-actions {
  display: flex;
  gap: 0.5rem;
}

.chat-form {
  display: flex;
  gap: 0.75rem;
}

.chat-form input {
  flex: 1;
  border-radius: 0.75rem;
  border: 1px solid #d5dfe8;
  padding: 0.75rem 1rem;
}

.chat-form button {
  border-radius: 0.75rem;
  border: none;
  padding: 0.75rem 1.25rem;
  background: #0b2e33;
  color: #fff;
}
</style>

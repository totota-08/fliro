<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { onChildAdded, push, ref as dbRef, update } from 'firebase/database'
import { database } from '@/firebase/config'
import { useAuthStore } from '@/store/auth'
import { listenTasks, createTask, type TaskDoc } from '@/services/taskService'
import { ROUTE_NAMES } from '@/constants/routes'
import AppButton from '@/components/ui/AppButton.vue'
import { computed } from 'vue'

const route = useRoute()
const router = useRouter()
const { user, profile } = useAuthStore()
const projectId = String(route.params.projectId)
const messages = ref<{ id: string; author: string; text: string; linkedTaskId?: string }[]>([])
const input = ref('')
const tasks = ref<TaskDoc[]>([])
const taskMap = computed(() => Object.fromEntries(tasks.value.map((task) => [task.id, task.title])))
let unsubscribeTasks: (() => void) | null = null
let unsubscribeChat: (() => void) | null = null

function watchChat() {
  const chatRef = dbRef(database, `projects/${projectId}/realtimeChat`)
  unsubscribeChat = onChildAdded(chatRef, (snapshot) => {
    const data = snapshot.val() as any
    messages.value.push({ id: snapshot.key || '', author: data.author, text: data.text, linkedTaskId: data.linkedTaskId })
  })
}

function watchTasks() {
  unsubscribeTasks = listenTasks(projectId, (list) => {
    tasks.value = list
  })
}

async function sendMessage() {
  if (!input.value.trim() || !user.value) return
  await push(dbRef(database, `projects/${projectId}/realtimeChat`), {
    text: input.value.trim(),
    author: profile.value?.nickname || profile.value?.fullName || 'User',
    createdAt: Date.now(),
  })
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

onMounted(() => {
  watchTasks()
  watchChat()
})

onBeforeUnmount(() => {
  unsubscribeTasks?.()
  if (unsubscribeChat && typeof unsubscribeChat === 'function') unsubscribeChat()
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
      <article v-for="message in messages" :key="message.id">
        <h3>{{ message.author }}</h3>
        <p>{{ message.text }}</p>
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

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { collection, doc, getDoc, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuthStore } from '@/store/auth'
import { ROUTE_NAMES } from '@/constants/routes'
import type { ProjectDoc } from '@/types/project'
import {
  listenTasks,
  createTask,
  updateTask,
  deleteTask,
  type TaskDoc,
  type TaskStatus,
} from '@/services/taskService'
import { listenProjectChat, sendProjectMessage, type ChatMessage } from '@/services/projectChat'
import { updateProjectSettings } from '@/services/projectSettings'
import AppButton from '@/components/ui/AppButton.vue'

const router = useRouter()
const route = useRoute()
const { user, profile } = useAuthStore()
const projectId = ref(String(route.params.projectId || ''))

const project = ref<ProjectDoc | null>(null)
const members = ref<{ id: string; name: string; color: string }[]>([])
const tasks = ref<TaskDoc[]>([])
const chatMessages = ref<ChatMessage[]>([])
const taskView = ref<'list' | 'board'>('list')
const quickTitle = ref('')
const filters = reactive({ search: '', status: 'all', assignee: 'all', due: 'all' })
const showMyTasksOnly = ref(false)
const selectedTask = ref<TaskDoc | null>(null)
const editor = reactive({ description: '', dueDate: '', assigneeId: '', status: 'todo' as TaskStatus })
const notifications = ref<string[]>([])
const chatInput = ref('')
const aiEnabled = ref(false)
const aiKey = ref('')
const aiPrompt = ref('')
const aiResponse = ref('')
const aiLoading = ref(false)
const projectList = ref<{ id: string; name: string }[]>([])
const draggingTask = ref<TaskDoc | null>(null)

let stopTasks: (() => void) | null = null
let stopProject: (() => void) | null = null
let stopMembers: (() => void) | null = null
let stopChat: (() => void) | null = null

const memberPalette = ['#93b1b5', '#4f7c82', '#b8e3e9', '#0b2e33', '#f4a261', '#9b5de5', '#00a6fb']

async function loadProjectList() {
  if (!user.value) return
  const snap = await getDocs(collection(db, 'userProjects', user.value.uid, 'projects'))
  projectList.value = snap.docs.map((docSnap) => ({ id: docSnap.id, name: (docSnap.data().projectName as string) || 'Project' }))
}

function watchProject() {
  stopProject = onSnapshot(doc(db, 'projects', projectId.value), (snapshot) => {
    if (!snapshot.exists()) return
    project.value = snapshot.data() as ProjectDoc
    aiEnabled.value = Boolean(project.value?.settings?.aiChatEnabled)
    aiKey.value = project.value?.settings?.aiApiKey ?? ''
  })
  stopMembers = onSnapshot(collection(db, 'projects', projectId.value, 'members'), (snapshot) => {
    const items: typeof members.value = []
    snapshot.forEach((docSnap, index) => {
      const data = docSnap.data() as any
      items.push({
        id: data.userId,
        name: data.nickname || data.fullName || docSnap.id,
        color: memberPalette[index % memberPalette.length],
      })
    })
    members.value = items
  })
}

function watchTasks() {
  stopTasks = listenTasks(projectId.value, (list) => {
    tasks.value = list
    evaluateNotifications()
  })
}

function watchChat() {
  stopChat = listenProjectChat(projectId.value, (messages) => {
    chatMessages.value = messages
  })
}

function evaluateNotifications() {
  const alerts: string[] = []
  const now = Date.now()
  const oneDay = 24 * 60 * 60 * 1000
  const assigned = tasks.value.filter((task) => task.assigneeId === user.value?.uid)
  if (assigned.length) {
    alerts.push(`あなたに割り当てられたタスクが ${assigned.length} 件あります`)
  }
  const dueSoon = tasks.value.filter((task) => {
    if (!task.dueDate?.seconds) return false
    const due = task.dueDate.seconds * 1000
    return due - now <= oneDay && due > now
  })
  if (dueSoon.length) {
    alerts.push(`期限が迫っているタスク: ${dueSoon.length} 件`)
  }
  notifications.value = alerts
}

const filteredTasks = computed(() => {
  let list = [...tasks.value]
  if (filters.search.trim()) {
    const keyword = filters.search.trim().toLowerCase()
    list = list.filter((task) => task.title.toLowerCase().includes(keyword))
  }
  if (filters.status !== 'all') {
    list = list.filter((task) => task.status === filters.status)
  }
  if (filters.assignee !== 'all') {
    list = list.filter((task) => (task.assigneeId || '') === filters.assignee)
  }
  if (filters.due !== 'all') {
    const now = new Date()
    list = list.filter((task) => {
      if (!task.dueDate?.seconds) return false
      const due = new Date(task.dueDate.seconds * 1000)
      if (filters.due === 'today') {
        return due.toDateString() === now.toDateString()
      }
      if (filters.due === 'week') {
        const diff = due.getTime() - now.getTime()
        return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000
      }
      if (filters.due === 'overdue') {
        return due < now
      }
      return true
    })
  }
  if (showMyTasksOnly.value && user.value) {
    list = list.filter((task) => task.assigneeId === user.value?.uid)
  }
  return list
})

const boardColumns = computed(() => {
  const map: Record<TaskStatus, TaskDoc[]> = {
    'todo': [],
    'in-progress': [],
    'done': [],
  }
  filteredTasks.value.forEach((task) => {
    map[task.status].push(task)
  })
  return map
})

function formatDate(seconds?: number) {
  if (!seconds) return '-'
  return new Date(seconds * 1000).toLocaleDateString()
}

async function handleQuickCreate() {
  if (!quickTitle.value.trim() || !user.value) return
  await createTask(projectId.value, { title: quickTitle.value.trim() }, user.value.uid)
  quickTitle.value = ''
}

function openEditor(task: TaskDoc) {
  selectedTask.value = task
  editor.description = task.description || ''
  editor.dueDate = task.dueDate?.seconds ? new Date(task.dueDate.seconds * 1000).toISOString().slice(0, 10) : ''
  editor.assigneeId = task.assigneeId || ''
  editor.status = task.status
}

async function saveTask() {
  if (!selectedTask.value) return
  await updateTask(projectId.value, selectedTask.value.id, {
    description: editor.description,
    status: editor.status,
    dueDate: editor.dueDate ? new Date(editor.dueDate) : null,
    assigneeId: editor.assigneeId || null,
  })
  selectedTask.value = null
}

async function removeTask(taskId: string) {
  await deleteTask(projectId.value, taskId)
}

async function handleDrop(status: TaskStatus) {
  if (!draggingTask.value) return
  if (draggingTask.value.status === status) {
    draggingTask.value = null
    return
  }
  await updateTask(projectId.value, draggingTask.value.id, { status })
  draggingTask.value = null
}

function startDrag(task: TaskDoc) {
  draggingTask.value = task
}

async function sendChat() {
  if (!chatInput.value.trim() || !user.value) return
  await sendProjectMessage(
    projectId.value,
    user.value.uid,
    profile.value?.nickname || profile.value?.fullName || 'User',
    chatInput.value.trim(),
  )
  chatInput.value = ''
}

async function convertToTask(message: ChatMessage) {
  if (!user.value) return
  await createTask(projectId.value, { title: message.text, description: `Chat #${message.id}` }, user.value.uid)
}

async function saveAiSettings() {
  await updateProjectSettings(projectId.value, { aiChatEnabled: aiEnabled.value, aiApiKey: aiKey.value })
}

async function askAi() {
  if (!aiEnabled.value) {
    aiResponse.value = 'AI チャットは無効化されています。'
    return
  }
  if (!aiKey.value) {
    aiResponse.value = '先に API キーを設定してください。'
    return
  }
  if (!aiPrompt.value.trim()) {
    return
  }
  aiLoading.value = true
  aiResponse.value = ''
  try {
    const summary = tasks.value.slice(0, 10).map((task) => `- ${task.title} [${task.status}]`).join('\n')
    const body = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a task assistant for the Teamie project.' },
        { role: 'user', content: `Tasks:\n${summary}\nUser question: ${aiPrompt.value}` },
      ],
    }
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiKey.value}`,
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error('AI API エラー')
    }
    const data = await response.json()
    aiResponse.value = data.choices?.[0]?.message?.content || '回答を取得できませんでした。'
  } catch (error: any) {
    console.error(error)
    aiResponse.value = error?.message || 'AI 応答に失敗しました。'
  } finally {
    aiLoading.value = false
  }
}

function goProject(target: string) {
  router.push({ name: ROUTE_NAMES.projectDashboard, params: { projectId: target } })
}

function resetSubscriptions() {
  stopTasks?.()
  stopProject?.()
  stopMembers?.()
  stopChat?.()
  watchProject()
  watchTasks()
  watchChat()
}

onMounted(() => {
  loadProjectList()
  resetSubscriptions()
})

watch(
  () => route.params.projectId,
  (newId) => {
    if (!newId) return
    projectId.value = String(newId)
    resetSubscriptions()
  },
)

onBeforeUnmount(() => {
  stopTasks?.()
  stopProject?.()
  stopMembers?.()
  stopChat?.()
})
</script>

<template>
  <div class="dashboard">
    <aside class="dashboard__sidebar">
      <h2>プロジェクト</h2>
      <ul>
        <li v-for="projectEntry in projectList" :key="projectEntry.id" :class="{ active: projectEntry.id === projectId }">
          <button type="button" @click="goProject(projectEntry.id)">{{ projectEntry.name }}</button>
        </li>
      </ul>
      <AppButton :to="{ name: ROUTE_NAMES.projectCreate }" variant="primary">新規作成</AppButton>
    </aside>

    <main class="dashboard__main">
      <header class="dashboard__header" v-if="project">
        <div>
          <p>Teamie Projects</p>
          <h1>{{ project?.name }}</h1>
          <p class="dashboard__meta">{{ members.length }} 人のメンバー / {{ filteredTasks.length }} 件のタスク</p>
        </div>
        <div class="dashboard__actions">
          <button type="button" :class="{ active: taskView === 'list' }" @click="taskView = 'list'">リスト</button>
          <button type="button" :class="{ active: taskView === 'board' }" @click="taskView = 'board'">ボード</button>
        </div>
      </header>

      <section class="dashboard__filters">
        <input v-model="quickTitle" type="text" placeholder="タスクを入力して Enter" @keydown.enter.prevent="handleQuickCreate" />
        <button type="button" @click="handleQuickCreate">追加</button>
        <input v-model="filters.search" type="search" placeholder="タスク検索" />
        <select v-model="filters.status">
          <option value="all">全て</option>
          <option value="todo">未着手</option>
          <option value="in-progress">進行中</option>
          <option value="done">完了</option>
        </select>
        <select v-model="filters.assignee">
          <option value="all">担当者</option>
          <option v-for="member in members" :key="member.id" :value="member.id">{{ member.name }}</option>
        </select>
        <select v-model="filters.due">
          <option value="all">期限</option>
          <option value="today">今日</option>
          <option value="week">今週</option>
          <option value="overdue">期限切れ</option>
        </select>
        <label class="toggle">
          <input type="checkbox" v-model="showMyTasksOnly" />
          <span>自分のタスク</span>
        </label>
      </section>

      <section v-if="notifications.length" class="dashboard__alerts">
        <p v-for="note in notifications" :key="note">⚡ {{ note }}</p>
      </section>

      <section v-if="taskView === 'list'" class="task-list">
        <div v-for="task in filteredTasks" :key="task.id" class="task-row">
          <div>
            <h3>{{ task.title }}</h3>
            <p>{{ task.description || '説明なし' }}</p>
          </div>
          <div class="task-row__meta">
            <span class="badge" :data-status="task.status">{{ task.status }}</span>
            <span>{{ formatDate(task.dueDate?.seconds) }}</span>
            <span>{{ members.find((m) => m.id === task.assigneeId)?.name || '未割当' }}</span>
            <button type="button" @click="openEditor(task)">編集</button>
            <button type="button" @click="removeTask(task.id)">削除</button>
          </div>
        </div>
      </section>

      <section v-else class="task-board">
        <div v-for="(column, status) in boardColumns" :key="status" class="task-column">
          <header>{{ status }}</header>
          <div class="task-column__body" @dragover.prevent @drop.prevent="handleDrop(status as TaskStatus)">
            <article
              v-for="task in column"
              :key="task.id"
              class="task-card"
              draggable="true"
              @dragstart="startDrag(task)"
              @dblclick="openEditor(task)"
            >
              <p>{{ task.title }}</p>
              <small>{{ members.find((m) => m.id === task.assigneeId)?.name || '未割当' }}</small>
            </article>
          </div>
        </div>
      </section>

      <section class="dashboard__grid">
        <div class="dashboard__panel">
          <h2>チャット</h2>
          <div class="chat-box">
            <p v-for="message in chatMessages" :key="message.id">
              <strong>{{ message.senderName }}:</strong>
              {{ message.text }}
              <button type="button" @click="convertToTask(message)">タスク化</button>
            </p>
          </div>
          <form class="chat-form" @submit.prevent="sendChat">
            <input v-model="chatInput" type="text" placeholder="メッセージを入力" />
            <button type="submit">送信</button>
          </form>
        </div>

        <div class="dashboard__panel">
          <h2>AI アシスタント</h2>
          <label class="toggle">
            <input type="checkbox" v-model="aiEnabled" />
            <span>AI を有効化</span>
          </label>
          <label>
            API Key
            <input v-model="aiKey" type="password" placeholder="sk-..." />
          </label>
          <button type="button" @click="saveAiSettings">設定を保存</button>
          <textarea v-model="aiPrompt" rows="3" placeholder="質問を入力"></textarea>
          <button type="button" :disabled="aiLoading" @click="askAi">{{ aiLoading ? '応答中...' : 'AIに聞く' }}</button>
          <p class="ai-response" v-if="aiResponse">{{ aiResponse }}</p>
        </div>
      </section>
    </main>

    <div v-if="selectedTask" class="task-editor">
      <div class="task-editor__card">
        <header>
          <h3>{{ selectedTask.title }}</h3>
          <button type="button" @click="selectedTask = null">×</button>
        </header>
        <label>
          説明
          <textarea v-model="editor.description" rows="4"></textarea>
        </label>
        <label>
          期限
          <input v-model="editor.dueDate" type="date" />
        </label>
        <label>
          担当者
          <select v-model="editor.assigneeId">
            <option value="">未割当</option>
            <option v-for="member in members" :key="member.id" :value="member.id">{{ member.name }}</option>
          </select>
        </label>
        <label>
          ステータス
          <select v-model="editor.status">
            <option value="todo">未着手</option>
            <option value="in-progress">進行中</option>
            <option value="done">完了</option>
          </select>
        </label>
        <footer>
          <button type="button" @click="saveTask">保存</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: grid;
  grid-template-columns: 260px 1fr;
  min-height: 100vh;
  background: #f6f8fb;
}

.dashboard__sidebar {
  border-right: 1px solid #e0e7f1;
  padding: 2rem 1.5rem;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dashboard__sidebar ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dashboard__sidebar li button {
  width: 100%;
  border: none;
  background: transparent;
  padding: 0.75rem 1rem;
  text-align: left;
  border-radius: 0.8rem;
  cursor: pointer;
}

.dashboard__sidebar li.active button {
  background: #e8eef8;
  font-weight: 600;
}

.dashboard__main {
  padding: 2rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.dashboard__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard__meta {
  color: #61728c;
}

.dashboard__actions button {
  border: none;
  border-radius: 0.75rem;
  padding: 0.4rem 0.9rem;
  margin-left: 0.35rem;
}

.dashboard__actions button.active {
  background: #0b2e33;
  color: #fff;
}

.dashboard__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.dashboard__filters input,
.dashboard__filters select {
  padding: 0.65rem 0.85rem;
  border-radius: 0.8rem;
  border: 1px solid #d1dae8;
  background: #fff;
}

.dashboard__filters > button {
  padding: 0.65rem 1rem;
  border-radius: 0.8rem;
  border: none;
  background: #0b2e33;
  color: #fff;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
}

.dashboard__alerts {
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
  padding: 0.85rem 1rem;
  border-radius: 1rem;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.task-row {
  background: #fff;
  border-radius: 1rem;
  border: 1px solid #e1e7f0;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.task-row__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.badge[data-status='todo'] { color: #64748b; }
.badge[data-status='in-progress'] { color: #d97706; }
.badge[data-status='done'] { color: #16a34a; }

.task-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.task-column {
  background: #fff;
  border-radius: 1rem;
  border: 1px solid #e1e7f0;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.task-column__body {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.task-card {
  padding: 0.75rem;
  border-radius: 0.85rem;
  background: #f7f9fc;
  border: 1px solid #dfe7f4;
}

.dashboard__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
}

.dashboard__panel {
  background: #fff;
  border-radius: 1rem;
  border: 1px solid #e1e8f0;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.chat-box {
  border: 1px solid #e1e8f0;
  border-radius: 0.85rem;
  padding: 0.75rem;
  max-height: 220px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chat-box button {
  margin-left: 0.5rem;
  border: none;
  background: transparent;
  color: #4f7c82;
  cursor: pointer;
}

.chat-form {
  display: flex;
  gap: 0.5rem;
}

.chat-form input {
  flex: 1;
  border: 1px solid #d1dae8;
  border-radius: 0.85rem;
  padding: 0.65rem 0.85rem;
}

.chat-form button {
  border: none;
  border-radius: 0.85rem;
  padding: 0.65rem 1rem;
  background: #0b2e33;
  color: #fff;
}

.ai-response {
  background: #f1f5f9;
  border-radius: 0.75rem;
  padding: 0.75rem;
  min-height: 80px;
}

.task-editor {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-editor__card {
  width: min(420px, 100%);
  background: #fff;
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.task-editor__card textarea,
.task-editor__card input,
.task-editor__card select {
  width: 100%;
  border: 1px solid #d1dae8;
  border-radius: 0.75rem;
  padding: 0.65rem 0.85rem;
}

.task-editor__card header {
  display: flex;
  justify-content: space-between;
}

.task-editor__card footer {
  display: flex;
  justify-content: flex-end;
}

.task-editor__card footer button {
  border: none;
  border-radius: 0.75rem;
  padding: 0.65rem 1rem;
  background: #0b2e33;
  color: #fff;
}

@media (max-width: 1024px) {
  .dashboard {
    grid-template-columns: 1fr;
  }

  .dashboard__sidebar {
    flex-direction: row;
    overflow-x: auto;
  }

  .dashboard__main {
    padding: 1.5rem;
  }

  .task-board {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { collection, doc, getDoc, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuthStore } from '@/store/auth'
import { ROUTE_NAMES } from '@/constants/routes'
import type { ProjectDoc } from '@/types/project'
import DashboardSidebar from '@/components/projectDashboard/DashboardSidebar.vue'
import DashboardSummaryCards, { type SummaryCard } from '@/components/projectDashboard/DashboardSummaryCards.vue'
import DashboardTaskBoard, { type BoardColumn } from '@/components/projectDashboard/DashboardTaskBoard.vue'
import TeamChatPreview, { type PreviewChatMessage } from '@/components/projectDashboard/TeamChatPreview.vue'
import AppButton from '@/components/ui/AppButton.vue'
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

const router = useRouter()
const route = useRoute()
const { user, profile } = useAuthStore()
const projectId = ref(String(route.params.projectId || ''))

const project = ref<ProjectDoc | null>(null)
const projectList = ref<{ id: string; name: string }[]>([])
const members = ref<{ id: string; name: string }[]>([])
const tasks = ref<TaskDoc[]>([])
const selectedTask = ref<TaskDoc | null>(null)
const editor = reactive({ description: '', dueDate: '', assigneeId: '', status: 'todo' as TaskStatus })
const chatMessages = ref<ChatMessage[]>([])
const chatInput = ref('')
const notifications = ref<string[]>([])
const filters = reactive({ search: '', status: 'all', assignee: 'all', due: 'all' })
const showMyTasksOnly = ref(false)
const aiEnabled = ref(false)
const aiKey = ref('')
const aiPrompt = ref('')
const aiResponse = ref('')
const aiLoading = ref(false)
const quickTitle = ref('')
const isSidebarOpen = ref(true)

let stopTasks: (() => void) | null = null
let stopProject: (() => void) | null = null
let stopMembers: (() => void) | null = null
let stopChat: (() => void) | null = null

const STATUS_CONFIG = [
  { key: 'todo', title: '未着手' },
  { key: 'in-progress', title: '進行中' },
  { key: 'done', title: '完了' },
]

const navItems = computed(() => [
  { key: 'dashboard', label: 'ダッシュボード', to: { name: ROUTE_NAMES.projectDashboard, params: { projectId: projectId.value } }, icon: 'dashboard' },
  { key: 'tasks', label: 'マイタスク', to: { name: ROUTE_NAMES.myTasks }, icon: 'tasks' },
  { key: 'team', label: 'チャット', to: { name: ROUTE_NAMES.projectChat, params: { projectId: projectId.value } }, icon: 'team' },
  { key: 'settings', label: '設定', disabled: true, icon: 'settings' },
])

const sidebarProjects = computed(() =>
  projectList.value.map((entry, index) => ({
    key: entry.id,
    label: entry.name,
    to: { name: ROUTE_NAMES.projectDashboard, params: { projectId: entry.id } },
    accent: (['primary', 'secondary', 'accent'][index % 3] as 'primary' | 'secondary' | 'accent'),
  })),
)

const profileInfo = computed(() => ({
  name: profile.value?.nickname || profile.value?.fullName || 'Teamie User',
  email: profile.value?.email || '',
}))

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
      if (filters.due === 'today') return due.toDateString() === now.toDateString()
      if (filters.due === 'week') return due.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000 && due >= now
      if (filters.due === 'overdue') return due < now
      return true
    })
  }
  if (showMyTasksOnly.value && user.value) {
    list = list.filter((task) => task.assigneeId === user.value?.uid)
  }
  return list
})

const boardColumns = computed<BoardColumn[]>(() => {
  const memberMap = Object.fromEntries(members.value.map((member) => [member.id, member.name]))
  return STATUS_CONFIG.map((status) => {
    const columnTasks = filteredTasks.value
      .filter((task) => task.status === status.key)
      .map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description || '説明なし',
        status: status.title,
        priority: '中',
        due: task.dueDate?.seconds ? new Date(task.dueDate.seconds * 1000).toLocaleDateString() : '未設定',
        assignee: memberMap[task.assigneeId || ''] || '未割当',
        comments: 0,
      }))
    return {
      key: status.key,
      title: status.title,
      badge: columnTasks.length ? String(columnTasks.length) : undefined,
      tasks: columnTasks,
    }
  })
})

const summaryCards = computed<SummaryCard[]>(() => {
  const total = tasks.value.length
  const done = tasks.value.filter((task) => task.status === 'done').length
  const progress = total ? Math.round((done / total) * 100) : 0
  const inProgress = tasks.value.filter((task) => task.status === 'in-progress').length
  const overdue = tasks.value.filter((task) => task.dueDate?.seconds && task.dueDate.seconds * 1000 < Date.now()).length
  return [
    { id: 'progress', label: '進捗率', value: progress, caption: '完了タスク率' },
    { id: 'done', label: '完了', value: String(done), caption: '完了済みタスク' },
    { id: 'active', label: '進行中', value: String(inProgress), caption: '進行中のタスク' },
    { id: 'overdue', label: '期限切れ', value: String(overdue), caption: '期限切れタスク', tone: overdue > 0 ? 'alert' : 'neutral' },
  ]
})

const chatPreviewMessages = computed<PreviewChatMessage[]>(() =>
  chatMessages.value.map((message) => ({
    id: message.id,
    author: message.senderName,
    time: message.createdAt?.seconds ? new Date(message.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
    message: message.text,
    type: undefined,
  })),
)

function evaluateNotifications() {
  const now = Date.now()
  const oneDay = 24 * 60 * 60 * 1000
  const userAssignments = tasks.value.filter((task) => task.assigneeId === user.value?.uid)
  const dueSoon = tasks.value.filter((task) => task.dueDate?.seconds && task.dueDate.seconds * 1000 - now <= oneDay && task.dueDate.seconds * 1000 > now)
  const alerts: string[] = []
  if (userAssignments.length) alerts.push(`あなたに割り当てられたタスクが ${userAssignments.length} 件あります`)
  if (dueSoon.length) alerts.push(`期限が迫っているタスク: ${dueSoon.length} 件`)
  notifications.value = alerts
}

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
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as any
      items.push({ id: data.userId, name: data.nickname || data.fullName || docSnap.id })
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

function resetWatchers() {
  stopTasks?.()
  stopProject?.()
  stopMembers?.()
  stopChat?.()
  watchProject()
  watchTasks()
  watchChat()
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

function selectTaskById(taskId: string) {
  const match = tasks.value.find((task) => task.id === taskId)
  if (match) openEditor(match)
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

async function handleStatusChange(payload: { taskId: string; status: string }) {
  await updateTask(projectId.value, payload.taskId, { status: payload.status as TaskStatus })
}

async function sendChatMessage(text: string) {
  if (!user.value) return
  await sendProjectMessage(
    projectId.value,
    user.value.uid,
    profile.value?.nickname || profile.value?.fullName || 'User',
    text,
  )
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
  if (!aiPrompt.value.trim()) return
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
    if (!response.ok) throw new Error('AI API エラー')
    const data = await response.json()
    aiResponse.value = data.choices?.[0]?.message?.content || '回答を取得できませんでした。'
  } catch (error: any) {
    aiResponse.value = error?.message || 'AI 応答に失敗しました。'
  } finally {
    aiLoading.value = false
  }
}

function closeSidebar() {
  isSidebarOpen.value = false
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}

onMounted(() => {
  if (window.matchMedia('(max-width: 1200px)').matches) {
    isSidebarOpen.value = false
  }
  loadProjectList()
  resetWatchers()
})

watch(
  () => route.params.projectId,
  (newId) => {
    if (!newId) return
    projectId.value = String(newId)
    resetWatchers()
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
  <div :class="['demo', { 'demo--sidebar-collapsed': !isSidebarOpen }]">
    <DashboardSidebar
      :open="isSidebarOpen"
      :nav-items="navItems"
      :projects="sidebarProjects"
      :profile="profileInfo"
      brand-subtitle="プロジェクト"
      @close="closeSidebar"
    />
    <div v-if="isSidebarOpen" class="demo__overlay" @click="closeSidebar" />

    <div class="demo__main">
      <header class="demo__topbar">
        <div class="demo__topbar-left">
          <button type="button" class="demo__menu-button" @click="toggleSidebar">
            <span class="sr-only">サイドバーを切り替え</span>
            <svg aria-hidden="true" class="demo__menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <p class="demo__breadcrumb">プロジェクト &gt; ダッシュボード</p>
            <h1 class="demo__heading">{{ project?.name || 'プロジェクト' }}</h1>
          </div>
        </div>
        <div class="demo__toolbar">
          <AppButton variant="outline" :to="{ name: ROUTE_NAMES.projectCreate }">新規プロジェクト</AppButton>
        </div>
      </header>

      <div class="demo__content">
        <DashboardSummaryCards
          :title="project?.name || 'ダッシュボード'"
          :description="`${members.length} 人のメンバーと ${tasks.length} 件のタスク`"
          note="実データに基づいて自動更新"
          :cards="summaryCards"
          :rotate="false"
        />

        <div class="filters">
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
        </div>

        <section v-if="notifications.length" class="dashboard__alerts">
          <p v-for="note in notifications" :key="note">⚡ {{ note }}</p>
        </section>

        <div class="demo__grid">
          <section class="demo__primary">
            <DashboardTaskBoard
              :columns="boardColumns"
              :interactive="true"
              @create="handleQuickCreate"
              @select="selectTaskById"
              @change-status="handleStatusChange"
            />
          </section>

          <aside class="demo__secondary">
            <div class="chat-preview__header">
              <h3>チームチャット（プレビュー）</h3>
              <AppButton variant="outline" :to="{ name: ROUTE_NAMES.projectChat, params: { projectId: projectId } }">チャットを開く</AppButton>
            </div>
            <TeamChatPreview :messages="chatPreviewMessages" :online-count="members.length" :show-composer="true" @send="sendChatMessage" />

            <section class="ai-panel">
              <h3>AI アシスタント</h3>
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
            </section>
          </aside>
        </div>
      </div>
    </div>

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
          <button type="button" class="danger" @click="selectedTask && removeTask(selectedTask.id)">削除</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '@/pages/demo/styles/demo-shell.css';

.demo__content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.filters input,
.filters select {
  padding: 0.65rem 0.85rem;
  border-radius: 0.8rem;
  border: 1px solid #d1dae8;
  background: #fff;
}

.filters > button {
  padding: 0.65rem 1rem;
  border-radius: 0.8rem;
  border: none;
  background: #0b2e33;
  color: #fff;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-weight: 600;
}

.dashboard__alerts {
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
  padding: 0.85rem 1rem;
  border-radius: 1rem;
}

.ai-panel {
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid #e1e8f0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: #fff;
}

.chat-preview__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.ai-panel textarea,
.ai-panel input {
  width: 100%;
  border-radius: 0.8rem;
  border: 1px solid #d1dae8;
  padding: 0.65rem 0.85rem;
}

.ai-panel button {
  align-self: flex-start;
  border: none;
  border-radius: 0.8rem;
  padding: 0.6rem 1rem;
  background: #0b2e33;
  color: #fff;
}

.ai-response {
  background: #f1f5f9;
  border-radius: 0.8rem;
  padding: 0.75rem;
  min-height: 80px;
}

.task-editor {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-editor__card {
  width: min(460px, 100%);
  background: #fff;
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.task-editor__card header {
  display: flex;
  justify-content: space-between;
}

.task-editor__card textarea,
.task-editor__card input,
.task-editor__card select {
  width: 100%;
  border: 1px solid #d1dae8;
  border-radius: 0.75rem;
  padding: 0.65rem 0.85rem;
}

.task-editor__card footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.task-editor__card footer button {
  border: none;
  border-radius: 0.75rem;
  padding: 0.6rem 1rem;
  background: #0b2e33;
  color: #fff;
}

.task-editor__card footer .danger {
  background: #d64545;
}
</style>

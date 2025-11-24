<script setup lang="ts">
import DashboardSidebar from '@/components/projectDashboard/DashboardSidebar.vue'
import DashboardSummaryCards, { type SummaryCard } from '@/components/projectDashboard/DashboardSummaryCards.vue'
import TeamChatPreview from '@/components/projectDashboard/TeamChatPreview.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { ROUTE_NAMES } from '@/constants/routes'
import { db } from '@/firebase/config'
import { useUserDisplay } from '@/composables/useUserDisplay'
import {
  addMessageReaction,
  deleteProjectMessage,
  listenProjectChat,
  sendProjectMessage,
  updateProjectMessage,
  type ChatMessage,
} from '@/services/projectChat'
import {
  createTask,
  deleteTask,
  listenTasks,
  updateTask,
  type TaskDoc,
  type TaskStatus,
} from '@/services/taskService'
import { useAuthStore } from '@/store/auth'
import type { ProjectDoc } from '@/types/project'
import type { DashboardNavItem, PreviewChatMessage } from '@/types/projectDashboard'
import { collection, doc, getDoc, getDocs, onSnapshot } from 'firebase/firestore'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const { user, profile } = useAuthStore()
const projectId = ref(String(route.params.projectId || ''))

type MemberEntry = {
  id: string
  name: string
  role?: string
  email?: string
  lastAccessedAt?: { seconds: number; nanoseconds: number }
}

const project = ref<ProjectDoc | null>(null)
const projectList = ref<{ id: string; name: string }[]>([])
const members = ref<MemberEntry[]>([])
const { getDisplayName } = useUserDisplay(members)
const tasks = ref<TaskDoc[]>([])
const selectedTask = ref<TaskDoc | null>(null)
const editor = reactive({ description: '', dueDate: '', assigneeId: '', status: 'todo' as TaskStatus, progress: 0 })
const chatMessages = ref<ChatMessage[]>([])
const chatLoading = ref(true)
const notifications = ref<string[]>([])
const filters = reactive({ search: '', status: 'all', assignee: 'all', due: 'all' })
const showMyTasksOnly = ref(false)
const isSidebarOpen = ref(true)
const isTaskModalOpen = ref(false)
const secondaryTab = ref<'chat' | 'members'>('chat')
const PROGRESS_OPTIONS = [0, 25, 50, 75, 100] as const
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * 20

const taskForm = reactive({ title: '', description: '', dueDate: '', assigneeId: '', progress: 0 })

let stopTasks: (() => void) | null = null
let stopProject: (() => void) | null = null
let stopMembers: (() => void) | null = null
let stopChat: (() => void) | null = null

const navItems = computed<DashboardNavItem[]>(() =>
  [
    {
      key: 'dashboard',
      label: 'ダッシュボード',
      to: { name: ROUTE_NAMES.projectDashboard, params: { projectId: projectId.value } },
      icon: 'dashboard',
    },
    { key: 'tasks', label: 'マイタスク', to: { name: ROUTE_NAMES.myTasks }, icon: 'tasks' },
    {
      key: 'team',
      label: 'チャット',
      to: { name: ROUTE_NAMES.projectChat, params: { projectId: projectId.value } },
      icon: 'team',
    },
    {
      key: 'members',
      label: 'メンバー',
      to: { name: ROUTE_NAMES.projectMembers, params: { projectId: projectId.value } },
      icon: 'members',
    },
    {
      key: 'settings',
      label: '設定',
      to: { name: ROUTE_NAMES.projectSettings, params: { projectId: projectId.value } },
      icon: 'settings',
    },
  ] satisfies DashboardNavItem[],
)

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

const statusLabels: Record<TaskStatus, string> = {
  todo: '未着手',
  'in-progress': '進行中',
  review: 'レビュー',
  done: '完了',
}

const wbsGroups = computed(() => {
  const groups = members.value.map((member) => ({
    id: member.id,
    name: member.name,
    tasks: filteredTasks.value.filter((task) => task.assigneeId === member.id),
  }))
  const unassignedTasks = filteredTasks.value.filter((task) => !task.assigneeId)
  groups.push({ id: 'unassigned', name: '未割当', tasks: unassignedTasks })

  return groups
    .filter((group) => group.tasks.length)
    .map((group) => {
      const progressSum = group.tasks.reduce((sum, task) => sum + (task.progress ?? (task.status === 'done' ? 100 : 0)), 0)
      const progress = group.tasks.length ? Math.round(progressSum / group.tasks.length) : 0
      return {
        ...group,
        progress,
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

function formatDueDate(task: TaskDoc) {
  if (!task.dueDate?.seconds) return '未設定'
  return new Date(task.dueDate.seconds * 1000).toLocaleDateString()
}

function normalizeProgress(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  const clamped = Math.min(100, Math.max(0, value))
  return Math.round(clamped / 25) * 25
}

function statusClass(status: TaskStatus) {
  switch (status) {
    case 'done':
      return 'status-pill status-pill--done'
    case 'in-progress':
      return 'status-pill status-pill--progress'
    case 'review':
      return 'status-pill status-pill--review'
    default:
      return 'status-pill status-pill--todo'
  }
}

function taskPriority(task: TaskDoc) {
  return ((task as any).priority as string) || '中'
}

function taskProgress(task: TaskDoc) {
  return normalizeProgress(task.progress ?? (task.status === 'done' ? 100 : 0))
}

const chatPreviewMessages = computed<PreviewChatMessage[]>(() =>
  chatMessages.value.map((message) => ({
    id: message.id,
    author: message.author || message.senderName || 'Unknown',
    time: message.createdAt
      ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--:--',
    message: message.text,
    reactions: message.reactionSummary || [],
    senderId: message.senderId,
    linkedTaskId: message.linkedTaskId,
    isTask: message.isTask,
  })),
)

const onlineMemberCount = computed(() => members.value.filter((member) => isMemberRecentlyActive(member)).length)
const memberPreviewList = computed(() =>
  members.value.slice(0, 4).map((member) => ({
    ...member,
    statusLabel: memberStatusLabel(member),
    statusClass: memberStatusClass(member),
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
  })
  stopMembers = onSnapshot(collection(db, 'projects', projectId.value, 'members'), async (snapshot) => {
    const promises = snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data() as any
      const memberId = data.userId || docSnap.id
      let name = data.nickname || data.fullName

      if (!name) {
        try {
          const profileSnap = await getDoc(doc(db, 'profiles', memberId))
          if (profileSnap.exists()) {
            const profile = profileSnap.data()
            name = profile.nickname || profile.fullName
          }
        } catch (e) {
          console.error('Failed to fetch profile for', memberId, e)
        }
      }

      return {
        id: memberId,
        name: name || docSnap.id,
        role: data.role,
        email: data.email,
        lastAccessedAt: data.lastAccessedAt,
      }
    })

    members.value = await Promise.all(promises)
  })
}

function watchTasks() {
  stopTasks = listenTasks(projectId.value, (list) => {
    tasks.value = list
    evaluateNotifications()
  })
}

function watchChat() {
  chatLoading.value = true
  stopChat = listenProjectChat(
    projectId.value,
    (messages) => {
      chatMessages.value = messages
      chatLoading.value = false
    },
    (error) => {
      console.error('Failed to load chat:', error)
      chatLoading.value = false
    },
  )
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

function resetTaskForm() {
  taskForm.title = ''
  taskForm.description = ''
  taskForm.dueDate = ''
  taskForm.assigneeId = ''
  taskForm.progress = 0
}

function openTaskModal() {
  resetTaskForm()
  isTaskModalOpen.value = true
}

function closeTaskModal() {
  isTaskModalOpen.value = false
}

function getMemberNameById(id?: string | null) {
  if (!id) return ''
  const member = members.value.find((entry) => entry.id === id)
  return member?.name || getDisplayName(id) || ''
}

function displayAssignee(task: TaskDoc) {
  if (task.assigneeName) return task.assigneeName
  const memberName = getMemberNameById(task.assigneeId || '')
  return memberName || task.assigneeId || '未割当'
}

async function submitTaskForm() {
  if (!user.value || !taskForm.title.trim()) return
  const assigneeId = taskForm.assigneeId || null
  const normalizedProgress = normalizeProgress(taskForm.progress)
  await createTask(
    projectId.value,
    {
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      dueDate: taskForm.dueDate ? new Date(taskForm.dueDate) : null,
      assigneeId,
      assigneeName: assigneeId ? getMemberNameById(assigneeId) : null,
      progress: normalizedProgress,
    },
    user.value.uid,
  )
  closeTaskModal()
}

function openEditor(task: TaskDoc) {
  selectedTask.value = task
  editor.description = task.description || ''
  editor.dueDate = task.dueDate?.seconds ? new Date(task.dueDate.seconds * 1000).toISOString().slice(0, 10) : ''
  editor.assigneeId = task.assigneeId || ''
  editor.status = task.status
  editor.progress = normalizeProgress(task.progress ?? (task.status === 'done' ? 100 : 0))
}

function selectTaskById(taskId: string) {
  const match = tasks.value.find((task) => task.id === taskId)
  if (match) openEditor(match)
}

async function saveTask() {
  if (!selectedTask.value) return
  const assigneeName = editor.assigneeId ? getMemberNameById(editor.assigneeId) : null
  const normalizedProgress = normalizeProgress(editor.progress)
  await updateTask(projectId.value, selectedTask.value.id, {
    description: editor.description,
    status: editor.status,
    dueDate: editor.dueDate ? new Date(editor.dueDate) : null,
    assigneeId: editor.assigneeId || null,
    assigneeName,
    progress: normalizedProgress,
  })
  selectedTask.value = null
}

async function removeTask(taskId: string) {
  await deleteTask(projectId.value, taskId)
}

async function sendChatMessage(text: string) {
  if (!user.value) return
  await sendProjectMessage(
    projectId.value,
    user.value.uid,
    profile.value?.nickname || profile.value?.fullName || 'User',
    text,
    'general',
  )
}

async function reactToChatMessage(payload: { messageId: string; emoji: string }) {
  if (!user.value || !payload.messageId || !payload.emoji) return
  await addMessageReaction(projectId.value, payload.messageId, payload.emoji, user.value.uid)
}

async function handleUpdateMessage(payload: { messageId: string; text: string }) {
  if (!user.value || !payload.messageId || !payload.text) return
  await updateProjectMessage(projectId.value, payload.messageId, payload.text)
}

async function handleDeleteMessage(messageId: string) {
  if (!user.value || !messageId) return
  await deleteProjectMessage(projectId.value, messageId)
}

async function handleConvertToTask(payload: { messageId: string; text: string }) {
  if (!user.value) return
  const taskId = await createTask(projectId.value, { title: payload.text }, user.value.uid)
  await updateProjectMessage(projectId.value, payload.messageId, undefined, taskId)
}

async function handleLinkTask(payload: { messageId: string; taskId: string }) {
  if (!user.value) return
  await updateProjectMessage(projectId.value, payload.messageId, undefined, payload.taskId)
}

function isMemberRecentlyActive(member: MemberEntry) {
  if (!member.lastAccessedAt?.seconds) return false
  const lastAccess = member.lastAccessedAt.seconds * 1000
  return Date.now() - lastAccess < 1000 * 60 * 60 * 4
}

function memberStatusLabel(member: MemberEntry) {
  if (!member.lastAccessedAt?.seconds) return 'オフライン'
  const lastAccess = member.lastAccessedAt.seconds * 1000
  const diff = Date.now() - lastAccess
  if (diff < 1000 * 60 * 5) return 'オンライン'
  if (diff < 1000 * 60 * 60) return '離席中'
  return 'オフライン'
}

function memberStatusClass(member: MemberEntry) {
  const status = memberStatusLabel(member)
  if (status === 'オンライン') return 'online'
  if (status === '離席中') return 'away'
  return 'offline'
}

function getMemberInitials(name: string) {
  if (!name) return '??'
  const trimmed = name.trim()
  if (trimmed.length <= 2) {
    return trimmed
  }
  return trimmed.slice(0, 2).toUpperCase()
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
        </div>
      </header>

      <div class="demo__content">
        <DashboardSummaryCards
          :title="project?.name || 'ダッシュボード'"
          :description="`${members.length} 人のメンバーと ${tasks.length} 件のタスク`"
          :cards="summaryCards"
          :rotate="false"
        />

        <div class="filters">
          <button type="button" class="filters__new" @click="openTaskModal">＋ 新規タスク</button>
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
            <div class="wbs">
              <article v-for="group in wbsGroups" :key="group.id" class="wbs__group">
                <header class="wbs__group-header">
                  <div>
                    <p class="wbs__eyebrow">担当者</p>
                    <h3>{{ group.name }}</h3>
                  </div>
                  <div class="wbs__progress">
                    <span>{{ group.progress }}%</span>
                    <div class="wbs__progress-track">
                      <div class="wbs__progress-fill" :style="{ width: `${group.progress}%` }" />
                    </div>
                    <small>{{ group.tasks.length }}件</small>
                  </div>
                </header>
                <ul class="wbs__tasks">
                  <li
                    v-for="task in group.tasks"
                    :key="task.id"
                    class="wbs-task"
                    @click="selectTaskById(task.id)"
                  >
                    <div class="wbs-task__main">
                      <p class="wbs-task__title">{{ task.title }}</p>
                      <span :class="statusClass(task.status)">{{ statusLabels[task.status] }}</span>
                    </div>
                    <p class="wbs-task__description">{{ task.description || '説明なし' }}</p>
                    <div class="wbs-task__meta">
                      <span>担当: {{ displayAssignee(task) }}</span>
                      <span>期限: {{ formatDueDate(task) }}</span>
                      <span>優先度: {{ taskPriority(task) }}</span>
                    </div>
                    <div class="wbs-task__progress-row">
                      <div class="wbs-task__progress-circle">
                        <svg viewBox="0 0 48 48">
                          <circle cx="24" cy="24" r="20" stroke="#B8E3E9" stroke-width="4" fill="none" />
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            :stroke="taskProgress(task) === 100 ? '#4F7C82' : '#93B1B5'"
                            stroke-width="4"
                            fill="none"
                            :stroke-dasharray="PROGRESS_CIRCUMFERENCE"
                            :stroke-dashoffset="PROGRESS_CIRCUMFERENCE * (1 - taskProgress(task) / 100)"
                          />
                        </svg>
                        <span>{{ taskProgress(task) }}%</span>
                      </div>
                      <p class="wbs-task__progress-text">進捗状況</p>
                    </div>
                  </li>
                </ul>
              </article>
            </div>
          </section>

          <aside class="demo__secondary">
            <div class="secondary-tabs">
              <button
                type="button"
                :class="['secondary-tab', { 'is-active': secondaryTab === 'chat' }]"
                @click="secondaryTab = 'chat'"
              >
                チャット
              </button>
              <button
                type="button"
                :class="['secondary-tab', { 'is-active': secondaryTab === 'members' }]"
                @click="secondaryTab = 'members'"
              >
                メンバー
              </button>
            </div>

            <div v-if="secondaryTab === 'chat'">
              <div class="chat-preview__header">
                <h3>チームチャット</h3>
                <p>最新メッセージはダッシュボードから直接確認できます。</p>
              </div>
              <TeamChatPreview
                :messages="chatPreviewMessages"
                :online-count="members.length"
                :show-composer="true"
                :loading="chatLoading"
                :current-user-id="user?.uid"
                :current-user-name="profile?.nickname || profile?.fullName"
                :tasks="tasks"
                @send="sendChatMessage"
                @react="reactToChatMessage"
                @update="handleUpdateMessage"
                @delete="handleDeleteMessage"
                @convert-task="handleConvertToTask"
                @link-task="handleLinkTask"
              />
            </div>

            <div v-else class="member-preview">
              <div class="member-preview__header">
                <div>
                  <h3>チームメンバー</h3>
                  <p>{{ members.length }}名のメンバーを素早く確認できます。</p>
                </div>
                <AppButton
                  class="member-preview__cta"
                  variant="outline"
                  :to="{ name: ROUTE_NAMES.projectMembers, params: { projectId } }"
                >
                  メンバー管理へ
                </AppButton>
              </div>

              <div class="member-preview__stats">
                <div>
                  <p>総メンバー</p>
                  <strong>{{ members.length }}</strong>
                </div>
                <div>
                  <p>オンライン</p>
                  <strong>{{ onlineMemberCount }}</strong>
                </div>
              </div>

              <ul class="member-preview__list">
                <li v-for="member in memberPreviewList" :key="member.id">
                  <div class="member-chip">
                    <div class="member-chip__avatar" aria-hidden="true">{{ getMemberInitials(member.name) }}</div>
                    <div>
                      <p class="member-chip__name">{{ member.name }}</p>
                      <p class="member-chip__meta">{{ member.role || 'member' }}・{{ member.statusLabel }}</p>
                    </div>
                  </div>
                  <span class="member-chip__status" :class="`status-${member.statusClass}`">{{ member.statusLabel }}</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>

    <div v-if="isTaskModalOpen" class="task-modal">
      <div class="task-modal__card">
        <header>
          <h3>新規タスク</h3>
          <button type="button" @click="closeTaskModal">×</button>
        </header>
        <form class="task-modal__form" @submit.prevent="submitTaskForm">
          <label>
            タイトル
            <input v-model="taskForm.title" type="text" placeholder="例）デザインレビュー" required />
          </label>
          <label>
            説明
            <textarea v-model="taskForm.description" rows="3" placeholder="タスクの詳細を入力"></textarea>
          </label>
          <label>
            期限
            <input v-model="taskForm.dueDate" type="date" />
          </label>
          <label>
            担当者
            <select v-model="taskForm.assigneeId">
              <option value="">未割当</option>
              <option v-for="member in members" :key="member.id" :value="member.id">
                {{ member.name }}
              </option>
            </select>
          </label>
          <section class="task-modal__section">
            <div class="task-modal__range-header">
              <p class="label">進捗率</p>
              <span class="hint">{{ taskForm.progress }}%</span>
            </div>
            <div class="progress-picker">
              <button
                v-for="option in PROGRESS_OPTIONS"
                :key="`modal-progress-${option}`"
                type="button"
                :class="['progress-pill', { 'is-active': taskForm.progress === option }]"
                @click="taskForm.progress = option"
              >
                {{ option }}%
              </button>
            </div>
          </section>
          <footer>
            <button type="button" class="ghost" @click="closeTaskModal">キャンセル</button>
            <button type="submit">作成</button>
          </footer>
        </form>
      </div>
    </div>

    <transition name="task-drawer">
      <div v-if="selectedTask" class="task-drawer">
        <div class="task-drawer__overlay" @click="selectedTask = null" />
        <aside class="task-drawer__panel">
          <header class="task-drawer__header">
            <div>
              <p class="task-drawer__eyebrow">タスク詳細</p>
              <h3>{{ selectedTask.title }}</h3>
            </div>
            <button type="button" @click="selectedTask = null">×</button>
          </header>
          <section class="task-drawer__section">
            <p class="label">説明</p>
            <textarea v-model="editor.description" rows="4"></textarea>
          </section>
          <section class="task-drawer__section">
            <p class="label">期限</p>
            <input v-model="editor.dueDate" type="date" />
          </section>
          <section class="task-drawer__section">
            <p class="label">担当者</p>
            <select v-model="editor.assigneeId">
              <option value="">未割当</option>
              <option v-for="member in members" :key="member.id" :value="member.id">{{ member.name }}</option>
            </select>
          </section>
        <section class="task-drawer__section">
          <p class="label">ステータス</p>
          <select v-model="editor.status">
            <option value="todo">未着手</option>
            <option value="in-progress">進行中</option>
            <option value="review">レビュー</option>
            <option value="done">完了</option>
          </select>
        </section>
        <section class="task-drawer__section">
          <div class="task-modal__range-header">
            <p class="label">進捗率</p>
            <span class="hint">{{ editor.progress }}%</span>
          </div>
          <div class="progress-picker">
            <button
              v-for="option in PROGRESS_OPTIONS"
              :key="`drawer-progress-${option}`"
              type="button"
              :class="['progress-pill', { 'is-active': editor.progress === option }]"
              @click="editor.progress = option"
            >
              {{ option }}%
            </button>
          </div>
        </section>
          <footer class="task-drawer__footer">
            <button type="button" class="ghost" @click="selectedTask = null">閉じる</button>
            <button type="button" @click="saveTask">保存</button>
            <button type="button" class="danger" @click="selectedTask && removeTask(selectedTask.id)">削除</button>
          </footer>
        </aside>
      </div>
    </transition>
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

.filters__new {
  padding: 0.65rem 1rem;
  border-radius: 0.9rem;
  border: none;
  background: #0b2e33;
  color: #fff;
  font-weight: 600;
  box-shadow: 0 10px 20px rgba(11, 46, 51, 0.2);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.filters__new:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 28px rgba(11, 46, 51, 0.25);
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

.demo__primary {
  display: grid;
  gap: 2rem;
}

.demo__secondary {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.secondary-tabs {
  display: flex;
  gap: 0.5rem;
}

.secondary-tab {
  flex: 1;
  border: 1px solid rgba(11, 46, 51, 0.12);
  border-radius: 1rem;
  padding: 0.65rem 1rem;
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-weight: 600;
  color: #4f7c82;
}

.secondary-tab.is-active {
  background: #0b2e33;
  color: #fff;
  border-color: #0b2e33;
  box-shadow: 0 12px 24px rgba(11, 46, 51, 0.18);
}

.member-preview {
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 1.25rem;
  padding: 1.25rem;
  background: #fffdf8;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.member-preview__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.member-preview__header h3 {
  margin: 0;
}

.member-preview__header p {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.member-preview__cta {
  padding: 0.45rem 1rem;
  font-size: 0.9rem;
}

.member-preview__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.member-preview__stats div {
  border-radius: 1rem;
  padding: 0.75rem 1rem;
  background: rgba(184, 227, 233, 0.3);
}

.member-preview__stats p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.member-preview__stats strong {
  font-size: 1.4rem;
  color: #0b2e33;
}

.member-preview__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.member-chip {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.member-chip__avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 999px;
  background: rgba(79, 124, 130, 0.15);
  color: #0b2e33;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.member-chip__name {
  margin: 0;
  font-weight: 600;
}

.member-chip__meta {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.member-chip__status {
  margin-left: auto;
  font-size: 0.85rem;
  font-weight: 600;
}

.member-chip__status.status-online {
  color: #1d9160;
}

.member-chip__status.status-away {
  color: #b07816;
}

.member-chip__status.status-offline {
  color: #9da8b6;
}

.wbs {
  display: grid;
  gap: 1.5rem;
}

.wbs__group {
  border: 1px solid var(--border-light);
  border-radius: 1.5rem;
  background: var(--surface-elevated, #fff);
  padding: 1.25rem;
  box-shadow: 0 16px 28px rgba(11, 46, 51, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.wbs__group-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.wbs__eyebrow {
  margin: 0;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.wbs__group-header h3 {
  margin: 0.2rem 0 0;
  font-size: 1.2rem;
  color: var(--text-strong);
}

.wbs__progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.wbs__progress-track {
  width: 120px;
  height: 0.4rem;
  background: rgba(11, 46, 51, 0.1);
  border-radius: 999px;
  overflow: hidden;
}

.wbs__progress-fill {
  height: 100%;
  background: #4f7c82;
  border-radius: inherit;
}

.wbs__tasks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.9rem;
}

.wbs-task {
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 1rem;
  padding: 0.9rem 1rem;
  display: grid;
  gap: 0.35rem;
  cursor: pointer;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}

.wbs-task:hover {
  border-color: rgba(11, 46, 51, 0.35);
  box-shadow: 0 12px 24px rgba(11, 46, 51, 0.15);
}

.wbs-task__main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.wbs-task__title {
  margin: 0;
  font-weight: 600;
  color: var(--text-strong);
}

.wbs-task__description {
  margin: 0;
  color: var(--text-muted);
}

.wbs-task__meta {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--text-muted);
  flex-wrap: wrap;
}

.wbs-task__progress-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.4rem;
}

.wbs-task__progress-circle {
  position: relative;
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-strong);
}

.wbs-task__progress-circle svg {
  position: absolute;
  inset: 0;
  transform: rotate(-90deg);
}

.wbs-task__progress-text {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.status-pill {
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-pill--todo {
  background: rgba(11, 46, 51, 0.08);
  color: var(--text-strong);
}
.status-pill--progress {
  background: rgba(79, 124, 130, 0.2);
  color: #0b2e33;
}
.status-pill--review {
  background: rgba(255, 202, 99, 0.25);
  color: #915a00;
}
.status-pill--done {
  background: rgba(34, 197, 94, 0.25);
  color: #166534;
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
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.chat-preview__header p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
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

.task-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 60;
}

.task-modal__card {
  width: min(520px, 100%);
  background: #fff;
  border-radius: 1.25rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: 0 24px 48px rgba(11, 46, 51, 0.2);
}

.task-modal__card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.task-modal__card button {
  border: none;
  background: transparent;
  font-size: 1.25rem;
  cursor: pointer;
}

.task-modal__form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.task-modal__form input,
.task-modal__form textarea,
.task-modal__form select {
  width: 100%;
  border-radius: 0.8rem;
  border: 1px solid #d1dae8;
  padding: 0.65rem 0.85rem;
}

.task-modal__form footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.task-modal__form footer button {
  border: none;
  border-radius: 0.8rem;
  padding: 0.6rem 1.2rem;
  cursor: pointer;
}

.task-modal__form footer .ghost {
  background: rgba(11, 46, 51, 0.08);
  color: #0b2e33;
}

.task-modal__form footer button:last-child {
  background: #0b2e33;
  color: #fff;
}

.task-modal__range-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-modal__range-header .hint {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.progress-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.4rem;
}

.progress-pill {
  border: 1px solid rgba(11, 46, 51, 0.2);
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
  background: transparent;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.progress-pill.is-active {
  background: #4f7c82;
  color: #fff;
  border-color: #4f7c82;
}

.task-drawer-enter-active,
.task-drawer-leave-active {
  transition: opacity 0.2s ease;
}

.task-drawer-enter-from,
.task-drawer-leave-to {
  opacity: 0;
}

.task-drawer-enter-from .task-drawer__panel,
.task-drawer-leave-to .task-drawer__panel {
  transform: translateX(20%);
  opacity: 0;
}

.task-drawer {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  z-index: 80;
}

.task-drawer__overlay {
  flex: 1;
  background: rgba(0, 0, 0, 0.35);
}

.task-drawer__panel {
  width: clamp(280px, 35vw, 420px);
  background: #fff;
  box-shadow: -12px 0 28px rgba(11, 46, 51, 0.18);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  transform: translateX(0);
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.task-drawer__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-drawer__eyebrow {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.task-drawer__header h3 {
  margin: 0.2rem 0 0;
}

.task-drawer__section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.task-drawer__section .label {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.task-drawer__section textarea,
.task-drawer__section input,
.task-drawer__section select {
  width: 100%;
  border: 1px solid #d1dae8;
  border-radius: 0.8rem;
  padding: 0.65rem 0.85rem;
}

.task-drawer__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.task-drawer__footer button {
  border: none;
  border-radius: 0.75rem;
  padding: 0.6rem 1rem;
  background: #0b2e33;
  color: #fff;
}

.task-drawer__footer .ghost {
  background: rgba(11, 46, 51, 0.1);
  color: #0b2e33;
}

.task-drawer__footer .danger {
  background: #d64545;
}
</style>

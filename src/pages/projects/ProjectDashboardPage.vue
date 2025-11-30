<script setup lang="ts">
import DashboardSidebar from '@/components/projectDashboard/DashboardSidebar.vue'
import DashboardSummaryCards, { type SummaryCard } from '@/components/projectDashboard/DashboardSummaryCards.vue'
import NotificationBar from '@/components/projectDashboard/NotificationBar.vue'
import { useNotificationCenter } from '@/composables/useNotificationCenter'
import { useUserDisplay } from '@/composables/useUserDisplay'
import { ROUTE_NAMES } from '@/constants/routes'
import { db } from '@/firebase/config'
import {
  // addMessageReaction,
  // deleteProjectMessage,
  listenProjectChat,
  // sendProjectMessage,
  // updateProjectMessage,
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
import type { ProjectMember } from '@/services/projectMembers'
import { useAuthStore } from '@/store/auth'
import type { ProjectDoc } from '@/types/project'
import type { DashboardNavItem, PreviewChatMessage } from '@/types/projectDashboard'
import { collection, doc, getDoc, getDocs, onSnapshot } from 'firebase/firestore'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const { user, profile } = useAuthStore()
const projectId = ref(String(route.params.projectId || ''))

type MemberEntry = ProjectMember & {
  id: string
  name: string
  lastAccessedAt?: { seconds: number; nanoseconds: number }
}

type DashboardNotification = {
  id: string
  message: string
  dismissible: boolean
}

const project = ref<ProjectDoc | null>(null)
const projectList = ref<{ id: string; name: string }[]>([])
const members = ref<MemberEntry[]>([])
const { getDisplayName } = useUserDisplay(members)
const tasks = ref<TaskDoc[]>([])
const { notifications: notificationsBar, sendNotification } = useNotificationCenter()
const taskView = ref<'all' | 'mine'>('all')
const selectedTask = ref<TaskDoc | null>(null)
const editor = reactive({ description: '', dueDate: '', assigneeId: '', status: 'todo' as TaskStatus, progress: 0 })
const chatMessages = ref<ChatMessage[]>([])
const chatLoading = ref(true)
const notifications = ref<DashboardNotification[]>([])
const dismissedNotificationIds = ref<Set<string>>(new Set())
const filters = reactive({ search: '', status: 'all', assignee: 'all', due: 'all' })
const showMyTasksOnly = ref(false)
const isSidebarOpen = ref(true)
const isTaskModalOpen = ref(false)
// const secondaryTab = ref<'chat' | 'members'>('chat')
const PROGRESS_OPTIONS = [0, 25, 50, 75, 100] as const

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
    {
      key: 'debug',
      label: 'デバッグ',
      to: { name: ROUTE_NAMES.projectDebug, params: { projectId: projectId.value } },
      icon: 'debug',
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
if (taskView.value === 'mine' && user.value) {
  list = list.filter((task) => task.assigneeId === user.value?.uid)
}
return list
})

const summaryCards = computed<SummaryCard[]>(() => {
  const total = tasks.value.length
  const done = tasks.value.filter((task) => task.status === 'done').length
  
  const inProgress = tasks.value.filter((task) => task.status === 'in-progress').length
  const overdue = tasks.value.filter((task) => task.dueDate?.seconds && task.dueDate.seconds * 1000 < Date.now()).length
  
  return [
    { 
      id: 'done', 
      label: '完了タスク', 
      value: String(done), 
      caption: `全${total}件中${done}件が完了`,
      icon: 'check'
    },
    { 
      id: 'active', 
      label: '進行中', 
      value: String(inProgress), 
      caption: '現在作業中のタスク数',
      icon: 'activity'
    },
    { 
      id: 'overdue', 
      label: '期限切れ', 
      value: String(overdue), 
      caption: '期限を超過したタスク', 
      tone: overdue > 0 ? 'alert' : 'neutral',
      icon: 'alert'
    },
  ]
})


const gaugeRadius = 80
const gaugeCircumference = Math.PI * gaugeRadius

const overallProgress = computed(() => {
  const total = tasks.value.length
  if (!total) return 0
  const totalProgress = tasks.value.reduce((sum, task) => {
    return sum + (task.progress ?? (task.status === 'done' ? 100 : 0))
  }, 0)
  return Math.round(totalProgress / total)
})

const statusCounts = computed(() => {
  const counts: Record<TaskStatus, number> = {
    todo: 0,
    'in-progress': 0,
    review: 0,
    done: 0,
  }
  tasks.value.forEach((task) => {
    counts[task.status] = (counts[task.status] || 0) + 1
  })
  return counts
})

const maxStatusCount = computed(() => {
  const values = Object.values(statusCounts.value)
  return Math.max(1, ...values)
})

const healthScore = computed(() => {
  const overdue = tasks.value.filter((task) => isTaskOverdue(task)).length
  const now = Date.now()
  const soonThreshold = 3 * 24 * 60 * 60 * 1000
  const dueSoon = tasks.value.filter(
    (task) => task.dueDate?.seconds && task.dueDate.seconds * 1000 - now <= soonThreshold && task.dueDate.seconds * 1000 > now,
  ).length
  const progressPenalty = Math.max(0, 70 - overallProgress.value) * 0.4
  let score = 100
  score -= overdue * 12
  score -= dueSoon * 5
  score -= progressPenalty
  return Math.max(0, Math.min(100, Math.round(score)))
})

const healthColor = computed(() => {
  if (healthScore.value >= 80) return '#16a34a'
  if (healthScore.value >= 60) return '#f59e0b'
  if (healthScore.value >= 40) return '#f97316'
  return '#ef4444'
})

const gaugeDashoffset = computed(() => gaugeCircumference * (1 - healthScore.value / 100))
const healthNeedleRotation = computed(() => -90 + (healthScore.value / 100) * 180)

const gaugeSegments = [
  { id: 'danger', color: '#ef4444', size: 40 },
  { id: 'warn', color: '#f97316', size: 20 },
  { id: 'caution', color: '#f59e0b', size: 20 },
  { id: 'good', color: '#16a34a', size: 20 },
]

const gaugeSegmentStyles = computed(() => {
  let offset = 0
  return gaugeSegments.map((segment) => {
    const len = gaugeCircumference * (segment.size / 100)
    const style = {
      stroke: segment.color,
      strokeDasharray: `${len} ${gaugeCircumference - len}`,
      strokeDashoffset: `${-offset}`,
    }
    offset += len
    return style
  })
})


function formatDueDate(task: TaskDoc) {
  if (!task.dueDate?.seconds) return '未設定'
  return new Date(task.dueDate.seconds * 1000).toLocaleDateString()
}

function isTaskOverdue(task: TaskDoc) {
  if (!task.dueDate?.seconds) return false
  const due = task.dueDate.seconds * 1000
  return due < Date.now() && task.status !== 'done'
}

function taskStatusLabel(status: TaskStatus) {
  if (status === 'in-progress') return '進行中'
  if (status === 'review') return 'レビュー'
  if (status === 'done') return '完了'
  return '未着手'
}

function taskStatusClass(task: TaskDoc) {
  const base = `task-row__status--${task.status}`
  return [base, { 'is-overdue': isTaskOverdue(task) }]
}

function normalizeProgress(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  const clamped = Math.min(100, Math.max(0, value))
  return Math.round(clamped / 25) * 25
}

function taskProgress(task: TaskDoc) {
  return normalizeProgress(task.progress ?? (task.status === 'done' ? 100 : 0))
}

// const chatPreviewMessages = computed<PreviewChatMessage[]>(() =>
//   chatMessages.value.map((message) => ({
//     id: message.id,
//     author: message.author || message.senderName || 'Unknown',
//     time: message.createdAt
//       ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
//       : '--:--',
//     message: message.text,
//     reactions: message.reactionSummary || [],
//     senderId: message.senderId,
//     linkedTaskId: message.linkedTaskId,
//     isTask: message.isTask,
//   })),
// )

// const onlineMemberCount = computed(() => members.value.filter((member) => isMemberRecentlyActive(member)).length)
// const memberPreviewList = computed(() =>
//   members.value.slice(0, 4).map((member) => ({
//     ...member,
//     statusLabel: memberStatusLabel(member),
//     statusClass: memberStatusClass(member),
//   })),
// )


watch(() => editor.progress, (newVal) => {
  if (newVal > 0 && newVal < 100 && editor.status === 'todo') {
    editor.status = 'in-progress'
  }
  if (newVal === 100 && editor.status !== 'done') {
    editor.status = 'done'
  }
  if (newVal < 100 && editor.status === 'done') {
    editor.status = 'in-progress'
  }
})

watch(() => editor.status, (newVal) => {
  if (newVal === 'done') {
    editor.progress = 100
  }
  if (newVal === 'todo' && editor.progress > 0) {
    editor.progress = 0
  }
})

function evaluateNotifications() {
  const now = Date.now()
  const oneDay = 24 * 60 * 60 * 1000
  const userAssignments = tasks.value.filter((task) => task.assigneeId === user.value?.uid)
  const dueSoon = tasks.value.filter((task) => task.dueDate?.seconds && task.dueDate.seconds * 1000 - now <= oneDay && task.dueDate.seconds * 1000 > now)
  const overdueCount = tasks.value.filter((task) => isTaskOverdue(task)).length

  const alerts: DashboardNotification[] = []
  if (userAssignments.length && !dismissedNotificationIds.value.has('assigned')) {
    alerts.push({ id: 'assigned', message: `あなたに割り当てられたタスクが ${userAssignments.length} 件あります`, dismissible: true })
  }
  if (dueSoon.length && !dismissedNotificationIds.value.has('due-soon')) {
    alerts.push({ id: 'due-soon', message: `期限が迫っているタスク: ${dueSoon.length} 件`, dismissible: true })
  }
  if (overdueCount) {
    alerts.push({ id: 'overdue', message: `期限切れのタスクが ${overdueCount} 件あります`, dismissible: false })
  }
  notifications.value = alerts
}

function dismissNotification(id: string) {
  const note = notifications.value.find((entry) => entry.id === id)
  if (!note || !note.dismissible) return
  const next = new Set(dismissedNotificationIds.value)
  next.add(id)
  dismissedNotificationIds.value = next
  notifications.value = notifications.value.filter((entry) => entry.id !== id)
}

function resetFilters() {
  filters.search = ''
  filters.status = 'all'
  filters.assignee = 'all'
  filters.due = 'all'
}

watch(
  taskView,
  (mode) => {
    showMyTasksOnly.value = mode === 'mine'
  },
  { immediate: true },
)

watch(showMyTasksOnly, (flag) => {
  taskView.value = flag ? 'mine' : 'all'
})



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
        userId: memberId,
        role: (data.role as ProjectMember['role']) || 'member',
        projectRole: (data.projectRole as ProjectMember['projectRole']) || 'member',
        nickname: data.nickname,
        fullName: data.fullName,
        displayName: data.nickname || data.fullName || name || docSnap.id,
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
  
  let initialStatus: TaskStatus = 'todo'
  if (normalizedProgress === 100) initialStatus = 'done'
  else if (normalizedProgress > 0) initialStatus = 'in-progress'

  await createTask(
    projectId.value,
    {
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      dueDate: taskForm.dueDate ? new Date(taskForm.dueDate) : null,
      assigneeId,
      assigneeName: assigneeId ? getMemberNameById(assigneeId) : null,
      progress: normalizedProgress,
      status: initialStatus,
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

// async function sendChatMessage(text: string) {
//   if (!user.value) return
//   await sendProjectMessage(
//     projectId.value,
//     user.value.uid,
//     profile.value?.nickname || profile.value?.fullName || 'User',
//     text,
//     'general',
//   )
// }

// async function reactToChatMessage(payload: { messageId: string; emoji: string }) {
//   if (!user.value || !payload.messageId || !payload.emoji) return
//   await addMessageReaction(projectId.value, payload.messageId, payload.emoji, user.value.uid)
// }

// async function handleUpdateMessage(payload: { messageId: string; text: string }) {
//   if (!user.value || !payload.messageId || !payload.text) return
//   await updateProjectMessage(projectId.value, payload.messageId, payload.text)
// }

// async function handleDeleteMessage(messageId: string) {
//   if (!user.value || !messageId) return
//   await deleteProjectMessage(projectId.value, messageId)
// }

// async function handleConvertToTask(payload: { messageId: string; text: string }) {
//   if (!user.value) return
//   const taskId = await createTask(projectId.value, { title: payload.text }, user.value.uid)
//   await updateProjectMessage(projectId.value, payload.messageId, undefined, taskId)
// }

// async function handleLinkTask(payload: { messageId: string; taskId: string }) {
//   if (!user.value) return
//   await updateProjectMessage(projectId.value, payload.messageId, undefined, payload.taskId)
// }

// function isMemberRecentlyActive(member: MemberEntry) {
//   if (!member.lastAccessedAt?.seconds) return false
//   const lastAccess = member.lastAccessedAt.seconds * 1000
//   return Date.now() - lastAccess < 1000 * 60 * 60 * 4
// }

// function memberStatusLabel(member: MemberEntry) {
//   if (!member.lastAccessedAt?.seconds) return 'オフライン'
//   const lastAccess = member.lastAccessedAt.seconds * 1000
//   const diff = Date.now() - lastAccess
//   if (diff < 1000 * 60 * 5) return 'オンライン'
//   if (diff < 1000 * 60 * 60) return '離席中'
//   return 'オフライン'
// }

// function memberStatusClass(member: MemberEntry) {
//   const status = memberStatusLabel(member)
//   if (status === 'オンライン') return 'online'
//   if (status === '離席中') return 'away'
//   return 'offline'
// }

// function getMemberInitials(name: string) {
//   if (!name) return '??'
//   const trimmed = name.trim()
//   if (trimmed.length <= 2) {
//     return trimmed
//   }
//   return trimmed.slice(0, 2).toUpperCase()
// }



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
        <section v-if="notifications.length" class="dashboard__alerts">
          <div v-for="note in notifications" :key="note.id" class="dashboard__alert">
            <p>⚡ {{ note.message }}</p>
            <button
              v-if="note.dismissible"
              type="button"
              class="dashboard__alert-close"
              aria-label="通知を閉じる"
              @click.stop="dismissNotification(note.id)"
            >
              ×
            </button>
          </div>
        </section>
        <NotificationBar :notifications="notificationsBar" />
        <section class="dashboard__charts">
          <div class="chart-card chart-card--donut">
            <header class="chart-card__header">
              <p class="chart-card__eyebrow">全体の進捗</p>
              <h3>プロジェクト進捗</h3>
              <span class="chart-card__meta">{{ tasks.length }}件のタスク</span>
            </header>
            <span class="chart-card__metric">{{ overallProgress }}%</span>
            <div class="progress-chart">
              <div class="progress-chart__track">
                <div class="progress-chart__fill" :style="{ width: `${overallProgress}%` }" />
              </div>
              <div class="progress-chart__labels">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          <div class="chart-card chart-card--bars">
            <header class="chart-card__header">
              <p class="chart-card__eyebrow">タスクの状況</p>
              <h3>ステータス別タスク数</h3>
            </header>
            <ul class="status-bars">
              <li class="status-bars__row">
                <div class="status-bars__label">
                  <span>未着手</span>
                  <strong>{{ statusCounts.todo }}</strong>
                </div>
                <div class="status-bars__track">
                  <div
                    class="status-bars__fill status-bars__fill--todo"
                    :style="{ width: `${Math.max((statusCounts.todo / maxStatusCount) * 100, 6)}%` }"
                  />
                </div>
              </li>
              <li class="status-bars__row">
                <div class="status-bars__label">
                  <span>進行中</span>
                  <strong>{{ statusCounts['in-progress'] }}</strong>
                </div>
                <div class="status-bars__track">
                  <div
                    class="status-bars__fill status-bars__fill--progress"
                    :style="{ width: `${Math.max((statusCounts['in-progress'] / maxStatusCount) * 100, 6)}%` }"
                  />
                </div>
              </li>
              <li class="status-bars__row">
                <div class="status-bars__label">
                  <span>レビュー</span>
                  <strong>{{ statusCounts.review }}</strong>
                </div>
                <div class="status-bars__track">
                  <div
                    class="status-bars__fill status-bars__fill--review"
                    :style="{ width: `${Math.max((statusCounts.review / maxStatusCount) * 100, 6)}%` }"
                  />
                </div>
              </li>
              <li class="status-bars__row">
                <div class="status-bars__label">
                  <span>完了</span>
                  <strong>{{ statusCounts.done }}</strong>
                </div>
                <div class="status-bars__track">
                  <div
                    class="status-bars__fill status-bars__fill--done"
                    :style="{ width: `${Math.max((statusCounts.done / maxStatusCount) * 100, 6)}%` }"
                  />
                </div>
              </li>
            </ul>
          </div>

          <div class="chart-card chart-card--gauge">
            <header class="chart-card__header">
              <p class="chart-card__eyebrow">プロジェクトの危険度</p>
              <h3>ヘルススコア</h3>
              <span class="chart-card__meta">期限・進捗から算出</span>
            </header>
            <span class="chart-card__metric chart-card__metric--health">{{ healthScore }}%</span>
            <div class="gauge-chart">
              <svg viewBox="0 0 200 120">
                <path class="gauge-chart__base" d="M20 120 A80 80 0 0 1 180 120" />
                <path
                  v-for="(segment, index) in gaugeSegments"
                  :key="segment.id"
                  class="gauge-chart__segment"
                  d="M20 120 A80 80 0 0 1 180 120"
                  :style="gaugeSegmentStyles[index]"
                />
                <path
                  class="gauge-chart__value-path"
                  d="M20 120 A80 80 0 0 1 180 120"
                  :style="{ strokeDasharray: `${gaugeCircumference}`, strokeDashoffset: `${gaugeDashoffset}`, stroke: healthColor }"
                />
                <polygon
                  class="gauge-chart__needle"
                  points="100,28 96,120 104,120"
                  :transform="`rotate(${healthNeedleRotation} 100 120)`"
                />
                <circle class="gauge-chart__needle-hub" cx="100" cy="120" r="6" />
              </svg>
              <div class="gauge-chart__legend">
                <span class="gauge-chart__legend-item">
                  <span class="gauge-chart__legend-dot gauge-chart__legend-dot--danger" aria-hidden="true"></span>
                  危険
                </span>
                <span class="gauge-chart__legend-item">
                  <span class="gauge-chart__legend-dot gauge-chart__legend-dot--warn" aria-hidden="true"></span>
                  要対応
                </span>
                <span class="gauge-chart__legend-item">
                  <span class="gauge-chart__legend-dot gauge-chart__legend-dot--caution" aria-hidden="true"></span>
                  注意
                </span>
                <span class="gauge-chart__legend-item">
                  <span class="gauge-chart__legend-dot gauge-chart__legend-dot--good" aria-hidden="true"></span>
                  良好
                </span>
              </div>
            </div>
          </div>
        </section>

        <DashboardSummaryCards
          :title="project?.name || 'ダッシュボード'"
          :description="''"
          :cards="summaryCards"
          :rotate="false"
          :show-header="false"
        />


        <div class="top-actions">
          <button type="button" class="top-actions__new" @click="openTaskModal">＋ 新規タスク</button>
        </div>
        <div class="demo__grid">
          <section class="demo__primary">
            <div class="task-list">
              <div class="task-list__header">
                <div class="task-list__header-left">
                  <h3>タスク一覧</h3>
                  <p>{{ filteredTasks.length }}件のタスク</p>
                </div>
                <div class="task-list__filters">
                  <select v-model="filters.status" class="task-filter-select">
                    <option value="all">全て</option>
                    <option value="todo">未着手</option>
                    <option value="in-progress">進行中</option>
                    <option value="done">完了</option>
                  </select>
                  <select v-model="filters.assignee" class="task-filter-select">
                    <option value="all">担当者</option>
                    <option v-for="member in members" :key="member.id" :value="member.id">{{ member.name }}</option>
                  </select>
                  <select v-model="filters.due" class="task-filter-select">
                    <option value="all">期限</option>
                    <option value="today">今日</option>
                    <option value="week">今週</option>
                    <option value="overdue">期限切れ</option>
                  </select>
                  <button type="button" class="filter-reset-btn" @click="resetFilters" title="フィルターをリセット">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                      <path d="M21 3v5h-5"></path>
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                      <path d="M3 21v-5h5"></path>
                    </svg>
                  </button>
                </div>
              </div>
              <ul class="task-list__items">
                <li
                  v-for="task in filteredTasks"
                  :key="task.id"
                  class="task-row"
                  :class="{ 'is-overdue': isTaskOverdue(task) }"
                  @click="selectTaskById(task.id)"
                >
                  <div class="task-row__content">
                    <p class="task-row__title">{{ task.title }}</p>
                    <span class="task-row__assignee">{{ displayAssignee(task) }}</span>
                    <span class="task-row__status" :class="taskStatusClass(task)">
                      {{ taskStatusLabel(task.status) }}
                    </span>
                    <div class="task-row__progress">
                      <div class="task-row__progress-bar">
                        <div class="task-row__progress-fill" :style="{ width: `${taskProgress(task)}%` }" />
                      </div>
                      <span class="task-row__progress-value">{{ taskProgress(task) }}%</span>
                    </div>
                    <span class="task-row__due" :class="{ 'task-row__due--overdue': isTaskOverdue(task) }">
                      {{ formatDueDate(task) }}
                    </span>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          <!-- Temporarily commented out
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
          -->
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

.demo__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.75rem;
}

.top-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.top-actions__new {
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

.top-actions__new:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 28px rgba(11, 46, 51, 0.25);
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
  border-radius: 1rem;
  padding: 0.4rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.dashboard__charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
  align-items: stretch;
}

.chart-card {
  background: #fff;
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 1.1rem;
  padding: 1rem 1.25rem;
  box-shadow: 0 16px 32px rgba(11, 46, 51, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  position: relative;
}

.chart-card__header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.chart-card__header h3 {
  margin: 0;
  font-size: 1.15rem;
  color: #0b2e33;
}

.chart-card__eyebrow {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.chart-card__meta {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.chart-card__metric {
  position: absolute;
  top: 0.85rem;
  right: 1rem;
  background: #0b2e33;
  color: #fff;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  font-weight: 700;
  font-size: 1rem;
  box-shadow: 0 8px 16px rgba(11, 46, 51, 0.18);
}

.chart-card__metric--health {
  background: #4f7c82;
}

.progress-chart {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.25rem;
}

.progress-chart__track {
  height: 14px;
  border-radius: 999px;
  background: rgba(11, 46, 51, 0.08);
  overflow: hidden;
}

.progress-chart__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #4f7c82, #0b2e33);
  transition: width 0.3s ease;
}

.progress-chart__labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.status-bars {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.status-bars__row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.status-bars__label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.95rem;
  color: #0b2e33;
}

.status-bars__label strong {
  font-size: 1.05rem;
}

.status-bars__track {
  background: rgba(11, 46, 51, 0.07);
  border-radius: 999px;
  overflow: hidden;
  height: 0.6rem;
}

.status-bars__fill {
  height: 100%;
  border-radius: inherit;
  transition: width 0.3s ease;
}

.status-bars__fill--todo {
  background: rgba(11, 46, 51, 0.28);
}

.status-bars__fill--progress {
  background: #4f7c82;
}

.status-bars__fill--review {
  background: #f59e0b;
}

.status-bars__fill--done {
  background: #16a34a;
}

.gauge-chart {
  position: relative;
  padding: 0.25rem 0.1rem;
}

.gauge-chart svg {
  width: 100%;
  height: 160px;
}

.gauge-chart__base {
  fill: none;
  stroke: rgba(11, 46, 51, 0.08);
  stroke-width: 20;
  stroke-linecap: round;
}

.gauge-chart__segment {
  fill: none;
  stroke-width: 20;
  stroke-linecap: butt;
  opacity: 0.25;
}

.gauge-chart__value-path {
  fill: none;
  stroke: #4f7c82;
  stroke-width: 20;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.4s ease;
}

.gauge-chart__needle {
  fill: #000;
  transition: transform 0.35s ease;
}

.gauge-chart__needle-hub {
  fill: #fff;
  stroke: #0b2e33;
  stroke-width: 2;
}

.gauge-chart__legend {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.35rem;
  text-align: left;
  font-size: 0.88rem;
  color: var(--text-muted);
  margin-top: 0.15rem;
}

.gauge-chart__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
}

.gauge-chart__legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  display: inline-block;
}

.gauge-chart__legend-dot--danger {
  background: #ef4444;
}

.gauge-chart__legend-dot--warn {
  background: #f97316;
}

.gauge-chart__legend-dot--caution {
  background: #f59e0b;
}

.gauge-chart__legend-dot--good {
  background: #16a34a;
}

.dashboard__alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.45rem 0.35rem 0.45rem 0.5rem;
}

.dashboard__alert p {
  margin: 0;
  color: #92400e;
  font-weight: 600;
}

.dashboard__alert-close {
  border: none;
  background: transparent;
  color: #b45309;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0.25rem 0.35rem;
  line-height: 1;
  border-radius: 0.5rem;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.dashboard__alert-close:hover {
  background: rgba(244, 172, 67, 0.25);
  color: #92400e;
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

.task-list {
  border: 1px solid var(--border-light);
  border-radius: 1.5rem;
  background: var(--surface-elevated, #fff);
  padding: 1.25rem;
  box-shadow: 0 16px 28px rgba(11, 46, 51, 0.08);
}

.task-list__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid rgba(11, 46, 51, 0.08);
  gap: 1.5rem;
  flex-wrap: wrap;
}

.task-list__header-left {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.task-list__header-left h3 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-strong);
}

.task-list__header-left p {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-muted);
}

.task-list__filters {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  flex-wrap: nowrap;
}

.task-filter-select {
  padding: 0.55rem 0.85rem;
  border-radius: 0.7rem;
  border: 1px solid rgba(11, 46, 51, 0.12);
  background: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  font-weight: 500;
  color: #0b2e33;
  transition: all 0.15s ease;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%230b2e33' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.7rem center;
  background-size: 10px;
  padding-right: 2.2rem;
  min-width: 110px;
}

.task-filter-select:hover {
  border-color: rgba(11, 46, 51, 0.25);
  background-color: #fff;
}

.task-filter-select:focus {
  outline: none;
  border-color: #4f7c82;
  background-color: #fff;
  box-shadow: 0 0 0 3px rgba(79, 124, 130, 0.1);
}

.filter-reset-btn {
  padding: 0.55rem;
  border-radius: 0.7rem;
  border: 1px solid rgba(11, 46, 51, 0.15);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4f7c82;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-reset-btn svg {
  display: block;
}

.filter-reset-btn:hover {
  border-color: #4f7c82;
  background: rgba(79, 124, 130, 0.08);
  color: #0b2e33;
  transform: rotate(-15deg);
}

.filter-reset-btn:active {
  transform: scale(0.95) rotate(-15deg);
}

.task-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.task-row {
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.task-row:hover {
  border-color: rgba(11, 46, 51, 0.2);
  background-color: rgba(184, 227, 233, 0.1);
}

.task-row__content {
  display: grid;
  grid-template-columns: 2fr 1fr 0.9fr 1.5fr 1fr;
  gap: 1rem;
  align-items: center;
}

.task-row__title {
  margin: 0;
  font-weight: 600;
  color: var(--text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-row__assignee {
  font-size: 0.9rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-row__status {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  min-width: auto;
  padding: 0;
  border-radius: 0;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  border: none;
  background: transparent;
  transition: color 0.2s ease;
}

.task-row__status--todo {
  color: var(--text-muted);
}

.task-row__status--in-progress {
  color: #0b2e33;
}

.task-row__status--review {
  color: #8a5a00;
}

.task-row__status--done {
  color: #166534;
}

.task-row__status.is-overdue {
  color: #991b1b;
}

.task-row__progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.task-row__progress-bar {
  flex: 1;
  height: 0.5rem;
  background: rgba(11, 46, 51, 0.1);
  border-radius: 999px;
  overflow: hidden;
}

.task-row__progress-fill {
  height: 100%;
  background: #4f7c82;
  border-radius: inherit;
  transition: width 0.3s ease;
}

.task-row__progress-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-strong);
  min-width: 3rem;
  text-align: right;
}

.task-row__due {
  font-size: 0.9rem;
  color: var(--text-muted);
  text-align: right;
}

.task-row__due--overdue {
  color: #b91c1c;
  font-weight: 700;
}

.task-row.is-overdue {
  border-color: rgba(239, 68, 68, 0.25);
  background-color: rgba(239, 68, 68, 0.05);
}

.task-row.is-overdue:hover {
  border-color: rgba(239, 68, 68, 0.4);
  background-color: rgba(239, 68, 68, 0.08);
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

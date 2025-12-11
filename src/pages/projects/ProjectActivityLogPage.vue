<script setup lang="ts">
import DashboardSidebar from '@/components/projectDashboard/DashboardSidebar.vue'
import { appName } from '@/constants/appMeta'
import { ROUTE_NAMES } from '@/constants/routes'
import { db } from '@/lib/firebase'
import { listenProjectMembers, type ProjectMember } from '@/services/projectMembers'
import { listenTasks, type TaskDoc } from '@/services/taskService'
import { useAuthStore } from '@/store/auth'
import type { DashboardNavItem } from '@/types/projectDashboard'
import { collection, getDocs } from 'firebase/firestore'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

type ActivityType = 'task' | 'member' | 'assignment'

type ActivityEvent = {
  id: string
  title: string
  description: string
  type: ActivityType
  createdAt: number
}

const route = useRoute()
const { user, profile } = useAuthStore()

const projectId = ref(String(route.params.projectId || ''))
const projectList = ref<{ id: string; name: string }[]>([])
const tasks = ref<TaskDoc[]>([])
const members = ref<ProjectMember[]>([])
const filterType = ref<ActivityType | 'all'>('all')
const dateFrom = ref('')
const dateTo = ref('')
const isSidebarOpen = ref(true)

let stopTasks: (() => void) | null = null
let stopMembers: (() => void) | null = null

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
      label: 'スレッド',
      to: { name: ROUTE_NAMES.projectThreads, params: { projectId: projectId.value } },
      icon: 'team',
    },
    {
      key: 'activity',
      label: 'アクティビティ',
      to: { name: ROUTE_NAMES.projectActivity, params: { projectId: projectId.value } },
      icon: 'dashboard',
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
  projectList.value.map((project, index) => ({
    key: project.id,
    label: project.name,
    to: { name: ROUTE_NAMES.projectDashboard, params: { projectId: project.id } },
    accent: (['primary', 'secondary', 'accent'][index % 3] as 'primary' | 'secondary' | 'accent'),
  })),
)

const profileInfo = computed(() => ({
  name: profile.value?.nickname || profile.value?.fullName || `${appName} User`,
  email: profile.value?.email || '',
}))

const activityEvents = computed<ActivityEvent[]>(() => {
  const events: ActivityEvent[] = []

  tasks.value.forEach((task) => {
    if (task.createdAt && 'seconds' in task.createdAt) {
      events.push({
        id: `task-created-${task.id}`,
        title: 'タスク作成',
        description: `「${task.title}」が作成されました`,
        type: 'task',
        createdAt: task.createdAt.seconds * 1000,
      })
    }
    if (task.updatedAt && 'seconds' in task.updatedAt && task.updatedAt.seconds !== task.createdAt?.seconds) {
      events.push({
        id: `task-updated-${task.id}`,
        title: 'タスク更新',
        description: `「${task.title}」が更新されました`,
        type: 'task',
        createdAt: task.updatedAt.seconds * 1000,
      })
    }
    if (task.assigneeId) {
      events.push({
        id: `task-assigned-${task.id}`,
        title: '担当アサイン',
        description: `${task.assigneeName || '担当者未設定'} に「${task.title}」をアサイン`,
        type: 'assignment',
        createdAt: task.updatedAt?.seconds ? task.updatedAt.seconds * 1000 : Date.now(),
      })
    }
  })

  members.value.forEach((member) => {
    const joined = (member as any).joinedAt
    const joinedAt = joined?.seconds ? joined.seconds * 1000 : null
    if (joinedAt) {
      events.push({
        id: `member-${member.userId}`,
        title: 'メンバー参加',
        description: `${member.displayName || member.userId} が参加しました`,
        type: 'member',
        createdAt: joinedAt,
      })
    }
  })

  return events.sort((a, b) => b.createdAt - a.createdAt)
})

const filteredEvents = computed(() => {
  const from = dateFrom.value ? new Date(dateFrom.value).getTime() : null
  const to = dateTo.value ? new Date(dateTo.value).getTime() : null
  return activityEvents.value.filter((event) => {
    if (filterType.value !== 'all' && event.type !== filterType.value) return false
    if (from && event.createdAt < from) return false
    if (to && event.createdAt > to + 24 * 60 * 60 * 1000) return false
    return true
  })
})

async function loadProjectList() {
  if (!user.value) return
  const snap = await getDocs(collection(db, 'userProjects', user.value.uid, 'projects'))
  projectList.value = snap.docs.map((docSnap) => ({
    id: docSnap.id,
    name: (docSnap.data().projectName as string) || 'Project',
  }))
}

function resetWatchers() {
  stopTasks?.()
  stopMembers?.()
  stopTasks = listenTasks(projectId.value, (list) => (tasks.value = list))
  stopMembers = listenProjectMembers(projectId.value, (list) => (members.value = list))
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
  stopMembers?.()
})
</script>

<template>
  <div :class="['activity-shell', { 'activity-shell--sidebar-collapsed': !isSidebarOpen }]">
    <DashboardSidebar
      :open="isSidebarOpen"
      :nav-items="navItems"
      :projects="sidebarProjects"
      :profile="profileInfo"
      brand-subtitle="アクティビティ"
      @close="closeSidebar"
    />
    <div v-if="isSidebarOpen" class="activity-shell__overlay" @click="closeSidebar" />

    <main class="activity-shell__main">
      <header class="activity-shell__topbar">
        <div class="activity-shell__topbar-left">
          <button type="button" class="activity-shell__menu-button" @click="toggleSidebar">
            <span class="sr-only">サイドバーを切り替え</span>
            <svg aria-hidden="true" class="activity-shell__menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <p class="activity-shell__breadcrumb">プロジェクト &gt; アクティビティ</p>
            <h1 class="activity-shell__heading">アクティビティログ</h1>
          </div>
        </div>
      </header>

      <div class="activity-content">
        <section class="activity-filters">
          <div>
            <p class="eyebrow">フィルター</p>
            <h2>イベントを絞り込み</h2>
          </div>
          <div class="filter-grid">
            <label class="filter-item">
              <span>種類</span>
              <select v-model="filterType">
                <option value="all">すべて</option>
                <option value="task">タスク</option>
                <option value="assignment">アサイン</option>
                <option value="member">メンバー</option>
              </select>
            </label>
            <label class="filter-item">
              <span>開始日</span>
              <input v-model="dateFrom" type="date" />
            </label>
            <label class="filter-item">
              <span>終了日</span>
              <input v-model="dateTo" type="date" />
            </label>
          </div>
        </section>

        <section class="activity-list">
          <header class="activity-list__header">
            <div>
              <p class="eyebrow">履歴</p>
              <h2>最近のイベント</h2>
            </div>
            <span class="badge">{{ filteredEvents.length }}件</span>
          </header>

          <div v-if="!filteredEvents.length" class="empty">該当するイベントがありません。</div>
          <ul v-else class="activity-items">
            <li v-for="event in filteredEvents" :key="event.id" class="activity-item">
              <div class="activity-item__meta">
                <span class="chip" :class="`chip--${event.type}`">{{ event.type }}</span>
                <span class="muted">{{ new Date(event.createdAt).toLocaleString() }}</span>
              </div>
              <p class="activity-item__title">{{ event.title }}</p>
              <p class="activity-item__desc">{{ event.description }}</p>
            </li>
          </ul>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
@import '@/pages/demo/styles/demo-shell.css';

.activity-shell {
  display: flex;
  min-height: 100vh;
  background: #f6f8fa;
}

.activity-shell__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.18);
}

.activity-shell__main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.activity-shell__topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
}

.activity-shell__topbar-left {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.activity-shell__breadcrumb {
  margin: 0;
  color: var(--text-muted);
}

.activity-shell__heading {
  margin: 0;
}

.activity-shell__menu-button {
  border: none;
  border-radius: 0.75rem;
  background: #fff;
  padding: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.activity-shell__menu-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.activity-content {
  padding: 0 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 900px;
}

.activity-filters,
.activity-list {
  background: #fff;
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 1rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
  color: #0f172a;
}

.filter-item input,
.filter-item select {
  border: 1px solid #d5dde5;
  border-radius: 0.9rem;
  padding: 0.65rem 0.85rem;
  background: #f8fafc;
}

.activity-list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.activity-items {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.activity-item {
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 0.9rem;
  padding: 0.75rem 0.9rem;
  background: #fdfefe;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.activity-item__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.activity-item__title {
  margin: 0;
  font-weight: 700;
}

.activity-item__desc {
  margin: 0;
  color: #344054;
  line-height: 1.4;
}

.chip {
  border-radius: 999px;
  padding: 0.15rem 0.65rem;
  font-size: 0.85rem;
  background: rgba(11, 46, 51, 0.08);
  color: #0b2e33;
}

.chip--task {
  background: rgba(59, 130, 246, 0.15);
  color: #1d4ed8;
}

.chip--member {
  background: rgba(14, 165, 233, 0.15);
  color: #0ea5e9;
}

.chip--assignment {
  background: rgba(52, 211, 153, 0.2);
  color: #047857;
}

.badge {
  border-radius: 999px;
  padding: 0.25rem 0.65rem;
  background: #0b2e33;
  color: #fff;
  font-weight: 700;
}

.empty {
  border: 1px dashed rgba(11, 46, 51, 0.1);
  border-radius: 0.8rem;
  padding: 0.75rem;
  color: var(--text-muted);
  background: #f9fafb;
}

.eyebrow {
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0;
  font-size: 0.8rem;
}

.muted {
  color: var(--text-muted);
  margin: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 768px) {
  .activity-shell__topbar {
    padding: 1rem;
  }

  .activity-content {
    padding: 0 1rem 2rem;
  }
}
</style>

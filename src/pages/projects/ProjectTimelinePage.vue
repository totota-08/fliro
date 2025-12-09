<script setup lang="ts">
import DashboardSidebar from '@/components/projectDashboard/DashboardSidebar.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { appName } from '@/constants/appMeta'
import { ROUTE_NAMES } from '@/constants/routes'
import { db } from '@/firebase/config'
import { listenProjectMembers, type ProjectMember } from '@/services/projectMembers'
import { addTimelinePost, listenTimeline, type TimelinePost } from '@/services/timelineService'
import { listenTasks, type TaskDoc } from '@/services/taskService'
import { useAuthStore } from '@/store/auth'
import type { DashboardNavItem } from '@/types/projectDashboard'
import { getLogger } from '@logtape/logtape'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { collection, getDocs } from 'firebase/firestore'

const logger = getLogger('app.pages.projects.Timeline')
const route = useRoute()
const { user, profile } = useAuthStore()

const projectId = ref(String(route.params.projectId || ''))
const projectList = ref<{ id: string; name: string }[]>([])
const timelinePosts = ref<TimelinePost[]>([])
const tasks = ref<TaskDoc[]>([])
const members = ref<ProjectMember[]>([])
const newPost = ref('')
const posting = ref(false)
const isSidebarOpen = ref(true)

let stopTimeline: (() => void) | null = null
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
      key: 'timeline',
      label: 'タイムライン',
      to: { name: ROUTE_NAMES.projectTimeline, params: { projectId: projectId.value } },
      icon: 'tasks',
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

const profileInfo = computed(() => ({
  name: profile.value?.nickname || profile.value?.fullName || `${appName} User`,
  email: profile.value?.email || '',
}))

const currentMember = computed(() => members.value.find((entry) => entry.userId === user.value?.uid))
const canPost = computed(() => (currentMember.value?.role || 'viewer') !== 'viewer')
const sidebarProjects = computed(() =>
  projectList.value.map((project, index) => ({
    key: project.id,
    label: project.name,
    to: { name: ROUTE_NAMES.projectDashboard, params: { projectId: project.id } },
    accent: (['primary', 'secondary', 'accent'][index % 3] as 'primary' | 'secondary' | 'accent'),
  })),
)

const deadlineBotPosts = computed<TimelinePost[]>(() => {
  const now = Date.now()
  const windowMs = 1000 * 60 * 60 * 48
  return tasks.value
    .filter((task) => task.dueDate?.seconds)
    .filter((task) => {
      const due = task.dueDate!.seconds * 1000
      return due >= now && due - now <= windowMs
    })
    .map((task) => {
      const assigneeName = getMemberName(task.assigneeId) || task.assigneeName || '担当者'
      const dueDate = new Date(task.dueDate!.seconds * 1000).toLocaleString()
      return {
        id: `bot-${task.id}`,
        authorId: 'deadline-bot',
        authorName: 'Deadline Bot',
        body: `@${assigneeName} タスク「${task.title}」の期限が近づいています（${dueDate}）`,
        taskId: task.id,
        dueDate,
        isBot: true,
        createdAt: { seconds: Math.floor(task.dueDate!.seconds), nanoseconds: 0 },
      }
    })
})

const combinedFeed = computed(() => {
  const all = [...timelinePosts.value, ...deadlineBotPosts.value]
  return all.sort((a, b) => getCreatedAtMillis(b) - getCreatedAtMillis(a))
})

function getCreatedAtMillis(post: TimelinePost) {
  if (post.createdAt && 'seconds' in post.createdAt) {
    return post.createdAt.seconds * 1000 + (post.createdAt.nanoseconds || 0) / 1_000_000
  }
  return Date.now()
}

function getMemberName(userId?: string | null) {
  if (!userId) return ''
  return members.value.find((member) => member.userId === userId)?.displayName || ''
}

async function submitPost() {
  if (!projectId.value || !newPost.value.trim() || !user.value) return
  posting.value = true
  try {
    await addTimelinePost(projectId.value, {
      authorId: user.value.uid,
      authorName: profile.value?.nickname || profile.value?.fullName || 'メンバー',
      body: newPost.value.trim(),
    })
    newPost.value = ''
  } catch (error) {
    logger.error`Failed to submit timeline post: ${error}`
  } finally {
    posting.value = false
  }
}

function resetWatchers() {
  stopTimeline?.()
  stopTasks?.()
  stopMembers?.()
  stopTimeline = listenTimeline(projectId.value, (items) => (timelinePosts.value = items))
  stopTasks = listenTasks(projectId.value, (list) => (tasks.value = list))
  stopMembers = listenProjectMembers(projectId.value, (list) => (members.value = list))
}

async function loadProjectList() {
  if (!user.value) return
  const snap = await getDocs(collection(db, 'userProjects', user.value.uid, 'projects'))
  projectList.value = snap.docs.map((docSnap) => ({
    id: docSnap.id,
    name: (docSnap.data().projectName as string) || 'Project',
  }))
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
  stopTimeline?.()
  stopTasks?.()
  stopMembers?.()
})
</script>

<template>
  <div :class="['timeline-shell', { 'timeline-shell--sidebar-collapsed': !isSidebarOpen }]">
    <DashboardSidebar
      :open="isSidebarOpen"
      :nav-items="navItems"
      :projects="sidebarProjects"
      :profile="profileInfo"
      brand-subtitle="プロジェクト"
      @close="closeSidebar"
    />
    <div v-if="isSidebarOpen" class="timeline-shell__overlay" @click="closeSidebar" />

    <main class="timeline-shell__main">
      <header class="timeline-shell__topbar">
        <div class="timeline-shell__topbar-left">
          <button type="button" class="timeline-shell__menu-button" @click="toggleSidebar">
            <span class="sr-only">サイドバーを切り替え</span>
            <svg aria-hidden="true" class="timeline-shell__menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <p class="timeline-shell__breadcrumb">プロジェクト &gt; タイムライン</p>
            <h1 class="timeline-shell__heading">タイムライン</h1>
          </div>
        </div>
      </header>

      <div class="timeline-content">
        <section class="timeline-compose">
          <div>
            <p class="eyebrow">フィード投稿</p>
            <h2>チームの進捗を共有</h2>
            <p class="muted">締切前のボット投稿とメンバー投稿をまとめて表示します。</p>
          </div>
          <textarea
            v-model="newPost"
            class="timeline-compose__input"
            rows="3"
            :placeholder="canPost ? '今日の進捗や共有事項を投稿' : '閲覧のみ可能です'"
            :disabled="!canPost"
          />
          <div class="timeline-compose__actions">
            <span v-if="!canPost" class="muted">閲覧権限のみのため投稿できません</span>
            <AppButton variant="primary" :disabled="!newPost.trim() || !canPost" :loading="posting" @click="submitPost">
              投稿する
            </AppButton>
          </div>
        </section>

        <section class="timeline-feed">
          <article v-for="post in combinedFeed" :key="post.id" :class="['timeline-item', { 'timeline-item--bot': post.isBot }]">
            <header class="timeline-item__header">
              <div class="timeline-item__avatar" :data-bot="post.isBot ? 'bot' : ''">
                <span>{{ post.isBot ? '🤖' : (post.authorName || '??').slice(0, 2) }}</span>
              </div>
              <div>
                <p class="timeline-item__author">{{ post.authorName }}</p>
                <p class="timeline-item__meta">{{ new Date(getCreatedAtMillis(post)).toLocaleString() }}</p>
              </div>
            </header>
            <p class="timeline-item__body">{{ post.body }}</p>
            <div class="timeline-item__tags">
              <span v-if="post.isBot" class="chip">Deadline Bot</span>
              <span v-if="post.dueDate" class="chip chip--soft">期限: {{ post.dueDate }}</span>
            </div>
          </article>
          <p v-if="!combinedFeed.length" class="muted">まだ投稿がありません。</p>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
@import '@/pages/demo/styles/demo-shell.css';

.timeline-shell {
  display: flex;
  min-height: 100vh;
  background: #f6f8fa;
}

.timeline-shell__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.18);
}

.timeline-shell__main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.timeline-shell__topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
}

.timeline-shell__topbar-left {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.timeline-shell__breadcrumb {
  margin: 0;
  color: var(--text-muted);
}

.timeline-shell__heading {
  margin: 0;
}

.timeline-shell__menu-button {
  border: none;
  border-radius: 0.75rem;
  background: #fff;
  padding: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.timeline-shell__menu-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.timeline-content {
  padding: 0 1.5rem 2rem;
  display: grid;
  grid-template-columns: minmax(340px, 420px) minmax(0, 1fr);
  gap: 1.5rem;
}

.timeline-compose {
  background: #fff;
  border-radius: 1rem;
  padding: 1.25rem;
  border: 1px solid rgba(11, 46, 51, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  position: sticky;
  top: 1rem;
  height: fit-content;
}

.timeline-compose h2 {
  margin: 0.1rem 0 0;
}

.muted {
  color: var(--text-muted);
  margin: 0;
}

.eyebrow {
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0;
  font-size: 0.8rem;
}

.timeline-compose__input {
  width: 100%;
  min-height: 96px;
  border-radius: 1rem;
  border: 1px solid rgba(11, 46, 51, 0.1);
  padding: 0.9rem 1rem;
  background: #f8fafc;
}

.timeline-compose__input:focus {
  outline: 2px solid rgba(11, 46, 51, 0.2);
}

.timeline-compose__actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.timeline-feed {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.timeline-item {
  background: #fff;
  border-radius: 1rem;
  border: 1px solid rgba(11, 46, 51, 0.08);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.timeline-item--bot {
  border-color: rgba(52, 168, 83, 0.25);
  background: #f6fff6;
}

.timeline-item__header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.timeline-item__avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(11, 46, 51, 0.08);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.timeline-item__avatar[data-bot='bot'] {
  background: rgba(52, 168, 83, 0.18);
}

.timeline-item__author {
  margin: 0;
  font-weight: 700;
}

.timeline-item__meta {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.timeline-item__body {
  margin: 0;
  line-height: 1.5;
}

.timeline-item__tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.chip {
  border-radius: 999px;
  padding: 0.15rem 0.65rem;
  font-size: 0.85rem;
  background: rgba(11, 46, 51, 0.08);
  color: #0b2e33;
}

.chip--soft {
  background: rgba(11, 46, 51, 0.04);
  color: #496167;
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

@media (max-width: 1100px) {
  .timeline-content {
    grid-template-columns: 1fr;
  }

  .timeline-compose {
    position: static;
  }
}

@media (max-width: 768px) {
  .timeline-shell__topbar {
    padding: 1rem;
  }

  .timeline-content {
    padding: 0 1rem 2rem;
  }
}
</style>

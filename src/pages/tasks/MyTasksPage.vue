<script setup lang="ts">
import DashboardSidebar from '@/components/projectDashboard/DashboardSidebar.vue'
import { appName } from '@/constants/appMeta'
import { ROUTE_NAMES } from '@/constants/routes'
import { db } from '@/lib/firebase'
import { deleteTask, updateTask, type TaskDoc } from '@/services/taskService'
import { useAuthStore } from '@/store/auth'
import type { DashboardNavItem } from '@/types/projectDashboard'
import { getLogger } from '@logtape/logtape'
import { collection, getDocs } from 'firebase/firestore'
import { computed, onMounted, ref } from 'vue'

const logger = getLogger('app.pages.tasks.MyTasks')

const { user, profile } = useAuthStore()

const isSidebarOpen = ref(true)
const loading = ref(true)
const errorMessage = ref('')
const activeTab = ref<'active' | 'completed'>('active')
const tasks = ref<TaskDoc[]>([])
const projects = ref<{ id: string; name: string }[]>([])

/**
 * Sidebar 用ナビゲーション
 */
const navItems = computed<DashboardNavItem[]>(() => {
  const firstProjectId = projects.value[0]?.id
  return [
    {
      key: 'dashboard' as const,
      label: 'ダッシュボード',
      to: firstProjectId
        ? { name: ROUTE_NAMES.projectDashboard, params: { projectId: firstProjectId } }
        : undefined,
      icon: 'dashboard',
      disabled: !firstProjectId,
    },
    {
      key: 'tasks',
      label: 'マイタスク',
      to: { name: ROUTE_NAMES.myTasks },
      icon: 'tasks',
    },
    {
      key: 'team' as const,
      label: 'チャット',
      icon: 'team',
      to: firstProjectId ? { name: ROUTE_NAMES.projectThreads, params: { projectId: firstProjectId } } : undefined,
      disabled: !firstProjectId,
      tooltip: firstProjectId ? undefined : 'プロジェクトを選択してください',
    },
    {
      key: 'members',
      label: 'メンバー',
      icon: 'members',
      to: firstProjectId ? { name: ROUTE_NAMES.projectMembers, params: { projectId: firstProjectId } } : undefined,
      disabled: !firstProjectId,
    },
    {
      key: 'settings' as const,
      label: '設定',
      icon: 'settings',
      to: firstProjectId ? { name: ROUTE_NAMES.projectSettings, params: { projectId: firstProjectId } } : undefined,
      disabled: !firstProjectId,
    },
  ] satisfies DashboardNavItem[]
})

const sidebarProjects = computed(() =>
  projects.value.map((project, index) => ({
    key: project.id,
    label: project.name,
    to: { name: ROUTE_NAMES.projectDashboard, params: { projectId: project.id } },
    accent: (['primary', 'secondary', 'accent'][index % 3] as
      | 'primary'
      | 'secondary'
      | 'accent'),
  })),
)

const profileInfo = computed(() => ({
  name: profile.value?.nickname || profile.value?.fullName || `${appName} User`,
  email: profile.value?.email || '',
}))

/**
 * Firestore からタスク読み込み
 */
async function loadTasks() {
  if (!user.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const projectEntries: { id: string; name: string }[] = []
    const items: TaskDoc[] = []

    const projectsSnap = await getDocs(
      collection(db, 'userProjects', user.value.uid, 'projects'),
    )

    for (const docSnap of projectsSnap.docs) {
      const name = (docSnap.data().projectName as string) || 'プロジェクト'
      const projectId = docSnap.id
      projectEntries.push({ id: projectId, name })

      const taskSnap = await getDocs(collection(db, 'projects', projectId, 'tasks'))
      taskSnap.forEach((taskDoc) => {
        const data = taskDoc.data() as TaskDoc
        items.push({ ...data, id: taskDoc.id, projectId })
      })
    }

    projects.value = projectEntries
    tasks.value = items.filter((task) => task.assigneeId === user.value?.uid)
  } catch (error) {
    logger.error`Failed to load tasks: ${error}`
    errorMessage.value =
      'タスクを取得できませんでした。アクセス権限をご確認ください。'
  } finally {
    loading.value = false
  }
}

/**
 * UI 用の拡張型
 */
type DisplayStatus = '完了' | '進行中' | 'レビュー待ち' | '未着手'
type DisplayPriority = '高' | '中' | '低'

type DecoratedTask = TaskDoc & {
  projectName: string
  projectColor: string
  dueMessage: string
  dueClass: '' | 'due-over' | 'due-soon'
  dueDateLabel: string
  displayStatus: DisplayStatus
  displayPriority: DisplayPriority
}

/**
 * ステータス → バッジクラス
 */
const getStatusBadgeClass = (status: DisplayStatus) => {
  switch (status) {
    case '完了':
      return 'badge status-done'
    case '進行中':
      return 'badge status-progress'
    case 'レビュー待ち':
      return 'badge status-review'
    default:
      return 'badge status-todo'
  }
}

/**
 * 優先度 → バッジクラス
 */
const getPriorityBadgeClass = (priority: DisplayPriority) => {
  switch (priority) {
    case '高':
      return 'badge priority-high'
    case '中':
      return 'badge priority-medium'
    default:
      return 'badge priority-low'
  }
}

/**
 * 期限までの日数計算（Date → 日数）
 */
const getDaysDiff = (due: Date, base = new Date()) => {
  const diffTime = due.getTime() - base.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Firestore タスク → UI 用タスクに変換
 */
function decorate(task: TaskDoc): DecoratedTask {
  const projectIndex = projects.value.findIndex((entry) => entry.id === task.projectId)
  const project = projects.value[projectIndex]
  const projectName: string = project?.name ?? 'プロジェクト'
  const projectColors = ['task-dot--primary', 'task-dot--secondary', 'task-dot--accent']
  const projectColor: string =
    projectIndex >= 0
      ? projectColors[projectIndex % projectColors.length] ?? 'task-dot--primary'
      : 'task-dot--primary'

  const due =
    (task as any).dueDate?.seconds
      ? new Date((task as any).dueDate.seconds * 1000)
      : null

  let dueMessage = '期限未設定'
  let dueClass: DecoratedTask['dueClass'] = ''
  let dueDateLabel = '未設定'

  if (due) {
    const diff = getDaysDiff(due)
    dueDateLabel = due.toISOString().slice(0, 10)

    if (diff < 0) {
      dueMessage = `${Math.abs(diff)}日遅れ`
      dueClass = 'due-over'
    } else if (diff === 0) {
      dueMessage = '今日が期限'
      dueClass = 'due-soon'
    } else {
      dueMessage = `あと${diff}日`
      if (diff <= 3) dueClass = 'due-soon'
    }
  }

  // ステータス（英語）→ 表示用日本語
  let displayStatus: DisplayStatus = '未着手'
  switch ((task as any).status) {
    case 'done':
      displayStatus = '完了'
      break
    case 'in-progress':
      displayStatus = '進行中'
      break
    case 'review':
      displayStatus = 'レビュー待ち'
      break
    case 'todo':
    default:
      displayStatus = '未着手'
      break
  }

  // 優先度（想定: 'high' | 'medium' | 'low'）→ 日本語
  let displayPriority: DisplayPriority = '中'
  switch ((task as any).priority) {
    case 'high':
      displayPriority = '高'
      break
    case 'low':
      displayPriority = '低'
      break
    case 'medium':
    default:
      displayPriority = '中'
      break
  }

  return {
    ...(task as TaskDoc),
    projectName,
    projectColor,
    dueMessage,
    dueClass,
    dueDateLabel,
    displayStatus,
    displayPriority,
  }
}

const decoratedTasks = computed(() => tasks.value.map(decorate))
const activeTasks = computed(() =>
  decoratedTasks.value.filter((task) => (task as any).status !== 'done'),
)
const completedTasks = computed(() =>
  decoratedTasks.value.filter((task) => (task as any).status === 'done'),
)

const stats = computed(() => ({
  total: decoratedTasks.value.length,
  progress: decoratedTasks.value.filter((task) => (task as any).status === 'in-progress')
    .length,
  review: decoratedTasks.value.filter((task) => (task as any).status === 'review').length,
  done: completedTasks.value.length,
}))

/**
 * 完了トグル & 削除
 */
async function toggleComplete(task: DecoratedTask) {
  const next = (task as any).status === 'done' ? 'todo' : 'done'
  await updateTask(task.projectId, task.id, { status: next } as any)
  await loadTasks()
}

async function removeTask(task: DecoratedTask) {
  await deleteTask(task.projectId, task.id)
  await loadTasks()
}

/**
 * サイドバー制御
 */
const closeSidebar = () => {
  isSidebarOpen.value = false
}

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

/**
 * 初期ロード
 */
onMounted(() => {
  if (window.matchMedia('(max-width: 1200px)').matches) {
    isSidebarOpen.value = false
  }
  loadTasks()
})
</script>

<template>
  <div :class="['demo', { 'demo--sidebar-collapsed': !isSidebarOpen }]">
    <DashboardSidebar
      :open="isSidebarOpen"
      :nav-items="navItems"
      :projects="sidebarProjects"
      :profile="profileInfo"
      brand-subtitle="マイタスク"
      @close="closeSidebar"
    />
    <div v-if="isSidebarOpen" class="demo__overlay" @click="closeSidebar" />

    <div class="demo__main">
      <header class="demo__topbar">
        <div class="demo__topbar-left">
          <button type="button" class="demo__menu-button" @click="toggleSidebar">
            <span class="sr-only">サイドバーを切り替え</span>
            <svg
              v-if="!isSidebarOpen"
              aria-hidden="true"
              class="demo__menu-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg
              v-else
              aria-hidden="true"
              class="demo__menu-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6l-12 12" />
            </svg>
          </button>
          <div>
            <p class="demo__breadcrumb">{{ appName }} &gt; マイタスク</p>
            <h1 class="demo__heading">{{ profileInfo.name }}</h1>
          </div>
        </div>
      </header>

      <div class="demo__content demo__content--condensed">
        <section class="tasks-page">
          <header class="tasks-page__header">
            <div>
              <h2>マイタスク</h2>
              <p>あなたに割り当てられたタスクの一覧です</p>
            </div>
            <button type="button" class="tasks-page__filter">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M4 6h16M6 12h12M10 18h4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
              </svg>
              フィルター
            </button>
          </header>

          <section class="tasks-stats">
            <article class="tasks-stats__card">
              <p>全タスク</p>
              <strong>{{ stats.total }}</strong>
            </article>
            <article class="tasks-stats__card">
              <p>進行中</p>
              <strong class="tone-progress">{{ stats.progress }}</strong>
            </article>
            <article class="tasks-stats__card">
              <p>レビュー待ち</p>
              <strong class="tone-review">{{ stats.review }}</strong>
            </article>
            <article class="tasks-stats__card">
              <p>完了</p>
              <strong class="tone-done">{{ stats.done }}</strong>
            </article>
          </section>

          <section class="tasks-tabs">
            <div class="tasks-tabs__list" role="tablist" aria-label="タスクの状態">
              <button
                type="button"
                class="tasks-tabs__trigger"
                :class="{ 'is-active': activeTab === 'active' }"
                role="tab"
                :aria-selected="activeTab === 'active'"
                @click="activeTab = 'active'"
              >
                進行中 ({{ activeTasks.length }})
              </button>
              <button
                type="button"
                class="tasks-tabs__trigger"
                :class="{ 'is-active': activeTab === 'completed' }"
                role="tab"
                :aria-selected="activeTab === 'completed'"
                @click="activeTab = 'completed'"
              >
                完了 ({{ completedTasks.length }})
              </button>
            </div>

            <div class="tasks-tabs__content" role="tabpanel">
              <!-- 状態メッセージ -->
              <section v-if="loading" class="tasks-empty">読み込み中...</section>
              <section v-else-if="errorMessage" class="tasks-empty">
                {{ errorMessage }}
              </section>
              <section
                v-else-if="activeTab === 'active' && !activeTasks.length"
                class="tasks-empty"
              >
                進行中のタスクはありません。
              </section>
              <section
                v-else-if="activeTab === 'completed' && !completedTasks.length"
                class="tasks-empty"
              >
                完了したタスクはまだありません。
              </section>

              <template v-else>
                <!-- 進行中タブ -->
                <template v-if="activeTab === 'active'">
                  <article
                    v-for="task in activeTasks"
                    :key="task.id"
                    class="task-card"
                    :class="{
                      'is-overdue': task.dueClass === 'due-over',
                    }"
                  >
                    <div class="task-card__headline">
                      <div class="task-card__project">
                        <span :class="['task-dot', task.projectColor]" aria-hidden="true" />
                        <span>{{ task.projectName }}</span>
                      </div>
                      <div class="task-card__badges">
                        <span :class="getStatusBadgeClass(task.displayStatus)">
                          {{ task.displayStatus }}
                        </span>
                        <span :class="getPriorityBadgeClass(task.displayPriority)">
                          {{ task.displayPriority }}
                        </span>
                      </div>
                    </div>

                    <h3>{{ task.title }}</h3>
                    <p>{{ task.description || '説明なし' }}</p>

                    <div class="task-card__meta">
                      <div class="task-card__meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path
                            d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
                            stroke-width="1.6"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                          <path d="M7 10h10" stroke-width="1.6" stroke-linecap="round" />
                          <path
                            d="M11 14h2"
                            stroke-width="1.6"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                        <span>{{ task.dueDateLabel }}</span>
                      </div>
                      <div class="task-card__meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path
                            d="M12 6v6l3.5 3.5"
                            stroke-width="1.7"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                          <circle cx="12" cy="12" r="8" stroke-width="1.5" />
                        </svg>
                        <span :class="task.dueClass">{{ task.dueMessage }}</span>
                      </div>
                    </div>

                    <div class="task-card__actions">
                      <button type="button" @click="toggleComplete(task)">
                        {{
                          (task as any).status === 'done'
                            ? '未完了に戻す'
                            : '完了にする'
                        }}
                      </button>
                      <button
                        type="button"
                        class="is-danger"
                        @click="removeTask(task)"
                      >
                        削除
                      </button>
                    </div>
                  </article>
                </template>

                <!-- 完了タブ -->
                <template v-else>
                  <article
                    v-for="task in completedTasks"
                    :key="task.id"
                    class="task-card is-completed"
                  >
                    <div class="task-card__headline">
                      <div class="task-card__project">
                        <span :class="['task-dot', task.projectColor]" aria-hidden="true" />
                        <span>{{ task.projectName }}</span>
                      </div>
                      <span :class="getStatusBadgeClass(task.displayStatus)">
                        {{ task.displayStatus }}
                      </span>
                    </div>
                    <h3>{{ task.title }}</h3>
                    <p>{{ task.description || '説明なし' }}</p>
                    <div class="task-card__meta">
                      <div class="task-card__meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path
                            d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
                            stroke-width="1.6"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                          <path d="M7 10h10" stroke-width="1.6" stroke-linecap="round" />
                        </svg>
                        <span>{{ task.dueDateLabel }}</span>
                      </div>
                      <div class="task-card__meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path
                            d="M20 6 9 17l-5-5"
                            stroke-width="1.6"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                        <span>完了済み</span>
                      </div>
                    </div>

                    <div class="task-card__actions">
                      <button type="button" @click="toggleComplete(task)">
                        未完了に戻す
                      </button>
                      <button
                        type="button"
                        class="is-danger"
                        @click="removeTask(task)"
                      >
                        削除
                      </button>
                    </div>
                  </article>
                </template>
              </template>
            </div>
          </section>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '@/pages/demo/styles/demo-shell.css';

.demo__content--condensed {
  padding: 2rem;
  gap: 0;
}

.tasks-page {
  display: grid;
  gap: 2rem;
}

.tasks-page__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.tasks-page__header h2 {
  margin: 0;
  font-size: clamp(1.6rem, 3vw, 2rem);
  font-weight: 700;
  color: var(--text-strong);
}

.tasks-page__header p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
}

.tasks-page__filter {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.2rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(11, 46, 51, 0.18);
  background: rgba(245, 252, 255, 0.6);
  color: var(--primary-strong);
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.tasks-page__filter:hover {
  background: rgba(184, 227, 233, 0.2);
  border-color: rgba(11, 46, 51, 0.26);
  box-shadow: 0 12px 24px rgba(11, 46, 51, 0.15);
}

.tasks-page__filter svg {
  width: 1.1rem;
  height: 1.1rem;
}

.tasks-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.tasks-stats__card {
  padding: 1.25rem 1.5rem;
  border-radius: 1.25rem;
  background: rgba(245, 252, 255, 0.9);
  border: 1px solid rgba(11, 46, 51, 0.1);
  box-shadow: 0 16px 28px rgba(11, 46, 51, 0.12);
}

.tasks-stats__card p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.tasks-stats__card strong {
  display: block;
  margin-top: 0.5rem;
  font-size: 2rem;
  color: var(--text-strong);
  font-weight: 700;
}

.tasks-stats__card strong.tone-progress {
  color: var(--primary);
}

.tasks-stats__card strong.tone-review {
  color: #4c6b85;
}

.tasks-stats__card strong.tone-done {
  color: #1c8d72;
}

.tasks-tabs {
  display: grid;
  gap: 1.5rem;
}

.tasks-tabs__list {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255, 255, 255, 0.65);
  border-radius: 999px;
  padding: 0.4rem;
  border: 1px solid rgba(11, 46, 51, 0.08);
}

.tasks-tabs__trigger {
  border: none;
  background: transparent;
  padding: 0.55rem 1.3rem;
  border-radius: 999px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.tasks-tabs__trigger.is-active {
  background: rgba(79, 124, 130, 0.15);
  color: var(--primary-strong);
  box-shadow: 0 12px 24px rgba(11, 46, 51, 0.12);
}

.tasks-tabs__content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.task-card {
  display: grid;
  gap: 0.75rem;
  padding: 1.1rem;
  border-radius: 1rem;
  background: rgba(245, 252, 255, 0.9);
  border: 1px solid rgba(11, 46, 51, 0.12);
  box-shadow: 0 10px 20px rgba(11, 46, 51, 0.12);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.task-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 24px rgba(11, 46, 51, 0.14);
  border-color: rgba(79, 124, 130, 0.4);
}

.task-card.is-overdue {
  border-color: rgba(220, 53, 69, 0.35);
}

.task-card.is-completed {
  opacity: 0.8;
  box-shadow: none;
}

.task-card__headline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.task-card__project {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.task-card__badges {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.task-card h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-strong);
}

.task-card p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.4;
  font-size: 0.95rem;
}

.task-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.85rem;
}

.task-card__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--text-muted);
}

.task-card__meta-item svg {
  width: 1.1rem;
  height: 1.1rem;
}

.task-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.task-card__actions button {
  border: none;
  border-radius: 999px;
  padding: 0.4rem 0.9rem;
  font-size: 0.85rem;
  cursor: pointer;
  background: #0b2e33;
  color: #fff;
  font-weight: 500;
}

.task-card__actions button.is-danger {
  background: #d64545;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-done {
  background: rgba(42, 157, 143, 0.14);
  color: #1c8d72;
  border: 1px solid rgba(42, 157, 143, 0.3);
}

.status-progress {
  background: rgba(79, 124, 130, 0.16);
  color: var(--primary-strong);
  border: 1px solid rgba(79, 124, 130, 0.25);
}

.status-review {
  background: rgba(86, 108, 141, 0.16);
  color: #425c7b;
  border: 1px solid rgba(86, 108, 141, 0.25);
}

.status-todo {
  background: rgba(11, 46, 51, 0.08);
  color: var(--text-muted);
  border: 1px solid rgba(11, 46, 51, 0.15);
}

.priority-high {
  background: rgba(220, 53, 69, 0.15);
  color: #b02232;
  border: 1px solid rgba(220, 53, 69, 0.25);
}

.priority-medium {
  background: rgba(255, 193, 7, 0.18);
  color: #9c6d04;
  border: 1px solid rgba(255, 193, 7, 0.35);
}

.priority-low {
  background: rgba(11, 46, 51, 0.08);
  color: var(--text-muted);
  border: 1px solid rgba(11, 46, 51, 0.15);
}

.task-dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 999px;
  background: rgba(79, 124, 130, 0.4);
}

.task-dot--primary {
  background: #4f7c82;
}

.task-dot--secondary {
  background: #93b1b5;
}

.task-dot--accent {
  background: #c0a46c;
}

.due-over {
  color: #c43838;
  font-weight: 600;
}

.due-soon {
  color: #ad7a16;
  font-weight: 600;
}

.tasks-empty {
  text-align: center;
  padding: 2rem 0;
  color: var(--text-muted);
}

@media (max-width: 1200px) {
  .demo__content--condensed {
    padding: 1.75rem;
  }
}

@media (max-width: 768px) {
  .tasks-page__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .tasks-tabs__list {
    width: 100%;
    justify-content: space-between;
  }

  .task-card {
    padding: 1.4rem;
  }
}
</style>

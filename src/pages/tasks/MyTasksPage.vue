<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuthStore } from '@/store/auth'
import { deleteTask, updateTask, type TaskDoc } from '@/services/taskService'
import AppButton from '@/components/ui/AppButton.vue'
import { ROUTE_NAMES } from '@/constants/routes'

const { user } = useAuthStore()
const loading = ref(true)
const tasks = ref<TaskDoc[]>([])
const projects = ref<Record<string, string>>({})
const search = ref('')
const statusFilter = ref('all')
const dueFilter = ref('all')
const activeTask = ref<TaskDoc | null>(null)
const focusTrail = ref<number[]>([])
const autoHighlightTimer = ref<number>()

async function loadTasks() {
  if (!user.value) return
  loading.value = true
  const map: Record<string, string> = {}
  const items: TaskDoc[] = []
  const projectsSnap = await getDocs(collection(db, 'userProjects', user.value.uid, 'projects'))
  for (const docSnap of projectsSnap.docs) {
    map[docSnap.id] = (docSnap.data().projectName as string) || 'プロジェクト'
    const taskSnap = await getDocs(collection(db, 'projects', docSnap.id, 'tasks'))
    taskSnap.forEach((taskDoc) => {
      const data = taskDoc.data() as TaskDoc
      items.push({ ...data, id: taskDoc.id, projectId: docSnap.id })
    })
  }
  projects.value = map
  tasks.value = items.filter((task) => task.assigneeId === user.value?.uid || !task.assigneeId)
  loading.value = false
}

const filteredTasks = computed(() => {
  let list = [...tasks.value]
  if (search.value.trim()) {
    const keyword = search.value.toLowerCase()
    list = list.filter((task) => task.title.toLowerCase().includes(keyword))
  }
  if (statusFilter.value !== 'all') {
    list = list.filter((task) => task.status === statusFilter.value)
  }
  if (dueFilter.value !== 'all') {
    const now = new Date()
    list = list.filter((task) => {
      if (!task.dueDate?.seconds) return false
      const due = new Date(task.dueDate.seconds * 1000)
      if (dueFilter.value === 'today') return due.toDateString() === now.toDateString()
      if (dueFilter.value === 'week') return due.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000 && due >= now
      if (dueFilter.value === 'overdue') return due < now
      return true
    })
  }
  return list
})

const statusConfig = [
  { key: 'todo', title: '未着手' },
  { key: 'in-progress', title: '進行中' },
  { key: 'done', title: '完了' },
]

const boardColumns = computed(() =>
  statusConfig.map((status) => ({
    key: status.key,
    title: status.title,
    badge: filteredTasks.value.filter((task) => task.status === status.key).length || undefined,
    tasks: filteredTasks.value.filter((task) => task.status === status.key),
  })),
)

function openTask(task: TaskDoc) {
  activeTask.value = task
  stopAutoHighlight()
}

function closeTask() {
  activeTask.value = null
}

function stopAutoHighlight() {
  if (autoHighlightTimer.value) {
    window.clearInterval(autoHighlightTimer.value)
    autoHighlightTimer.value = undefined
  }
  focusTrail.value = []
}

function formatDue(task: TaskDoc) {
  return task.dueDate?.seconds ? new Date(task.dueDate.seconds * 1000).toLocaleDateString() : '期限未設定'
}

async function changeStatus(status: 'todo' | 'in-progress' | 'done') {
  if (!activeTask.value) return
  await updateTask(activeTask.value.projectId, activeTask.value.id, { status })
  await loadTasks()
  activeTask.value = null
}

async function removeActive() {
  if (!activeTask.value) return
  await deleteTask(activeTask.value.projectId, activeTask.value.id)
  await loadTasks()
  activeTask.value = null
}

onMounted(() => {
  loadTasks()
  let cursor = 0
  autoHighlightTimer.value = window.setInterval(() => {
    const list = filteredTasks.value
    if (!list.length) return
    const index = cursor % list.length
    const nextTask = list[index]
    if (nextTask) {
      activeTask.value = nextTask
      focusTrail.value = [index]
      cursor += 1
    }
  }, 7000)
})

onBeforeUnmount(() => {
  stopAutoHighlight()
})
</script>

<template>
  <div class="tasks-shell">
    <header class="tasks-header">
      <div>
        <p>Teamie / マイタスク</p>
        <h1>自分のタスク</h1>
      </div>
      <AppButton :to="{ name: ROUTE_NAMES.projectCreate }">新規プロジェクト</AppButton>
    </header>

    <section class="filters">
      <input v-model="search" type="search" placeholder="タスクを検索" />
      <select v-model="statusFilter">
        <option value="all">全てのステータス</option>
        <option value="todo">未着手</option>
        <option value="in-progress">進行中</option>
        <option value="done">完了</option>
      </select>
      <select v-model="dueFilter">
        <option value="all">期限</option>
        <option value="today">今日</option>
        <option value="week">今週</option>
        <option value="overdue">期限切れ</option>
      </select>
    </section>

    <section v-if="loading" class="empty">読み込み中...</section>
    <section v-else-if="!filteredTasks.length" class="empty">対象のタスクがありません。</section>

    <section v-else class="board">
      <div class="board__header">
        <h2>タスク管理</h2>
      </div>

      <div class="board__columns">
        <article v-for="column in boardColumns" :key="column.key" class="board-column">
          <header class="board-column__header">
            <h3>{{ column.title }}</h3>
            <span v-if="column.badge" class="badge">{{ column.badge }}</span>
          </header>

          <p v-if="column.tasks.length === 0" class="board-column__empty">
            {{ column.title }}のタスクはありません。
          </p>

          <div v-else class="board-column__tasks">
            <article
              v-for="task in column.tasks"
              :key="task.id"
              class="task-card"
              :class="{
                'is-selected': activeTask?.id === task.id,
                'is-highlight': focusTrail[0] !== undefined && filteredTasks[focusTrail[0]]?.id === task.id,
              }"
              role="button"
              tabindex="0"
              @click="openTask(task)"
              @keydown.enter.prevent="openTask(task)"
            >
              <div class="task-card__head">
                <h4>{{ task.title }}</h4>
                <span class="priority" :class="`priority--${task.status}`">{{ column.title }}</span>
              </div>
              <p class="task-card__description">{{ task.description || '説明なし' }}</p>
              <dl class="task-card__meta">
                <div>
                  <dt>期限</dt>
                  <dd>{{ formatDue(task) }}</dd>
                </div>
                <div>
                  <dt>担当</dt>
                  <dd>{{ user?.uid === task.assigneeId ? 'あなた' : '未割当' }}</dd>
                </div>
                <div>
                  <dt>プロジェクト</dt>
                  <dd>{{ projects[task.projectId] || 'プロジェクト' }}</dd>
                </div>
              </dl>
            </article>
          </div>
        </article>
      </div>

      <transition name="task-detail">
        <div v-if="activeTask" class="task-detail" role="dialog" aria-modal="true">
          <div class="task-detail__header">
            <div>
              <p class="task-detail__project">{{ projects[activeTask.projectId] || 'プロジェクト' }}</p>
              <h3>{{ activeTask.title }}</h3>
            </div>
            <button type="button" class="task-detail__close" @click="closeTask" aria-label="閉じる">
              ×
            </button>
          </div>
          <p class="task-detail__description">{{ activeTask.description || '説明なし' }}</p>
          <dl class="task-detail__grid">
            <div>
              <dt>ステータス</dt>
              <dd>{{ statusConfig.find((s) => s.key === activeTask.status)?.title || activeTask.status }}</dd>
            </div>
            <div>
              <dt>期限</dt>
              <dd>{{ formatDue(activeTask) }}</dd>
            </div>
            <div>
              <dt>担当者</dt>
              <dd>{{ user?.uid === activeTask.assigneeId ? 'あなた' : '未割当' }}</dd>
            </div>
          </dl>
          <div class="task-detail__actions">
            <button type="button" @click="changeStatus('todo')">未着手</button>
            <button type="button" @click="changeStatus('in-progress')">進行中</button>
            <button type="button" @click="changeStatus('done')">完了</button>
            <button type="button" class="danger" @click="removeActive">削除</button>
          </div>
        </div>
      </transition>
    </section>
  </div>
</template>

<style scoped>
.tasks-shell {
  padding: 2rem clamp(1rem, 5vw, 4rem);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filters {
  display: flex;
  gap: 0.75rem;
}

.filters input,
.filters select {
  padding: 0.65rem;
  border-radius: 0.75rem;
  border: 1px solid #d4dee8;
}

.task-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.task-item {
  border: 1px solid #e1e8f0;
  border-radius: 1rem;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.task-item h3 {
  margin: 0;
}

.task-item p {
  margin: 0.25rem 0;
}

.task-meta {
  color: #5b6b84;
}

.actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.empty {
  text-align: center;
  color: #5b6b84;
}

.board {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.board__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.25rem;
}

.board__columns {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  position: relative;
}

.board-column {
  background: var(--surface-elevated);
  border-radius: 1.25rem;
  border: 1px solid var(--border-light);
  padding: 1.25rem;
  min-height: 320px;
  box-shadow: 0 14px 28px rgba(11, 46, 51, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.board-column__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.board-column__empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.board-column__tasks {
  display: grid;
  gap: 1rem;
}

.task-card {
  border-radius: 1rem;
  border: 1px solid rgba(11, 46, 51, 0.1);
  padding: 1rem;
  background: rgba(184, 227, 233, 0.2);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.task-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.task-card__description {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.task-card__meta {
  margin: 0;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.priority {
  border-radius: 999px;
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--surface-elevated);
  background: #4f7c82;
}

.task-card.is-selected {
  border-color: rgba(11, 46, 51, 0.5);
  box-shadow: 0 22px 34px rgba(11, 46, 51, 0.18);
  background: rgba(184, 227, 233, 0.35);
}

.task-card.is-highlight {
  animation: pulse 1.4s ease-in-out infinite alternate;
}

@keyframes pulse {
  from {
    transform: translateY(-2px);
  }
  to {
    transform: translateY(-6px);
  }
}

.task-detail {
  margin-top: 0.5rem;
  border-radius: 1.5rem;
  background: var(--surface-elevated);
  border: 1px solid rgba(11, 46, 51, 0.12);
  padding: 1.5rem;
  box-shadow: 0 20px 40px rgba(11, 46, 51, 0.16);
  display: grid;
  gap: 1rem;
}

.task-detail__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.task-detail__project {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.task-detail__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.task-detail__actions button {
  border: none;
  border-radius: 0.75rem;
  padding: 0.6rem 1rem;
  background: #0b2e33;
  color: #fff;
}

.task-detail__actions button.danger {
  background: #d64545;
}
</style>
</style>

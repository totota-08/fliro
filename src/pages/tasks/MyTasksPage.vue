<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuthStore } from '@/store/auth'
import { createTask, deleteTask, updateTask, type TaskDoc } from '@/services/taskService'
import AppButton from '@/components/ui/AppButton.vue'
import { ROUTE_NAMES } from '@/constants/routes'

const { user } = useAuthStore()
const loading = ref(true)
const tasks = ref<TaskDoc[]>([])
const projects = ref<Record<string, string>>({})
const search = ref('')
const statusFilter = ref('all')
const dueFilter = ref('all')

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

async function toggleComplete(task: TaskDoc) {
  const nextStatus = task.status === 'done' ? 'todo' : 'done'
  await updateTask(task.projectId, task.id, { status: nextStatus })
  await loadTasks()
}

async function remove(task: TaskDoc) {
  await deleteTask(task.projectId, task.id)
  await loadTasks()
}

onMounted(() => {
  loadTasks()
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

    <ul v-else class="task-list">
      <li v-for="task in filteredTasks" :key="task.id" class="task-item">
        <div>
          <h3>{{ task.title }}</h3>
          <p>{{ task.description || '説明なし' }}</p>
          <p class="task-meta">{{ projects[task.projectId] || 'プロジェクト' }}</p>
        </div>
        <div class="actions">
          <label>
            <input type="checkbox" :checked="task.status === 'done'" @change="toggleComplete(task)" /> 完了
          </label>
          <span>{{ task.dueDate?.seconds ? new Date(task.dueDate.seconds * 1000).toLocaleDateString() : '期限未設定' }}</span>
          <button type="button" @click="remove(task)">削除</button>
        </div>
      </li>
    </ul>
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
</style>

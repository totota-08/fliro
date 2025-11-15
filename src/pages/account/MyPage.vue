<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { collection, getDocs, query } from 'firebase/firestore'
import { useRouter } from 'vue-router'
import { db } from '@/firebase/config'
import { useAuthStore } from '@/store/auth'
import { redeemInvite } from '@/services/projectInvites'
import { consumeInviteToken, rememberInviteToken } from '@/services/inviteSession'
import AppButton from '@/components/ui/AppButton.vue'
import { ROUTE_NAMES } from '@/constants/routes'

interface TaskDoc {
  title: string
  status: string
  dueDate?: { seconds: number }
  projectId: string
  projectName: string
}

const { user, profile } = useAuthStore()
const loading = ref(true)
const taskList = ref<TaskDoc[]>([])
const projectCount = ref(0)
const projects = ref<{ id: string; name: string; role?: string }[]>([])
const inviteMessage = ref('')
const keyBuffer = ref('')
const SECRET = 'teamie'
const router = useRouter()

async function fetchTasks() {
  if (!user.value) return
  loading.value = true
  try {
    const items: TaskDoc[] = []
    const projectItems: { id: string; name: string; role?: string }[] = []
    const projectsSnap = await getDocs(collection(db, 'userProjects', user.value.uid, 'projects'))
    projectCount.value = projectsSnap.size
    for (const docSnap of projectsSnap.docs) {
      const projectId = docSnap.id
      const projectName = (docSnap.data().projectName as string) || 'プロジェクト'
      projectItems.push({ id: projectId, name: projectName, role: docSnap.data().role as string })
      const tasksSnap = await getDocs(query(collection(db, 'projects', projectId, 'tasks')))
      tasksSnap.forEach((task) => {
        const data = task.data() as any
        items.push({
          title: data.title ?? 'タスク',
          status: data.status ?? 'todo',
          dueDate: data.dueDate,
          projectId,
          projectName,
        })
      })
    }
    taskList.value = items
    projects.value = projectItems
  } catch (error) {
    console.error('Failed to load tasks', error)
  } finally {
    loading.value = false
  }
}

const upcomingTasks = computed(() => {
  const now = Date.now()
  const weekAhead = now + 7 * 24 * 60 * 60 * 1000
  return taskList.value
    .filter((task) => task.dueDate?.seconds)
    .filter((task) => {
      const due = task.dueDate!.seconds * 1000
      return due >= now && due <= weekAhead
    })
    .sort((a, b) => a.dueDate!.seconds - b.dueDate!.seconds)
})

const totalTasks = computed(() => taskList.value.length)
const completedThisWeek = computed(() => taskList.value.filter((task) => task.status === 'done' || task.status === 'completed').length)

async function processPendingInvite() {
  if (!user.value) return
  const token = consumeInviteToken()
  if (!token) return
  try {
    const projectId = await redeemInvite(token, user.value.uid, user.value.email ?? '')
    inviteMessage.value = '招待を承認しました。プロジェクトへ移動します。'
    setTimeout(() => {
      router.push({ name: ROUTE_NAMES.projectDebug, params: { projectId } })
    }, 1200)
  } catch (error) {
    console.error(error)
    inviteMessage.value = '招待の承認に失敗しました。'
    rememberInviteToken(token)
  }
}

function handleKeydown(event: KeyboardEvent) {
  keyBuffer.value = (keyBuffer.value + event.key.toLowerCase()).slice(-SECRET.length)
  if (keyBuffer.value === SECRET) {
    router.push({ name: ROUTE_NAMES.secretAccess })
  }
}

onMounted(async () => {
  await fetchTasks()
  await processPendingInvite()
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="mypage-shell">
    <section class="profile-card">
      <div>
        <p class="eyebrow">My Page</p>
        <h1>{{ profile?.nickname || profile?.fullName || 'Teamie ユーザー' }}</h1>
        <p>{{ profile?.email }}</p>
        <div class="profile-actions">
          <AppButton :to="{ name: ROUTE_NAMES.authDebug }" variant="outline">アカウント設定</AppButton>
          <AppButton :to="{ name: ROUTE_NAMES.projectCreate }">新しいプロジェクト</AppButton>
        </div>
      </div>
      <dl>
        <div>
          <dt>参加プロジェクト</dt>
          <dd>{{ projectCount }}</dd>
        </div>
        <div>
          <dt>タスク総数</dt>
          <dd>{{ totalTasks }}</dd>
        </div>
        <div>
          <dt>完了タスク（週）</dt>
          <dd>{{ completedThisWeek }}</dd>
        </div>
      </dl>
    </section>

    <p v-if="inviteMessage" class="alert">{{ inviteMessage }}</p>

    <section class="projects-panel">
      <header>
        <div>
          <h2>参加中のプロジェクト</h2>
          <p>クリックしてプロジェクトのデバッグ画面にアクセスできます。</p>
        </div>
      </header>
      <div v-if="!projects.length" class="empty">まだプロジェクトに参加していません。</div>
      <ul v-else class="project-list">
        <li v-for="project in projects" :key="project.id">
          <div>
            <p class="project-name">{{ project.name }}</p>
            <p class="project-role">ロール: {{ project.role || 'member' }}</p>
          </div>
          <AppButton variant="outline" :to="{ name: ROUTE_NAMES.projectDebug, params: { projectId: project.id } }">
            開く
          </AppButton>
        </li>
      </ul>
    </section>

    <section class="tasks-panel">
      <header>
        <div>
          <h2>今週のタスク状況</h2>
          <p>期限が近いタスクをチェックして、優先順位を整えましょう。</p>
        </div>
      </header>
      <div v-if="loading" class="empty">読み込み中...</div>
      <div v-else-if="!taskList.length" class="empty">
        まだタスクがありません。新しいプロジェクトでタスクを追加してみましょう。
      </div>
      <div v-else class="task-grid">
        <article v-for="task in upcomingTasks" :key="task.title + task.projectId" class="task-card">
          <p class="task-title">{{ task.title }}</p>
          <p class="task-project">{{ task.projectName }}</p>
          <p class="task-due" v-if="task.dueDate">期限: {{ new Date(task.dueDate.seconds * 1000).toLocaleDateString() }}</p>
          <p class="task-due" v-else>期限: 未設定</p>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.mypage-shell {
  min-height: 100vh;
  padding: 3rem clamp(1rem, 5vw, 4rem);
  background: #f5f7f9;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.profile-card {
  background: #fff;
  border-radius: 1.75rem;
  border: 2px solid #b8e3e9;
  padding: 2rem;
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.25em;
  color: #4f7c82;
  margin: 0;
}

.profile-card h1 {
  margin: 0.35rem 0;
  color: #0b2e33;
}

.profile-card p {
  margin: 0;
  color: #4f7c82;
}

.profile-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

dl {
  margin: 0;
  display: flex;
  gap: 1.5rem;
}

dt {
  color: #4f7c82;
  font-size: 0.85rem;
}

dd {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.alert {
  background: #eaf6f6;
  border-left: 4px solid #4f7c82;
  padding: 1rem;
  border-radius: 1rem;
  color: #0b2e33;
}

.projects-panel {
  background: #fff;
  border-radius: 1.5rem;
  border: 1px solid #e1ecef;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.project-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.project-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #e1ecef;
  border-radius: 1rem;
  padding: 1rem;
}

.project-name {
  margin: 0;
  font-weight: 600;
  color: #0b2e33;
}

.project-role {
  margin: 0.35rem 0 0;
  color: #4f7c82;
  font-size: 0.9rem;
}

.tasks-panel {
  background: #fff;
  border-radius: 1.5rem;
  border: 1px solid #e1ecef;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.tasks-panel header h2 {
  margin: 0;
  color: #0b2e33;
}

.tasks-panel header p {
  margin: 0.35rem 0 0;
  color: #4f7c82;
}

.empty {
  text-align: center;
  color: #4f7c82;
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.task-card {
  border: 1px solid #e1ecef;
  border-radius: 1rem;
  padding: 1rem;
  background: #f9fbfb;
}

.task-title {
  margin: 0;
  font-weight: 600;
  color: #0b2e33;
}

.task-project,
.task-due {
  margin: 0.35rem 0 0;
  color: #4f7c82;
  font-size: 0.9rem;
}
</style>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import DashboardSidebar from '@/components/projectDashboard/DashboardSidebar.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { db } from '@/firebase/config'
import { useAuthStore } from '@/store/auth'
import { ROUTE_NAMES } from '@/constants/routes'
import { fetchProject, updateProjectMetadata, deleteProject } from '@/firebase/projectService'
import type { ProjectDoc } from '@/types/project'
import type { DashboardNavItem } from '@/types/projectDashboard'

const route = useRoute()
const router = useRouter()
const { user, profile } = useAuthStore()
const projectId = ref(String(route.params.projectId || ''))
const project = ref<ProjectDoc | null>(null)
const projectList = ref<{ id: string; name: string }[]>([])
const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const deleteError = ref('')
const deleteConfirmInput = ref('')
const isSidebarOpen = ref(true)
const canManage = ref(false)

const form = ref({
  name: '',
  description: '',
  isPublic: false,
  allowGuestView: false,
})

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

const confirmEmail = computed(() => user.value?.email ?? '')
const canDeleteProject = computed(
  () => Boolean(confirmEmail.value) && deleteConfirmInput.value.trim() === confirmEmail.value,
)

const canEdit = computed(() => canManage.value)

async function loadProjectList() {
  if (!user.value) return
  const snap = await getDocs(collection(db, 'userProjects', user.value.uid, 'projects'))
  projectList.value = snap.docs.map((docSnap, index) => ({
    id: docSnap.id,
    name: (docSnap.data().projectName as string) || `Project ${index + 1}`,
  }))
}

async function loadProject() {
  loading.value = true
  errorMessage.value = ''
  try {
    const fetched = await fetchProject(projectId.value)
    if (!fetched) {
      errorMessage.value = 'プロジェクトが見つかりません。'
      project.value = null
      return
    }
    project.value = fetched
    form.value = {
      name: fetched.name,
      description: fetched.description ?? '',
      isPublic: Boolean(fetched.settings?.isPublic),
      allowGuestView: Boolean(fetched.settings?.allowGuestView),
    }
    await evaluatePermissions()
  } catch (error) {
    console.error(error)
    errorMessage.value = '設定情報の取得に失敗しました。'
  } finally {
    loading.value = false
  }
}

async function evaluatePermissions() {
  if (!user.value) {
    canManage.value = false
    return
  }
  try {
    const memberSnap = await getDoc(doc(db, 'projects', projectId.value, 'members', user.value.uid))
    if (!memberSnap.exists()) {
      canManage.value = false
      return
    }
    const data = memberSnap.data() as any
    canManage.value = Boolean(data.permissions?.canManageSettings)
  } catch (error) {
    console.error('Failed to evaluate permissions', error)
    canManage.value = false
  }
}

function closeSidebar() {
  isSidebarOpen.value = false
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}

async function handleSave() {
  if (!canEdit.value || !project.value) return
  if (!form.value.name.trim()) {
    errorMessage.value = 'プロジェクト名は必須です。'
    return
  }
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await updateProjectMetadata(projectId.value, {
      name: form.value.name,
      description: form.value.description,
      isPublic: form.value.isPublic,
      allowGuestView: form.value.allowGuestView,
    })
    successMessage.value = '設定を保存しました。'
  } catch (error) {
    console.error(error)
    errorMessage.value = '設定の保存に失敗しました。'
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  deleteError.value = ''
  if (!canEdit.value || !project.value) {
    deleteError.value = '設定を変更する権限がありません。'
    return
  }
  if (!canDeleteProject.value) {
    deleteError.value = '本人確認のため、メールアドレスを正しく入力してください。'
    return
  }
  if (!confirm('このプロジェクトを完全に削除します。よろしいですか？')) {
    return
  }
  deleting.value = true
  try {
    await deleteProject(projectId.value)
    await router.push({ name: ROUTE_NAMES.myPage })
  } catch (error) {
    console.error(error)
    deleteError.value = 'プロジェクトの削除に失敗しました。'
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  if (window.matchMedia('(max-width: 1200px)').matches) {
    isSidebarOpen.value = false
  }
  await loadProjectList()
  await loadProject()
})

watch(
  () => route.params.projectId,
  async (newId) => {
    if (!newId) return
    projectId.value = String(newId)
    await loadProject()
  },
)
</script>

<template>
  <div :class="['demo', { 'demo--sidebar-collapsed': !isSidebarOpen }]">
    <DashboardSidebar
      :open="isSidebarOpen"
      :nav-items="navItems"
      :projects="sidebarProjects"
      :profile="profileInfo"
      brand-subtitle="プロジェクト設定"
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
            <p class="demo__breadcrumb">プロジェクト &gt; 設定</p>
            <h1 class="demo__heading">{{ project?.name || '設定' }}</h1>
          </div>
        </div>
      </header>

      <div class="settings-content">
        <section v-if="loading" class="settings-card">読み込み中...</section>
        <section v-else-if="errorMessage" class="settings-card settings-card--error">{{ errorMessage }}</section>

        <template v-else>
          <section class="settings-card" :class="{ 'is-disabled': !canEdit }">
            <header>
              <h2>基本情報</h2>
              <p>プロジェクト名や概要を編集できます。</p>
            </header>
            <form class="settings-form" @submit.prevent="handleSave">
              <label>
                <span>プロジェクト名</span>
                <input v-model="form.name" type="text" :disabled="!canEdit" required />
              </label>
              <label>
                <span>説明</span>
                <textarea v-model="form.description" rows="3" :disabled="!canEdit" placeholder="プロジェクトの補足情報を入力"></textarea>
              </label>
              <label class="toggle">
                <input type="checkbox" v-model="form.isPublic" :disabled="!canEdit" />
                <span>公開プロジェクトにする</span>
              </label>
              <label class="toggle">
                <input type="checkbox" v-model="form.allowGuestView" :disabled="!canEdit" />
                <span>ゲスト閲覧を許可する</span>
              </label>
              <div class="settings-actions">
                <AppButton type="submit" :loading="saving" :disabled="!canEdit">
                  設定を保存
                </AppButton>
                <p v-if="successMessage" class="settings-success">{{ successMessage }}</p>
              </div>
            </form>
          </section>

          <section class="settings-card settings-card--danger">
            <header>
              <h2>危険な操作</h2>
              <p>プロジェクトを削除するには、登録済みメールアドレスを入力し本人確認を行ってください。</p>
            </header>
            <label>
              <span>本人確認用メールアドレス</span>
              <input
                v-model="deleteConfirmInput"
                type="email"
                :placeholder="confirmEmail || 'メールアドレス'"
              />
            </label>
            <p class="danger-note">この操作は取り消せません。タスクやメンバー情報がすべて削除されます。</p>
            <div class="settings-actions">
              <AppButton
                variant="secondary"
                class="danger-button"
                :disabled="!canDeleteProject || deleting"
                :loading="deleting"
                @click="handleDelete"
              >
                プロジェクトを削除
              </AppButton>
            </div>
            <p v-if="deleteError" class="settings-error">{{ deleteError }}</p>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '@/pages/demo/styles/demo-shell.css';

.settings-content {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-card {
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 1.25rem;
  padding: 1.5rem;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.settings-card header h2 {
  margin: 0;
}

.settings-card header p {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
}

.settings-card.is-disabled {
  opacity: 0.6;
  pointer-events: none;
}

.settings-card--error {
  border-color: rgba(214, 69, 69, 0.3);
  background: rgba(214, 69, 69, 0.08);
}

.settings-card--danger {
  border-color: rgba(214, 69, 69, 0.3);
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.settings-form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
}

.settings-form input,
.settings-form textarea {
  border: 1px solid #d1dae8;
  border-radius: 0.95rem;
  padding: 0.75rem 1rem;
  font-size: 1rem;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.settings-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.settings-success {
  margin: 0;
  color: #1c8d72;
  font-weight: 600;
}

.settings-error {
  margin: 0;
  color: #d64545;
  font-weight: 600;
}

.settings-card--danger input {
  border: 1px solid #f0c9c9;
}

.danger-note {
  margin: 0;
  color: #8b3a3a;
  font-size: 0.9rem;
}

.danger-button {
  color: #d64545;
  border: 1px solid rgba(214, 69, 69, 0.4);
}

@media (max-width: 768px) {
  .settings-content {
    padding: 1.25rem;
  }
}
</style>

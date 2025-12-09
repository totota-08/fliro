<script setup lang="ts">
import DashboardSidebar from '@/components/projectDashboard/DashboardSidebar.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { appName } from '@/constants/appMeta'
import { ROUTE_NAMES } from '@/constants/routes'
import { db } from '@/firebase/config'
import { deleteProject, fetchProject, updateProjectMetadata } from '@/firebase/projectService'
import { updateProjectSettings } from '@/services/projectSettings'
import { listenTasks, type TaskDoc } from '@/services/taskService'
import { useAuthStore } from '@/store/auth'
import type { ProjectDoc } from '@/types/project'
import type { DashboardNavItem } from '@/types/projectDashboard'
import { getLogger } from '@logtape/logtape'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const logger = getLogger('app.pages.projects.ProjectSettings')

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

const aiEnabled = ref(false)
const aiKey = ref('')
const aiPrompt = ref('')
const aiResponse = ref('')
const aiLoading = ref(false)
const tasks = ref<TaskDoc[]>([])
let stopTasks: (() => void) | null = null

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
      label: 'スレッド',
      to: { name: ROUTE_NAMES.projectThreads, params: { projectId: projectId.value } },
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
  name: profile.value?.nickname || profile.value?.fullName || `${appName} User`,
  email: profile.value?.email || '',
}))

const confirmEmail = computed(() => user.value?.email ?? '')
const canDeleteProject = computed(
  () => Boolean(confirmEmail.value) && deleteConfirmInput.value.trim() === confirmEmail.value,
)

const canEdit = computed(() => canManage.value)

const summaryInfo = computed(() => {
  const created = project.value?.createdAt
  const createdLabel =
    created && typeof created === 'object' && 'seconds' in created
      ? new Date((created as { seconds: number }).seconds * 1000).toLocaleDateString()
      : created
      ? new Date(created as string | number | Date).toLocaleDateString()
      : '-'
  return {
    created: createdLabel,
    ownerId: project.value?.ownerUserId ?? '-',
    members: project.value?.stats?.totalMembers ?? '-',
  }
})

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
    aiEnabled.value = Boolean(fetched.settings?.aiChatEnabled)
    aiKey.value = fetched.settings?.aiApiKey ?? ''
    await evaluatePermissions()
  } catch (error) {
    logger.error`Failed to load project settings: ${error}`
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
    canManage.value = data.projectRole === 'owner'
  } catch (error) {
    logger.error`Failed to evaluate permissions: ${error}`
    canManage.value = false
  }
}

function watchTasks() {
  stopTasks = listenTasks(projectId.value, (list) => {
    tasks.value = list
  })
}

async function saveAiSettings() {
  if (!canEdit.value) return
  try {
    await updateProjectSettings(projectId.value, { aiChatEnabled: aiEnabled.value, aiApiKey: aiKey.value })
    successMessage.value = 'AI設定を保存しました。'
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (error) {
    logger.error`Failed to save AI settings: ${error}`
    errorMessage.value = 'AI設定の保存に失敗しました。'
  }
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
        { role: 'system', content: `You are a task assistant for the ${appName} project.` },
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
    logger.error`Failed to save project settings: ${error}`
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
    logger.error`Failed to delete project: ${error}`
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
  watchTasks()
})

onBeforeUnmount(() => {
  stopTasks?.()
})

watch(
  () => route.params.projectId,
  async (newId) => {
    if (!newId) return
    projectId.value = String(newId)
    stopTasks?.()
    await loadProject()
    watchTasks()
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
            <nav class="demo__breadcrumb-nav">
              <ol class="demo__breadcrumb-list">
                <li>プロジェクト</li>
                <li>設定</li>
              </ol>
            </nav>
            <h1 class="demo__heading">{{ project?.name || '設定' }}</h1>
          </div>
        </div>
      </header>

      <div class="settings-container">
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>読み込み中...</p>
        </div>

        <div v-else-if="errorMessage" class="error-state">
          <p>{{ errorMessage }}</p>
        </div>

        <template v-else>
          <div class="settings-grid">
            <!-- Main Settings Column -->
            <div class="settings-main">
              <section class="card" :class="{ 'is-disabled': !canEdit }">
                <header class="card-header">
                  <div class="card-header__icon">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2>基本設定</h2>
                    <p>プロジェクトの基本情報を管理します</p>
                  </div>
                </header>
                
                <form @submit.prevent="handleSave" class="form-stack">
                  <div class="form-group">
                    <label for="projectName">プロジェクト名</label>
                    <input 
                      id="projectName"
                      v-model="form.name" 
                      type="text" 
                      :disabled="!canEdit" 
                      required 
                      class="form-input"
                      placeholder="プロジェクト名を入力"
                    />
                  </div>

                  <div class="form-group">
                    <label for="projectDesc">説明</label>
                    <textarea 
                      id="projectDesc"
                      v-model="form.description" 
                      rows="4" 
                      :disabled="!canEdit" 
                      class="form-textarea"
                      placeholder="プロジェクトの目的や概要を入力してください"
                    ></textarea>
                  </div>

                  <div class="form-toggles">
                    <label class="toggle-switch">
                      <input type="checkbox" v-model="form.isPublic" :disabled="!canEdit" />
                      <span class="toggle-slider"></span>
                      <span class="toggle-label">
                        <span class="toggle-title">公開プロジェクト</span>
                        <span class="toggle-desc">誰でもこのプロジェクトを閲覧できるようになります</span>
                      </span>
                    </label>

                    <label class="toggle-switch">
                      <input type="checkbox" v-model="form.allowGuestView" :disabled="!canEdit" />
                      <span class="toggle-slider"></span>
                      <span class="toggle-label">
                        <span class="toggle-title">ゲスト閲覧を許可</span>
                        <span class="toggle-desc">アカウントを持たないユーザーも閲覧可能にします</span>
                      </span>
                    </label>
                  </div>

                  <div class="form-actions">
                    <AppButton type="submit" :loading="saving" :disabled="!canEdit" variant="primary">
                      変更を保存
                    </AppButton>
                    <transition name="fade">
                      <span v-if="successMessage" class="success-badge">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {{ successMessage }}
                      </span>
                    </transition>
                  </div>
                </form>
              </section>

              <section class="card" :class="{ 'is-disabled': !canEdit }">
                <header class="card-header">
                  <div class="card-header__icon">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h2>AI アシスタント</h2>
                    <p>OpenAI API を使用してタスクのサポートを行います</p>
                  </div>
                </header>

                <div class="form-stack">
                  <div class="form-toggles">
                    <label class="toggle-switch">
                      <input type="checkbox" v-model="aiEnabled" :disabled="!canEdit" />
                      <span class="toggle-slider"></span>
                      <span class="toggle-label">
                        <span class="toggle-title">AI アシスタントを有効化</span>
                        <span class="toggle-desc">タスクの内容に基づいてAIが回答します</span>
                      </span>
                    </label>
                  </div>

                  <div class="form-group">
                    <label for="aiKey">OpenAI API Key</label>
                    <input
                      id="aiKey"
                      v-model="aiKey"
                      type="password"
                      :disabled="!canEdit"
                      class="form-input"
                      placeholder="sk-..."
                    />
                  </div>

                  <div class="form-actions">
                    <AppButton type="button" :disabled="!canEdit" variant="primary" @click="saveAiSettings">
                      設定を保存
                    </AppButton>
                  </div>

                  <div v-if="aiEnabled" class="ai-playground">
                    <h3>テストチャット</h3>
                    <textarea
                      v-model="aiPrompt"
                      class="form-textarea"
                      placeholder="タスクについて質問してください"
                    ></textarea>
                    <div class="form-actions">
                      <AppButton type="button" :disabled="aiLoading || !aiKey" @click="askAi">
                        {{ aiLoading ? '応答中...' : 'AIに聞く' }}
                      </AppButton>
                    </div>
                    <div v-if="aiResponse" class="ai-response">
                      <p>{{ aiResponse }}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section class="card card--danger">
                <header class="card-header">
                  <div class="card-header__icon danger-icon">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div>
                    <h2>プロジェクトの削除</h2>
                    <p>この操作は取り消すことができません。慎重に操作してください。</p>
                  </div>
                </header>

                <div class="danger-content">
                  <div class="danger-warning">
                    <p>プロジェクトを削除すると、関連するすべてのタスク、チャット、ファイルが完全に削除されます。</p>
                  </div>
                  
                  <div class="form-group">
                    <label for="deleteConfirm">確認のため、メールアドレスを入力してください</label>
                    <input
                      id="deleteConfirm"
                      v-model="deleteConfirmInput"
                      type="email"
                      class="form-input danger-input"
                      :placeholder="confirmEmail"
                    />
                  </div>

                  <div class="danger-actions">
                    <AppButton
                      variant="secondary"
                      class="danger-button"
                      :disabled="!canDeleteProject || deleting"
                      :loading="deleting"
                      @click="handleDelete"
                    >
                      プロジェクトを削除
                    </AppButton>
                    <p v-if="deleteError" class="error-message">{{ deleteError }}</p>
                  </div>
                </div>
              </section>
            </div>

            <!-- Sidebar Info Column -->
            <aside class="settings-sidebar">
              <div class="info-card">
                <h3>プロジェクト情報</h3>
                <dl class="info-list">
                  <div class="info-item">
                    <dt>作成日</dt>
                    <dd>{{ summaryInfo.created }}</dd>
                  </div>
                  <div class="info-item">
                    <dt>オーナー</dt>
                    <dd class="truncate" :title="summaryInfo.ownerId">{{ summaryInfo.ownerId }}</dd>
                  </div>
                  <div class="info-item">
                    <dt>メンバー数</dt>
                    <dd>{{ summaryInfo.members }}名</dd>
                  </div>
                </dl>
              </div>
            </aside>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '@/pages/demo/styles/demo-shell.css';

/* Layout & Container */
.settings-container {
  max-width: 760px;
  margin: 0 auto;
  padding: 1.5rem;
  animation: fadeIn 0.3s ease-out;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  align-items: start;
}

/* Cards */
.card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05);
  border: 1px solid #e5e7eb;
  overflow: hidden;
  margin-bottom: 2rem;
}

.card-header {
  padding: 1.5rem;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.card-header__icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #f0f9ff;
  color: #0284c7;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-header__icon svg {
  width: 24px;
  height: 24px;
}

.card-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.25rem 0;
}

.card-header p {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

/* Forms */
.form-stack {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
  color: #1f2937;
  transition: all 0.2s;
  background: #f9fafb;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

/* Toggles */
.form-toggles {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #f3f4f6;
}

.toggle-switch {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  cursor: pointer;
}

.toggle-switch input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 44px;
  height: 24px;
  background-color: #e5e7eb;
  border-radius: 24px;
  transition: 0.3s;
  flex-shrink: 0;
  margin-top: 2px;
}

.toggle-slider:before {
  content: "";
  position: absolute;
  height: 20px;
  width: 20px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  border-radius: 50%;
  transition: 0.3s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #3b82f6;
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

.toggle-label {
  display: flex;
  flex-direction: column;
}

.toggle-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: #1f2937;
}

.toggle-desc {
  font-size: 0.8rem;
  color: #6b7280;
}

/* Actions */
.form-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
}

.success-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: #ecfdf5;
  color: #059669;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Danger Zone */
.card--danger {
  border-color: #fee2e2;
}

.card--danger .card-header {
  background: #fef2f2;
  border-bottom-color: #fee2e2;
}

.card--danger .card-header__icon {
  background: #fee2e2;
  color: #dc2626;
}

.danger-content {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.danger-warning {
  padding: 0.75rem;
  background: #fff5f5;
  border-radius: 6px;
  color: #991b1b;
  font-size: 0.875rem;
  border-left: 4px solid #ef4444;
}

.danger-input {
  border-color: #fca5a5;
}

.danger-input:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.danger-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.error-message {
  color: #dc2626;
  font-size: 0.875rem;
  font-weight: 500;
  margin: 0;
}

/* Sidebar Info */
.info-card {
  background: #fff;
  border-radius: 16px;
  padding: 1.5rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.info-card h3 {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
  margin: 0 0 1rem 0;
  font-weight: 600;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 0;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.info-item dt {
  color: #6b7280;
}

.info-item dd {
  font-weight: 500;
  color: #111827;
  max-width: 150px;
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Breadcrumb */
.demo__breadcrumb-nav {
  margin-bottom: 0.25rem;
}

.demo__breadcrumb-list {
  display: flex;
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.demo__breadcrumb-list li:not(:last-child)::after {
  content: "/";
  margin: 0 0.5rem;
  color: #9ca3af;
}

/* Loading & Animations */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: #6b7280;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.ai-playground {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #f3f4f6;
}

.ai-playground h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 1rem 0;
}

.ai-response {
  margin-top: 1rem;
  padding: 1rem;
  background: #f0f9ff;
  border-radius: 8px;
  border: 1px solid #bae6fd;
  color: #0c4a6e;
  font-size: 0.95rem;
  white-space: pre-wrap;
}
</style>

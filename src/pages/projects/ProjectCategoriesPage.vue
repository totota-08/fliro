<script setup lang="ts">
import DashboardSidebar from '@/components/projectDashboard/DashboardSidebar.vue'
import { appName } from '@/constants/appMeta'
import { ROUTE_NAMES } from '@/constants/routes'
import { db } from '@/lib/firebase'
import {
  addTaskCategory,
  deleteTaskCategory,
  listenTaskCategories,
  renameTaskCategory,
  type TaskCategory,
} from '@/services/taskCategoryService'
import { useAuthStore } from '@/store/auth'
import type { DashboardNavItem } from '@/types/projectDashboard'
import { doc, getDoc } from 'firebase/firestore'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const { user, profile } = useAuthStore()
const projectId = ref(String(route.params.projectId || ''))
const categories = ref<TaskCategory[]>([])
const newCategory = ref('')
const isSidebarOpen = ref(true)
const canEdit = ref(false)

let stopCategories: (() => void) | null = null

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
      key: 'categories',
      label: 'カテゴリ',
      to: { name: ROUTE_NAMES.projectCategories, params: { projectId: projectId.value } },
      icon: 'settings',
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

async function evaluatePermissions() {
  if (!user.value) {
    canEdit.value = false
    return
  }
  const memberSnap = await getDoc(doc(db, 'projects', projectId.value, 'members', user.value.uid))
  const data = memberSnap.data()
  canEdit.value = Boolean(data?.role === 'admin' || data?.projectRole === 'owner')
}

function watchCategories() {
  stopCategories = listenTaskCategories(projectId.value, (list) => {
    categories.value = list
  })
}

async function createCategory() {
  if (!canEdit.value || !newCategory.value.trim()) return
  await addTaskCategory(projectId.value, newCategory.value.trim())
  newCategory.value = ''
}

async function renameCategoryInline(category: TaskCategory) {
  if (!canEdit.value) return
  const name = prompt('カテゴリ名を変更', category.name)
  if (!name || name.trim() === category.name) return
  await renameTaskCategory(projectId.value, category.id, name.trim())
}

async function removeCategory(category: TaskCategory) {
  if (!canEdit.value) return
  if (!confirm(`「${category.name}」を削除しますか？`)) return
  await deleteTaskCategory(projectId.value, category.id)
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
  evaluatePermissions()
  watchCategories()
})

watch(
  () => route.params.projectId,
  (newId) => {
    if (!newId) return
    projectId.value = String(newId)
    evaluatePermissions()
    stopCategories?.()
    watchCategories()
  },
)

onBeforeUnmount(() => {
  stopCategories?.()
})
</script>

<template>
  <div :class="['category-shell', { 'category-shell--sidebar-collapsed': !isSidebarOpen }]">
    <DashboardSidebar
      :open="isSidebarOpen"
      :nav-items="navItems"
      :projects="[]"
      :profile="profileInfo"
      brand-subtitle="カテゴリ"
      @close="closeSidebar"
    />
    <div v-if="isSidebarOpen" class="category-shell__overlay" @click="closeSidebar" />

    <main class="category-shell__main">
      <header class="category-shell__topbar">
        <div class="category-shell__topbar-left">
          <button type="button" class="category-shell__menu-button" @click="toggleSidebar">
            <span class="sr-only">サイドバーを切り替え</span>
            <svg aria-hidden="true" class="category-shell__menu-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <p class="category-shell__breadcrumb">プロジェクト &gt; カテゴリ</p>
            <h1 class="category-shell__heading">カテゴリ管理</h1>
          </div>
        </div>
      </header>

      <div class="category-content">
        <div class="guard" v-if="!canEdit">
          <p class="guard__title">管理者のみ編集できます</p>
          <p class="guard__desc">閲覧はできますが、追加・編集・削除はできません。</p>
        </div>

        <section class="category-card">
          <header class="category-card__header">
            <div>
              <p class="eyebrow">カテゴリ</p>
              <h2>タスクカテゴリの追加・編集</h2>
            </div>
            <div class="category-card__actions">
              <input v-model="newCategory" type="text" placeholder="カテゴリ名" :disabled="!canEdit" />
              <button type="button" :disabled="!canEdit || !newCategory.trim()" @click="createCategory">追加</button>
            </div>
          </header>

          <ul class="category-list">
            <li v-for="category in categories" :key="category.id" class="category-item">
              <div>
                <p class="category-item__name">{{ category.name }}</p>
                <p class="category-item__meta">ID: {{ category.id }}</p>
              </div>
              <div class="category-item__actions" v-if="canEdit">
                <button type="button" class="ghost" @click="renameCategoryInline(category)">名称変更</button>
                <button type="button" class="danger" @click="removeCategory(category)">削除</button>
              </div>
            </li>
            <li v-if="!categories.length" class="category-item category-item--empty">カテゴリがまだありません。</li>
          </ul>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
@import '@/pages/demo/styles/demo-shell.css';

.category-shell {
  display: flex;
  min-height: 100vh;
  background: #f6f8fa;
}

.category-shell__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.18);
}

.category-shell__main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.category-shell__topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
}

.category-shell__topbar-left {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.category-shell__breadcrumb {
  margin: 0;
  color: var(--text-muted);
}

.category-shell__heading {
  margin: 0;
}

.category-shell__menu-button {
  border: none;
  border-radius: 0.75rem;
  background: #fff;
  padding: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.category-shell__menu-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.category-content {
  padding: 0 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 720px;
}

.category-card {
  background: #fff;
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 1rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.category-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.category-card__actions {
  display: flex;
  gap: 0.5rem;
}

.category-card__actions input {
  border: 1px solid #d5dde5;
  border-radius: 0.9rem;
  padding: 0.65rem 0.85rem;
  background: #f8fafc;
}

.category-card__actions button {
  border: none;
  border-radius: 0.9rem;
  padding: 0.65rem 1rem;
  background: #0b2e33;
  color: #fff;
  cursor: pointer;
}

.category-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.category-item {
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 0.9rem;
  padding: 0.75rem 0.9rem;
  background: #fdfefe;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-item--empty {
  justify-content: center;
  color: var(--text-muted);
}

.category-item__name {
  margin: 0;
  font-weight: 700;
}

.category-item__meta {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
}

.category-item__actions {
  display: flex;
  gap: 0.5rem;
}

.category-item__actions .ghost {
  border: 1px solid #d5dde5;
  background: #fff;
  padding: 0.4rem 0.75rem;
  border-radius: 0.65rem;
  cursor: pointer;
}

.category-item__actions .danger {
  border: 1px solid #d64545;
  background: #fff;
  color: #d64545;
  padding: 0.4rem 0.75rem;
  border-radius: 0.65rem;
  cursor: pointer;
}

.guard {
  border: 1px solid #f59e0b44;
  background: #fff7ed;
  border-radius: 0.9rem;
  padding: 0.75rem 1rem;
}

.guard__title {
  margin: 0;
  font-weight: 700;
  color: #b45309;
}

.guard__desc {
  margin: 0.15rem 0 0;
  color: #92400e;
}

.eyebrow {
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0;
  font-size: 0.8rem;
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
  .category-shell__topbar {
    padding: 1rem;
  }

  .category-content {
    padding: 0 1rem 2rem;
  }

  .category-card__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

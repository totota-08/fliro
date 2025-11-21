<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { collection, doc, getDocs, onSnapshot } from 'firebase/firestore'
import DashboardSidebar from '@/components/projectDashboard/DashboardSidebar.vue'
import { db } from '@/firebase/config'
import { useAuthStore } from '@/store/auth'
import { ROUTE_NAMES } from '@/constants/routes'
import type { ProjectDoc } from '@/types/project'
import type { DashboardNavItem } from '@/types/projectDashboard'
import ProjectInviteForm from '@/components/projects/ProjectInviteForm.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { removeProjectMember } from '@/services/projectMembers'
type MemberRole = 'owner' | 'admin' | 'member' | 'viewer'
type MemberDisplay = {
  id: string
  userId: string
  role: MemberRole
  displayName: string
  email?: string
  avatarUrl?: string
  statusLabel: string
  statusClass: 'online' | 'away' | 'offline'
  lastAccessedAt?: { seconds: number; nanoseconds: number }
}

const route = useRoute()
const { user, profile } = useAuthStore()
const projectId = ref(String(route.params.projectId || ''))
const project = ref<ProjectDoc | null>(null)
const projectList = ref<{ id: string; name: string }[]>([])
const members = ref<MemberDisplay[]>([])
const removingMemberId = ref('')
const isSidebarOpen = ref(true)
const latestInviteLink = ref('')
const inviteNotification = ref('')
const memberActionError = ref('')

let stopProject: (() => void) | null = null
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

const memberStats = computed(() => {
  const total = members.value.length
  const adminCount = members.value.filter((member) => member.role === 'owner' || member.role === 'admin').length
  const online = members.value.filter((member) => member.statusClass === 'online').length
  return { total, adminCount, online }
})

const currentRole = computed<MemberRole | null>(() => {
  const currentId = user.value?.uid
  if (!currentId) return null
  return members.value.find((member) => member.userId === currentId)?.role ?? null
})
const canManageMembers = computed(() => currentRole.value === 'owner' || currentRole.value === 'admin')

async function loadProjectList() {
  if (!user.value) return
  const snap = await getDocs(collection(db, 'userProjects', user.value.uid, 'projects'))
  projectList.value = snap.docs.map((docSnap) => ({
    id: docSnap.id,
    name: (docSnap.data().projectName as string) || 'Project',
  }))
}

function watchProject() {
  stopProject = onSnapshot(doc(db, 'projects', projectId.value), (snapshot) => {
    if (!snapshot.exists()) return
    project.value = snapshot.data() as ProjectDoc
  })

  stopMembers = onSnapshot(collection(db, 'projects', projectId.value, 'members'), (snapshot) => {
    const list = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as any
      const userId = data.userId || docSnap.id
      const role: MemberRole = data.role || 'member'
      const statusLabel = getStatusLabel(data.lastAccessedAt)
      return {
        id: docSnap.id,
        userId,
        role,
        displayName: data.nickname || data.fullName || `メンバー ${userId.slice(-4)}`,
        email: data.email || null,
        avatarUrl: data.avatarUrl || null,
        statusLabel,
        statusClass: getStatusClass(statusLabel),
        lastAccessedAt: data.lastAccessedAt,
      } satisfies MemberDisplay
    })
    const rank: Record<MemberRole, number> = { owner: 0, admin: 1, member: 2, viewer: 3 }
    members.value = list.sort((a, b) => rank[a.role] - rank[b.role])
  })
}

function resetWatchers() {
  stopProject?.()
  stopMembers?.()
  watchProject()
}

function closeSidebar() {
  isSidebarOpen.value = false
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}

function scrollToInvite() {
  const target = document.getElementById('member-invite')
  target?.scrollIntoView({ behavior: 'smooth' })
}

function handleLinkGenerated(link: string) {
  latestInviteLink.value = link
  inviteNotification.value = '共有リンクを作成しました。リンクをコピーしてメンバーに共有してください。'
}

async function handleRemoveMember(member: MemberDisplay) {
  if (!canManageMembers.value) return
  if (member.role === 'owner' || member.userId === user.value?.uid) return
  if (!confirm(`「${member.displayName}」をプロジェクトから削除しますか？`)) return
  removingMemberId.value = member.userId
  try {
    await removeProjectMember(projectId.value, member.userId)
    memberActionError.value = ''
  } catch (error) {
    console.error(error)
    memberActionError.value = 'メンバーの削除に失敗しました。'
  } finally {
    removingMemberId.value = ''
  }
}

function getStatusLabel(timestamp?: { seconds: number }) {
  if (!timestamp?.seconds) return 'オフライン'
  const diff = Date.now() - timestamp.seconds * 1000
  if (diff < 1000 * 60 * 5) return 'オンライン'
  if (diff < 1000 * 60 * 60) return '離席中'
  return 'オフライン'
}

function getStatusClass(label: string): MemberDisplay['statusClass'] {
  if (label === 'オンライン') return 'online'
  if (label === '離席中') return 'away'
  return 'offline'
}

function getInitials(name: string) {
  if (!name) return '??'
  const trimmed = name.trim()
  return trimmed.length <= 2 ? trimmed : trimmed.slice(0, 2)
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
  stopProject?.()
  stopMembers?.()
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
            <p class="demo__breadcrumb">プロジェクト &gt; メンバー</p>
            <h1 class="demo__heading">{{ project?.name || 'プロジェクト' }}</h1>
          </div>
        </div>
      </header>

      <div class="demo__content demo__content--condensed">
        <section class="team-page">
          <header class="team-page__header">
            <div>
              <h2>チーム</h2>
              <p>メンバーの状態と権限をまとめて確認できます。</p>
            </div>
            <button type="button" class="team-page__invite" @click="scrollToInvite">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 5v14M5 12h14" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              メンバーを招待
            </button>
          </header>

          <div class="team-page__stats">
            <article>
              <p>総メンバー</p>
              <strong>{{ memberStats.total }}</strong>
            </article>
            <article>
              <p>管理者</p>
              <strong>{{ memberStats.adminCount }}</strong>
            </article>
            <article>
              <p>オンライン</p>
              <strong>{{ memberStats.online }}</strong>
            </article>
          </div>

          <ul class="team-member__list">
            <li v-for="member in members" :key="member.userId" class="team-member">
              <div class="team-member__persona">
                <div class="avatar" aria-hidden="true">
                  <span>{{ getInitials(member.displayName) }}</span>
                </div>
                <div>
                  <p class="team-member__name">{{ member.displayName }}</p>
                  <p class="team-member__email">{{ member.email || 'メール未登録' }}</p>
                </div>
              </div>

              <div class="team-member__details">
                <span class="badge" :class="`role-${member.role}`">{{ member.role }}</span>
                <span class="status-indicator" :class="`status-${member.statusClass}`">{{ member.statusLabel }}</span>
              </div>

              <div class="team-member__actions">
                <AppButton
                  v-if="canManageMembers && member.role !== 'owner' && member.userId !== user?.uid"
                  variant="outline"
                  :loading="removingMemberId === member.userId"
                  @click="handleRemoveMember(member)"
                >
                  削除
                </AppButton>
                <span v-else class="team-member__note">
                  {{ member.role === 'owner' ? 'オーナー' : 'アクセス権限なし' }}
                </span>
              </div>
            </li>
            <li v-if="!members.length" class="team-member team-member--empty">まだメンバーがいません。</li>
          </ul>
          <p v-if="memberActionError" class="team-member__error">{{ memberActionError }}</p>
        </section>

        <section id="member-invite" class="invite-panel">
          <header>
            <div>
              <h3>参加リンクを共有</h3>
              <p>リンクをコピーして共有すると、メンバーはこのプロジェクトに参加できます。</p>
            </div>
            <p class="invite-panel__hint">必要に応じてパスワードを設定してください。</p>
          </header>

          <ProjectInviteForm :project-id="projectId" @generated="handleLinkGenerated" />

          <p v-if="latestInviteLink" class="invite-panel__link">{{ latestInviteLink }}</p>
          <p v-if="inviteNotification" class="invite-panel__message">{{ inviteNotification }}</p>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '@/pages/demo/styles/demo-shell.css';

.team-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.team-page__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.team-page__header h2 {
  margin: 0;
}

.team-page__header p {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
}

.team-page__invite {
  border: none;
  border-radius: 0.9rem;
  padding: 0.65rem 1rem;
  display: inline-flex;
  gap: 0.5rem;
  align-items: center;
  background: #0b2e33;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.team-page__invite svg {
  width: 1.25rem;
  height: 1.25rem;
}

.team-page__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.team-page__stats article {
  border-radius: 1rem;
  border: 1px solid rgba(11, 46, 51, 0.08);
  padding: 1rem;
  background: #fff;
}

.team-page__stats p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.team-page__stats strong {
  font-size: 2rem;
  color: #0b2e33;
}

.team-member__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.team-member {
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 1.25rem;
  padding: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  background: #fff;
}

.team-member--empty {
  justify-content: center;
  color: var(--text-muted);
}

.team-member__persona {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  min-width: 240px;
  flex: 1;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: rgba(79, 124, 130, 0.15);
  color: #0b2e33;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.team-member__name {
  margin: 0;
  font-weight: 600;
}

.team-member__email {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.team-member__details {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.badge {
  border-radius: 999px;
  padding: 0.2rem 0.75rem;
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: capitalize;
}

.badge.role-owner {
  background: rgba(11, 46, 51, 0.1);
  color: #0b2e33;
}

.badge.role-admin {
  background: rgba(79, 124, 130, 0.2);
  color: #0b2e33;
}

.badge.role-member,
.badge.role-viewer {
  background: rgba(11, 46, 51, 0.05);
  color: #496167;
}

.status-indicator {
  font-size: 0.85rem;
  font-weight: 600;
}

.status-indicator.status-online {
  color: #1d9160;
}

.status-indicator.status-away {
  color: #b07816;
}

.status-indicator.status-offline {
  color: #9da8b6;
}

.team-member__actions {
  margin-left: auto;
}

.team-member__note {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.team-member__error {
  margin: 0.5rem 0 0;
  color: #d64545;
  font-weight: 600;
}

.invite-panel {
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 1.25rem;
  padding: 1.5rem;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.invite-panel__hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.invite-panel__link {
  border: 1px solid #b8e3e9;
  border-radius: 0.85rem;
  padding: 0.75rem 1rem;
  background: #f5fbfb;
  word-break: break-all;
  font-size: 0.9rem;
  color: #0b2e33;
}

.invite-panel__actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.invite-panel__message {
  color: #0b2e33;
  margin: 0;
  font-weight: 600;
}

.invite-panel__error {
  color: #d64545;
  margin: 0;
  font-weight: 600;
}

@media (max-width: 768px) {
  .team-page__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .team-member {
    flex-direction: column;
    align-items: flex-start;
  }

  .team-member__actions {
    margin-left: 0;
  }
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ROUTE_NAMES } from '@/constants/routes'
import type { DashboardNavItem, DashboardProfileInfo, DashboardProjectItem } from '@/types/projectDashboard'

type NavItem = DashboardNavItem & { active: boolean }

const props = withDefaults(
  defineProps<{
    open: boolean
    navItems?: DashboardNavItem[]
    projects?: DashboardProjectItem[]
    profile?: DashboardProfileInfo
    brandSubtitle?: string
  }>(),
  {
    navItems: () =>
      [
        { key: 'dashboard', label: 'ダッシュボード', to: '/demo/dashboard', icon: 'dashboard' },
        { key: 'tasks', label: 'マイタスク', to: '/demo/tasks', icon: 'tasks' },
        { key: 'team', label: 'チーム', to: '/demo/team', icon: 'team' },
        { key: 'members', label: 'メンバー', to: '/demo/team', icon: 'members' },
        { key: 'settings', label: '設定', icon: 'settings', disabled: true },
      ] satisfies DashboardNavItem[],
    projects: () =>
      [
        { key: 'web', label: 'Webサイトリニューアル', accent: 'primary' },
        { key: 'mobile', label: 'モバイルアプリ開発', accent: 'secondary' },
        { key: 'marketing', label: 'マーケティングキャンペーン', accent: 'accent' },
      ] satisfies DashboardProjectItem[],
    profile: () => ({ name: '田中太郎', email: 'tanaka@example.com' } satisfies DashboardProfileInfo),
    brandSubtitle: 'デモ体験',
  },
)

const emit = defineEmits<{
  (e: 'close'): void
}>()

const route = useRoute()

const currentSection = computed(() => {
  if (typeof route.meta.section === 'string') {
    return route.meta.section as DashboardNavItem['key']
  }

  if (typeof route.name === 'string' && route.name.startsWith('demo.')) {
    return route.name.split('.')[1] as DashboardNavItem['key']
  }

  if (typeof route.name === 'string' && route.name.startsWith('demo-')) {
    return route.name.split('-')[1] as DashboardNavItem['key']
  }

  return undefined
})

const navigationItems = computed<NavItem[]>(() =>
  props.navItems.map((item) => {
    const matchesPath = typeof item.to === 'string' ? route.path.startsWith(item.to) : false
    return {
      ...item,
      active: currentSection.value === item.key || matchesPath,
    }
  }),
)

const rootClasses = computed(() => ['sidebar', { 'is-hidden': !props.open, 'is-open': props.open }])

const handleClose = () => emit('close')

const handleNavigate = () => {
  if (window.matchMedia('(max-width: 1200px)').matches) {
    emit('close')
  }
}
</script>

<template>
  <aside :class="rootClasses">
    <div class="sidebar__header">
      <div class="sidebar__brand">
        <div class="sidebar__logo">Teamie</div>
        <p class="sidebar__subtitle">{{ props.brandSubtitle }}</p>
      </div>
      <button type="button" class="sidebar__toggle" @click="handleClose">
        <span aria-hidden="true">X</span>
        <span class="sr-only">サイドバーを閉じる</span>
      </button>
    </div>

    <nav class="sidebar__nav">
      <p class="sidebar__section">ナビゲーション</p>
      <ul>
        <li v-for="item in navigationItems" :key="item.key">
          <RouterLink
            v-if="item.to && !item.disabled"
            :to="item.to"
            class="sidebar__nav-button"
            :class="{ 'is-active': item.active }"
            @click="handleNavigate"
          >
            <span class="sidebar__nav-icon" aria-hidden="true">
              <svg v-if="item.icon === 'dashboard'" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M4 12h16M12 4v16"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
              </svg>
              <svg v-else-if="item.icon === 'tasks'" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M5 6h14M5 12h14M5 18h8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
              </svg>
              <svg v-else-if="item.icon === 'team'" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M7 17c0-2.21 1.79-4 4-4h2c2.21 0 4 1.79 4 4M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
              </svg>
              <svg v-else-if="item.icon === 'members'" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.6"
                />
                <path
                  d="M18 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.4"
                />
                <path
                  d="M15 21v-3a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
                <path
                  d="M22 21v-2.5A3.5 3.5 0 0 0 18.5 15H15"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.4"
                />
              </svg>
              <svg v-else-if="item.icon === 'settings'" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .69.28 1.35.76 1.84.48.49 1.15.76 1.84.76H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.3"
                />
              </svg>
            </span>
            {{ item.label }}
          </RouterLink>
          <button
            v-else
            type="button"
            class="sidebar__nav-button is-disabled"
            :title="item.tooltip || '近日公開'"
            aria-disabled="true"
            disabled
          >
            <span class="sidebar__nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .69.28 1.35.76 1.84.48.49 1.15.76 1.84.76H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.3"
                />
              </svg>
            </span>
            {{ item.label }}
          </button>
        </li>
      </ul>
    </nav>

    <div class="sidebar__projects">
      <div class="sidebar__projects-header">
        <p class="sidebar__section">プロジェクト</p>
        <button type="button" class="sidebar__add" aria-label="プロジェクトを追加">+</button>
      </div>
      <ul>
        <li v-for="project in props.projects" :key="project.key">
          <component
            :is="project.to ? RouterLink : 'span'"
            class="sidebar__project-link"
            :to="project.to"
            @click="project.to ? handleNavigate() : undefined"
          >
            <span class="dot" :class="project.accent ? `dot--${project.accent}` : 'dot--primary'" />
            {{ project.label }}
          </component>
        </li>
      </ul>
    </div>

    <RouterLink
      :to="{ name: ROUTE_NAMES.myPage }"
      class="sidebar__profile"
      @click="handleNavigate"
    >
      <div class="avatar">{{ props.profile?.name?.charAt(0) || 'T' }}</div>
      <div>
        <p class="profile__name">{{ props.profile?.name }}</p>
        <p class="profile__mail">{{ props.profile?.email }}</p>
      </div>
    </RouterLink>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 260px;
  height: 100vh;
  background: #0b2e33;
  color: #f1f7f8;
  padding: 2rem 1.5rem;
  gap: 2rem;
  overflow-y: auto;
  flex-shrink: 0;
  opacity: 1;
  transition: opacity 0.25s ease, transform 0.3s ease;
}

@supports (height: 100dvh) {
  .sidebar {
    height: 100dvh;
  }
}

.sidebar.is-hidden {
  opacity: 0;
  pointer-events: none;
}

.sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.sidebar__brand {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sidebar__logo {
  font-weight: 700;
  font-size: 1.4rem;
  letter-spacing: 0.05em;
}

.sidebar__subtitle {
  font-size: 0.85rem;
  color: rgba(245, 252, 255, 0.7);
}

.sidebar__toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.6rem;
  border: 1px solid rgba(245, 252, 255, 0.2);
  background: transparent;
  color: rgba(245, 252, 255, 0.75);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.sidebar__toggle:hover {
  background: rgba(184, 227, 233, 0.12);
  color: #f5fcff;
  border-color: rgba(245, 252, 255, 0.35);
}

.sidebar__section {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(245, 252, 255, 0.6);
  margin-bottom: 0.75rem;
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sidebar__nav ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sidebar__nav-button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.65rem 0.9rem;
  border-radius: 0.85rem;
  background: transparent;
  border: 1px solid transparent;
  color: rgba(245, 252, 255, 0.85);
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  text-decoration: none;
}

.sidebar__nav-button:hover {
  background: rgba(184, 227, 233, 0.12);
  border-color: rgba(184, 227, 233, 0.2);
}

.sidebar__nav-button.is-active {
  background: rgba(184, 227, 233, 0.95);
  color: #0b2e33;
  border-color: rgba(184, 227, 233, 0.95);
  box-shadow: 0 12px 24px rgba(11, 46, 51, 0.18);
}

.sidebar__nav-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.65rem;
  background: rgba(245, 252, 255, 0.12);
  color: inherit;
}

.sidebar__nav-icon svg {
  width: 1.1rem;
  height: 1.1rem;
}

.sidebar__nav-button.is-active .sidebar__nav-icon {
  background: rgba(79, 124, 130, 0.16);
  color: #0b2e33;
}

.sidebar__nav-button.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.sidebar__projects {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sidebar__projects-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar__add {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.6rem;
  border: 1px solid rgba(245, 252, 255, 0.25);
  background: transparent;
  color: rgba(245, 252, 255, 0.85);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.sidebar__add:hover {
  background: rgba(184, 227, 233, 0.18);
  color: #f5fcff;
  border-color: rgba(245, 252, 255, 0.4);
}

.sidebar__projects ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.sidebar__projects li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  border-radius: 0.8rem;
  font-size: 0.9rem;
  color: rgba(245, 252, 255, 0.8);
  transition: background 0.2s ease;
}

.sidebar__project-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  color: inherit;
  text-decoration: none;
}

.sidebar__projects li:hover {
  background: rgba(184, 227, 233, 0.12);
}

.dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: rgba(245, 252, 255, 0.8);
  flex-shrink: 0;
}

.dot--primary {
  background: #b8e3e9;
}

.dot--secondary {
  background: #93b1b5;
}

.dot--accent {
  background: #4f7c82;
}

.sidebar__profile {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.9rem;
  border-radius: 0.8rem;
  background: rgba(79, 124, 130, 0.16);
  backdrop-filter: blur(10px);
  position: sticky;
  bottom: 1rem;
  text-decoration: none;
  color: inherit;
  transition: background 0.2s ease, transform 0.2s ease;
}

.sidebar__profile:hover {
  background: rgba(184, 227, 233, 0.28);
  transform: translateY(-1px);
}


.avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%; /* ここを丸にする */
  background: rgba(184, 227, 233, 0.9);
  color: #0b2e33;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0; /* ← これで flex で潰されないようにする */
}


.profile__name {
  font-size: 0.85rem;
}

.profile__mail {
  font-size: 0.7rem;
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

@media (max-width: 1200px) {
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 40;
    box-shadow: 0 28px 48px rgba(11, 46, 51, 0.32);
    transform: translateX(-110%);
    opacity: 0;
  }

  .sidebar.is-open {
    transform: translateX(0);
    opacity: 1;
  }

  .sidebar__toggle {
    display: inline-flex;
  }
}

@media (max-width: 960px) {
  .sidebar {
    max-width: 240px;
  }
}
</style>

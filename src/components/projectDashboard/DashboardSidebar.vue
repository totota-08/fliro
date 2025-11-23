<script setup lang="ts">
import SidebarUserProfile from '@/components/common/SidebarUserProfile.vue'
import type { DashboardNavItem, DashboardProfileInfo, DashboardProjectItem } from '@/types/projectDashboard'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

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

    <SidebarUserProfile :profile="props.profile" @click="handleNavigate" />
  </aside>
</template>

<style scoped src="@/components/common/sidebar.css"></style>

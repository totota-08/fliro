<script setup lang="ts">
/**
 * ProjectAppShell - プロジェクトコンテキスト用のアプリシェル
 *
 * 左サイドバー + メイン領域 + モバイルオーバーレイ
 * UIトークンを使用した統一されたレイアウト
 */
import DashboardSidebar from "@/components/projectDashboard/DashboardSidebar.vue";
import { useSidebarState } from "@/composables/useSidebarState";
import type {
  DashboardNavItem,
  DashboardProfileInfo,
  DashboardProjectItem,
} from "@/types/projectDashboard";
import { computed } from "vue";

type ShellProfileInfo = {
  name: string;
  email?: string;
  avatar?: string;
};

const props = withDefaults(
  defineProps<{
    projectId: string;
    brandSubtitle?: string;
    navItems: DashboardNavItem[];
    sidebarProjects: DashboardProjectItem[];
    profileInfo: ShellProfileInfo;
  }>(),
  {
    brandSubtitle: "プロジェクト",
  },
);

const { isSidebarOpen, toggleSidebar, closeSidebar } = useSidebarState();

const normalizedProfile = computed<DashboardProfileInfo>(() => ({
  name: props.profileInfo.name,
  email: props.profileInfo.email ?? "",
  avatar: props.profileInfo.avatar,
}));
</script>

<template>
  <div
    :class="[
      'project-app-shell',
      { 'project-app-shell--sidebar-collapsed': !isSidebarOpen },
    ]"
    :data-project-id="props.projectId"
  >
    <DashboardSidebar
      :open="isSidebarOpen"
      :nav-items="props.navItems"
      :projects="props.sidebarProjects"
      :profile="normalizedProfile"
      :brand-subtitle="props.brandSubtitle"
      @close="closeSidebar"
    />
    <div
      v-if="isSidebarOpen"
      class="project-app-shell__overlay"
      @click="closeSidebar"
    />

    <main class="project-app-shell__main">
      <header class="project-app-shell__topbar">
        <div class="project-app-shell__topbar-left">
          <button
            type="button"
            class="project-app-shell__menu-button"
            aria-label="サイドバーを切り替え"
            @click="toggleSidebar"
          >
            <svg
              aria-hidden="true"
              class="project-app-shell__menu-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <div class="project-app-shell__title">
            <slot name="headerTitle" />
          </div>
        </div>
        <div v-if="$slots.headerActions" class="project-app-shell__actions">
          <slot name="headerActions" />
        </div>
      </header>

      <div
        :class="[
          'project-app-shell__body',
          { 'project-app-shell__body--split': $slots.rightPanel },
        ]"
      >
        <div class="project-app-shell__body-main">
          <slot />
        </div>
        <aside v-if="$slots.rightPanel" class="project-app-shell__body-panel">
          <slot name="rightPanel" />
        </aside>
      </div>
    </main>
  </div>
</template>

<style scoped>
.project-app-shell {
  --shell-sidebar-width: var(--ui-sidebar-width, 260px);

  display: grid;
  grid-template-columns: var(--shell-sidebar-width) minmax(0, 1fr);
  width: 100%;
  height: 100vh;
  gap: 0;
  background: var(--ui-surface-muted, #f1f5f9);
}

.project-app-shell--sidebar-collapsed {
  --shell-sidebar-width: 0px;
}

@supports (height: 100dvh) {
  .project-app-shell {
    height: 100dvh;
  }
}

.project-app-shell__overlay {
  display: none;
}

.project-app-shell__main {
  display: flex;
  flex-direction: column;
  background: var(--ui-bg, #f5fcff);
  border-left: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  height: 100vh;
  overflow-y: auto;
}

@supports (height: 100dvh) {
  .project-app-shell__main {
    height: 100dvh;
  }
}

.project-app-shell__topbar {
  position: sticky;
  top: 0;
  z-index: var(--ui-z-sticky, 20);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-6, 1.5rem);
  min-height: var(--ui-topbar-height, 64px);
  padding: 0 var(--ui-space-6, 1.5rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  background: rgba(245, 252, 255, 0.95);
  backdrop-filter: blur(6px);
}

.project-app-shell__topbar-left {
  display: flex;
  align-items: center;
  gap: var(--ui-space-5, 1.25rem);
}

.project-app-shell__menu-button {
  display: none;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  background: transparent;
  color: var(--ui-brand-900, #0b2e33);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.project-app-shell__menu-button:hover {
  background: var(--ui-brand-100, #e5f6f8);
  border-color: var(--ui-border-strong, rgba(11, 46, 51, 0.2));
  box-shadow: var(--ui-shadow-md);
}

.project-app-shell__menu-button:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

.project-app-shell__menu-icon {
  width: 1.4rem;
  height: 1.4rem;
}

.project-app-shell__actions {
  display: flex;
  gap: var(--ui-space-3, 0.75rem);
  align-items: center;
}

.project-app-shell__body {
  flex: 1;
  min-height: 0;
  padding: var(--ui-space-6, 1.5rem);
}

.project-app-shell__body--split {
  display: grid;
  gap: var(--ui-space-6, 1.5rem);
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.9fr);
  align-items: start;
}

.project-app-shell__body-main {
  min-width: 0;
}

.project-app-shell__body-panel {
  min-width: 0;
  position: sticky;
  top: calc(var(--ui-topbar-height, 64px) + var(--ui-space-6, 1.5rem));
}

/* Header Title Styles */
:deep(.project-app-shell__breadcrumb) {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

:deep(.project-app-shell__heading) {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-xl, 1.25rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

/* Responsive */
@media (max-width: 1200px) {
  .project-app-shell {
    --shell-sidebar-width: 0px;
    grid-template-columns: minmax(0, 1fr);
  }

  .project-app-shell__overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: var(--ui-surface-overlay, rgba(0, 0, 0, 0.35));
    backdrop-filter: blur(2px);
    z-index: var(--ui-z-sidebar, 30);
  }

  .project-app-shell__menu-button {
    display: inline-flex;
  }

  .project-app-shell__topbar {
    gap: var(--ui-space-4, 1rem);
  }

  .project-app-shell__body {
    padding: var(--ui-space-4, 1rem);
  }

  .project-app-shell__body--split {
    grid-template-columns: minmax(0, 1fr);
  }

  .project-app-shell__body-panel {
    position: static;
  }
}

@media (max-width: 768px) {
  .project-app-shell__body {
    padding: var(--ui-space-3, 0.75rem);
  }
}
</style>

<script setup lang="ts">
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
            @click="toggleSidebar"
          >
            <span class="sr-only">サイドバーを切り替え</span>
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
  --sidebar-width: 260px;
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  width: 100%;
  height: 100vh;
  gap: 0;
  background: var(--surface-muted);
}

.project-app-shell--sidebar-collapsed {
  --sidebar-width: 0px;
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
  background: var(--surface-elevated, #f5fcff);
  border-left: 1px solid rgba(11, 46, 51, 0.08);
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
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  min-height: 4rem;
  padding: 0 1.75rem;
  border-bottom: 1px solid rgba(11, 46, 51, 0.08);
  background: rgba(245, 252, 255, 0.95);
  backdrop-filter: blur(6px);
}

.project-app-shell__topbar-left {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.project-app-shell__menu-button {
  display: none;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(11, 46, 51, 0.12);
  background: transparent;
  color: var(--primary-strong);
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.project-app-shell__menu-button:hover {
  background: rgba(184, 227, 233, 0.2);
  border-color: rgba(11, 46, 51, 0.18);
  box-shadow: 0 8px 18px rgba(11, 46, 51, 0.12);
}

.project-app-shell__menu-icon {
  width: 1.4rem;
  height: 1.4rem;
}

.project-app-shell__actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.project-app-shell__body {
  flex: 1;
  min-height: 0;
}

.project-app-shell__body--split {
  display: grid;
  gap: 1.75rem;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.9fr);
  align-items: start;
}

.project-app-shell__body-main {
  min-width: 0;
}

.project-app-shell__body-panel {
  min-width: 0;
}

:deep(.project-app-shell__breadcrumb) {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

:deep(.project-app-shell__heading) {
  margin: 0.35rem 0 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-strong);
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
  .project-app-shell {
    --sidebar-width: 0px;
    grid-template-columns: minmax(0, 1fr);
  }

  .project-app-shell__overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(11, 46, 51, 0.45);
    backdrop-filter: blur(2px);
    z-index: 30;
  }

  .project-app-shell__menu-button {
    display: inline-flex;
  }

  .project-app-shell__topbar {
    gap: 1rem;
  }

  .project-app-shell__body--split {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<script setup lang="ts">
/**
 * ProjectLayout - プロジェクトページの共有レイアウト
 *
 * ネストされたルートで使用し、サイドバーを共有することで
 * ページ遷移時の再描画を防ぐ
 */
import DashboardSidebar from "@/components/projectDashboard/DashboardSidebar.vue";
import MobileBottomNav from "@/components/mobile/MobileBottomNav.vue";
import TaskCreateModal, {
  type TaskFormData,
} from "@/components/tasks/TaskCreateModal.vue";
import { useSidebarState } from "@/composables/useSidebarState";
import {
  useTaskCreateModal,
  useTaskCreateData,
} from "@/composables/useTaskCreateModal";
import { useProjectShellData } from "@/composables/useProjectShellData";
import { providePageTitle } from "@/composables/usePageTitle";
import { createTask } from "@/services/taskService";
import { useAuthStore } from "@/store/auth";
import type { DashboardProfileInfo } from "@/types/projectDashboard";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const projectId = ref(String(route.params.projectId || ""));

// プロジェクトIDの変更を監視
watch(
  () => route.params.projectId,
  (newId) => {
    if (newId) {
      projectId.value = String(newId);
    }
  },
);

// サイドバーの状態
const { isSidebarOpen, toggleSidebar, closeSidebar } = useSidebarState();

// ページタイトル（各ページから設定される）
const { title: pageTitle, subtitle: pageSubtitle } = providePageTitle();

// ProjectAppShell用のデータを取得
const { navItems, sidebarProjects, profileInfo } =
  useProjectShellData(projectId);

const normalizedProfile = computed<DashboardProfileInfo>(() => ({
  name: profileInfo.value.name,
  email: profileInfo.value.email ?? "",
  avatar: profileInfo.value.avatar,
}));

// Mobile bottom nav items
const mobileNavItems = computed(() => [
  {
    name: "dashboard",
    label: "ホーム",
    icon: "home",
    to: { name: "project-dashboard", params: { projectId: projectId.value } },
  },
  {
    name: "tasks",
    label: "タスク",
    icon: "tasks",
    to: { name: "my-tasks" },
  },
  {
    name: "team",
    label: "チーム",
    icon: "users",
    to: { name: "project-members", params: { projectId: projectId.value } },
  },
  {
    name: "settings",
    label: "設定",
    icon: "settings",
    to: { name: "project-settings", params: { projectId: projectId.value } },
  },
]);

// Task create modal
const { isTaskModalOpen, openTaskModal, closeTaskModal } = useTaskCreateModal({
  enableKeyboard: true,
});
const { categories, members } = useTaskCreateData(projectId);
const { user, profile } = useAuthStore();

async function handleTaskSubmit(data: TaskFormData) {
  if (!user.value) return;
  try {
    await createTask(
      projectId.value,
      {
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        categoryId: data.categoryId || null,
        assigneeId: data.assigneeId || null,
        progress: data.progress,
      },
      user.value.uid,
      {
        actorName:
          profile.value?.nickname || profile.value?.fullName || "Unknown",
      },
    );
    closeTaskModal();
  } catch {
    // Error handling is done in the service
  }
}
</script>

<template>
  <div
    :class="[
      'project-layout',
      { 'project-layout--sidebar-collapsed': !isSidebarOpen },
    ]"
    :data-project-id="projectId"
  >
    <DashboardSidebar
      :open="isSidebarOpen"
      :nav-items="navItems"
      :projects="sidebarProjects"
      :profile="normalizedProfile"
      brand-subtitle="プロジェクト"
      @close="closeSidebar"
    />
    <div
      v-if="isSidebarOpen"
      class="project-layout__overlay"
      @click="closeSidebar"
    />

    <main class="project-layout__main">
      <header class="project-layout__topbar">
        <div class="project-layout__topbar-left">
          <button
            type="button"
            class="project-layout__menu-button"
            aria-label="サイドバーを切り替え"
            @click="toggleSidebar"
          >
            <svg
              aria-hidden="true"
              class="project-layout__menu-icon"
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
          <div class="project-layout__title-group">
            <h1 v-if="pageTitle" class="project-layout__page-title">
              {{ pageTitle }}
            </h1>
            <p v-if="pageSubtitle" class="project-layout__page-subtitle">
              {{ pageSubtitle }}
            </p>
          </div>
        </div>
        <div class="project-layout__actions">
          <button
            type="button"
            class="project-layout__add-task-btn"
            aria-label="新規タスクを作成"
            @click="openTaskModal"
          >
            <svg
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span class="project-layout__add-task-label">タスク</span>
          </button>
        </div>
      </header>

      <div class="project-layout__body">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </div>
    </main>

    <!-- Mobile Bottom Navigation -->
    <MobileBottomNav
      :items="mobileNavItems"
      class="project-layout__bottom-nav"
    />

    <!-- Task Create Modal -->
    <Teleport to="body">
      <TaskCreateModal
        :open="isTaskModalOpen"
        :categories="categories"
        :members="members"
        @close="closeTaskModal"
        @submit="handleTaskSubmit"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.project-layout {
  --shell-sidebar-width: var(--ui-sidebar-width, 260px);

  display: grid;
  grid-template-columns: var(--shell-sidebar-width) minmax(0, 1fr);
  width: 100%;
  height: 100vh;
  gap: 0;
  background: var(--ui-surface-muted, #f1f5f9);
}

.project-layout--sidebar-collapsed {
  --shell-sidebar-width: 0px;
}

@supports (height: 100dvh) {
  .project-layout {
    height: 100dvh;
  }
}

.project-layout__overlay {
  display: none;
}

.project-layout__main {
  display: flex;
  flex-direction: column;
  background: var(--ui-bg, #f5fcff);
  border-left: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  height: 100vh;
  overflow-y: auto;
}

@supports (height: 100dvh) {
  .project-layout__main {
    height: 100dvh;
  }
}

.project-layout__topbar {
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

.project-layout__topbar-left {
  display: flex;
  align-items: center;
  gap: var(--ui-space-5, 1.25rem);
}

.project-layout__menu-button {
  display: none;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--ui-radius-lg, 1rem);
  border: none;
  background: var(--ui-brand-900, #0b2e33);
  color: var(--ui-surface, #ffffff);
  cursor: pointer;
  transition: var(--ui-transition-all);
  box-shadow: var(--ui-shadow-sm);
  flex-shrink: 0;
}

.project-layout__menu-button:hover {
  background: var(--ui-brand-800, #134e4a);
  box-shadow: var(--ui-shadow-md);
  transform: scale(1.02);
}

.project-layout__menu-button:active {
  transform: scale(0.98);
}

.project-layout__menu-button:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

.project-layout__menu-icon {
  width: 1.25rem;
  height: 1.25rem;
  stroke-width: 2.5;
}

.project-layout__title-group {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.project-layout__page-title {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-layout__page-subtitle {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-layout__actions {
  display: flex;
  gap: var(--ui-space-3, 0.75rem);
  align-items: center;
}

.project-layout__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* Add Task Button */
.project-layout__add-task-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  border: none;
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-brand-900, #0b2e33);
  color: var(--ui-surface, #ffffff);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.project-layout__add-task-btn:hover {
  background: var(--ui-brand-800, #134e4a);
  box-shadow: var(--ui-shadow-md);
}

.project-layout__add-task-btn:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

.project-layout__add-task-btn svg {
  width: 1rem;
  height: 1rem;
}

/* Responsive */
@media (max-width: 1200px) {
  .project-layout {
    --shell-sidebar-width: 0px;
    grid-template-columns: minmax(0, 1fr);
  }

  .project-layout__overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: var(--ui-surface-overlay, rgba(0, 0, 0, 0.35));
    backdrop-filter: blur(2px);
    z-index: var(--ui-z-sidebar, 30);
  }

  .project-layout__menu-button {
    display: inline-flex;
  }

  .project-layout__topbar {
    gap: var(--ui-space-4, 1rem);
  }
}

@media (max-width: 768px) {
  /* モバイルでもラベルを表示（アイコンのみだと混乱するため） */
  .project-layout__add-task-label {
    display: inline;
    font-size: var(--ui-text-xs, 0.75rem);
  }

  .project-layout__add-task-btn {
    padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
    gap: var(--ui-space-1, 0.25rem);
  }

  .project-layout__add-task-btn svg {
    width: 0.875rem;
    height: 0.875rem;
  }

  /* Show bottom nav on mobile */
  .project-layout__bottom-nav {
    display: grid;
  }

  /* Add padding for bottom nav */
  .project-layout__body {
    padding-bottom: calc(
      var(--ui-bottom-nav-height, 56px) + env(safe-area-inset-bottom)
    );
  }
}

/* Hide bottom nav on desktop */
.project-layout__bottom-nav {
  display: none;
}
</style>

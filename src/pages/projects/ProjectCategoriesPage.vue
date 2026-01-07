<script setup lang="ts">
import AppEmptyState from "@/components/ui/AppEmptyState.vue";
import { appName } from "@/constants/appMeta";
import { buildProjectNavItems } from "@/constants/projectNav";
import { ProjectPermission } from "@/constants/permissions";
import { useProjectIdRoute } from "@/composables/useProjectIdRoute";
import { useProjectAccess } from "@/composables/useProjectAccess";
import ProjectAppShell from "@/layouts/ProjectAppShell.vue";
import {
  addTaskCategory,
  deleteTaskCategory,
  listenTaskCategories,
  renameTaskCategory,
  type TaskCategory,
} from "@/services/taskCategoryService";
import { useAuthStore } from "@/store/auth";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const { profile } = useAuthStore();
const { projectId } = useProjectIdRoute();
const categories = ref<TaskCategory[]>([]);
const newCategory = ref("");

let stopCategories: (() => void) | null = null;

// useProjectAccess で権限管理を統一
const { can } = useProjectAccess(projectId);

const canEdit = computed(() => can(ProjectPermission.MANAGE_CATEGORIES));

const navItems = computed(() => buildProjectNavItems(projectId.value));

const profileInfo = computed(() => ({
  name: profile.value?.nickname || profile.value?.fullName || `${appName} User`,
  email: profile.value?.email || "",
}));

function watchCategories() {
  stopCategories = listenTaskCategories(projectId.value, (list) => {
    categories.value = list;
  });
}

async function createCategory() {
  if (!canEdit.value || !newCategory.value.trim()) return;
  await addTaskCategory(projectId.value, newCategory.value.trim());
  newCategory.value = "";
}

async function renameCategoryInline(category: TaskCategory) {
  if (!canEdit.value) return;
  const name = prompt("カテゴリ名を変更", category.name);
  if (!name || name.trim() === category.name) return;
  await renameTaskCategory(projectId.value, category.id, name.trim());
}

async function removeCategory(category: TaskCategory) {
  if (!canEdit.value) return;
  if (!confirm(`「${category.name}」を削除しますか？`)) return;
  await deleteTaskCategory(projectId.value, category.id);
}

onMounted(() => {
  watchCategories();
});

watch(projectId, (newId, oldId) => {
  if (!newId || newId === oldId) return;
  stopCategories?.();
  watchCategories();
});

onBeforeUnmount(() => {
  stopCategories?.();
});
</script>

<template>
  <ProjectAppShell
    :project-id="projectId"
    :nav-items="navItems"
    :sidebar-projects="[]"
    :profile-info="profileInfo"
    brand-subtitle="カテゴリ"
  >
    <template #headerTitle>
      <p class="project-app-shell__breadcrumb">プロジェクト &gt; カテゴリ</p>
      <h1 class="project-app-shell__heading">カテゴリ管理</h1>
    </template>

    <div class="category-content">
      <div class="guard" v-if="!canEdit">
        <p class="guard__title">管理者のみ編集できます</p>
        <p class="guard__desc">
          閲覧はできますが、追加・編集・削除はできません。
        </p>
      </div>

      <section class="category-card">
        <header class="category-card__header">
          <div>
            <p class="eyebrow">カテゴリ</p>
            <h2>タスクカテゴリの追加・編集</h2>
          </div>
          <div class="category-card__actions">
            <input
              v-model="newCategory"
              type="text"
              placeholder="カテゴリ名"
              :disabled="!canEdit"
            />
            <button
              type="button"
              :disabled="!canEdit || !newCategory.trim()"
              @click="createCategory"
            >
              追加
            </button>
          </div>
        </header>

        <ul class="category-list">
          <li
            v-for="category in categories"
            :key="category.id"
            class="category-item"
          >
            <div>
              <p class="category-item__name">{{ category.name }}</p>
              <p class="category-item__meta">ID: {{ category.id }}</p>
            </div>
            <div class="category-item__actions" v-if="canEdit">
              <button
                type="button"
                class="ghost"
                @click="renameCategoryInline(category)"
              >
                名称変更
              </button>
              <button
                type="button"
                class="danger"
                @click="removeCategory(category)"
              >
                削除
              </button>
            </div>
          </li>
          <li v-if="!categories.length" class="category-item--empty">
            <AppEmptyState
              title="カテゴリがまだありません"
              description="新しいカテゴリを追加して、タスクを整理しましょう。"
              icon="folder"
            />
          </li>
        </ul>
      </section>
    </div>
  </ProjectAppShell>
</template>

<style scoped>
@import "@/pages/demo/styles/demo-shell.css";

.category-content {
  padding: 0 var(--ui-space-6, 1.5rem) var(--ui-space-8, 2rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
  max-width: 720px;
}

.category-card {
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-5, 1.25rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.category-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--ui-space-4, 1rem);
}

.category-card__actions {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
}

.category-card__actions input {
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  background: var(--ui-surface-muted, #f1f5f9);
  font-size: var(--ui-text-sm, 0.875rem);
  transition: var(--ui-transition-colors);
}

.category-card__actions input:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.category-card__actions button {
  border: none;
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  background: var(--ui-brand-900, #0b2e33);
  color: var(--ui-text-inverse, #ffffff);
  font-weight: var(--ui-font-semibold, 600);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.category-card__actions button:hover:not(:disabled) {
  background: var(--ui-brand-700, #1a4a51);
  box-shadow: var(--ui-shadow-md);
}

.category-card__actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.category-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.category-item {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  background: var(--ui-surface, #ffffff);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: var(--ui-transition-all);
}

.category-item:hover {
  border-color: var(--ui-border, rgba(11, 46, 51, 0.12));
  box-shadow: var(--ui-shadow-sm);
}

.category-item--empty {
  justify-content: center;
  color: var(--ui-text-muted, #64748b);
}

.category-item__name {
  margin: 0;
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text, #0b2e33);
}

.category-item__meta {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.category-item__actions {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
}

.category-item__actions .ghost {
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  background: var(--ui-surface, #ffffff);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-sm, 0.5rem);
  font-size: var(--ui-text-sm, 0.875rem);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.category-item__actions .ghost:hover {
  border-color: var(--ui-brand-600, #4f7c82);
  color: var(--ui-brand-600, #4f7c82);
}

.category-item__actions .danger {
  border: 1px solid var(--ui-danger, #d64545);
  background: var(--ui-surface, #ffffff);
  color: var(--ui-danger, #d64545);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-sm, 0.5rem);
  font-size: var(--ui-text-sm, 0.875rem);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.category-item__actions .danger:hover {
  background: var(--ui-danger-light, #fee2e2);
}

.guard {
  border: 1px solid rgba(245, 158, 11, 0.3);
  background: var(--ui-warning-light, #fef3c7);
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
}

.guard__title {
  margin: 0;
  font-weight: var(--ui-font-bold, 700);
  color: #b45309;
}

.guard__desc {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  color: #92400e;
  font-size: var(--ui-text-sm, 0.875rem);
}

.eyebrow {
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ui-text-muted, #64748b);
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
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
  .category-content {
    padding: 0 var(--ui-space-4, 1rem) var(--ui-space-8, 2rem);
  }

  .category-card__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

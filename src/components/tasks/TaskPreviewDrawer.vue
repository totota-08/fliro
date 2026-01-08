<script setup lang="ts">
import AppDrawer from "@/components/ui/AppDrawer.vue";
import TaskStatusBadge from "@/components/ui/TaskStatusBadge.vue";
import { ROUTE_NAMES } from "@/constants/routes";
import type { TaskDoc } from "@/services/taskService";
import { computed, ref } from "vue";

const props = defineProps<{
  task: TaskDoc | null;
  projectId: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const isDescriptionExpanded = ref(false);

const isOpen = computed(() => props.task !== null);

function formatDueDate(task: TaskDoc) {
  if (!task.dueDate?.seconds) return "未設定";
  return new Date(task.dueDate.seconds * 1000).toLocaleDateString();
}
</script>

<template>
  <AppDrawer :open="isOpen" width="420px" @close="emit('close')">
    <template #header>
      <div v-if="task">
        <p class="task-drawer__eyebrow">タスク概要</p>
        <h3>
          <router-link
            :to="{
              name: ROUTE_NAMES.projectTaskDetail,
              params: { projectId: projectId, taskId: task.id },
              query: { from: 'dashboard' },
            }"
            class="task-drawer__title-link"
          >
            {{ task.title }} ↗
          </router-link>
        </h3>
        <p class="task-drawer__helper">詳細は別ページで確認・議論できます</p>
      </div>
    </template>

    <div v-if="task" class="drawer-content">
      <section class="task-drawer__section">
        <p class="label">ステータス</p>
        <div class="readonly-value">
          <TaskStatusBadge :status="task.status" />
          <span class="muted" style="margin-left: 8px"
            >{{ task.progress }}%</span
          >
        </div>
      </section>

      <section class="task-drawer__section">
        <p class="label">担当者</p>
        <div class="readonly-value">
          {{ task.assigneeName || "未割当" }}
        </div>
      </section>

      <section class="task-drawer__section">
        <p class="label">期限</p>
        <div class="readonly-value">
          {{ formatDueDate(task) }}
        </div>
      </section>

      <section class="task-drawer__section">
        <p class="label">説明</p>
        <div
          class="description-preview"
          :class="{ 'is-expanded': isDescriptionExpanded }"
        >
          {{ task.description || "説明はありません" }}
        </div>
        <button
          v-if="
            (task.description || '').split('\n').length > 5 ||
            (task.description || '').length > 200
          "
          type="button"
          class="description-toggle"
          @click="isDescriptionExpanded = !isDescriptionExpanded"
        >
          {{ isDescriptionExpanded ? "閉じる" : "もっと見る" }}
        </button>
      </section>
    </div>

    <template #footer>
      <router-link
        v-if="task"
        :to="{
          name: ROUTE_NAMES.projectTaskDetail,
          params: { projectId: projectId, taskId: task.id },
          query: { from: 'dashboard' },
        }"
        class="cta-button"
      >
        詳細ページを開く →
      </router-link>
    </template>
  </AppDrawer>
</template>

<style scoped>
.task-drawer__eyebrow {
  margin: 0;
  font-size: var(--ui-text-xs);
  letter-spacing: 0.08em;
  color: var(--ui-text-muted);
  text-transform: uppercase;
}

.task-drawer__title-link {
  text-decoration: none;
  color: inherit;
  display: flex;
  align-items: baseline;
  gap: var(--ui-space-1);
  transition: var(--ui-transition-colors);
}

.task-drawer__title-link:hover {
  color: var(--ui-brand-600);
  text-decoration: underline;
}

.task-drawer__helper {
  font-size: var(--ui-text-xs);
  color: var(--ui-text-muted);
  margin: var(--ui-space-1) 0 0 0;
}

.drawer-content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5);
}

.task-drawer__section {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.task-drawer__section .label {
  margin: 0;
  font-size: var(--ui-text-sm);
  color: var(--ui-text-muted);
}

.readonly-value {
  padding: var(--ui-space-2) 0;
  color: var(--ui-text);
  font-size: var(--ui-text-base);
  display: flex;
  align-items: center;
}

.muted {
  color: var(--ui-text-muted);
  font-size: var(--ui-text-sm);
}

.description-preview {
  white-space: pre-wrap;
  color: var(--ui-text);
  font-size: var(--ui-text-sm);
  line-height: var(--ui-leading-relaxed);
  max-height: 100px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.6);
  padding: var(--ui-space-3);
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-border-light);
  transition: max-height 0.3s ease;
}

.description-preview.is-expanded {
  max-height: 500px;
  overflow-y: auto;
}

.description-toggle {
  background: none;
  border: none;
  color: var(--ui-brand-600);
  font-size: var(--ui-text-xs);
  cursor: pointer;
  padding: var(--ui-space-1) 0;
  margin-top: var(--ui-space-1);
  font-weight: var(--ui-font-semibold);
  transition: var(--ui-transition-colors);
}

.description-toggle:hover {
  text-decoration: underline;
}

.cta-button {
  display: flex;
  width: 100%;
  justify-content: center;
  align-items: center;
  padding: var(--ui-space-3) var(--ui-space-4);
  border: 1px solid var(--ui-brand-600);
  border-radius: var(--ui-radius-md);
  color: var(--ui-brand-600);
  font-weight: var(--ui-font-semibold);
  text-decoration: none;
  font-size: var(--ui-text-sm);
  background: var(--ui-surface);
  transition: var(--ui-transition-all);
}

.cta-button:hover {
  background: rgba(79, 124, 130, 0.08);
}
</style>

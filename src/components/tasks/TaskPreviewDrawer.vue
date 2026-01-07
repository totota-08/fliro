<script setup lang="ts">
import type { TaskDoc, TaskStatus } from "@/services/taskService";
import { ROUTE_NAMES } from "@/constants/routes";
import { ref } from "vue";

const props = defineProps<{
  task: TaskDoc | null;
  projectId: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const isDescriptionExpanded = ref(false);

function formatStatus(status: TaskStatus) {
  const map: Record<TaskStatus, string> = {
    todo: "未着手",
    "in-progress": "進行中",
    review: "レビュー",
    done: "完了",
  };
  return map[status] || status;
}

function formatDueDate(task: TaskDoc) {
  if (!task.dueDate?.seconds) return "未設定";
  return new Date(task.dueDate.seconds * 1000).toLocaleDateString();
}
</script>

<template>
  <transition name="task-drawer">
    <div v-if="task" class="task-drawer">
      <div
        class="task-drawer__overlay"
        aria-hidden="true"
        @click="emit('close')"
      />
      <aside class="task-drawer__panel">
        <header class="task-drawer__header">
          <div>
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
            <p class="task-drawer__helper">
              詳細は別ページで確認・議論できます
            </p>
          </div>
          <button type="button" class="drawer-close" @click="emit('close')">
            ×
          </button>
        </header>

        <div class="drawer-content">
          <section class="task-drawer__section">
            <p class="label">ステータス</p>
            <div class="readonly-value">
              <span :class="['status-badge', task.status]">
                {{ formatStatus(task.status) }}
              </span>
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

        <footer class="task-drawer__sticky-footer">
          <router-link
            :to="{
              name: ROUTE_NAMES.projectTaskDetail,
              params: { projectId: projectId, taskId: task.id },
              query: { from: 'dashboard' },
            }"
            class="cta-button"
          >
            詳細ページを開く →
          </router-link>
        </footer>
      </aside>
    </div>
  </transition>
</template>

<style scoped>
.task-drawer-enter-active,
.task-drawer-leave-active {
  transition: opacity 0.2s ease;
}

.task-drawer-enter-from,
.task-drawer-leave-to {
  opacity: 0;
}

.task-drawer-enter-from .task-drawer__panel,
.task-drawer-leave-to .task-drawer__panel {
  transform: translateX(20%);
  opacity: 0;
}

.task-drawer {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  z-index: var(--ui-z-modal, 50);
}

.task-drawer__overlay {
  flex: 1;
  background: rgba(0, 0, 0, 0.35);
}

.task-drawer__panel {
  width: clamp(280px, 85vw, 420px);
  background: var(--ui-surface-elevated, #f8fafc);
  border-left: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  box-shadow: var(--ui-shadow-lg);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
  padding: var(--ui-space-6, 1.5rem);
  transform: translateX(0);
  transition: var(--ui-transition-all);
}

.task-drawer__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-drawer__eyebrow {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  letter-spacing: 0.08em;
  color: var(--ui-text-muted, #64748b);
  text-transform: uppercase;
}

.task-drawer__header h3 {
  margin: var(--ui-space-1, 0.25rem) 0 0;
}

.task-drawer__title-link {
  text-decoration: none;
  color: inherit;
  display: flex;
  align-items: baseline;
  gap: var(--ui-space-1, 0.25rem);
  transition: var(--ui-transition-colors);
}

.task-drawer__title-link:hover {
  color: var(--ui-brand-600, #4f7c82);
  text-decoration: underline;
}

.task-drawer__helper {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  margin: var(--ui-space-1, 0.25rem) 0 0 0;
}

.task-drawer__section {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.task-drawer__section .label {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.drawer-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5, 1.25rem);
  overflow-y: auto;
  min-height: 0;
}

.drawer-close {
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-md, 0.75rem);
  width: 36px;
  height: 36px;
  cursor: pointer;
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-brand-900, #0b2e33);
  display: grid;
  place-items: center;
  font-size: var(--ui-text-xl, 1.25rem);
  transition: var(--ui-transition-all);
}

.drawer-close:hover {
  border-color: var(--ui-brand-600, #4f7c82);
  color: var(--ui-brand-600, #4f7c82);
}

.readonly-value {
  padding: var(--ui-space-2, 0.5rem) 0;
  color: var(--ui-text, #0b2e33);
  font-size: var(--ui-text-base, 1rem);
  display: flex;
  align-items: center;
}

.status-badge {
  display: inline-flex;
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  border-radius: var(--ui-radius-full, 9999px);
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text, #0b2e33);
}

.status-badge.todo {
  background: var(--ui-surface-muted, #f1f5f9);
}

.status-badge.in-progress {
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-900, #0b2e33);
}

.status-badge.review {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.done {
  background: #dcfce7;
  color: #166534;
}

.muted {
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.description-preview {
  white-space: pre-wrap;
  color: var(--ui-text, #0b2e33);
  font-size: var(--ui-text-sm, 0.875rem);
  line-height: var(--ui-leading-relaxed, 1.625);
  max-height: 100px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.6);
  padding: var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  transition: max-height 0.3s ease;
}

.description-preview.is-expanded {
  max-height: 500px;
  overflow-y: auto;
}

.description-toggle {
  background: none;
  border: none;
  color: var(--ui-brand-600, #4f7c82);
  font-size: var(--ui-text-xs, 0.75rem);
  cursor: pointer;
  padding: var(--ui-space-1, 0.25rem) 0;
  margin-top: var(--ui-space-1, 0.25rem);
  font-weight: var(--ui-font-semibold, 600);
  transition: var(--ui-transition-colors);
}

.description-toggle:hover {
  text-decoration: underline;
}

.task-drawer__sticky-footer {
  margin-top: auto;
  padding: var(--ui-space-4, 1rem) var(--ui-space-6, 1.5rem);
  background: var(--ui-surface-elevated, #f8fafc);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  display: flex;
  justify-content: center;
  position: sticky;
  bottom: 0;
}

.cta-button {
  display: flex;
  width: 100%;
  justify-content: center;
  align-items: center;
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border: 1px solid var(--ui-brand-600, #4f7c82);
  border-radius: var(--ui-radius-md, 0.75rem);
  color: var(--ui-brand-600, #4f7c82);
  font-weight: var(--ui-font-semibold, 600);
  text-decoration: none;
  font-size: var(--ui-text-sm, 0.875rem);
  background: var(--ui-surface, #ffffff);
  transition: var(--ui-transition-all);
}

.cta-button:hover {
  background: rgba(79, 124, 130, 0.08);
}
</style>

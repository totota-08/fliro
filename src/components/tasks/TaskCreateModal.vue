<script setup lang="ts">
import type { TaskCategory } from "@/services/taskCategoryService";
import { reactive, watch } from "vue";

export interface TaskFormData {
  title: string;
  description: string;
  dueDate: string;
  assigneeId: string;
  categoryId: string;
  progress: number;
}

interface MemberOption {
  id: string;
  name: string;
}

const props = defineProps<{
  open: boolean;
  categories: TaskCategory[];
  members: MemberOption[];
}>();

const emit = defineEmits<{
  close: [];
  submit: [data: TaskFormData];
}>();

const PROGRESS_OPTIONS = [0, 25, 50, 75, 100] as const;

const form = reactive<TaskFormData>({
  title: "",
  description: "",
  dueDate: "",
  assigneeId: "",
  categoryId: "",
  progress: 0,
});

function resetForm() {
  form.title = "";
  form.description = "";
  form.dueDate = "";
  form.assigneeId = "";
  form.categoryId = "";
  form.progress = 0;
}

function handleClose() {
  resetForm();
  emit("close");
}

function handleSubmit() {
  if (!form.title.trim()) return;
  emit("submit", { ...form });
  resetForm();
}

// Reset form when modal opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      resetForm();
    }
  },
);
</script>

<template>
  <div v-if="open" class="task-modal">
    <div class="task-modal__card">
      <header>
        <h3>新規タスク</h3>
        <button type="button" @click="handleClose">×</button>
      </header>
      <form class="task-modal__form" @submit.prevent="handleSubmit">
        <label>
          タイトル
          <input
            v-model="form.title"
            type="text"
            placeholder="例）デザインレビュー"
            required
          />
        </label>
        <label>
          説明
          <textarea
            v-model="form.description"
            rows="3"
            placeholder="タスクの詳細を入力"
          ></textarea>
        </label>
        <label>
          期限
          <input v-model="form.dueDate" type="date" />
        </label>
        <label>
          カテゴリ
          <select v-model="form.categoryId">
            <option value="">カテゴリなし</option>
            <option
              v-for="category in categories"
              :key="category.id"
              :value="category.id"
            >
              {{ category.name }}
            </option>
          </select>
        </label>
        <label>
          担当者
          <select v-model="form.assigneeId">
            <option value="">未割当</option>
            <option
              v-for="member in members"
              :key="member.id"
              :value="member.id"
            >
              {{ member.name }}
            </option>
          </select>
        </label>
        <section class="task-modal__section">
          <div class="task-modal__range-header">
            <p class="label">進捗率</p>
            <span class="hint">{{ form.progress }}%</span>
          </div>
          <div class="progress-picker">
            <button
              v-for="option in PROGRESS_OPTIONS"
              :key="`modal-progress-${option}`"
              type="button"
              :class="[
                'progress-pill',
                { 'is-active': form.progress === option },
              ]"
              @click="form.progress = option"
            >
              {{ option }}%
            </button>
          </div>
        </section>

        <footer>
          <button type="button" class="ghost" @click="handleClose">
            キャンセル
          </button>
          <button type="submit">作成</button>
        </footer>
      </form>
    </div>
  </div>
</template>

<style scoped>
.task-modal {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.4);
  z-index: var(--ui-z-modal, 50);
}

.task-modal__card {
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-6, 1.5rem);
  width: clamp(300px, 90vw, 500px);
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--ui-shadow-xl);
}

.task-modal__card header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--ui-space-5, 1.25rem);
}

.task-modal__card header h3 {
  margin: 0;
  font-size: var(--ui-text-xl, 1.25rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text, #0b2e33);
}

.task-modal__card header button {
  border: none;
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-full, 9999px);
  width: 32px;
  height: 32px;
  cursor: pointer;
  font-size: var(--ui-text-lg, 1.125rem);
  color: var(--ui-text-muted, #64748b);
  transition: var(--ui-transition-colors);
}

.task-modal__card header button:hover {
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-900, #0b2e33);
}

.task-modal__form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.task-modal__form label {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.task-modal__form input,
.task-modal__form textarea,
.task-modal__form select {
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-base, 1rem);
  color: var(--ui-text, #0b2e33);
  background: var(--ui-surface, #ffffff);
  transition: var(--ui-transition-colors);
}

.task-modal__form input:focus,
.task-modal__form textarea:focus,
.task-modal__form select:focus {
  outline: none;
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.task-modal__section {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.task-modal__range-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-modal__range-header .label {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.task-modal__range-header .hint {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.progress-picker {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
  flex-wrap: wrap;
}

.progress-pill {
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text, #0b2e33);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-full, 9999px);
  cursor: pointer;
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  transition: var(--ui-transition-colors);
}

.progress-pill:hover {
  border-color: var(--ui-brand-600, #4f7c82);
  background: var(--ui-brand-100, #e5f6f8);
}

.progress-pill.is-active {
  border-color: var(--ui-brand-900, #0b2e33);
  background: var(--ui-brand-900, #0b2e33);
  color: var(--ui-surface, #ffffff);
}

.task-modal__form footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-3, 0.75rem);
  margin-top: var(--ui-space-4, 1rem);
  padding-top: var(--ui-space-4, 1rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.task-modal__form footer button {
  border: none;
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-5, 1.25rem);
  cursor: pointer;
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  transition: var(--ui-transition-colors);
}

.task-modal__form footer button[type="submit"] {
  background: var(--ui-brand-900, #0b2e33);
  color: var(--ui-surface, #ffffff);
}

.task-modal__form footer button[type="submit"]:hover {
  background: var(--ui-brand-800, #134e4a);
}

.task-modal__form footer .ghost {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text, #0b2e33);
}

.task-modal__form footer .ghost:hover {
  background: var(--ui-border, rgba(11, 46, 51, 0.12));
}
</style>

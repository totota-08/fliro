<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import AppModal from "@/components/ui/AppModal.vue";
import AppSelect, { type SelectOption } from "@/components/ui/AppSelect.vue";
import type { TaskCategory } from "@/services/taskCategoryService";
import { computed, reactive, ref, watch } from "vue";

export interface TaskFormData {
  title: string;
  description: string;
  dueDate: string;
  assigneeId: string;
  categoryId: string;
  priority: "high" | "medium" | "low";
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

const PRIORITY_OPTIONS = [
  { value: "high", label: "高", color: "danger" },
  { value: "medium", label: "中", color: "warning" },
  { value: "low", label: "低", color: "info" },
] as const;

const form = reactive<TaskFormData>({
  title: "",
  description: "",
  dueDate: "",
  assigneeId: "",
  categoryId: "",
  priority: "medium",
  progress: 0,
});

// バリデーションエラー
const titleError = ref("");

// カテゴリオプション（AppSelect用）
const categoryOptions = computed<SelectOption[]>(() => [
  { value: "", label: "カテゴリなし" },
  ...props.categories.map((cat) => ({
    value: cat.id,
    label: cat.name,
  })),
]);

// メンバーオプション（AppSelect用）
const memberOptions = computed<SelectOption[]>(() => [
  { value: "", label: "未割当" },
  ...props.members.map((member) => ({
    value: member.id,
    label: member.name,
  })),
]);

function resetForm() {
  form.title = "";
  form.description = "";
  form.dueDate = "";
  form.assigneeId = "";
  form.categoryId = "";
  form.priority = "medium";
  form.progress = 0;
  titleError.value = "";
}

// タイトル入力時にエラーをクリア
function handleTitleInput() {
  if (titleError.value && form.title.trim()) {
    titleError.value = "";
  }
}

function handleClose() {
  resetForm();
  emit("close");
}

function handleSubmit() {
  // バリデーション
  if (!form.title.trim()) {
    titleError.value = "タイトルは必須です";
    return;
  }
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
  <AppModal :open="open" title="新規タスク" size="md" @close="handleClose">
    <form class="task-create-form" @submit.prevent="handleSubmit">
      <div class="form-field" :class="{ 'has-error': titleError }">
        <label class="form-label">
          タイトル <span class="required">*</span>
        </label>
        <input
          v-model="form.title"
          type="text"
          class="form-input"
          :class="{ 'input-error': titleError }"
          placeholder="例）デザインレビュー"
          aria-required="true"
          @input="handleTitleInput"
        />
        <span v-if="titleError" class="error-message">{{ titleError }}</span>
      </div>

      <div class="form-field">
        <label class="form-label">説明</label>
        <textarea
          v-model="form.description"
          class="form-textarea"
          rows="3"
          placeholder="タスクの詳細を入力"
        ></textarea>
      </div>

      <div class="form-field">
        <label class="form-label">期限</label>
        <input v-model="form.dueDate" type="date" class="form-input" />
      </div>

      <div class="form-field">
        <label class="form-label">カテゴリ</label>
        <AppSelect
          v-model="form.categoryId"
          :options="categoryOptions"
          :placeholder="undefined"
        />
      </div>

      <div class="form-field">
        <label class="form-label">担当者</label>
        <AppSelect
          v-model="form.assigneeId"
          :options="memberOptions"
          :placeholder="undefined"
        />
      </div>

      <div class="form-field">
        <label class="form-label">優先度</label>
        <div class="priority-picker">
          <button
            v-for="option in PRIORITY_OPTIONS"
            :key="option.value"
            type="button"
            :class="[
              'priority-pill',
              `priority-${option.value}`,
              { 'is-active': form.priority === option.value },
            ]"
            @click="form.priority = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="form-field">
        <div class="progress-header">
          <span class="form-label">進捗率</span>
          <span class="progress-hint">{{ form.progress }}%</span>
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
            :aria-label="`進捗を${option}%に設定`"
            @click="form.progress = option"
          >
            {{ option }}%
          </button>
        </div>
      </div>
    </form>

    <template #footer>
      <AppButton variant="ghost" @click="handleClose"> キャンセル </AppButton>
      <AppButton variant="primary" @click="handleSubmit"> 作成 </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.task-create-form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.form-label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.required {
  color: var(--ui-danger, #ef4444);
}

.form-input,
.form-textarea {
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem);
  font-size: max(var(--ui-text-base, 1rem), 16px); /* iOS zoom prevention */
  color: var(--ui-text, #0b2e33);
  background: var(--ui-surface, #ffffff);
  transition: var(--ui-transition-colors);
  min-height: var(--ui-touch-target-min, 44px);
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.form-input.input-error {
  border-color: var(--ui-danger, #ef4444);
}

.error-message {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-danger, #ef4444);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-hint {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.priority-picker {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
}

.priority-pill {
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text, #0b2e33);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-full, 9999px);
  cursor: pointer;
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  transition: var(--ui-transition-colors);
}

.priority-pill:hover {
  background: var(--ui-surface-hover, #f8fafc);
}

.priority-pill.is-active.priority-high {
  background: var(--ui-danger-light, #fee2e2);
  color: var(--ui-danger, #ef4444);
  border-color: var(--ui-danger, #ef4444);
}

.priority-pill.is-active.priority-medium {
  background: var(--ui-warning-light, #fef3c7);
  color: var(--ui-warning, #f59e0b);
  border-color: var(--ui-warning, #f59e0b);
}

.priority-pill.is-active.priority-low {
  background: var(--ui-info-light, #e0f2fe);
  color: var(--ui-info, #0ea5e9);
  border-color: var(--ui-info, #0ea5e9);
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
  min-height: var(--ui-touch-target-min, 44px);
  min-width: var(--ui-touch-target-min, 44px);
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

/* Touch device feedback */
@media (hover: none) and (pointer: coarse) {
  .progress-pill:active {
    transform: scale(0.95);
    transition: transform 0.1s ease;
  }
}

/* モバイル対応 */
@media (max-width: 640px) {
  .task-create-form {
    gap: var(--ui-space-5, 1.25rem);
  }

  .form-field {
    gap: var(--ui-space-2, 0.5rem);
  }

  .form-label {
    font-size: var(--ui-text-base, 1rem);
  }

  .form-input,
  .form-textarea {
    padding: var(--ui-space-4, 1rem);
  }

  .progress-picker {
    gap: var(--ui-space-3, 0.75rem);
    justify-content: space-between;
  }

  .progress-pill {
    flex: 1;
    justify-content: center;
    text-align: center;
    padding: var(--ui-space-3, 0.75rem) var(--ui-space-2, 0.5rem);
    min-width: 0;
  }
}
</style>

<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppSelect from "@/components/ui/AppSelect.vue";
import AppTextarea from "@/components/ui/AppTextarea.vue";
import DatePicker from "@/components/ui/DatePicker.vue";
import type { TaskDoc, CreateTaskPayload } from "@/services/taskService";
import { computed, reactive, watch } from "vue";

interface Category {
  id: string;
  name: string;
}

interface Member {
  id: string;
  name: string;
}

const props = withDefaults(
  defineProps<{
    /** 編集モードの場合、既存タスクを渡す */
    task?: TaskDoc | null;
    /** カテゴリ一覧 */
    categories?: Category[];
    /** メンバー一覧 */
    members?: Member[];
    /** 送信中かどうか */
    submitting?: boolean;
  }>(),
  {
    task: null,
    categories: () => [],
    members: () => [],
    submitting: false,
  },
);

const emit = defineEmits<{
  (e: "submit", payload: CreateTaskPayload): void;
  (e: "cancel"): void;
}>();

const PROGRESS_OPTIONS = [0, 25, 50, 75, 100] as const;

const form = reactive({
  title: "",
  description: "",
  dueDate: "",
  assigneeId: "",
  categoryId: "",
  progress: 0,
});

const isEditMode = computed(() => !!props.task);

const formTitle = computed(() =>
  isEditMode.value ? "タスク編集" : "新規タスク",
);

const submitLabel = computed(() => (isEditMode.value ? "更新" : "作成"));

// AppSelect用のオプション
const categoryOptions = computed(() =>
  props.categories.map((c) => ({ value: c.id, label: c.name })),
);

const memberOptions = computed(() =>
  props.members.map((m) => ({ value: m.id, label: m.name })),
);

// タスクが変更されたらフォームを初期化
watch(
  () => props.task,
  (task) => {
    if (task) {
      form.title = task.title || "";
      form.description = task.description || "";
      form.dueDate = task.dueDate?.seconds
        ? (new Date(task.dueDate.seconds * 1000).toISOString().split("T")[0] ??
          "")
        : "";
      form.assigneeId = task.assigneeId || "";
      form.categoryId = task.categoryId || "";
      form.progress = task.progress ?? 0;
    } else {
      resetForm();
    }
  },
  { immediate: true },
);

function resetForm() {
  form.title = "";
  form.description = "";
  form.dueDate = "";
  form.assigneeId = "";
  form.categoryId = "";
  form.progress = 0;
}

function handleSubmit() {
  if (!form.title.trim()) return;

  const payload: CreateTaskPayload = {
    title: form.title.trim(),
    description: form.description.trim(),
    dueDate: form.dueDate ? new Date(form.dueDate) : null,
    categoryId: form.categoryId || null,
    assigneeId: form.assigneeId || null,
    assigneeName:
      props.members.find((m) => m.id === form.assigneeId)?.name || null,
    progress: form.progress,
  };

  emit("submit", payload);
}

function handleCancel() {
  emit("cancel");
}
</script>

<template>
  <div class="task-form">
    <header class="task-form__header">
      <h3>{{ formTitle }}</h3>
      <button
        type="button"
        class="task-form__close"
        aria-label="閉じる"
        @click="handleCancel"
      >
        ×
      </button>
    </header>

    <form class="task-form__body" @submit.prevent="handleSubmit">
      <div class="task-form__field">
        <span class="task-form__label">タイトル</span>
        <AppInput
          v-model="form.title"
          placeholder="例）デザインレビュー"
          :disabled="submitting"
        />
      </div>

      <div class="task-form__field">
        <span class="task-form__label">説明</span>
        <AppTextarea
          v-model="form.description"
          :rows="3"
          placeholder="タスクの詳細を入力"
          :disabled="submitting"
        />
      </div>

      <div class="task-form__field">
        <span class="task-form__label">期限</span>
        <DatePicker
          v-model="form.dueDate"
          placeholder="期限を選択"
          :disabled="submitting"
        />
      </div>

      <div class="task-form__field">
        <span class="task-form__label">カテゴリ</span>
        <AppSelect
          v-model="form.categoryId"
          :options="categoryOptions"
          placeholder="カテゴリなし"
          :disabled="submitting"
        />
      </div>

      <div class="task-form__field">
        <span class="task-form__label">担当者</span>
        <AppSelect
          v-model="form.assigneeId"
          :options="memberOptions"
          placeholder="未割当"
          :disabled="submitting"
        />
      </div>

      <section class="task-form__section">
        <div class="task-form__range-header">
          <span class="task-form__label">進捗率</span>
          <span class="task-form__hint">{{ form.progress }}%</span>
        </div>
        <div class="task-form__progress-picker">
          <button
            v-for="option in PROGRESS_OPTIONS"
            :key="`progress-${option}`"
            type="button"
            :class="[
              'task-form__progress-pill',
              { 'is-active': form.progress === option },
            ]"
            :disabled="submitting"
            @click="form.progress = option"
          >
            {{ option }}%
          </button>
        </div>
      </section>

      <footer class="task-form__footer">
        <AppButton variant="ghost" :disabled="submitting" @click="handleCancel">
          キャンセル
        </AppButton>
        <AppButton
          type="submit"
          variant="primary"
          :disabled="submitting || !form.title.trim()"
          :loading="submitting"
        >
          {{ submitLabel }}
        </AppButton>
      </footer>
    </form>
  </div>
</template>

<style scoped>
.task-form {
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-xl, 1.25rem);
  box-shadow: var(--ui-shadow-xl);
  max-width: 480px;
  width: 100%;
}

.task-form__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--ui-space-5, 1.25rem) var(--ui-space-6, 1.5rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.task-form__header h3 {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.task-form__close {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-full, 9999px);
  font-size: var(--ui-text-lg, 1.125rem);
  color: var(--ui-text-muted, #64748b);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.task-form__close:hover {
  background: var(--ui-border, rgba(11, 46, 51, 0.12));
  color: var(--ui-text, #0b2e33);
}

.task-form__body {
  padding: var(--ui-space-6, 1.5rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.task-form__field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.task-form__label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.task-form__section {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.task-form__range-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-form__hint {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.task-form__progress-picker {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
}

.task-form__progress-pill {
  flex: 1;
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-surface, #ffffff);
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-muted, #64748b);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.task-form__progress-pill:hover:not(:disabled) {
  border-color: var(--ui-brand-500, #4f7c82);
  color: var(--ui-brand-500, #4f7c82);
}

.task-form__progress-pill.is-active {
  background: var(--ui-brand-500, #4f7c82);
  border-color: var(--ui-brand-500, #4f7c82);
  color: var(--ui-surface, #ffffff);
}

.task-form__progress-pill:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.task-form__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-3, 0.75rem);
  padding-top: var(--ui-space-4, 1rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}
</style>

<script setup lang="ts">
import type { Task, TaskState } from "@/types/task";
import { computed, ref } from "vue";

const props = defineProps<{
  task: Task | null;
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:title", value: string): void;
  (e: "update:state", value: TaskState): void;
  (e: "update:assignee"): void;
  (e: "update:priority"): void;
  (e: "update:due"): void;
}>();

const titleDraft = ref(props.task?.title ?? "");

const dueLabel = computed(() => {
  if (!props.task?.dueAt) return "期限なし";
  const d = props.task.dueAt instanceof Date ? props.task.dueAt : new Date(props.task.dueAt);
  return d.toLocaleDateString();
});

const stateOptions: { label: string; value: TaskState; tone: string }[] = [
  { label: "TODO", value: "todo", tone: "todo" },
  { label: "DOING", value: "doing", tone: "doing" },
  { label: "DONE", value: "done", tone: "done" },
];

const saveTitle = () => {
  if (!titleDraft.value.trim() || !props.task) return;
  emit("update:title", titleDraft.value.trim());
};
</script>

<template>
  <header class="header">
    <div class="header__left">
      <input
        v-model="titleDraft"
        class="title-input"
        type="text"
        :placeholder="'無題のタスク'"
        @blur="saveTitle"
        @keyup.enter.prevent="saveTitle"
      />
    </div>
    <div class="header__right">
      <div class="pill state" :class="task?.state || 'todo'">
        <select
          :value="task?.state || 'todo'"
          @change="emit('update:state', ($event.target as HTMLSelectElement).value as TaskState)"
        >
          <option v-for="opt in stateOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <button class="meta-btn" @click="emit('update:assignee')">
        <span class="label">担当</span>
        <span class="value">{{ task?.assigneeId || "未設定" }}</span>
      </button>
      <button class="meta-btn" @click="emit('update:due')">
        <span class="label">期限</span>
        <span class="value">{{ dueLabel }}</span>
      </button>
      <button class="meta-btn" @click="emit('update:priority')">
        <span class="label">優先度</span>
        <span class="value">{{ task?.priority || "未設定" }}</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  background: linear-gradient(180deg, rgba(246, 247, 249, 0.95), rgba(246, 247, 249, 0.6));
  backdrop-filter: blur(8px);
}

.header__left {
  flex: 1;
}

.header__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-input {
  width: 100%;
  font-size: 20px;
  font-weight: 600;
  border: none;
  background: transparent;
  outline: none;
  padding: 8px 10px;
  border-radius: 10px;
  transition: background 0.2s ease;
}

.title-input:focus {
  background: #fff;
  box-shadow: 0 0 0 1px #e6e8ee;
}

.pill.state {
  border: 1px solid #e6e8ee;
  background: #fff;
  padding: 4px 8px;
}

.pill select {
  border: none;
  background: transparent;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  outline: none;
}

.pill.todo {
  background: #fff7ed;
  border-color: #fed7aa;
  color: #c2410c;
}

.pill.doing {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.pill.done {
  background: #ecfdf3;
  border-color: #bbf7d0;
  color: #15803d;
}

.meta-btn {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #e6e8ee;
  background: #fff;
  cursor: pointer;
  min-width: 120px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.meta-btn:hover {
  border-color: #4f7c82;
  box-shadow: 0 4px 12px rgba(79, 124, 130, 0.12);
}

.label {
  font-size: 11px;
  color: #64748b;
}

.value {
  font-weight: 600;
  font-size: 13px;
}
</style>

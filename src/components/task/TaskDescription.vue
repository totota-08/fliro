<script setup lang="ts">
import type { Task } from "@/types/task";
import { computed, ref } from "vue";

const props = defineProps<{
  task: Task | null;
}>();

const emit = defineEmits<{
  (e: "save", value: string): void;
}>();

const editing = ref(false);
const draft = ref(props.task?.description ?? "");

const description = computed(() => props.task?.description || "まだ説明がありません。");

const startEdit = () => {
  editing.value = true;
  draft.value = props.task?.description ?? "";
};

const save = () => {
  editing.value = false;
  emit("save", draft.value.trim());
};
</script>

<template>
  <section class="section-card">
    <div class="section-title">Description</div>
    <div v-if="editing" class="editor">
      <textarea v-model="draft" rows="6" />
      <div class="actions">
        <button class="btn primary" @click="save">保存</button>
        <button class="btn ghost" @click="editing = false">キャンセル</button>
      </div>
    </div>
    <div v-else class="viewer" @click="startEdit">
      <p v-if="description" class="body">{{ description }}</p>
      <p v-else class="placeholder">クリックして説明を書きましょう</p>
    </div>
  </section>
</template>

<style scoped>
.section-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  margin-bottom: 8px;
}

.viewer {
  min-height: 120px;
  padding: 10px;
  border-radius: 10px;
  border: 1px dashed #e6e8ee;
  cursor: text;
}

.body {
  margin: 0;
  line-height: 1.7;
}

.placeholder {
  color: #94a3b8;
  margin: 0;
}

.editor textarea {
  width: 100%;
  min-height: 140px;
  border-radius: 10px;
  border: 1px solid #e6e8ee;
  padding: 12px;
  font-family: inherit;
  resize: vertical;
}

.actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}

.btn {
  border-radius: 10px;
  border: 1px solid #e6e8ee;
  padding: 8px 12px;
  cursor: pointer;
  background: #fff;
}

.btn.primary {
  background: linear-gradient(135deg, #4f7c82, #0b2e33);
  color: #fff;
  border-color: #4f7c82;
}

.btn.ghost {
  background: #fff;
}
</style>

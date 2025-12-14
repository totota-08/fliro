<script setup lang="ts">
import type { ChecklistItem } from "@/types/task";
import { ref, computed } from "vue";

const props = defineProps<{
  items: ChecklistItem[];
  taskId: string;
}>();

const emit = defineEmits<{
  (e: "add", body: string): void;
  (e: "toggle", id: string, done: boolean): void;
}>();

const input = ref("");
const showDone = ref(false);

const openItems = computed(() => props.items.filter((i) => !i.done));
const doneItems = computed(() => props.items.filter((i) => i.done));

const submit = () => {
  if (!input.value.trim()) return;
  emit("add", input.value.trim());
  input.value = "";
};
</script>

<template>
  <section class="section-card checklist">
    <div class="section-title">Checklist</div>
    <div class="input-row">
      <input v-model="input" type="text" placeholder="新しいチェック項目" @keyup.enter="submit" />
      <button class="btn primary" @click="submit">追加</button>
    </div>
    <div class="list">
      <div v-for="item in openItems" :key="item.id" class="list-row">
        <input
          type="checkbox"
          :checked="item.done"
          @change="emit('toggle', item.id, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ item.body }}</span>
      </div>
    </div>
    <div class="done-toggle" v-if="doneItems.length">
      <button class="btn ghost" @click="showDone = !showDone">
        完了 {{ doneItems.length }} 件 {{ showDone ? "隠す" : "表示" }}
      </button>
    </div>
    <div v-if="showDone" class="list muted">
      <div v-for="item in doneItems" :key="item.id" class="list-row done">
        <input
          type="checkbox"
          :checked="item.done"
          @change="emit('toggle', item.id, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ item.body }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.section-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  margin-bottom: 12px;
}

.input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.input-row input {
  flex: 1;
  border-radius: 10px;
  border: 1px solid #e6e8ee;
  padding: 8px 10px;
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

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #e6e8ee;
  border-radius: 10px;
  background: #fff;
}

.list-row.done {
  color: #94a3b8;
  text-decoration: line-through;
}

.muted .list-row {
  background: #f8fafc;
}

.done-toggle {
  margin-top: 8px;
}
</style>

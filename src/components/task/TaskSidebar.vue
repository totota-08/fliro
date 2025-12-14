<script setup lang="ts">
import type { ChecklistItem, CommentItem, Task } from "@/types/task";
import { computed } from "vue";

const props = defineProps<{
  task: Task | null;
  decisions: CommentItem[];
  openQuestions: CommentItem[];
  openChecklist: ChecklistItem[];
  watchers?: string[];
}>();

const nextActions = computed(() => {
  return [
    ...props.openChecklist.map((c) => ({ type: "checklist", label: c.body })),
    ...props.openQuestions.map((q) => ({
      type: "question",
      label: q.body,
    })),
  ];
});
</script>

<template>
  <aside class="sidebar">
    <div class="section">
      <div class="section-title">Properties</div>
      <div class="meta-grid">
        <div class="meta-item">
          <span class="label">ステータス</span>
          <span class="value">{{ task?.state || "todo" }}</span>
        </div>
        <div class="meta-item">
          <span class="label">期限</span>
          <span class="value">
            {{ task?.dueAt ? task.dueAt.toLocaleDateString?.() : "未設定" }}
          </span>
        </div>
        <div class="meta-item">
          <span class="label">優先度</span>
          <span class="value">{{ task?.priority || "未設定" }}</span>
        </div>
        <div class="meta-item">
          <span class="label">担当</span>
          <span class="value">{{ task?.assigneeId || "未設定" }}</span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Decisions</div>
      <div class="list">
        <div v-for="d in decisions" :key="d.id" class="list-row decision">
          <div class="badge">decision</div>
          <div class="body">{{ d.body }}</div>
        </div>
        <p v-if="!decisions.length" class="empty">決定事項はまだありません</p>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Next actions</div>
      <div class="list">
        <div v-for="(item, idx) in nextActions" :key="idx" class="list-row">
          <span class="badge">{{ item.type }}</span>
          <span class="body">{{ item.label }}</span>
        </div>
        <p v-if="!nextActions.length" class="empty">次のアクションはありません</p>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Watchers</div>
      <div class="list-row watchers">
        <div class="avatars">
          <span class="avatar" v-for="(id, idx) in watchers || []" :key="id">{{ idx + 1 }}</span>
        </div>
        <span class="body">{{ (watchers?.length || 0) }} 人がウォッチ</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section {
  background: #fff;
  border: 1px solid #e6e8ee;
  border-radius: 10px;
  padding: 16px;
}

.section-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  margin-bottom: 8px;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
}

.meta-item {
  border: 1px dashed #e6e8ee;
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 12px;
  color: #94a3b8;
}

.value {
  font-weight: 700;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid #e6e8ee;
  border-radius: 10px;
  background: #fff;
}

.list-row.decision {
  border-left: 4px solid #4f7c82;
}

.badge {
  padding: 4px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  font-size: 12px;
  text-transform: capitalize;
}

.body {
  font-size: 14px;
  font-weight: 600;
}

.empty {
  margin: 0;
  color: #94a3b8;
}

.watchers .avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #4f7c82;
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 12px;
}

.avatars {
  display: flex;
  gap: 6px;
}
</style>

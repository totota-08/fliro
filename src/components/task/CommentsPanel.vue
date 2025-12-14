<script setup lang="ts">
import type { CommentItem, CommentType } from "@/types/task";
import { computed, ref } from "vue";

const props = defineProps<{
  comments: CommentItem[];
}>();

const emit = defineEmits<{
  (e: "post", payload: { type: CommentType; body: string }): void;
  (e: "resolve-question", id: string, resolved: boolean): void;
  (e: "subtaskify", id: string): void;
}>();

const body = ref("");
const type = ref<CommentType>("comment");

const sorted = computed(() => [...props.comments].sort((a, b) => (a.createdAt?.getTime?.() || 0) - (b.createdAt?.getTime?.() || 0)));

const submit = () => {
  if (!body.value.trim()) return;
  emit("post", { type: type.value, body: body.value.trim() });
  body.value = "";
};
</script>

<template>
  <section class="section-card">
    <div class="section-title">Comments</div>
    <div class="composer">
      <select v-model="type">
        <option value="comment">Comment</option>
        <option value="decision">Decision</option>
        <option value="question">Question</option>
        <option value="request">Request</option>
      </select>
      <textarea v-model="body" rows="3" placeholder="フィードバックを書く" />
      <div class="composer__actions">
        <button class="btn primary" @click="submit">投稿</button>
      </div>
    </div>

    <div class="list">
      <article
        v-for="c in sorted"
        :key="c.id"
        class="comment"
        :class="[c.type, { resolved: !!c.resolvedAt }]"
      >
        <div class="meta">
          <span class="badge">{{ c.type }}</span>
          <span class="timestamp">{{ c.createdAt?.toLocaleString?.() || "" }}</span>
          <span v-if="c.type === 'question' && !c.resolvedAt" class="tag">未解決</span>
          <span v-if="c.resolvedAt" class="tag done">解決</span>
        </div>
        <p class="body">{{ c.body }}</p>
        <div class="actions">
          <button
            v-if="c.type === 'question'"
            class="btn ghost"
            @click="emit('resolve-question', c.id, !c.resolvedAt)"
          >
            {{ c.resolvedAt ? "再オープン" : "解決にする" }}
          </button>
          <button v-if="c.type === 'request'" class="btn ghost" @click="emit('subtaskify', c.id)">
            サブタスク化
          </button>
        </div>
      </article>
      <p v-if="!sorted.length" class="empty">まだコメントはありません</p>
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

.composer {
  border: 1px solid #e6e8ee;
  border-radius: 10px;
  padding: 10px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.composer select,
.composer textarea {
  width: 100%;
  border-radius: 10px;
  border: 1px solid #e6e8ee;
  padding: 8px 10px;
  font-family: inherit;
}

.composer__actions {
  display: flex;
  justify-content: flex-end;
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
  gap: 10px;
  margin-top: 12px;
}

.comment {
  border: 1px solid #e6e8ee;
  border-radius: 10px;
  padding: 10px 12px;
  background: #fff;
}

.comment.decision {
  border-left: 4px solid #4f7c82;
}

.comment.question {
  border-left: 4px solid #f59e0b;
}

.comment.request {
  border-left: 4px solid #0ea5e9;
}

.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #94a3b8;
}

.badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  text-transform: capitalize;
}

.tag {
  padding: 2px 6px;
  border-radius: 999px;
  background: #fff7ed;
  color: #c2410c;
  border: 1px solid #fed7aa;
}

.tag.done {
  background: #ecfdf3;
  color: #15803d;
  border-color: #bbf7d0;
}

.body {
  margin: 6px 0;
  line-height: 1.6;
}

.actions {
  display: flex;
  gap: 8px;
}

.empty {
  margin: 0;
  color: #94a3b8;
}
</style>

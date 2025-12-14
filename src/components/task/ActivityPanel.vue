<script setup lang="ts">
import type { ActivityEvent } from "@/types/task";

defineProps<{
  events: ActivityEvent[];
}>();
</script>

<template>
  <section class="section-card">
    <div class="section-title">Activity</div>
    <div class="timeline">
      <div v-for="ev in events" :key="ev.id" class="event">
        <div class="dot"></div>
        <div class="content">
          <p class="title">
            <strong>{{ ev.eventType }}</strong>
            <span v-if="ev.fieldName"> · {{ ev.fieldName }}</span>
          </p>
          <p class="meta">{{ ev.createdAt?.toLocaleString?.() || "" }}</p>
        </div>
      </div>
      <p v-if="!events.length" class="empty">アクティビティはまだありません</p>
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

.timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.event {
  display: grid;
  grid-template-columns: 16px 1fr;
  gap: 8px;
  align-items: flex-start;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #cbd5e1;
  margin-top: 5px;
}

.content {
  border: 1px solid #e6e8ee;
  border-radius: 10px;
  padding: 8px 10px;
  background: #f8fafc;
}

.title {
  margin: 0;
  font-weight: 600;
}

.meta {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}

.empty {
  margin: 0;
  color: #94a3b8;
}
</style>

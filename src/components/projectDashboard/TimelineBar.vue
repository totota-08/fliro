<script setup lang="ts">
import { computed } from "vue";

type Milestone = {
  label: string;
  date: Date;
  key: string;
};

const props = defineProps<{
  projectName?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  tasks?: { id: string; title: string; dueDate?: Date | null }[];
}>();

const start = computed(() => props.startDate || new Date());
const end = computed(() => {
  const taskEnd = props.tasks?.reduce<Date | null>((max, task) => {
    if (!task.dueDate) return max;
    if (!max || task.dueDate > max) return task.dueDate;
    return max;
  }, null);
  return props.endDate || taskEnd || start.value;
});

const milestones = computed<Milestone[]>(() => {
  const list: Milestone[] = (props.tasks || [])
    .filter((task) => task.dueDate)
    .map((task) => ({
      key: task.id,
      label: task.title || "タスク",
      date: task.dueDate as Date,
    }));
  list.sort((a, b) => a.date.getTime() - b.date.getTime());
  return [
    { key: "start", label: "開始", date: start.value },
    ...list,
    { key: "end", label: "ゴール", date: end.value },
  ];
});

const progress = computed(() => {
  const now = Date.now();
  const total = end.value.getTime() - start.value.getTime();
  if (total <= 0) return 0;
  const elapsed = now - start.value.getTime();
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
});

function positionPercent(date: Date) {
  const total = end.value.getTime() - start.value.getTime();
  if (total <= 0) return 0;
  const diff = date.getTime() - start.value.getTime();
  return Math.min(100, Math.max(0, (diff / total) * 100));
}
</script>

<template>
  <div class="timeline">
    <div class="timeline__bar">
      <div class="timeline__track" />
      <div class="timeline__progress" :style="{ width: `${progress}%` }" />
      <div class="timeline__now" :style="{ left: `${progress}%` }">
        <span>今日</span>
      </div>
      <div
        v-for="milestone in milestones"
        :key="milestone.key"
        class="timeline__point"
        :style="{ left: `${positionPercent(milestone.date)}%` }"
      >
        <span class="dot" :class="{ 'dot--end': milestone.key === 'end' }" />
        <p class="label">{{ milestone.label }}</p>
      </div>
    </div>
    <div class="timeline__meta">
      <span>開始: {{ start.toLocaleDateString() }}</span>
      <span>終了: {{ end.toLocaleDateString() }}</span>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  border: 1px solid var(--ui-border-light);
  border-radius: var(--ui-radius-xl);
  padding: var(--ui-space-4) var(--ui-space-5);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-lg);
  display: grid;
  gap: var(--ui-space-3);
}

.timeline__bar {
  position: relative;
  height: var(--ui-space-12);
}

.timeline__track {
  position: absolute;
  top: 22px;
  left: 0;
  right: 0;
  height: var(--ui-space-1);
  background: var(--ui-chart-gray-light);
  border-radius: var(--ui-radius-full);
}

.timeline__progress {
  position: absolute;
  top: 22px;
  left: 0;
  height: var(--ui-space-1);
  background: var(--ui-brand-900);
  border-radius: var(--ui-radius-full);
  transition: width var(--ui-duration-base) var(--ui-ease-standard);
}

.timeline__now {
  position: absolute;
  top: 6px;
  transform: translateX(-50%);
  background: var(--ui-brand-900);
  color: var(--ui-text-inverse);
  padding: var(--ui-space-1) var(--ui-space-2);
  border-radius: var(--ui-radius-md);
  font-size: var(--ui-text-sm);
}

.timeline__point {
  position: absolute;
  top: var(--ui-space-2);
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-1);
  max-width: 120px;
}

.dot {
  width: var(--ui-space-3);
  height: var(--ui-space-3);
  border-radius: 50%;
  background: var(--ui-brand-900);
  border: 2px solid var(--ui-surface);
  box-shadow: var(--ui-shadow-md);
}

.dot--end {
  background: var(--ui-brand-600);
}

.label {
  margin: 0;
  font-size: var(--ui-text-sm);
  color: var(--ui-brand-900);
  text-align: center;
  line-height: var(--ui-leading-tight);
}

.timeline__meta {
  display: flex;
  justify-content: space-between;
  font-size: var(--ui-text-sm);
  color: var(--ui-gray-600);
}
</style>

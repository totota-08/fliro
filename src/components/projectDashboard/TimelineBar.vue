<script setup lang="ts">
import { computed } from 'vue'

type Milestone = {
  label: string
  date: Date
  key: string
}

const props = defineProps<{
  projectName?: string
  startDate?: Date | null
  endDate?: Date | null
  tasks?: { id: string; title: string; dueDate?: Date | null }[]
}>()

const start = computed(() => props.startDate || new Date())
const end = computed(() => {
  const taskEnd = props.tasks?.reduce<Date | null>((max, task) => {
    if (!task.dueDate) return max
    if (!max || task.dueDate > max) return task.dueDate
    return max
  }, null)
  return props.endDate || taskEnd || start.value
})

const milestones = computed<Milestone[]>(() => {
  const list: Milestone[] = (props.tasks || [])
    .filter((task) => task.dueDate)
    .map((task) => ({
      key: task.id,
      label: task.title || 'タスク',
      date: task.dueDate as Date,
    }))
  list.sort((a, b) => a.date.getTime() - b.date.getTime())
  return [
    { key: 'start', label: '開始', date: start.value },
    ...list,
    { key: 'end', label: 'ゴール', date: end.value },
  ]
})

const progress = computed(() => {
  const now = Date.now()
  const total = end.value.getTime() - start.value.getTime()
  if (total <= 0) return 0
  const elapsed = now - start.value.getTime()
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
})

function positionPercent(date: Date) {
  const total = end.value.getTime() - start.value.getTime()
  if (total <= 0) return 0
  const diff = date.getTime() - start.value.getTime()
  return Math.min(100, Math.max(0, (diff / total) * 100))
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
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 1.25rem;
  padding: 1rem 1.25rem;
  background: #fff;
  box-shadow: 0 12px 20px rgba(11, 46, 51, 0.08);
  display: grid;
  gap: 0.75rem;
}

.timeline__bar {
  position: relative;
  height: 48px;
}

.timeline__track {
  position: absolute;
  top: 22px;
  left: 0;
  right: 0;
  height: 4px;
  background: #e5e7eb;
  border-radius: 999px;
}

.timeline__progress {
  position: absolute;
  top: 22px;
  left: 0;
  height: 4px;
  background: #0b2e33;
  border-radius: 999px;
  transition: width 0.2s ease;
}

.timeline__now {
  position: absolute;
  top: 6px;
  transform: translateX(-50%);
  background: #0b2e33;
  color: #fff;
  padding: 0.15rem 0.55rem;
  border-radius: 0.7rem;
  font-size: 0.85rem;
}

.timeline__point {
  position: absolute;
  top: 8px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  max-width: 120px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #0b2e33;
  border: 2px solid #fff;
  box-shadow: 0 4px 10px rgba(11, 46, 51, 0.2);
}

.dot--end {
  background: #4f7c82;
}

.label {
  margin: 0;
  font-size: 0.9rem;
  color: #0b2e33;
  text-align: center;
  line-height: 1.2;
}

.timeline__meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: #4b5563;
}
</style>

<script setup lang="ts">
import type { TaskDoc, TaskStatus } from "@/services/taskService";
import { computed } from "vue";

const props = defineProps<{
  tasks: TaskDoc[];
}>();

function isTaskOverdue(task: TaskDoc) {
  if (!task.dueDate?.seconds) return false;
  const due = task.dueDate.seconds * 1000;
  return due < Date.now() && task.status !== "done";
}

const overallProgress = computed(() => {
  const total = props.tasks.length;
  if (!total) return 0;
  const totalProgress = props.tasks.reduce((sum, task) => {
    return sum + (task.progress ?? (task.status === "done" ? 100 : 0));
  }, 0);
  return Math.round(totalProgress / total);
});

const statusCounts = computed(() => {
  const counts: Record<TaskStatus, number> = {
    todo: 0,
    "in-progress": 0,
    done: 0,
  };
  props.tasks.forEach((task) => {
    counts[task.status] = (counts[task.status] || 0) + 1;
  });
  return counts;
});

const maxStatusCount = computed(() => {
  const values = Object.values(statusCounts.value);
  return Math.max(1, ...values);
});

const gaugeRadius = 80;
const gaugeCircumference = Math.PI * gaugeRadius;

const healthScore = computed(() => {
  const overdue = props.tasks.filter((task) => isTaskOverdue(task)).length;
  const now = Date.now();
  const soonThreshold = 3 * 24 * 60 * 60 * 1000;
  const dueSoon = props.tasks.filter(
    (task) =>
      task.dueDate?.seconds &&
      task.dueDate.seconds * 1000 - now <= soonThreshold &&
      task.dueDate.seconds * 1000 > now,
  ).length;
  const progressPenalty = Math.max(0, 70 - overallProgress.value) * 0.4;
  let score = 100;
  score -= overdue * 12;
  score -= dueSoon * 5;
  score -= progressPenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
});

const healthColor = computed(() => {
  if (healthScore.value >= 80) return "#16a34a";
  if (healthScore.value >= 60) return "#f59e0b";
  if (healthScore.value >= 40) return "#f97316";
  return "#ef4444";
});

const gaugeDashoffset = computed(
  () => gaugeCircumference * (1 - healthScore.value / 100),
);

const healthNeedleRotation = computed(
  () => -90 + (healthScore.value / 100) * 180,
);

const gaugeSegments = [
  { id: "danger", color: "#ef4444", size: 40 },
  { id: "warn", color: "#f97316", size: 20 },
  { id: "caution", color: "#f59e0b", size: 20 },
  { id: "good", color: "#16a34a", size: 20 },
];

const gaugeSegmentStyles = computed(() => {
  let offset = 0;
  return gaugeSegments.map((segment) => {
    const len = gaugeCircumference * (segment.size / 100);
    const style = {
      stroke: segment.color,
      strokeDasharray: `${len} ${gaugeCircumference - len}`,
      strokeDashoffset: `${-offset}`,
    };
    offset += len;
    return style;
  });
});
</script>

<template>
  <section class="dashboard__charts">
    <div class="chart-card chart-card--donut">
      <header class="chart-card__header">
        <p class="chart-card__eyebrow">全体の進捗</p>
        <h3>プロジェクト進捗</h3>
        <span class="chart-card__meta">{{ tasks.length }}件のタスク</span>
      </header>
      <span class="chart-card__metric">{{ overallProgress }}%</span>
      <div class="progress-chart">
        <div class="progress-chart__track">
          <div
            class="progress-chart__fill"
            :style="{ width: `${overallProgress}%` }"
          />
        </div>
        <div class="progress-chart__labels">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
    </div>

    <div class="chart-card chart-card--bars">
      <header class="chart-card__header">
        <p class="chart-card__eyebrow">タスクの状況</p>
        <h3>ステータス別タスク数</h3>
      </header>
      <ul class="status-bars">
        <li class="status-bars__row">
          <div class="status-bars__label">
            <span>未着手</span>
            <strong>{{ statusCounts.todo }}</strong>
          </div>
          <div class="status-bars__track">
            <div
              class="status-bars__fill status-bars__fill--todo"
              :style="{
                width: `${Math.max((statusCounts.todo / maxStatusCount) * 100, 6)}%`,
              }"
            />
          </div>
        </li>
        <li class="status-bars__row">
          <div class="status-bars__label">
            <span>進行中</span>
            <strong>{{ statusCounts["in-progress"] }}</strong>
          </div>
          <div class="status-bars__track">
            <div
              class="status-bars__fill status-bars__fill--progress"
              :style="{
                width: `${Math.max((statusCounts['in-progress'] / maxStatusCount) * 100, 6)}%`,
              }"
            />
          </div>
        </li>
        <li class="status-bars__row">
          <div class="status-bars__label">
            <span>完了</span>
            <strong>{{ statusCounts.done }}</strong>
          </div>
          <div class="status-bars__track">
            <div
              class="status-bars__fill status-bars__fill--done"
              :style="{
                width: `${Math.max((statusCounts.done / maxStatusCount) * 100, 6)}%`,
              }"
            />
          </div>
        </li>
      </ul>
    </div>

    <div class="chart-card chart-card--gauge">
      <header class="chart-card__header">
        <p class="chart-card__eyebrow">プロジェクトの危険度</p>
        <h3>ヘルススコア</h3>
        <span class="chart-card__meta">期限・進捗から算出</span>
      </header>
      <span class="chart-card__metric chart-card__metric--health"
        >{{ healthScore }}%</span
      >
      <div class="gauge-chart">
        <svg viewBox="0 0 200 120">
          <path class="gauge-chart__base" d="M20 120 A80 80 0 0 1 180 120" />
          <path
            v-for="(segment, index) in gaugeSegments"
            :key="segment.id"
            class="gauge-chart__segment"
            d="M20 120 A80 80 0 0 1 180 120"
            :style="gaugeSegmentStyles[index]"
          />
          <path
            class="gauge-chart__value-path"
            d="M20 120 A80 80 0 0 1 180 120"
            :style="{
              strokeDasharray: `${gaugeCircumference}`,
              strokeDashoffset: `${gaugeDashoffset}`,
              stroke: healthColor,
            }"
          />
          <polygon
            class="gauge-chart__needle"
            points="100,28 96,120 104,120"
            :transform="`rotate(${healthNeedleRotation} 100 120)`"
          />
          <circle class="gauge-chart__needle-hub" cx="100" cy="120" r="6" />
        </svg>
        <div class="gauge-chart__legend">
          <span class="gauge-chart__legend-item">
            <span
              class="gauge-chart__legend-dot gauge-chart__legend-dot--danger"
              aria-hidden="true"
            ></span>
            危険
          </span>
          <span class="gauge-chart__legend-item">
            <span
              class="gauge-chart__legend-dot gauge-chart__legend-dot--warn"
              aria-hidden="true"
            ></span>
            要対応
          </span>
          <span class="gauge-chart__legend-item">
            <span
              class="gauge-chart__legend-dot gauge-chart__legend-dot--caution"
              aria-hidden="true"
            ></span>
            注意
          </span>
          <span class="gauge-chart__legend-item">
            <span
              class="gauge-chart__legend-dot gauge-chart__legend-dot--good"
              aria-hidden="true"
            ></span>
            良好
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dashboard__charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--ui-space-4, 1rem);
  align-items: stretch;
}

.chart-card {
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-4, 1rem) var(--ui-space-5, 1.25rem);
  box-shadow: var(--ui-shadow-lg);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
  position: relative;
}

.chart-card__header {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.chart-card__header h3 {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  color: var(--ui-brand-900, #0b2e33);
}

.chart-card__eyebrow {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.chart-card__meta {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.chart-card__metric {
  position: absolute;
  top: var(--ui-space-3, 0.75rem);
  right: var(--ui-space-4, 1rem);
  background: var(--ui-brand-900, #0b2e33);
  color: var(--ui-surface, #ffffff);
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-full, 9999px);
  font-weight: var(--ui-font-bold, 700);
  font-size: var(--ui-text-base, 1rem);
  box-shadow: var(--ui-shadow-md);
}

.chart-card__metric--health {
  background: var(--ui-brand-600, #4f7c82);
}

.progress-chart {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
  margin-top: var(--ui-space-1, 0.25rem);
}

.progress-chart__track {
  height: 14px;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-border-light, rgba(11, 46, 51, 0.08));
  overflow: hidden;
}

.progress-chart__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    var(--ui-brand-600, #4f7c82),
    var(--ui-brand-900, #0b2e33)
  );
  transition: width 0.3s ease;
}

.progress-chart__labels {
  display: flex;
  justify-content: space-between;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.status-bars {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.status-bars__row {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.status-bars__label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-brand-900, #0b2e33);
}

.status-bars__label strong {
  font-size: var(--ui-text-base, 1rem);
}

.status-bars__track {
  background: var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-full, 9999px);
  overflow: hidden;
  height: 0.6rem;
}

.status-bars__fill {
  height: 100%;
  border-radius: inherit;
  transition: width 0.3s ease;
}

.status-bars__fill--todo {
  background: var(--ui-border-strong);
}

.status-bars__fill--progress {
  background: var(--ui-brand-600, #4f7c82);
}

.status-bars__fill--review {
  background: var(--ui-warning, #f59e0b);
}

.status-bars__fill--done {
  background: var(--ui-success, #16a34a);
}

.gauge-chart {
  position: relative;
  padding: var(--ui-space-1, 0.25rem) 0.1rem;
}

.gauge-chart svg {
  width: 100%;
  height: 160px;
}

.gauge-chart__base {
  fill: none;
  stroke: var(--ui-border-light, rgba(11, 46, 51, 0.08));
  stroke-width: 20;
  stroke-linecap: round;
}

.gauge-chart__segment {
  fill: none;
  stroke-width: 20;
  stroke-linecap: butt;
  opacity: 0.25;
}

.gauge-chart__value-path {
  fill: none;
  stroke: var(--ui-brand-600, #4f7c82);
  stroke-width: 20;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.4s ease;
}

.gauge-chart__needle {
  fill: var(--ui-text-strong, #0f172a);
  transition: transform 0.35s ease;
}

.gauge-chart__needle-hub {
  fill: var(--ui-surface, #ffffff);
  stroke: var(--ui-brand-900, #0b2e33);
  stroke-width: 2;
}

.gauge-chart__legend {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--ui-space-1, 0.25rem);
  text-align: left;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  margin-top: var(--ui-space-1, 0.25rem);
}

.gauge-chart__legend-item {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1, 0.25rem);
  white-space: nowrap;
}

.gauge-chart__legend-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--ui-radius-full, 9999px);
  display: inline-block;
}

.gauge-chart__legend-dot--danger {
  background: var(--ui-danger, #ef4444);
}

.gauge-chart__legend-dot--warn {
  background: var(--ui-warn, #f97316);
}

.gauge-chart__legend-dot--caution {
  background: var(--ui-warning, #f59e0b);
}

.gauge-chart__legend-dot--good {
  background: var(--ui-success, #16a34a);
}
</style>

<script setup lang="ts">
/**
 * DashboardInsights コンポーネント
 *
 * プロジェクトの進捗、ステータス別タスク数、ヘルススコアを表示するチャート群。
 * カードの表示/非表示と並び順は cardConfig で制御可能。
 */
import type { InsightCardConfig } from "@/services/dashboardSettingsService";
import type { TaskDoc, TaskStatus } from "@/services/taskService";
import { computed } from "vue";

interface Props {
  /** タスク一覧 */
  tasks: TaskDoc[];
  /** カード設定（オプション） */
  cardConfig?: InsightCardConfig[];
}

const props = withDefaults(defineProps<Props>(), {
  cardConfig: () => [
    { id: "progress", type: "progress", position: 0, visible: true },
    { id: "status", type: "status", position: 1, visible: true },
    { id: "health", type: "health", position: 2, visible: true },
  ],
});

// 表示するカードを並び順でソート（visible: true のみ）
const visibleCards = computed(() =>
  [...props.cardConfig]
    .filter((c) => c.visible)
    .sort((a, b) => a.position - b.position),
);

// 全体の進捗率
const overallProgress = computed(() => {
  const total = props.tasks.length;
  if (!total) return 0;
  const totalProgress = props.tasks.reduce((sum, task) => {
    return sum + (task.progress ?? (task.status === "done" ? 100 : 0));
  }, 0);
  return Math.round(totalProgress / total);
});

// ステータス別カウント
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

// ヘルススコア計算
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

// ゲージ描画用
const gaugeRadius = 80;
const gaugeCircumference = Math.PI * gaugeRadius;

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

function isTaskOverdue(task: TaskDoc) {
  if (!task.dueDate?.seconds) return false;
  const due = task.dueDate.seconds * 1000;
  return due < Date.now() && task.status !== "done";
}
</script>

<template>
  <section v-if="visibleCards.length > 0" class="dashboard-insights">
    <header class="dashboard-insights__header">
      <h3 class="dashboard-insights__title">インサイト</h3>
    </header>

    <div class="dashboard-insights__content">
      <div class="dashboard-insights__charts">
        <template v-for="card in visibleCards" :key="card.id">
          <!-- 全体の進捗 -->
          <div
            v-if="card.type === 'progress'"
            class="chart-card chart-card--progress"
          >
            <header class="chart-card__header">
              <p class="chart-card__eyebrow">全体の進捗</p>
              <h4>プロジェクト進捗</h4>
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

          <!-- ステータス別タスク数 -->
          <div
            v-else-if="card.type === 'status'"
            class="chart-card chart-card--bars"
          >
            <header class="chart-card__header">
              <p class="chart-card__eyebrow">タスクの状況</p>
              <h4>ステータス別タスク数</h4>
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

          <!-- ヘルススコア -->
          <div
            v-else-if="card.type === 'health'"
            class="chart-card chart-card--gauge"
          >
            <header class="chart-card__header">
              <p class="chart-card__eyebrow">プロジェクトの危険度</p>
              <h4>ヘルススコア</h4>
              <span class="chart-card__meta">期限・進捗から算出</span>
            </header>
            <span class="chart-card__metric chart-card__metric--health">
              {{ healthScore }}%
            </span>
            <div class="gauge-chart">
              <svg viewBox="0 0 200 120">
                <path
                  class="gauge-chart__base"
                  d="M20 120 A80 80 0 0 1 180 120"
                />
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
                <circle
                  class="gauge-chart__needle-hub"
                  cx="100"
                  cy="120"
                  r="6"
                />
              </svg>
              <div class="gauge-chart__legend">
                <span class="gauge-chart__legend-item">
                  <span
                    class="gauge-chart__legend-dot gauge-chart__legend-dot--danger"
                    aria-hidden="true"
                  />
                  危険
                </span>
                <span class="gauge-chart__legend-item">
                  <span
                    class="gauge-chart__legend-dot gauge-chart__legend-dot--warn"
                    aria-hidden="true"
                  />
                  要対応
                </span>
                <span class="gauge-chart__legend-item">
                  <span
                    class="gauge-chart__legend-dot gauge-chart__legend-dot--caution"
                    aria-hidden="true"
                  />
                  注意
                </span>
                <span class="gauge-chart__legend-item">
                  <span
                    class="gauge-chart__legend-dot gauge-chart__legend-dot--good"
                    aria-hidden="true"
                  />
                  良好
                </span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dashboard-insights {
  background: var(--surface, #fff);
  border: 1px solid var(--border-color, rgba(11, 46, 51, 0.08));
  border-radius: var(--radius-lg, 1.25rem);
  padding: var(--gap-lg, 1.25rem);
  margin-bottom: var(--gap-lg, 1.5rem);
}

.dashboard-insights__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--gap-lg, 1rem);
}

.dashboard-insights__title {
  margin: 0;
  font-size: var(--font-size-lg, 1.15rem);
  font-weight: var(--font-weight-bold, 700);
  color: var(--brand, #0b2e33);
}

.dashboard-insights__charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--gap-lg, 1rem);
}

/* Chart Card */
.chart-card {
  background: var(--surface, #fff);
  border: 1px solid var(--border-color, rgba(11, 46, 51, 0.08));
  border-radius: var(--radius-md, 1.1rem);
  padding: var(--gap-lg, 1rem) var(--gap-lg, 1.25rem);
  box-shadow: var(--shadow-sm, 0 4px 12px rgba(11, 46, 51, 0.04));
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  position: relative;
}

.chart-card__header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.chart-card__header h4 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--brand, #0b2e33);
}

.chart-card__eyebrow {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted, #4f7c82);
}

.chart-card__meta {
  font-size: 0.85rem;
  color: var(--text-muted, #4f7c82);
}

.chart-card__metric {
  position: absolute;
  top: 0.85rem;
  right: 1rem;
  background: var(--brand, #0b2e33);
  color: #fff;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.9rem;
  box-shadow: 0 4px 12px rgba(11, 46, 51, 0.18);
}

.chart-card__metric--health {
  background: var(--brand-muted, #4f7c82);
}

/* Progress Chart */
.progress-chart {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.25rem;
}

.progress-chart__track {
  height: 14px;
  border-radius: 999px;
  background: var(--ui-border-light);
  overflow: hidden;
}

.progress-chart__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    var(--brand-600, #4f7c82),
    var(--brand-900, #0b2e33)
  );
  transition: width 0.3s ease;
}

.progress-chart__labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--text-muted, #4f7c82);
}

/* Status Bars */
.status-bars {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.status-bars__row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.status-bars__label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: var(--brand, #0b2e33);
}

.status-bars__label strong {
  font-size: 1rem;
}

.status-bars__track {
  background: var(--ui-border-light);
  border-radius: 999px;
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
  background: var(--brand-600, #4f7c82);
}

.status-bars__fill--review {
  background: var(--warning, #f59e0b);
}

.status-bars__fill--done {
  background: var(--success, #16a34a);
}

/* Gauge Chart */
.gauge-chart {
  position: relative;
  padding: 0.25rem 0.1rem;
}

.gauge-chart svg {
  width: 100%;
  height: 140px;
}

.gauge-chart__base {
  fill: none;
  stroke: var(--ui-border-light);
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
  stroke: var(--brand-600, #4f7c82);
  stroke-width: 20;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.4s ease;
}

.gauge-chart__needle {
  fill: var(--text, #0b2e33);
  transition: transform 0.35s ease;
}

.gauge-chart__needle-hub {
  fill: var(--surface, #fff);
  stroke: var(--brand-900, #0b2e33);
  stroke-width: 2;
}

.gauge-chart__legend {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.35rem;
  text-align: left;
  font-size: 0.8rem;
  color: var(--text-muted, #4f7c82);
  margin-top: 0.15rem;
}

.gauge-chart__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
}

.gauge-chart__legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  display: inline-block;
}

.gauge-chart__legend-dot--danger {
  background: var(--danger, #ef4444);
}

.gauge-chart__legend-dot--warn {
  background: var(--warn, #f97316);
}

.gauge-chart__legend-dot--caution {
  background: var(--warning, #f59e0b);
}

.gauge-chart__legend-dot--good {
  background: var(--success, #16a34a);
}

/* Screen reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .dashboard-insights__toggle-icon,
  .progress-chart__fill,
  .status-bars__fill,
  .gauge-chart__value-path,
  .gauge-chart__needle {
    transition: none;
  }

  .dashboard-insights__content {
    animation: none;
  }
}

/* Responsive */
@media (max-width: 768px) {
  .dashboard-insights__charts {
    grid-template-columns: 1fr;
  }

  .gauge-chart__legend {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

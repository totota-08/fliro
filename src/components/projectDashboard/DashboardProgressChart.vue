<script setup lang="ts">
const props = defineProps<{
  progress: number
  totalTasks: number
  doneTasks: number
}>()

const RADIUS = 36
const CIRC = 2 * Math.PI * RADIUS

const dashOffset = () => CIRC * (1 - Math.min(Math.max(props.progress, 0), 100) / 100)
</script>

<template>
  <div class="chart">
    <svg :width="96" :height="96" viewBox="0 0 96 96">
      <circle class="track" :cx="48" :cy="48" :r="RADIUS" />
      <circle
        class="progress"
        :cx="48"
        :cy="48"
        :r="RADIUS"
        :stroke-dasharray="CIRC"
        :stroke-dashoffset="dashOffset()"
      />
    </svg>
    <div class="chart__content">
      <strong>{{ Math.round(progress) }}%</strong>
      <small>{{ doneTasks }}/{{ totalTasks }}</small>
    </div>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  width: 96px;
  height: 96px;
}

.track {
  fill: none;
  stroke: #e5e7eb;
  stroke-width: 8;
  opacity: 0.8;
}

.progress {
  fill: none;
  stroke: #0b2e33;
  stroke-width: 8;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: 48px 48px;
  transition: stroke-dashoffset 0.3s ease;
}

.chart__content {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  gap: 2px;
  font-weight: 700;
  color: #0b2e33;
}

.chart__content small {
  font-weight: 600;
  color: #6b7280;
}
</style>

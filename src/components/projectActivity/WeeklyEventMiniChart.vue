<script setup lang="ts">
import { computed } from "vue";
type SeriesPoint = {
  key: string;
  label: string;
  total: number;
};

const props = defineProps<{
  series: SeriesPoint[];
  max?: number;
}>();

const maxValue = computed(() => {
  const provided = props.max ?? 0;
  const localMax = props.series.reduce((m, p) => Math.max(m, p.total), 0);
  return Math.max(provided, localMax, 1);
});

function barHeight(total: number) {
  return Math.round((total / maxValue.value) * 100);
}
</script>

<template>
  <div class="chart" role="img" aria-label="直近7日間のイベント推移">
    <svg viewBox="0 0 200 140" preserveAspectRatio="none">
      <g v-for="(point, index) in series" :key="point.key">
        <rect
          class="chart__bar"
          :x="index * (200 / series.length) + 6"
          :y="130 - barHeight(point.total)"
          :width="200 / series.length - 12"
          :height="barHeight(point.total)"
          rx="3"
          ry="3"
        />
        <text
          v-if="point.total > 0"
          class="chart__value"
          :x="index * (200 / series.length) + 200 / series.length / 2"
          :y="130 - barHeight(point.total) - 4"
        >
          {{ point.total }}
        </text>
        <text
          class="chart__label"
          :x="index * (200 / series.length) + 200 / series.length / 2"
          y="138"
        >
          {{ point.label }}
        </text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.chart {
  width: 100%;
}

.chart svg {
  width: 100%;
  height: 160px;
}

.chart__bar {
  fill: #2d6cdf;
  opacity: 0.85;
}

.chart__value {
  font-size: 10px;
  fill: #0f172a;
  text-anchor: middle;
}

.chart__label {
  font-size: 11px;
  fill: #475467;
  text-anchor: middle;
}
</style>

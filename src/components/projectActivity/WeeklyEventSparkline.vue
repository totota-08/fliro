<script setup lang="ts">
import { computed, ref } from "vue";

type SeriesPoint = {
  key: string;
  label: string;
  total: number;
};

const props = defineProps<{
  series: SeriesPoint[];
  todayKey?: string;
}>();

const maxValue = computed(() => {
  const max = props.series.reduce((m, p) => Math.max(m, p.total), 0);
  return Math.max(1, max);
});

const todayIndex = computed(() =>
  props.series.findIndex((item) => item.key === props.todayKey),
);

const labels = computed(() => {
  const len = props.series.length;
  const first = props.series[0]?.label ?? "";
  const mid = props.series[Math.floor(len / 2)]?.label ?? "";
  const last = props.series[len - 1]?.label ?? "";
  return { first, mid, last };
});

const activeIndex = ref<number | null>(null);
const tooltipPoint = computed(() =>
  activeIndex.value == null ? null : props.series[activeIndex.value],
);
const tooltipLeft = computed(() => {
  if (activeIndex.value == null) return "0%";
  const step = 100 / props.series.length;
  return `${activeIndex.value * step + step / 2}%`;
});

function handleEnter(index: number) {
  activeIndex.value = index;
}

function handleLeave() {
  activeIndex.value = null;
}
</script>

<template>
  <div class="sparkline" role="img" aria-label="直近7日のイベント推移">
    <div class="sparkline__bars" @mouseleave="handleLeave">
      <button
        v-for="(point, index) in series"
        :key="point.key"
        type="button"
        class="sparkline__bar"
        :class="{
          'is-today': index === todayIndex,
        }"
        :aria-label="`${point.label} ${point.total}件`"
        @mouseenter="handleEnter(index)"
        @focus="handleEnter(index)"
        @blur="handleLeave"
        @click="handleEnter(index)"
      >
        <div class="sparkline__track" />
        <div
          class="sparkline__fill"
          :class="{ 'is-empty': point.total === 0 }"
          :style="{
            height: `${Math.max((point.total / maxValue) * 100, point.total > 0 ? 8 : 0)}%`,
          }"
        />
      </button>
      <div
        v-if="tooltipPoint"
        class="sparkline__tooltip"
        :style="{ left: tooltipLeft }"
      >
        <span>{{ tooltipPoint.label }}</span>
        <strong>{{ tooltipPoint.total }}件</strong>
      </div>
    </div>
    <div class="sparkline__labels">
      <span>{{ labels.first }}</span>
      <span>{{ labels.mid }}</span>
      <span>{{ labels.last }}</span>
      <span v-if="todayIndex !== -1" class="sparkline__badge">今日</span>
    </div>
    <p v-if="series.every((p) => p.total === 0)" class="sparkline__empty">
      この7日間はイベントがありません
    </p>
  </div>
</template>

<style scoped>
.sparkline {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sparkline__bars {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  align-items: flex-end;
  gap: 6px;
  height: 82px;
  position: relative;
}

.sparkline__bar {
  position: relative;
  height: 100%;
  display: flex;
  align-items: flex-end;
  border: none;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.sparkline__track {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100%;
  border-radius: 6px;
  background: rgba(11, 46, 51, 0.08);
}

.sparkline__fill {
  position: relative;
  width: 100%;
  background: linear-gradient(180deg, #2d6cdf, #1f6feb);
  border-radius: 6px;
  min-height: 0;
}

.sparkline__bar.is-today .sparkline__fill {
  background: linear-gradient(180deg, #2563eb, #1d4ed8);
}

.sparkline__fill.is-empty {
  background: transparent;
}

.sparkline__labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #475467;
  gap: 0.5rem;
}

.sparkline__empty {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.sparkline__tooltip {
  position: absolute;
  bottom: 90px;
  transform: translateX(-50%);
  background: #0b2e33;
  color: #fff;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.sparkline__tooltip strong {
  margin-left: 6px;
  font-weight: 700;
}

.sparkline__badge {
  padding: 2px 6px;
  border-radius: 999px;
  background: #e8eef5;
  color: #0b2e33;
  font-size: 11px;
}
</style>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";

interface Props {
  modelValue: string | null;
  placeholder?: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  placeholder: "日付を選択",
  disabled: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: string | null];
}>();

const isOpen = ref(false);

// 現在表示している月（カレンダーナビゲーション用）
const viewDate = ref(new Date());

// 選択された日付をパース
const selectedDate = computed(() => {
  if (!props.modelValue) return null;
  const date = new Date(props.modelValue);
  return isNaN(date.getTime()) ? null : date;
});

// 表示用のフォーマット
const displayValue = computed(() => {
  if (!selectedDate.value) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(selectedDate.value);
});

// カレンダーヘッダーの月年表示
const monthYearLabel = computed(() => {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
  }).format(viewDate.value);
});

// 曜日ラベル
const weekDays = ["日", "月", "火", "水", "木", "金", "土"];

// カレンダーの日付グリッドを生成
const calendarDays = computed(() => {
  const year = viewDate.value.getFullYear();
  const month = viewDate.value.getMonth();

  // 月の最初の日
  const firstDay = new Date(year, month, 1);
  // 月の最後の日
  const lastDay = new Date(year, month + 1, 0);

  // 週の開始日（日曜）に合わせて前月の日を追加
  const startPadding = firstDay.getDay();

  const days: {
    date: Date;
    day: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
  }[] = [];

  // 前月の日を追加
  for (let i = startPadding - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    days.push({
      date,
      day: date.getDate(),
      isCurrentMonth: false,
      isToday: false,
      isSelected: false,
    });
  }

  // 今日の日付
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 当月の日を追加
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    const isToday = date.getTime() === today.getTime();
    const isSelected =
      selectedDate.value !== null &&
      date.toDateString() === selectedDate.value.toDateString();

    days.push({
      date,
      day: d,
      isCurrentMonth: true,
      isToday,
      isSelected,
    });
  }

  // 次月の日を追加（6行になるように）
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(year, month + 1, d);
    days.push({
      date,
      day: d,
      isCurrentMonth: false,
      isToday: false,
      isSelected: false,
    });
  }

  return days;
});

function toggleCalendar() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;

  // カレンダーを開く時、選択された日付があればその月を表示
  if (isOpen.value && selectedDate.value) {
    viewDate.value = new Date(selectedDate.value);
  }
}

function closeCalendar() {
  isOpen.value = false;
}

function prevMonth() {
  viewDate.value = new Date(
    viewDate.value.getFullYear(),
    viewDate.value.getMonth() - 1,
    1,
  );
}

function nextMonth() {
  viewDate.value = new Date(
    viewDate.value.getFullYear(),
    viewDate.value.getMonth() + 1,
    1,
  );
}

function goToToday() {
  viewDate.value = new Date();
}

function selectDate(day: (typeof calendarDays.value)[0]) {
  const year = day.date.getFullYear();
  const month = String(day.date.getMonth() + 1).padStart(2, "0");
  const date = String(day.date.getDate()).padStart(2, "0");
  emit("update:modelValue", `${year}-${month}-${date}`);
  closeCalendar();
}

function clearDate() {
  emit("update:modelValue", "");
  closeCalendar();
}

// 外側クリックで閉じる
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest(".date-picker")) {
    closeCalendar();
  }
}

watch(isOpen, (open) => {
  if (open) {
    document.addEventListener("click", handleClickOutside);
  } else {
    document.removeEventListener("click", handleClickOutside);
  }
});

// コンポーネントアンマウント時にリスナーをクリーンアップ
onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <div class="date-picker" :class="{ 'date-picker--disabled': disabled }">
    <button
      type="button"
      class="date-picker__trigger"
      :disabled="disabled"
      @click.stop="toggleCalendar"
    >
      <svg
        class="date-picker__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <span :class="{ 'date-picker__placeholder': !displayValue }">
        {{ displayValue || placeholder }}
      </span>
      <svg
        v-if="modelValue"
        class="date-picker__clear"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        @click.stop="clearDate"
      >
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>

    <Transition name="dropdown">
      <div v-if="isOpen" class="date-picker__dropdown" @click.stop>
        <header class="date-picker__header">
          <button
            type="button"
            class="date-picker__nav"
            aria-label="前の月"
            @click="prevMonth"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            class="date-picker__month-label"
            @click="goToToday"
          >
            {{ monthYearLabel }}
          </button>
          <button
            type="button"
            class="date-picker__nav"
            aria-label="次の月"
            @click="nextMonth"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </header>

        <div class="date-picker__weekdays">
          <span
            v-for="day in weekDays"
            :key="day"
            class="date-picker__weekday"
            :class="{
              'date-picker__weekday--weekend': day === '日' || day === '土',
            }"
          >
            {{ day }}
          </span>
        </div>

        <div class="date-picker__days">
          <button
            v-for="(day, index) in calendarDays"
            :key="index"
            type="button"
            class="date-picker__day"
            :class="{
              'date-picker__day--other-month': !day.isCurrentMonth,
              'date-picker__day--today': day.isToday,
              'date-picker__day--selected': day.isSelected,
              'date-picker__day--weekend': index % 7 === 0 || index % 7 === 6,
            }"
            @click="selectDate(day)"
          >
            {{ day.day }}
          </button>
        </div>

        <footer class="date-picker__footer">
          <button
            type="button"
            class="date-picker__today-btn"
            @click="goToToday"
          >
            今日
          </button>
          <button
            type="button"
            class="date-picker__clear-btn"
            @click="clearDate"
          >
            クリア
          </button>
        </footer>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.date-picker {
  position: relative;
  width: 100%;
}

.date-picker--disabled {
  opacity: 0.6;
  pointer-events: none;
}

.date-picker__trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface, #ffffff);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text, #0b2e33);
  cursor: pointer;
  transition: var(--ui-transition-colors);
  text-align: left;
}

.date-picker__trigger:hover:not(:disabled) {
  border-color: var(--ui-border-focus, #4f7c82);
}

.date-picker__trigger:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.date-picker__icon {
  width: 18px;
  height: 18px;
  color: var(--ui-text-muted, #64748b);
  flex-shrink: 0;
}

.date-picker__placeholder {
  color: var(--ui-text-muted, #64748b);
}

.date-picker__clear {
  width: 16px;
  height: 16px;
  margin-left: auto;
  color: var(--ui-text-muted, #64748b);
  cursor: pointer;
  transition: color 0.15s ease;
}

.date-picker__clear:hover {
  color: var(--ui-danger, #ef4444);
}

.date-picker__dropdown {
  position: absolute;
  top: calc(100% + var(--ui-space-2, 0.5rem));
  left: 0;
  z-index: 50;
  width: 280px;
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  box-shadow: var(--ui-shadow-lg);
  padding: var(--ui-space-3, 0.75rem);
}

.date-picker__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--ui-space-3, 0.75rem);
}

.date-picker__nav {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: var(--ui-radius-md, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.date-picker__nav:hover {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text, #0b2e33);
}

.date-picker__nav svg {
  width: 18px;
  height: 18px;
}

.date-picker__month-label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
  border: none;
  background: transparent;
  cursor: pointer;
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  border-radius: var(--ui-radius-sm, 0.5rem);
  transition: background-color 0.15s ease;
}

.date-picker__month-label:hover {
  background: var(--ui-surface-muted, #f1f5f9);
}

.date-picker__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--ui-space-1, 0.25rem);
  margin-bottom: var(--ui-space-2, 0.5rem);
}

.date-picker__weekday {
  text-align: center;
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text-muted, #64748b);
  padding: var(--ui-space-1, 0.25rem);
}

.date-picker__weekday--weekend {
  color: var(--ui-brand-600, #4f7c82);
}

.date-picker__days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--ui-space-1, 0.25rem);
}

.date-picker__day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text, #0b2e33);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.date-picker__day:hover {
  background: var(--ui-brand-100, #e5f6f8);
}

.date-picker__day--other-month {
  color: var(--ui-text-muted, #64748b);
  opacity: 0.4;
}

.date-picker__day--weekend {
  color: var(--ui-brand-600, #4f7c82);
}

.date-picker__day--today {
  background: var(--ui-surface-muted, #f1f5f9);
  font-weight: var(--ui-font-bold, 700);
  position: relative;
}

.date-picker__day--today::after {
  content: "";
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  background: var(--ui-brand-600, #4f7c82);
  border-radius: var(--ui-radius-full, 9999px);
}

.date-picker__day--selected {
  background: var(--ui-brand-600, #4f7c82) !important;
  color: var(--ui-surface, #ffffff) !important;
  font-weight: var(--ui-font-bold, 700);
}

.date-picker__day--selected::after {
  display: none;
}

.date-picker__footer {
  display: flex;
  justify-content: space-between;
  margin-top: var(--ui-space-3, 0.75rem);
  padding-top: var(--ui-space-3, 0.75rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.date-picker__today-btn,
.date-picker__clear-btn {
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.date-picker__today-btn {
  border: 1px solid var(--ui-brand-600, #4f7c82);
  background: transparent;
  color: var(--ui-brand-600, #4f7c82);
}

.date-picker__today-btn:hover {
  background: var(--ui-brand-100, #e5f6f8);
}

.date-picker__clear-btn {
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  background: transparent;
  color: var(--ui-text-muted, #64748b);
}

.date-picker__clear-btn:hover {
  background: var(--ui-surface-muted, #f1f5f9);
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (prefers-reduced-motion: reduce) {
  .dropdown-enter-active,
  .dropdown-leave-active {
    transition: none;
  }
}
</style>

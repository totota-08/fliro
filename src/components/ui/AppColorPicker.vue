<script setup lang="ts">
/**
 * AppColorPicker - カスタムカラーピッカーコンポーネント
 * Deep Green / Card UI デザインに準拠
 * プリセットカラーとカスタムカラー選択を提供
 */
import { computed, ref } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    presetColors?: string[];
  }>(),
  {
    modelValue: "#4f7c82",
    presetColors: () => [
      "#4f7c82",
      "#0b2e33",
      "#93b1b5",
      "#b8e3e9",
      "#16a34a",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
    ],
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const colorValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit("update:modelValue", value),
});

const colorInputRef = ref<HTMLInputElement | null>(null);

function selectPreset(color: string) {
  colorValue.value = color;
}

function openCustomPicker() {
  colorInputRef.value?.click();
}

function isSelected(color: string): boolean {
  return colorValue.value.toLowerCase() === color.toLowerCase();
}

// 色のコントラストを判定（明るい色かどうか）
function isLightColor(hex: string): boolean {
  const c = hex.substring(1);
  const rgb = parseInt(c, 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = rgb & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}
</script>

<template>
  <div class="app-color-picker">
    <div class="app-color-picker__grid">
      <button
        v-for="color in presetColors"
        :key="color"
        type="button"
        class="app-color-picker__swatch"
        :class="{
          'app-color-picker__swatch--selected': isSelected(color),
          'app-color-picker__swatch--light': isLightColor(color),
        }"
        :style="{ backgroundColor: color }"
        :aria-label="`色を選択: ${color}`"
        :aria-pressed="isSelected(color)"
        @click="selectPreset(color)"
      >
        <svg
          v-if="isSelected(color)"
          class="app-color-picker__check"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M3 8L7 12L13 4"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>

      <button
        type="button"
        class="app-color-picker__custom"
        :class="{
          'app-color-picker__custom--active': !presetColors.includes(
            colorValue.toLowerCase(),
          ),
        }"
        aria-label="カスタムカラーを選択"
        @click="openCustomPicker"
      >
        <div
          class="app-color-picker__custom-preview"
          :style="{ backgroundColor: colorValue }"
        />
        <span class="app-color-picker__custom-label">カスタム</span>
        <input
          ref="colorInputRef"
          v-model="colorValue"
          type="color"
          class="app-color-picker__input"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.app-color-picker {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.app-color-picker__grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2, 0.5rem);
  align-items: center;
}

.app-color-picker__swatch {
  position: relative;
  width: 40px;
  height: 40px;
  border: 2px solid transparent;
  border-radius: var(--ui-radius-md, 0.75rem);
  cursor: pointer;
  transition:
    transform var(--ui-duration-fast, 120ms) var(--ui-ease-standard),
    box-shadow var(--ui-duration-fast, 120ms) var(--ui-ease-standard);
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-color-picker__swatch:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--ui-shadow-md);
}

.app-color-picker__swatch:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

.app-color-picker__swatch--selected {
  border-color: var(--ui-brand-900, #0b2e33);
  transform: translateY(-2px) scale(1.05);
  box-shadow: var(--ui-shadow-md);
}

.app-color-picker__swatch--selected:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.05);
}

.app-color-picker__check {
  width: 16px;
  height: 16px;
  color: var(--ui-surface, #ffffff);
}

.app-color-picker__swatch--light .app-color-picker__check {
  color: var(--ui-text, #0b2e33);
}

.app-color-picker__custom {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border: 1px dashed var(--ui-border-strong, rgba(11, 46, 51, 0.2));
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface, #ffffff);
  cursor: pointer;
  transition:
    border-color var(--ui-duration-fast, 120ms) var(--ui-ease-standard),
    background-color var(--ui-duration-fast, 120ms) var(--ui-ease-standard),
    box-shadow var(--ui-duration-fast, 120ms) var(--ui-ease-standard);
  position: relative;
}

.app-color-picker__custom:hover:not(:disabled) {
  border-color: var(--ui-brand-600, #4f7c82);
  background: var(--ui-brand-50, #f5fcff);
}

.app-color-picker__custom:focus-visible {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

.app-color-picker__custom--active {
  border-style: solid;
  border-color: var(--ui-brand-600, #4f7c82);
  background: var(--ui-brand-50, #f5fcff);
}

.app-color-picker__custom-preview {
  width: 24px;
  height: 24px;
  border-radius: var(--ui-radius-sm, 0.5rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
}

.app-color-picker__custom-label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-brand-600, #4f7c82);
}

.app-color-picker__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  .app-color-picker__swatch,
  .app-color-picker__custom {
    transition: none;
  }
}
</style>

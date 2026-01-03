<script setup lang="ts">
import { computed } from "vue";

// Use 'exclude' to allow pass-through of standard button attributes easily if needed,
// though manual props are safer for clear interface.
const props = withDefaults(
  defineProps<{
    loading?: boolean;
    label?: string;
    loadingLabel?: string;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
    variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  }>(),
  {
    loading: false,
    label: "ボタン",
    loadingLabel: "処理中...",
    disabled: false,
    type: "button",
    variant: "primary",
  },
);

const emit = defineEmits<{
  (e: "click", event: MouseEvent): void;
}>();

const currentLabel = computed(() =>
  props.loading ? props.loadingLabel : props.label,
);

const handleClick = (e: MouseEvent) => {
  if (props.loading || props.disabled) {
    e.preventDefault();
    return;
  }
  emit("click", e);
};
</script>

<template>
  <button
    :type="type"
    class="app-button"
    :class="[`app-button--${variant}`, { 'app-button--loading': loading }]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <div v-if="loading" class="loading-dots app-button__dots">
      <span></span><span></span><span></span>
    </div>
    <span class="app-button__label">
      <slot>{{ currentLabel }}</slot>
    </span>
  </button>
</template>

<style scoped>
/* Reusing/Extending existing AppButton styles if possible, but defining base here to ensure self-contained if needed.
   Assumption: Global styles provide basic button resets. 
*/

.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6em 1.2em;
  font-size: 0.95rem;
  font-weight: 600;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
  line-height: 1.25;
  cursor: pointer;
  border: 1px solid transparent;
  position: relative;
}

.app-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  filter: grayscale(0.2);
}

/* Primary */
.app-button--primary {
  background-color: var(--primary);
  color: #fff;
}
.app-button--primary:not(:disabled):hover {
  background-color: var(--primary-strong);
}

/* Secondary */
.app-button--secondary {
  background-color: var(--surface-card);
  border-color: var(--border-light);
  color: var(--text);
}
.app-button--secondary:not(:disabled):hover {
  background-color: var(--surface-hover);
  border-color: var(--border);
}

/* Outline */
.app-button--outline {
  background-color: transparent;
  border-color: var(--border);
  color: var(--text);
}
.app-button--outline:not(:disabled):hover {
  border-color: var(--text-muted);
  background-color: var(--surface-hover);
}

/* Danger (Custom for this project context based on MemberDetailPanel) */
.app-button--danger {
  border-color: color-mix(in srgb, var(--accent-danger) 65%, transparent);
  color: var(--accent-danger);
  background-color: transparent;
}
.app-button--danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent-danger) 12%, transparent);
}

.loading-dots {
  font-size: 6px; /* Size of dots relative to button */
}
</style>

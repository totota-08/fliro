<script setup lang="ts">
/**
 * AppModal - 統一モーダルコンポーネント
 *
 * オーバーレイ + Esc で閉じる + 閉じるボタン
 */
import { onBeforeUnmount, onMounted, watch } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    size?: "sm" | "md" | "lg" | "xl";
    closeOnOverlay?: boolean;
    closeOnEscape?: boolean;
  }>(),
  {
    title: undefined,
    size: "md",
    closeOnOverlay: true,
    closeOnEscape: true,
  },
);

const emit = defineEmits<{
  close: [];
}>();

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && props.closeOnEscape) {
    emit("close");
  }
}

function handleOverlayClick() {
  if (props.closeOnOverlay) {
    emit("close");
  }
}

onMounted(() => {
  if (props.open) {
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeydown);
  }
});

onBeforeUnmount(() => {
  document.body.style.overflow = "";
  window.removeEventListener("keydown", handleKeydown);
});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeydown);
    } else {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeydown);
    }
  },
);
</script>

<template>
  <Teleport to="body">
    <Transition name="app-modal">
      <div
        v-if="open"
        class="app-modal__overlay"
        role="dialog"
        aria-modal="true"
        @click.self="handleOverlayClick"
      >
        <div :class="['app-modal__panel', `app-modal--${size}`]">
          <header v-if="title || $slots.header" class="app-modal__header">
            <slot name="header">
              <h2 class="app-modal__title">{{ title }}</h2>
            </slot>
            <button
              type="button"
              class="app-modal__close"
              aria-label="閉じる"
              @click="emit('close')"
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                />
              </svg>
            </button>
          </header>

          <div class="app-modal__body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="app-modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-modal__overlay {
  position: fixed;
  inset: 0;
  z-index: var(--ui-z-modal, 50);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: var(--ui-space-16, 4rem) var(--ui-space-4, 1rem);
  background: var(--ui-surface-overlay, rgba(0, 0, 0, 0.35));
  backdrop-filter: blur(2px);
  overflow-y: auto;
}

.app-modal__panel {
  position: relative;
  width: 100%;
  background: var(--ui-surface, #ffffff);
  border-radius: var(--ui-radius-xl, 1.25rem);
  box-shadow: var(--ui-shadow-2xl);
  overflow: hidden;
}

/* Sizes */
.app-modal--sm {
  max-width: 24rem;
}

.app-modal--md {
  max-width: 32rem;
}

.app-modal--lg {
  max-width: 42rem;
}

.app-modal--xl {
  max-width: 56rem;
}

.app-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4, 1rem);
  padding: var(--ui-space-5, 1.25rem) var(--ui-space-6, 1.5rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

.app-modal__title {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.app-modal__close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-sm, 0.5rem);
  background: transparent;
  color: var(--ui-text-muted, #64748b);
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.app-modal__close:hover {
  border-color: var(--ui-border-focus, #4f7c82);
  color: var(--ui-text, #0b2e33);
}

.app-modal__close svg {
  width: 1.25rem;
  height: 1.25rem;
}

.app-modal__body {
  padding: var(--ui-space-6, 1.5rem);
}

.app-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-4, 1rem) var(--ui-space-6, 1.5rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  background: var(--ui-surface-muted, #f1f5f9);
}

/* Transitions */
.app-modal-enter-active,
.app-modal-leave-active {
  transition:
    opacity var(--ui-duration-base, 180ms) var(--ui-ease-standard),
    transform var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.app-modal-enter-from,
.app-modal-leave-to {
  opacity: 0;
}

.app-modal-enter-from .app-modal__panel,
.app-modal-leave-to .app-modal__panel {
  transform: scale(0.95) translateY(-1rem);
}

@media (max-width: 640px) {
  .app-modal__overlay {
    padding: var(--ui-space-4, 1rem);
    padding-bottom: 0;
    align-items: flex-end;
  }

  .app-modal__panel {
    border-radius: var(--ui-radius-xl, 1.25rem) var(--ui-radius-xl, 1.25rem) 0 0;
    max-height: 85vh;
    max-height: 85dvh;
  }

  .app-modal__body {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .app-modal__footer {
    padding-bottom: calc(var(--ui-space-4, 1rem) + env(safe-area-inset-bottom));
  }

  .app-modal__close {
    width: var(--ui-touch-target-min, 44px);
    height: var(--ui-touch-target-min, 44px);
  }
}
</style>

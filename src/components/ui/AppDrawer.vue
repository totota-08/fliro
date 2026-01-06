<script setup lang="ts">
/**
 * AppDrawer - 統一ドロワーコンポーネント
 *
 * 右から出る + オーバーレイで閉じる
 * Nowファースト思想の中核コンポーネント
 */
import { onBeforeUnmount, onMounted, watch } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    width?: string;
    closeOnOverlay?: boolean;
    closeOnEscape?: boolean;
  }>(),
  {
    title: undefined,
    width: "420px",
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
    <Transition name="app-drawer">
      <div
        v-if="open"
        class="app-drawer__overlay"
        @click.self="handleOverlayClick"
      >
        <aside
          class="app-drawer__panel"
          :style="{ '--drawer-width': width }"
          role="dialog"
          aria-modal="true"
        >
          <header class="app-drawer__header">
            <slot name="header">
              <h2 v-if="title" class="app-drawer__title">{{ title }}</h2>
            </slot>
            <button
              type="button"
              class="app-drawer__close"
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

          <div class="app-drawer__body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="app-drawer__footer">
            <slot name="footer" />
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-drawer__overlay {
  position: fixed;
  inset: 0;
  z-index: var(--ui-z-drawer, 60);
  display: flex;
  justify-content: flex-end;
  background: var(--ui-surface-overlay, rgba(0, 0, 0, 0.35));
  backdrop-filter: blur(2px);
}

.app-drawer__panel {
  display: flex;
  flex-direction: column;
  width: min(var(--drawer-width, 420px), 100vw);
  height: 100%;
  background: var(--ui-surface, #ffffff);
  box-shadow: var(--ui-shadow-2xl);
}

.app-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4, 1rem);
  padding: var(--ui-space-5, 1.25rem) var(--ui-space-6, 1.5rem);
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  flex-shrink: 0;
}

.app-drawer__title {
  margin: 0;
  font-size: var(--ui-text-lg, 1.125rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.app-drawer__close {
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

.app-drawer__close:hover {
  border-color: var(--ui-border-focus, #4f7c82);
  color: var(--ui-text, #0b2e33);
}

.app-drawer__close svg {
  width: 1.25rem;
  height: 1.25rem;
}

.app-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: var(--ui-space-6, 1.5rem);
}

.app-drawer__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-4, 1rem) var(--ui-space-6, 1.5rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  background: var(--ui-surface-muted, #f1f5f9);
  flex-shrink: 0;
}

/* Transitions */
.app-drawer-enter-active,
.app-drawer-leave-active {
  transition: opacity var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.app-drawer-enter-active .app-drawer__panel,
.app-drawer-leave-active .app-drawer__panel {
  transition: transform var(--ui-duration-slow, 280ms) var(--ui-ease-standard);
}

.app-drawer-enter-from,
.app-drawer-leave-to {
  opacity: 0;
}

.app-drawer-enter-from .app-drawer__panel,
.app-drawer-leave-to .app-drawer__panel {
  transform: translateX(100%);
}
</style>

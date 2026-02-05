<script setup lang="ts">
import ProjectInviteForm from "@/components/projects/ProjectInviteForm.vue";
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    canCreate: boolean;
    projectId: string;
    projectName?: string | null;
  }>(),
  {
    open: false,
    canCreate: false,
    projectName: null,
  },
);

const emit = defineEmits<{
  (e: "close"): void;
  (e: "created", link: string): void;
}>();

const panelRef = ref<HTMLElement | null>(null);
const bodyOverflow = ref<string | null>(null);
const bodyPaddingRight = ref<string | null>(null);

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    requestClose();
  }
};

function lockBodyScroll() {
  if (typeof document === "undefined") return;
  const body = document.body;
  if (bodyOverflow.value === null) {
    bodyOverflow.value = body.style.overflow;
    bodyPaddingRight.value = body.style.paddingRight;
  }
  body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  const body = document.body;
  if (bodyOverflow.value !== null) {
    body.style.overflow = bodyOverflow.value;
    bodyOverflow.value = null;
  }
  if (bodyPaddingRight.value !== null) {
    body.style.paddingRight = bodyPaddingRight.value;
    bodyPaddingRight.value = null;
  }
}

function requestClose() {
  emit("close");
}

function handleCreated(link: string) {
  emit("created", link);
}

watch(
  () => props.open,
  (open) => {
    if (typeof window === "undefined") return;
    window.removeEventListener("keydown", handleKeydown);
    if (open) {
      window.addEventListener("keydown", handleKeydown);
      lockBodyScroll();
      void nextTick(() => {
        panelRef.value?.focus();
      });
    } else {
      unlockBodyScroll();
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", handleKeydown);
  }
  unlockBodyScroll();
});
</script>

<template>
  <Transition name="invite-drawer">
    <div v-if="open" class="invite-drawer">
      <button
        type="button"
        class="invite-drawer__overlay"
        aria-label="閉じる"
        @click="requestClose"
      />
      <aside
        ref="panelRef"
        class="invite-drawer__panel"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-create-title"
      >
        <header class="invite-drawer__header">
          <div>
            <p class="invite-drawer__eyebrow">招待リンク</p>
            <h3 id="invite-create-title">招待リンクを作成</h3>
            <p>必要に応じてパスワードや期限を設定してください。</p>
          </div>
          <button
            type="button"
            class="invite-drawer__close"
            aria-label="閉じる"
            @click="requestClose"
          >
            ✕
          </button>
        </header>

        <div class="invite-drawer__content">
          <ProjectInviteForm
            v-if="canCreate"
            :project-id="projectId"
            :project-name="projectName"
            @generated="handleCreated"
          />
          <p v-else class="invite-drawer__note">
            招待リンクを作成する権限がありません。
          </p>
        </div>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.invite-drawer-enter-active,
.invite-drawer-leave-active {
  transition: opacity 0.2s ease;
}

.invite-drawer-enter-from,
.invite-drawer-leave-to {
  opacity: 0;
}

.invite-drawer-enter-from .invite-drawer__panel,
.invite-drawer-leave-to .invite-drawer__panel {
  transform: translateX(12%);
  opacity: 0;
}

.invite-drawer {
  position: fixed;
  inset: 0;
  left: var(--sidebar-width, 0px);
  display: flex;
  justify-content: flex-end;
  z-index: 60;
}

.invite-drawer__overlay {
  flex: 1;
  border: none;
  padding: 0;
  background: color-mix(in srgb, var(--text) 35%, transparent);
  cursor: pointer;
}

.invite-drawer__panel {
  width: clamp(320px, 42vw, 480px);
  max-width: 100%;
  height: 100%;
  background: var(--surface-card);
  border-left: 1px solid var(--border-light);
  box-shadow: -12px 0 28px var(--border);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
  overflow: auto;
  outline: none;
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
}

.invite-drawer__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.invite-drawer__eyebrow {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.invite-drawer__header h3 {
  margin: 0.2rem 0 0;
  font-size: 1.2rem;
  color: var(--text-strong);
}

.invite-drawer__header p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.invite-drawer__close {
  border: 1px solid var(--border-light);
  background: transparent;
  border-radius: 0.75rem;
  padding: 0.4rem 0.6rem;
  cursor: pointer;
  color: var(--text);
}

.invite-drawer__content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.invite-drawer__note {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

@media (max-width: 960px) {
  .invite-drawer {
    left: 0;
  }

  .invite-drawer__panel {
    width: 100%;
    border-radius: 0;
  }
}
</style>

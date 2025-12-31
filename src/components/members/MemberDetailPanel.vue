<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

type MemberRole = "owner" | "admin" | "member" | "viewer";

type PanelMember = {
  userId: string;
  role: MemberRole;
  displayName: string;
  email?: string | null;
  avatarUrl?: string | null;
  statusLabel: string;
  statusClass: "online" | "away" | "offline";
  lastAccessedAt?: { seconds: number; nanoseconds: number };
};

const props = withDefaults(
  defineProps<{
    open: boolean;
    member: PanelMember | null;
    roleOptions: MemberRole[];
    canEditRole: boolean;
    canRemove: boolean;
    currentUserId?: string | null;
    updatingRoleId?: string;
    removingMemberId?: string;
  }>(),
  {
    open: false,
    member: null,
    canEditRole: false,
    canRemove: false,
    currentUserId: null,
    updatingRoleId: "",
    removingMemberId: "",
  },
);

const emit = defineEmits<{
  (e: "close"): void;
  (e: "role-change", value: MemberRole): void;
  (e: "remove"): void;
}>();

const panelRef = ref<HTMLElement | null>(null);
const copyMessage = ref("");
let copyTimer: ReturnType<typeof setTimeout> | null = null;

const isOwner = computed(() => props.member?.role === "owner");
const isSelf = computed(() =>
  Boolean(props.member?.userId && props.member?.userId === props.currentUserId),
);
const canEditCurrentRole = computed(() => props.canEditRole && !isOwner.value);
const canRemoveCurrent = computed(
  () => props.canRemove && !isOwner.value && !isSelf.value,
);
const isUpdating = computed(
  () =>
    Boolean(props.member?.userId) &&
    props.member?.userId === props.updatingRoleId,
);
const isRemoving = computed(
  () =>
    Boolean(props.member?.userId) &&
    props.member?.userId === props.removingMemberId,
);

const lastAccessedLabel = computed(() => {
  const timestamp = props.member?.lastAccessedAt;
  if (!timestamp?.seconds) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp.seconds * 1000));
});

const removeHint = computed(() => {
  if (isOwner.value) return "オーナーは削除できません。";
  if (isSelf.value) return "自分自身は削除できません。";
  if (!props.canRemove) return "削除権限がありません。";
  return "";
});

const roleHint = computed(() => {
  if (isOwner.value) return "オーナーは変更できません。";
  if (!props.canEditRole) return "ロール変更の権限がありません。";
  return "";
});

const roleLabel = (role: MemberRole) => {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "member") return "Member";
  return "Viewer";
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    emit("close");
  }
};

watch(
  () => props.open,
  (open) => {
    if (typeof window === "undefined") return;
    window.removeEventListener("keydown", handleKeydown);
    if (open) {
      window.addEventListener("keydown", handleKeydown);
      void nextTick(() => {
        panelRef.value?.focus();
      });
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", handleKeydown);
  }
  if (copyTimer) {
    clearTimeout(copyTimer);
  }
});

function handleRoleChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const value = (target?.value as MemberRole) || props.member?.role;
  if (!value) return;
  emit("role-change", value);
}

function setCopyMessage(message: string) {
  copyMessage.value = message;
  if (copyTimer) {
    clearTimeout(copyTimer);
  }
  copyTimer = setTimeout(() => {
    copyMessage.value = "";
  }, 2000);
}

async function fallbackCopy(text: string) {
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const succeeded = document.execCommand("copy");
  document.body.removeChild(textarea);
  return succeeded;
}

async function handleCopy() {
  if (!props.member) return;
  const text = props.member.userId;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      setCopyMessage("コピーしました。");
      return;
    }
    const succeeded = await fallbackCopy(text);
    setCopyMessage(succeeded ? "コピーしました。" : "コピーに失敗しました。");
  } catch {
    setCopyMessage("コピーに失敗しました。");
  }
}
</script>

<template>
  <Transition name="member-panel">
    <div v-if="open && member" class="member-panel">
      <button
        type="button"
        class="member-panel__overlay"
        aria-label="閉じる"
        @click="emit('close')"
      />
      <aside ref="panelRef" class="member-panel__panel" tabindex="-1">
        <header class="member-panel__header">
          <div>
            <p class="member-panel__eyebrow">メンバー詳細</p>
            <h3 class="member-panel__title">{{ member.displayName }}</h3>
            <div class="member-panel__status">
              <span
                class="status-indicator"
                :class="`status-${member.statusClass}`"
              >
                {{ member.statusLabel }}
              </span>
              <span class="badge" :class="`role-${member.role}`">
                {{ roleLabel(member.role) }}
              </span>
            </div>
          </div>
          <button
            type="button"
            class="member-panel__close"
            aria-label="閉じる"
            @click="emit('close')"
          >
            ✕
          </button>
        </header>

        <section class="member-panel__section">
          <h4>基本情報</h4>
          <div class="member-panel__row">
            <span>ユーザーID</span>
            <div class="member-panel__row-value">
              <span class="member-panel__mono">{{ member.userId }}</span>
              <button
                type="button"
                class="member-panel__copy"
                @click="handleCopy"
              >
                コピー
              </button>
            </div>
          </div>
          <p v-if="copyMessage" class="member-panel__hint">
            {{ copyMessage }}
          </p>
          <div class="member-panel__row">
            <span>メール</span>
            <span>{{ member.email || "—" }}</span>
          </div>
          <div class="member-panel__row">
            <span>最終アクセス</span>
            <span>{{ lastAccessedLabel }}</span>
          </div>
        </section>

        <section class="member-panel__section">
          <h4>ロール</h4>
          <div v-if="isOwner" class="member-panel__role">
            <span class="badge role-owner">Owner</span>
          </div>
          <select
            v-else
            :value="member.role"
            :disabled="!canEditCurrentRole || isUpdating"
            @change="handleRoleChange"
          >
            <option v-for="role in roleOptions" :key="role" :value="role">
              {{ roleLabel(role) }}
            </option>
          </select>
          <p v-if="roleHint" class="member-panel__hint">{{ roleHint }}</p>
        </section>

        <section class="member-panel__section">
          <h4>メンバー操作</h4>
          <AppButton
            variant="outline"
            :disabled="!canRemoveCurrent || isRemoving"
            :loading="isRemoving"
            @click="emit('remove')"
          >
            メンバーを削除
          </AppButton>
          <p v-if="removeHint" class="member-panel__hint">{{ removeHint }}</p>
        </section>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.member-panel-enter-active,
.member-panel-leave-active {
  transition: opacity 0.2s ease;
}

.member-panel-enter-from,
.member-panel-leave-to {
  opacity: 0;
}

.member-panel-enter-from .member-panel__panel,
.member-panel-leave-to .member-panel__panel {
  transform: translateX(12%);
  opacity: 0;
}

.member-panel {
  position: fixed;
  inset: 0;
  left: var(--sidebar-width, 0px);
  display: flex;
  justify-content: flex-end;
  z-index: 60;
}

.member-panel__overlay {
  flex: 1;
  border: none;
  padding: 0;
  background: color-mix(in srgb, var(--text) 35%, transparent);
  cursor: pointer;
}

.member-panel__panel {
  width: clamp(320px, 38vw, 420px);
  max-width: 100%;
  height: 100%;
  background: var(--surface-card);
  border-left: 1px solid var(--border-light);
  box-shadow: -12px 0 28px var(--border);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  transform: translateX(0);
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
  outline: none;
}

.member-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.member-panel__eyebrow {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.member-panel__title {
  margin: 0.35rem 0 0;
  font-size: 1.2rem;
  color: var(--text-strong);
}

.member-panel__status {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
}

.member-panel__close {
  border: 1px solid var(--border-light);
  background: transparent;
  border-radius: 0.75rem;
  padding: 0.4rem 0.6rem;
  cursor: pointer;
  color: var(--text);
}

.member-panel__section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.member-panel__section h4 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-strong);
}

.member-panel__row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.95rem;
  color: var(--text);
}

.member-panel__row-value {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.member-panel__mono {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.member-panel__copy {
  border: none;
  background: transparent;
  color: var(--primary);
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.member-panel__section select {
  border-radius: 0.85rem;
  border: 1px solid var(--border-light);
  padding: 0.6rem 0.75rem;
  font-size: 0.95rem;
  background: var(--surface-card);
  color: var(--text);
  width: 100%;
}

.member-panel__section select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.member-panel__hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.badge {
  border-radius: 999px;
  padding: 0.2rem 0.75rem;
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: capitalize;
}

.badge.role-owner {
  background: color-mix(in srgb, var(--primary-strong) 12%, transparent);
  color: var(--text);
}

.badge.role-admin {
  background: color-mix(in srgb, var(--primary) 20%, transparent);
  color: var(--text);
}

.badge.role-member,
.badge.role-viewer {
  background: color-mix(in srgb, var(--primary-strong) 6%, transparent);
  color: var(--text-muted);
}

.status-indicator {
  font-size: 0.85rem;
  font-weight: 600;
}

.status-indicator.status-online {
  color: var(--accent-success);
}

.status-indicator.status-away {
  color: var(--accent-warning);
}

.status-indicator.status-offline {
  color: var(--text-muted);
}

@media (max-width: 720px) {
  .member-panel {
    left: 0;
  }

  .member-panel__panel {
    width: 100%;
    border-radius: 0;
  }
}
</style>

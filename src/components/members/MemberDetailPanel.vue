<script setup lang="ts">
import ButtonLoading from "@/components/loading/ButtonLoading.vue";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

type MemberRole = string;

type RoleInfo = {
  id: string;
  name: string;
  color: string;
};

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
    roleInfoMap?: Map<string, RoleInfo>;
    canEditRole: boolean;
    canRemove: boolean;
    canManageRoles?: boolean;
    currentUserId?: string | null;
    saveRole?: (role: MemberRole) => Promise<void>;
    removeMember?: () => Promise<void>;
    goToRoleSettings?: () => void;
  }>(),
  {
    open: false,
    member: null,
    roleInfoMap: undefined,
    canEditRole: false,
    canRemove: false,
    canManageRoles: false,
    currentUserId: null,
    saveRole: undefined,
    removeMember: undefined,
    goToRoleSettings: undefined,
  },
);

const emit = defineEmits<{
  (e: "close"): void;
}>();

const panelRef = ref<HTMLElement | null>(null);
const copyMessage = ref("");
const saveSuccess = ref("");
const removeError = ref("");
const draftRole = ref<MemberRole | null>(null);
const baseRole = ref<MemberRole | null>(null);
const isSaving = ref(false);
const isRemoving = ref(false);
const bodyOverflow = ref<string | null>(null);
const bodyPaddingRight = ref<string | null>(null);
let copyTimer: ReturnType<typeof setTimeout> | null = null;
let successTimer: ReturnType<typeof setTimeout> | null = null;

const isOwner = computed(() => props.member?.role === "owner");
const isSelf = computed(() =>
  Boolean(props.member?.userId && props.member?.userId === props.currentUserId),
);
const canEditCurrentRole = computed(() => props.canEditRole && !isOwner.value);
const canRemoveCurrent = computed(
  () => props.canRemove && !isOwner.value && !isSelf.value,
);
const isDirty = computed(
  () =>
    Boolean(props.member) &&
    draftRole.value !== null &&
    baseRole.value !== null &&
    draftRole.value !== baseRole.value,
);
const canSave = computed(
  () =>
    Boolean(props.saveRole) &&
    canEditCurrentRole.value &&
    isDirty.value &&
    !isSaving.value,
);

const primaryName = computed(() => {
  if (!props.member) return "";
  const name = props.member.displayName?.trim();
  if (name) return name;
  const shortId = props.member.userId?.slice(-4) || "";
  return `メンバー ${shortId}`;
});

const initials = computed(() => {
  if (!props.member) return "??";
  const raw = primaryName.value;
  if (!raw) return "??";
  const trimmed = raw.trim();
  return trimmed.length <= 2 ? trimmed : trimmed.slice(0, 2);
});

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
  // Check roleInfoMap first for custom role names
  if (props.roleInfoMap?.has(role)) {
    return props.roleInfoMap.get(role)!.name;
  }
  // Fallback to default labels
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "member") return "Member";
  if (role === "viewer") return "Viewer";
  // For unknown custom roles, capitalize first letter
  return role.charAt(0).toUpperCase() + role.slice(1);
};

const getRoleColor = (role: MemberRole) => {
  if (props.roleInfoMap?.has(role)) {
    return props.roleInfoMap.get(role)!.color;
  }
  // Default colors
  if (role === "owner") return "#0b2e33";
  if (role === "admin") return "#4f7c82";
  return "#64748b";
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    requestClose();
  }
};

function clearSuccessMessage() {
  saveSuccess.value = "";
  if (successTimer) {
    clearTimeout(successTimer);
    successTimer = null;
  }
}

function showSuccess(message: string) {
  saveSuccess.value = message;
  if (successTimer) {
    clearTimeout(successTimer);
  }
  successTimer = setTimeout(() => {
    saveSuccess.value = "";
  }, 2500);
}

function formatErrorDetail(error: unknown) {
  if (!error) return "";
  if (typeof error === "string") return error;
  const err = error as { code?: string; name?: string; message?: string };
  const parts = [];
  if (err.code) parts.push(`code: ${err.code}`);
  if (err.name) parts.push(`name: ${err.name}`);
  if (err.message) parts.push(`message: ${err.message}`);
  if (!parts.length) return JSON.stringify(error);
  return parts.join(" / ");
}

// Keep draft/base roles aligned with the selected member.
function syncDraft(member: PanelMember | null) {
  if (!member) {
    baseRole.value = null;
    draftRole.value = null;
    removeError.value = "";
    clearSuccessMessage();
    return;
  }
  baseRole.value = member.role;
  draftRole.value = member.role;
  removeError.value = "";
  clearSuccessMessage();
}

// Prevent background scroll while the panel is open.
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
  if (isSaving.value) return;
  // if (isDirty.value) {
  //   const shouldDiscard = confirm("変更を破棄して閉じますか？");
  //   if (!shouldDiscard) return;
  // }
  emit("close");
}

watch(
  () => props.open,
  (open) => {
    if (typeof window === "undefined") return;
    window.removeEventListener("keydown", handleKeydown);
    if (open) {
      window.addEventListener("keydown", handleKeydown);
      lockBodyScroll();
      syncDraft(props.member);
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
  if (copyTimer) {
    clearTimeout(copyTimer);
  }
  if (successTimer) {
    clearTimeout(successTimer);
  }
  unlockBodyScroll();
});

watch(
  () => props.member?.userId,
  (memberId, prevMemberId) => {
    if (!props.open) return;
    if (memberId && memberId !== prevMemberId) {
      syncDraft(props.member);
    }
  },
);

watch(
  () => props.member?.role,
  (role) => {
    if (!props.member || role === undefined) return;
    if (!isDirty.value) {
      baseRole.value = role;
      draftRole.value = role;
    }
  },
);

function setCopyMessage(message: string) {
  copyMessage.value = message;
  if (copyTimer) {
    clearTimeout(copyTimer);
  }
  copyTimer = setTimeout(() => {
    copyMessage.value = "";
  }, 2000);
}

async function handleCopy() {
  if (!props.member) return;
  try {
    await navigator.clipboard.writeText(props.member.userId);
    setCopyMessage("コピーしました。");
  } catch {
    setCopyMessage("コピーに失敗しました。");
  }
}

function handleDiscard() {
  if (!props.member) return;
  draftRole.value = baseRole.value ?? props.member.role;
  clearSuccessMessage();
}

async function handleSave() {
  if (!props.member || !draftRole.value) return;
  if (!canEditCurrentRole.value) return;
  if (!props.saveRole) return;
  if (isSelf.value && draftRole.value !== baseRole.value) {
    const confirmed = confirm(
      "自分のロールを変更すると管理権限を失う可能性があります。続行しますか？",
    );
    if (!confirmed) return;
  }
  isSaving.value = true;
  clearSuccessMessage();
  try {
    await props.saveRole(draftRole.value);
    baseRole.value = draftRole.value;
    showSuccess("更新しました。");
  } catch {
    // Ignore role update errors per request.
  } finally {
    isSaving.value = false;
  }
}

async function handleRemove() {
  if (!props.member || !props.removeMember) return;
  if (!canRemoveCurrent.value) {
    removeError.value = removeHint.value || "削除できません。";
    return;
  }
  const confirmed = confirm(
    `「${primaryName.value}」をプロジェクトから削除しますか？`,
  );
  if (!confirmed) return;
  isRemoving.value = true;
  removeError.value = "";
  try {
    await props.removeMember();
  } catch (error) {
    removeError.value =
      formatErrorDetail(error) || "メンバーの削除に失敗しました。";
  } finally {
    isRemoving.value = false;
  }
}
</script>

<template>
  <Transition name="panel-slide-right">
    <div v-if="open && member" class="member-panel">
      <button
        type="button"
        class="member-panel__overlay"
        aria-label="閉じる"
        @click="requestClose"
      />
      <aside ref="panelRef" class="member-panel__panel" tabindex="-1">
        <header class="member-panel__header">
          <div class="member-panel__identity">
            <div class="member-panel__avatar" aria-hidden="true">
              <img
                v-if="member.avatarUrl"
                :src="member.avatarUrl"
                alt=""
                class="member-panel__avatar-img"
              />
              <span v-else>{{ initials }}</span>
            </div>
            <div>
              <p class="member-panel__eyebrow">メンバー詳細</p>
              <h3 class="member-panel__title">{{ primaryName }}</h3>
              <div class="member-panel__status">
                <span
                  class="status-dot"
                  :class="`status-${member.statusClass}`"
                  aria-hidden="true"
                />
                <span class="member-panel__status-text">
                  {{ member.statusLabel }}
                </span>
                <span
                  class="badge"
                  :style="{
                    backgroundColor: getRoleColor(member.role) + '20',
                    color: getRoleColor(member.role),
                  }"
                >
                  {{ roleLabel(member.role) }}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            class="member-panel__close"
            aria-label="閉じる"
            @click="requestClose"
          >
            ✕
          </button>
        </header>

        <section class="member-panel__section">
          <h4>基本情報</h4>
          <div class="member-panel__row">
            <span class="member-panel__label">ユーザーID</span>
            <div class="member-panel__row-value">
              <span class="member-panel__mono">{{ member.userId }}</span>
              <button
                type="button"
                class="member-panel__icon-button"
                aria-label="ユーザーIDをコピー"
                @click="handleCopy"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M9 9h9v10H9z"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M6 5h9v3"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
          <p v-if="copyMessage" class="member-panel__hint">
            {{ copyMessage }}
          </p>
          <div class="member-panel__row">
            <span class="member-panel__label">メール</span>
            <span>{{ member.email || "—" }}</span>
          </div>
          <div class="member-panel__row">
            <span class="member-panel__label">最終アクセス</span>
            <span>{{ lastAccessedLabel }}</span>
          </div>
        </section>

        <section class="member-panel__section">
          <div class="member-panel__section-header">
            <h4>ロール</h4>
            <button
              v-if="canManageRoles && goToRoleSettings"
              type="button"
              class="member-panel__link-button"
              @click="goToRoleSettings"
            >
              ロール設定 →
            </button>
          </div>
          <div v-if="isOwner" class="member-panel__role">
            <span class="badge role-owner">Owner</span>
          </div>
          <select
            v-else
            v-model="draftRole"
            :disabled="!canEditCurrentRole || isSaving"
          >
            <option v-for="role in roleOptions" :key="role" :value="role">
              {{ roleLabel(role) }}
            </option>
          </select>
          <p v-if="roleHint" class="member-panel__hint">{{ roleHint }}</p>
          <p v-if="saveSuccess" class="member-panel__success">
            {{ saveSuccess }}
          </p>
          <div class="member-panel__actions">
            <ButtonLoading
              :disabled="!canSave"
              :loading="isSaving"
              @click="handleSave"
            >
              保存
            </ButtonLoading>
            <ButtonLoading
              variant="secondary"
              :disabled="!isDirty || isSaving"
              @click="handleDiscard"
            >
              変更を破棄
            </ButtonLoading>
          </div>
        </section>

        <section class="member-panel__section">
          <h4>メンバー操作</h4>
          <ButtonLoading
            variant="outline"
            class="member-panel__danger"
            :disabled="!canRemoveCurrent || isRemoving"
            :loading="isRemoving"
            @click="handleRemove"
          >
            メンバーを削除
          </ButtonLoading>
          <p v-if="removeHint" class="member-panel__hint">{{ removeHint }}</p>
          <p v-if="removeError" class="member-panel__error">
            {{ removeError }}
          </p>
        </section>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
/*
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
*/
/* Replaced by global .panel-slide-right in motion.css */

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
  /* transform: translateX(0); */ /* Managed by global transition now or default layout */
  /* transition: transform 0.25s ease, opacity 0.25s ease; */ /* Removed local transition */
  outline: none;
}

.member-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.member-panel__identity {
  display: flex;
  gap: 0.9rem;
  align-items: center;
}

.member-panel__avatar {
  width: 52px;
  height: 52px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 18%, transparent);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  overflow: hidden;
}

.member-panel__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.member-panel__eyebrow {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.member-panel__title {
  margin: 0.2rem 0 0;
  font-size: 1.25rem;
  color: var(--text-strong);
}

.member-panel__status {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
}

.member-panel__status-text {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--text-muted);
}

.status-dot.status-online {
  background: var(--accent-success);
}

.status-dot.status-away {
  background: var(--accent-warning);
}

.status-dot.status-offline {
  background: var(--text-muted);
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

.member-panel__section + .member-panel__section {
  border-top: 1px solid var(--border-light);
  padding-top: 1rem;
}

.member-panel__section h4 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-strong);
}

.member-panel__section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.member-panel__link-button {
  border: none;
  background: transparent;
  color: var(--primary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s ease;
}

.member-panel__link-button:hover {
  color: var(--primary-strong);
  text-decoration: underline;
}

.member-panel__row {
  display: grid;
  grid-template-columns: 96px 1fr;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.95rem;
  color: var(--text);
}

.member-panel__label {
  color: var(--text-muted);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
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

.member-panel__icon-button {
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text-muted);
  width: 28px;
  height: 28px;
  border-radius: 0.6rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition:
    border-color 0.2s ease,
    color 0.2s ease;
}

.member-panel__icon-button:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.member-panel__icon-button svg {
  width: 16px;
  height: 16px;
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

.member-panel__actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.member-panel__hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.member-panel__error {
  margin: 0;
  font-size: 0.85rem;
  color: var(--accent-danger);
}

.member-panel__success {
  margin: 0;
  font-size: 0.85rem;
  color: var(--accent-success);
}

.member-panel__error-detail summary {
  cursor: pointer;
  font-weight: 600;
}

.member-panel__error-detail-text {
  margin: 0.4rem 0 0;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  word-break: break-all;
}

.member-panel__danger {
  border-color: color-mix(in srgb, var(--accent-danger) 65%, transparent);
  color: var(--accent-danger);
}

.member-panel__danger:hover {
  background: color-mix(in srgb, var(--accent-danger) 12%, transparent);
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

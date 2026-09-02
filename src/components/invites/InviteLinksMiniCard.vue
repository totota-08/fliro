<script setup lang="ts">
import { useActionFeedback } from "@/composables/useActionFeedback";
import { ROUTE_NAMES } from "@/constants/routes";
import {
  buildInviteStatus,
  buildInviteUrl,
  inviteStatusClass as statusClass,
  inviteStatusLabel as statusLabel,
  listenProjectInvites,
  revokeProjectInvite,
  type ProjectInvite,
  type ProjectInviteStatus,
} from "@/services/projectInvites";
import { toMillis } from "@/utils/datetime";
import { useAuthStore } from "@/store/auth";
import { getLogger } from "@logtape/logtape";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";

const props = withDefaults(
  defineProps<{
    projectId: string;
    canManage: boolean;
  }>(),
  {
    canManage: false,
  },
);

const logger = getLogger("app.components.invites.InviteLinksMiniCard");
const router = useRouter();
const { user, profile } = useAuthStore();

const invites = ref<ProjectInvite[]>([]);
const loading = ref(true);
const { actionMessage, actionError, setActionMessage, setActionError } =
  useActionFeedback();
const revokeTarget = ref<string | null>(null);

const limitSize = 8;
const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

let stopInvites: (() => void) | null = null;

const sortedInvites = computed(() => {
  const list = [...invites.value];
  list.sort(
    (a, b) => (toMillis(b.createdAt) ?? 0) - (toMillis(a.createdAt) ?? 0),
  );
  return list;
});

const statusSummary = computed(() => {
  const counts: Record<ProjectInviteStatus, number> = {
    active: 0,
    expired: 0,
    revoked: 0,
  };
  sortedInvites.value.forEach((invite) => {
    const status = buildInviteStatus(invite);
    counts[status] += 1;
  });
  return counts;
});

function formatDate(value: unknown) {
  const ts = toMillis(value);
  if (ts === null) return "—";
  return dateFormatter.format(new Date(ts));
}

function formatExpiry(invite: ProjectInvite) {
  if (!invite.expiresAt) return "—";
  return formatDate(invite.expiresAt);
}

function formatUses(invite: ProjectInvite) {
  if (!invite.maxUses) return "";
  const used = invite.usedCount ?? 0;
  return `${used} / ${invite.maxUses}`;
}

async function copyInvite(invite: ProjectInvite) {
  const url = buildInviteUrl(invite);
  if (!url) {
    setActionError("リンクの生成に失敗しました。");
    return;
  }
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      throw new Error("Clipboard API unavailable");
    }
    await navigator.clipboard.writeText(url);
    setActionMessage("リンクをコピーしました。");
  } catch (error) {
    logger.warn`Failed to copy invite link: ${error}`;
    setActionError("コピーに失敗しました。");
  }
}

async function revokeInvite(invite: ProjectInvite) {
  if (!props.canManage) {
    setActionError("招待リンクの操作権限がありません。");
    return;
  }
  if (buildInviteStatus(invite) !== "active") {
    return;
  }
  const confirmed = confirm("この招待リンクを無効化しますか？");
  if (!confirmed) return;
  revokeTarget.value = invite.id;
  try {
    const actorName =
      profile.value?.nickname ||
      profile.value?.fullName ||
      user.value?.uid ||
      "System";
    await revokeProjectInvite(invite.id, {
      id: user.value?.uid ?? null,
      name: actorName,
    });
    setActionMessage("招待リンクを無効化しました。");
  } catch (error) {
    logger.error`Failed to revoke invite: ${error}`;
    setActionError("無効化に失敗しました。");
  } finally {
    revokeTarget.value = null;
  }
}

function goToInvites() {
  if (!props.projectId) return;
  void router.push({
    name: ROUTE_NAMES.projectInvites,
    params: { projectId: props.projectId },
  });
}

function watchInvites() {
  stopInvites?.();
  invites.value = [];
  loading.value = true;
  if (!props.projectId) {
    loading.value = false;
    return;
  }
  stopInvites = listenProjectInvites(
    props.projectId,
    (list) => {
      invites.value = list;
      loading.value = false;
    },
    { limitSize },
  );
}

watch(
  () => props.projectId,
  () => {
    watchInvites();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  stopInvites?.();
});
</script>

<template>
  <section class="invite-links-mini-card">
    <header class="invite-links-mini__header">
      <h3>招待リンク</h3>
      <button type="button" class="invite-links-mini__all" @click="goToInvites">
        すべて表示
      </button>
    </header>

    <div class="invite-links-mini__summary">
      <span>有効 {{ statusSummary.active }}</span>
      <span>期限切れ {{ statusSummary.expired }}</span>
      <span>無効 {{ statusSummary.revoked }}</span>
    </div>

    <p v-if="actionMessage" class="invite-links-mini__message">
      {{ actionMessage }}
    </p>
    <p v-if="actionError" class="invite-links-mini__error">
      {{ actionError }}
    </p>

    <div v-if="loading" class="invite-links-mini__empty">読み込み中...</div>
    <div v-else-if="!sortedInvites.length" class="invite-links-mini__empty">
      <p>招待リンクはまだありません。</p>
      <button
        v-if="canManage"
        type="button"
        class="invite-links-mini__create"
        @click="goToInvites"
      >
        招待リンクを作成
      </button>
    </div>
    <ul v-else class="invite-links-mini__list">
      <li
        v-for="invite in sortedInvites"
        :key="invite.id"
        class="invite-links-mini__row"
      >
        <div class="invite-links-mini__meta">
          <span
            class="invite-links-mini__status"
            :class="statusClass(buildInviteStatus(invite))"
          >
            {{ statusLabel(buildInviteStatus(invite)) }}
          </span>
          <span class="invite-links-mini__meta-item">
            作成 {{ formatDate(invite.createdAt) }}
          </span>
          <span class="invite-links-mini__meta-item">
            期限 {{ formatExpiry(invite) }}
          </span>
          <span v-if="invite.maxUses" class="invite-links-mini__meta-item">
            利用 {{ formatUses(invite) }}
          </span>
        </div>
        <div class="invite-links-mini__actions">
          <button
            type="button"
            class="invite-links-mini__action"
            @click="copyInvite(invite)"
          >
            コピー
          </button>
          <button
            v-if="canManage"
            type="button"
            class="invite-links-mini__action invite-links-mini__action--danger"
            :disabled="
              buildInviteStatus(invite) !== 'active' ||
              revokeTarget === invite.id
            "
            @click="revokeInvite(invite)"
          >
            {{ revokeTarget === invite.id ? "処理中..." : "無効化" }}
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.invite-links-mini-card {
  border: 1px solid var(--border-light);
  border-radius: 1.25rem;
  padding: 1.25rem;
  background: var(--surface-card);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.invite-links-mini__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.invite-links-mini__header h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-strong);
}

.invite-links-mini__all {
  border: none;
  background: transparent;
  color: var(--primary);
  font-weight: 600;
  font-size: 0.85rem;
  padding: 0;
  cursor: pointer;
}

.invite-links-mini__all:hover {
  text-decoration: underline;
}

.invite-links-mini__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.invite-links-mini__message,
.invite-links-mini__error {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
}

.invite-links-mini__message {
  color: var(--text-strong);
}

.invite-links-mini__error {
  color: var(--accent-danger);
}

.invite-links-mini__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-height: 240px;
  overflow: auto;
  padding-right: 0.25rem;
}

.invite-links-mini__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--border-light);
}

.invite-links-mini__row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.invite-links-mini__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.6rem;
}

.invite-links-mini__meta-item {
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.invite-links-mini__status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.7rem;
  border: 1px solid var(--border-light);
  background: var(--surface-muted);
  color: var(--text);
}

.invite-links-mini__status.status-active {
  color: var(--accent-success);
  border-color: color-mix(in srgb, var(--accent-success) 40%, transparent);
}

.invite-links-mini__status.status-expired {
  color: var(--accent-danger);
  border-color: color-mix(in srgb, var(--accent-danger) 40%, transparent);
}

.invite-links-mini__status.status-revoked {
  color: var(--accent-danger);
  border-color: color-mix(in srgb, var(--accent-danger) 40%, transparent);
}

.invite-links-mini__actions {
  margin-left: auto;
  display: inline-flex;
  gap: 0.4rem;
  flex-shrink: 0;
}

.invite-links-mini__action {
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text);
  border-radius: 0.6rem;
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    color 0.2s ease;
}

.invite-links-mini__action:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.invite-links-mini__action--danger:hover {
  border-color: var(--accent-danger);
  color: var(--accent-danger);
}

.invite-links-mini__action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.invite-links-mini__empty {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
  border: 1px dashed var(--border-light);
  border-radius: 0.85rem;
  padding: 0.75rem;
}

.invite-links-mini__empty p {
  margin: 0;
}

.invite-links-mini__create {
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text);
  border-radius: 0.8rem;
  padding: 0.5rem 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    color 0.2s ease;
}

.invite-links-mini__create:hover {
  border-color: var(--primary);
  color: var(--primary);
}
</style>

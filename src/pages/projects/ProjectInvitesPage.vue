<script setup lang="ts">
import InviteCreateDrawer from "@/components/invites/InviteCreateDrawer.vue";
import ButtonLoading from "@/components/loading/ButtonLoading.vue";
import PageSkeleton from "@/components/loading/PageSkeleton.vue";
import AppEmptyState from "@/components/ui/AppEmptyState.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppAlert from "@/components/ui/AppAlert.vue";
import { usePageTitle } from "@/composables/usePageTitle";
import { buildPermissionsFromRoles } from "@/constants/roles";
import { useProjectIdRoute } from "@/composables/useProjectIdRoute";
import { db } from "@/lib/firebase";
import {
  buildInviteStatus,
  buildInviteUrl,
  fetchProjectInvitesPage,
  listenProjectInvites,
  revokeProjectInvite,
  type ProjectInvite,
  type ProjectInviteCursor,
  type ProjectInviteStatus,
} from "@/services/projectInvites";
import { useAuthStore } from "@/store/auth";
import type { ProjectDoc } from "@/types/project";
import { getLogger } from "@logtape/logtape";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const logger = getLogger("app.pages.projects.ProjectInvites");

type InviteFilter = "all" | ProjectInviteStatus;
type MemberSummary = {
  userId: string;
  displayName: string;
  permissions: ReturnType<typeof buildPermissionsFromRoles>;
};

const { user, profile } = useAuthStore();
const { projectId } = useProjectIdRoute();
const project = ref<ProjectDoc | null>(null);

// ページタイトル設定
const { setTitle } = usePageTitle(
  "招待リンク",
  "招待リンクの発行状況と無効化を管理",
);
watch(
  project,
  (p) => {
    if (p?.name) setTitle(p.name);
  },
  { immediate: true },
);
const members = ref<MemberSummary[]>([]);
const statusFilter = ref<InviteFilter>("all");
const inviteQuery = ref("");
const loading = ref(true);
const loadingMore = ref(false);
const hasMore = ref(true);
const isCreateOpen = ref(false);
const actionMessage = ref("");
const actionError = ref("");
const revokeTarget = ref<string | null>(null);
const isInitialLoading = ref(true);

// オンボーディングヒント
const ONBOARDING_KEY = "onboarding-invites-dismissed";
const showOnboardingHint = ref(!localStorage.getItem(ONBOARDING_KEY));

let stopProject: (() => void) | null = null;
let stopMembers: (() => void) | null = null;
let stopInvites: (() => void) | null = null;
let actionTimer: ReturnType<typeof setTimeout> | null = null;

const memberNameMap = computed(() => {
  const map = new Map<string, string>();
  members.value.forEach((member) => {
    map.set(member.userId, member.displayName);
  });
  return map;
});

const currentPermissions = computed(() => {
  const currentId = user.value?.uid;
  if (!currentId) return buildPermissionsFromRoles([]);
  const memberPermissions = members.value.find(
    (member) => member.userId === currentId,
  )?.permissions;
  if (memberPermissions) return memberPermissions;
  if (project.value?.ownerUserId === currentId) {
    return buildPermissionsFromRoles(["owner"]);
  }
  return buildPermissionsFromRoles([]);
});

const canCreateInvite = computed(
  () =>
    currentPermissions.value.canInviteMembers ||
    currentPermissions.value.canManageMembers,
);
const canManageInvites = computed(() => canCreateInvite.value);

const liveInvites = ref<ProjectInvite[]>([]);
const olderInvites = ref<ProjectInvite[]>([]);
const liveCursor = ref<ProjectInviteCursor>(null);
const pagingCursor = ref<ProjectInviteCursor>(null);

const invites = computed(() => [...liveInvites.value, ...olderInvites.value]);

const sortedInvites = computed(() => {
  const list = [...invites.value];
  list.sort(
    (a, b) => resolveTimestamp(b.createdAt) - resolveTimestamp(a.createdAt),
  );
  return list;
});

const filteredInvites = computed(() => {
  const query = inviteQuery.value.trim().toLowerCase();
  return sortedInvites.value.filter((invite) => {
    const status = buildInviteStatus(invite);
    if (statusFilter.value !== "all" && status !== statusFilter.value) {
      return false;
    }
    if (!query) return true;
    const creatorName = getCreatorName(invite).toLowerCase();
    const targets = [invite.id, invite.token, invite.memo, creatorName]
      .filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
      .map((value) => value.toLowerCase());
    return targets.some((value) => value.includes(query));
  });
});

const statusOptions: { label: string; value: InviteFilter }[] = [
  { label: "すべて", value: "all" },
  { label: "有効", value: "active" },
  { label: "期限切れ", value: "expired" },
  { label: "無効化", value: "revoked" },
];

function resolveTimestamp(value: any) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
}

function formatDate(value: any) {
  const ts = resolveTimestamp(value);
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("ja-JP");
}

function formatExpiry(invite: ProjectInvite) {
  if (!invite.expiresAt) return "無期限";
  return formatDate(invite.expiresAt);
}

function formatUses(invite: ProjectInvite) {
  const used = invite.usedCount ?? 0;
  const max = invite.maxUses ?? null;
  return `${used} / ${max ?? "—"}`;
}

function getCreatorName(invite: ProjectInvite) {
  // まずFirestoreに保存された作成者名を使用
  if (invite.createdByName) {
    return invite.createdByName;
  }
  // 次にメンバーマップから取得
  const memberName = memberNameMap.value.get(invite.createdBy);
  if (memberName) {
    return memberName;
  }
  // フォールバック表示
  return "不明なユーザー";
}

function statusLabel(status: ProjectInviteStatus) {
  if (status === "active") return "有効";
  if (status === "expired") return "期限切れ";
  return "無効化";
}

function statusClass(status: ProjectInviteStatus) {
  if (status === "active") return "status-active";
  if (status === "expired") return "status-expired";
  return "status-revoked";
}

function setActionMessage(message: string) {
  actionMessage.value = message;
  actionError.value = "";
  if (actionTimer) {
    clearTimeout(actionTimer);
  }
  actionTimer = setTimeout(() => {
    actionMessage.value = "";
  }, 2500);
}

function setActionError(message: string) {
  actionError.value = message;
  if (actionTimer) {
    clearTimeout(actionTimer);
  }
  actionTimer = setTimeout(() => {
    actionError.value = "";
  }, 3000);
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
  if (!canManageInvites.value) {
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

function watchProject() {
  stopProject?.();
  stopMembers?.();
  stopProject = onSnapshot(doc(db, "projects", projectId.value), (snapshot) => {
    if (!snapshot.exists()) return;
    project.value = snapshot.data() as ProjectDoc;
  });

  stopMembers = onSnapshot(
    collection(db, "projects", projectId.value, "members"),
    async (snapshot) => {
      const list = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data() as any;
          const userId = data.userId || docSnap.id;
          const role = (data.role as string) || "member";
          const roles = (data.roles as string[] | undefined) ?? [role];
          const permissions =
            data.permissions ?? buildPermissionsFromRoles(roles);
          const baseName = [
            data.displayName,
            data.name,
            data.userName,
            data.username,
            data.nickname,
            data.fullName,
          ].find(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0,
          );
          let displayName = baseName ? baseName.trim() : "";
          const looksLikeUid =
            displayName === userId || displayName === docSnap.id;

          if (!displayName || looksLikeUid) {
            try {
              const profileSnap = await getDoc(doc(db, "profiles", userId));
              if (profileSnap.exists()) {
                const profile = profileSnap.data() as {
                  nickname?: string;
                  fullName?: string;
                };
                const profileName = [profile.nickname, profile.fullName].find(
                  (value): value is string =>
                    typeof value === "string" && value.trim().length > 0,
                );
                if (profileName) {
                  displayName = profileName.trim();
                }
              }
            } catch (error) {
              logger.error`Failed to fetch profile for ${userId}: ${error}`;
            }
          }

          if (!displayName) {
            displayName = `メンバー ${userId.slice(-4)}`;
          }

          return {
            userId,
            displayName,
            permissions,
          } satisfies MemberSummary;
        }),
      );
      members.value = list;
    },
  );
}

function watchInvites() {
  stopInvites?.();
  liveInvites.value = [];
  olderInvites.value = [];
  liveCursor.value = null;
  pagingCursor.value = null;
  hasMore.value = true;
  loading.value = true;
  loadingMore.value = false;
  stopInvites = listenProjectInvites(
    projectId.value,
    (list) => {
      liveInvites.value = list;
      loading.value = false;
      if (isInitialLoading.value) {
        isInitialLoading.value = false;
      }
      if (!pagingCursor.value) {
        hasMore.value = true;
      }
    },
    {
      limitSize: 50,
      onCursor: (cursor) => {
        liveCursor.value = cursor;
      },
    },
  );
}

async function loadMoreInvites() {
  if (loadingMore.value || !hasMore.value) return;
  const cursor = pagingCursor.value ?? liveCursor.value;
  if (!cursor) {
    hasMore.value = false;
    return;
  }
  loadingMore.value = true;
  try {
    const { invites: nextInvites, nextCursor } = await fetchProjectInvitesPage(
      projectId.value,
      cursor,
      50,
    );
    olderInvites.value = [...olderInvites.value, ...nextInvites];
    pagingCursor.value = nextCursor;
    if (!nextCursor || nextInvites.length === 0) {
      hasMore.value = false;
    }
  } catch (error) {
    logger.error`Failed to load more invites: ${error}`;
    setActionError("招待リンクの読み込みに失敗しました。");
  } finally {
    loadingMore.value = false;
  }
}

function openCreateDrawer() {
  if (!canCreateInvite.value) return;
  isCreateOpen.value = true;
}

function closeCreateDrawer() {
  isCreateOpen.value = false;
}

function handleInviteCreated(_link: string) {
  setActionMessage("招待リンクを作成しました。");
}

function dismissOnboardingHint() {
  showOnboardingHint.value = false;
  localStorage.setItem(ONBOARDING_KEY, "true");
}

onMounted(() => {
  watchProject();
  watchInvites();
});

watch(projectId, (newId, oldId) => {
  if (!newId || newId === oldId) return;
  watchProject();
  watchInvites();
});

onBeforeUnmount(() => {
  stopProject?.();
  stopMembers?.();
  stopInvites?.();
  if (actionTimer) {
    clearTimeout(actionTimer);
  }
});
</script>

<template>
  <div class="project-invites-page">
    <PageSkeleton v-if="isInitialLoading" variant="invites" />
    <template v-else>
      <div class="invites-content">
        <section class="invites-page">
          <header class="invites-page__header">
            <div
              class="invites-page__header-action"
              :title="!canCreateInvite ? '作成権限がありません' : undefined"
            >
              <ButtonLoading
                class="invites-page__create-button"
                :disabled="!canCreateInvite"
                :aria-disabled="!canCreateInvite ? 'true' : undefined"
                @click="openCreateDrawer"
              >
                <svg
                  v-if="!canCreateInvite"
                  class="invites-page__lock-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7 10V7a5 5 0 0110 0v3" />
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                </svg>
                招待リンクを作成
              </ButtonLoading>
            </div>
          </header>

          <section class="invites-page__list">
            <!-- オンボーディングヒント -->
            <AppAlert
              v-if="showOnboardingHint && canCreateInvite"
              variant="info"
              dismissible
              title="💡 ヒント: 招待リンクの使い方"
              @dismiss="dismissOnboardingHint"
            >
              <p>
                招待リンクを作成したら、メールやチャットで共有できます。
                パスワードを設定すると、セキュリティが向上します。
              </p>
            </AppAlert>

            <div class="invites-page__toolbar">
              <div class="invites-page__filters">
                <label class="small-label" for="invite-status">
                  ステータス
                </label>
                <select id="invite-status" v-model="statusFilter">
                  <option
                    v-for="option in statusOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </div>
              <div class="invites-page__search">
                <label class="sr-only" for="invite-search">検索</label>
                <input
                  id="invite-search"
                  v-model="inviteQuery"
                  type="search"
                  placeholder="ID / 作成者 / メモで検索"
                  autocomplete="off"
                />
              </div>
            </div>

            <p v-if="!canCreateInvite" class="invites-page__permission">
              招待リンクを作成する権限がありません。
            </p>

            <p v-if="actionMessage" class="invites-page__message">
              {{ actionMessage }}
            </p>
            <p v-if="actionError" class="invites-page__error">
              {{ actionError }}
            </p>

            <!-- 空状態 -->
            <AppEmptyState
              v-if="!loading && !filteredInvites.length"
              title="招待リンクがまだありません"
              description="招待リンクを作成して、チームメンバーを招待しましょう。"
              icon="empty"
            >
              <template #action>
                <AppButton
                  v-if="canCreateInvite"
                  variant="primary"
                  @click="openCreateDrawer"
                >
                  招待リンクを作成
                </AppButton>
              </template>
            </AppEmptyState>

            <!-- テーブル表示 -->
            <div v-else class="invites-page__table">
              <table>
                <thead>
                  <tr>
                    <th>ステータス</th>
                    <th class="col-created">作成日</th>
                    <th class="col-expiry">有効期限</th>
                    <th class="col-uses">利用回数</th>
                    <th class="col-password">パスワード</th>
                    <th class="col-creator">作成者</th>
                    <th class="actions">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="loading">
                    <td colspan="7" class="empty">読み込み中...</td>
                  </tr>
                  <tr v-for="invite in filteredInvites" :key="invite.id">
                    <td>
                      <span
                        class="invites-page__status"
                        :class="statusClass(buildInviteStatus(invite))"
                      >
                        {{ statusLabel(buildInviteStatus(invite)) }}
                      </span>
                    </td>
                    <td class="col-created">
                      {{ formatDate(invite.createdAt) }}
                    </td>
                    <td class="col-expiry">{{ formatExpiry(invite) }}</td>
                    <td class="col-uses">{{ formatUses(invite) }}</td>
                    <td class="col-password">
                      {{ invite.passwordHash ? "あり" : "なし" }}
                    </td>
                    <td class="col-creator">{{ getCreatorName(invite) }}</td>
                    <td class="actions">
                      <button type="button" @click="copyInvite(invite)">
                        コピー
                      </button>
                      <ButtonLoading
                        variant="danger"
                        size="small"
                        :disabled="
                          !canManageInvites ||
                          buildInviteStatus(invite) !== 'active' ||
                          revokeTarget === invite.id
                        "
                        :loading="revokeTarget === invite.id"
                        @click="revokeInvite(invite)"
                      >
                        無効化
                      </ButtonLoading>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="hasMore" class="invites-page__more">
              <button
                type="button"
                class="invites-page__more-button"
                :disabled="loadingMore"
                @click="loadMoreInvites"
              >
                {{ loadingMore ? "読み込み中..." : "さらに読み込む" }}
              </button>
            </div>
          </section>
        </section>
      </div>
    </template>

    <InviteCreateDrawer
      :open="isCreateOpen"
      :can-create="canCreateInvite"
      :project-id="projectId"
      :project-name="project?.name"
      @close="closeCreateDrawer"
      @created="handleInviteCreated"
    />
  </div>
</template>

<style scoped>
.invites-content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-8);
  padding: var(--ui-space-6);
  height: calc(100vh - var(--ui-topbar-height));
  min-height: 0;
  box-sizing: border-box;
}

@supports (height: 100dvh) {
  .invites-content {
    height: calc(100dvh - var(--ui-topbar-height));
  }
}

.invites-page {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5, 1.25rem);
  min-height: 0;
}

.invites-page__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--ui-space-4, 1rem);
  flex-wrap: wrap;
}

.invites-page__header h2 {
  margin: 0;
  font-size: var(--ui-text-xl, 1.25rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.invites-page__header p {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.invites-page__header-action {
  display: inline-flex;
}

.invites-page__create-button {
  white-space: nowrap;
}

.invites-page__lock-icon {
  width: 1rem;
  height: 1rem;
}

.invites-page__list {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
  min-height: 0;
}

.invites-page__toolbar {
  display: flex;
  justify-content: space-between;
  gap: var(--ui-space-4, 1rem);
  align-items: center;
  flex-wrap: wrap;
}

.invites-page__filters {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.invites-page__filters select {
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  padding: var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text, #0b2e33);
  transition: var(--ui-transition-colors);
}

.invites-page__filters select:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.invites-page__search {
  width: min(320px, 100%);
}

.invites-page__search input {
  width: 100%;
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  padding: var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text, #0b2e33);
  transition: var(--ui-transition-colors);
}

.invites-page__search input:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.invites-page__permission {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-xs, 0.75rem);
}

.invites-page__message,
.invites-page__error {
  margin: 0;
  font-weight: var(--ui-font-semibold, 600);
}

.invites-page__message {
  color: var(--ui-text-strong, #0f172a);
}

.invites-page__error {
  color: var(--ui-danger, #d64545);
}

.invites-page__table {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  overflow: hidden;
  background: var(--ui-surface, #ffffff);
}

.invites-page__table table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--ui-text-sm, 0.875rem);
}

.invites-page__table th,
.invites-page__table td {
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  text-align: left;
  border-bottom: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  vertical-align: middle;
}

.invites-page__table th {
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-text-strong, #0f172a);
  font-weight: var(--ui-font-bold, 700);
  border-bottom: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
}

.invites-page__table td {
  color: var(--ui-text, #0b2e33);
}

.invites-page__table tr:last-child td {
  border-bottom: none;
}

.invites-page__table td.actions {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
}

.invites-page__table td.actions button {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  background: transparent;
  color: var(--ui-text, #0b2e33);
  border-radius: var(--ui-radius-sm, 0.5rem);
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  cursor: pointer;
  font-weight: var(--ui-font-semibold, 600);
  font-size: var(--ui-text-xs, 0.75rem);
  transition: var(--ui-transition-colors);
}

.invites-page__table td.actions button:hover {
  border-color: var(--ui-brand-600, #4f7c82);
  color: var(--ui-brand-600, #4f7c82);
}

.invites-page__table td.actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.invites-page__table .empty {
  text-align: center;
  color: var(--ui-text-muted, #64748b);
  padding: var(--ui-space-6, 1.5rem);
}

.invites-page__status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-full, 9999px);
  font-weight: var(--ui-font-semibold, 600);
  font-size: var(--ui-text-xs, 0.75rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text, #0b2e33);
}

.invites-page__status.status-active {
  color: var(--ui-success, #16a34a);
  background: var(--ui-success-light, #dcfce7);
  border-color: rgba(22, 163, 74, 0.25);
}

.invites-page__status.status-expired {
  color: var(--ui-danger, #d64545);
  background: var(--ui-danger-light, #fee2e2);
  border-color: rgba(214, 69, 69, 0.25);
}

.invites-page__status.status-revoked {
  color: var(--ui-danger, #d64545);
  background: var(--ui-danger-light, #fee2e2);
  border-color: rgba(214, 69, 69, 0.25);
}

.invites-page__more {
  display: flex;
  justify-content: center;
}

.invites-page__more-button {
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text, #0b2e33);
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-5, 1.25rem);
  cursor: pointer;
  font-weight: var(--ui-font-semibold, 600);
  transition: var(--ui-transition-all);
}

.invites-page__more-button:hover:not(:disabled) {
  border-color: var(--ui-brand-600, #4f7c82);
  color: var(--ui-brand-600, #4f7c82);
}

.invites-page__more-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 960px) {
  .invites-page__table {
    overflow: hidden;
  }

  .invites-page__table table {
    min-width: 0;
  }

  .invites-page__table .col-uses,
  .invites-page__table .col-password {
    display: none;
  }
}

@media (max-width: 720px) {
  .invites-page__table .col-expiry,
  .invites-page__table .col-creator {
    display: none;
  }
}
</style>

<script setup lang="ts">
import InviteCreateDrawer from "@/components/invites/InviteCreateDrawer.vue";
import ButtonLoading from "@/components/loading/ButtonLoading.vue";
import PageSkeleton from "@/components/loading/PageSkeleton.vue";
import DashboardSidebar from "@/components/projectDashboard/DashboardSidebar.vue";
import { appName } from "@/constants/appMeta";
import { buildPermissionsFromRoles } from "@/constants/roles";
import { ROUTE_NAMES } from "@/constants/routes";
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
import type { DashboardNavItem } from "@/types/projectDashboard";
import { getLogger } from "@logtape/logtape";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const logger = getLogger("app.pages.projects.ProjectInvites");

type InviteFilter = "all" | ProjectInviteStatus;
type MemberSummary = {
  userId: string;
  displayName: string;
  permissions: ReturnType<typeof buildPermissionsFromRoles>;
};

const route = useRoute();
const router = useRouter();
const { user, profile } = useAuthStore();
const projectId = ref(String(route.params.projectId || ""));
const project = ref<ProjectDoc | null>(null);
const projectList = ref<{ id: string; name: string }[]>([]);
const members = ref<MemberSummary[]>([]);
const isSidebarOpen = ref(true);
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

let stopProject: (() => void) | null = null;
let stopMembers: (() => void) | null = null;
let stopInvites: (() => void) | null = null;
let actionTimer: ReturnType<typeof setTimeout> | null = null;

const navItems = computed<DashboardNavItem[]>(
  () =>
    [
      {
        key: "dashboard",
        label: "ダッシュボード",
        to: {
          name: ROUTE_NAMES.projectDashboard,
          params: { projectId: projectId.value },
        },
        icon: "dashboard",
      },
      {
        key: "tasks",
        label: "マイタスク",
        to: { name: ROUTE_NAMES.myTasks },
        icon: "tasks",
      },
      {
        key: "team",
        label: "スレッド",
        to: {
          name: ROUTE_NAMES.projectThreads,
          params: { projectId: projectId.value },
        },
        icon: "team",
      },
      {
        key: "timeline",
        label: "アクティビティー",
        to: {
          name: ROUTE_NAMES.projectActivity,
          params: { projectId: projectId.value },
        },
        icon: "tasks",
      },
      {
        key: "members",
        label: "メンバー",
        to: {
          name: ROUTE_NAMES.projectMembers,
          params: { projectId: projectId.value },
        },
        icon: "members",
      },
      {
        key: "invites",
        label: "招待リンク",
        to: {
          name: ROUTE_NAMES.projectInvites,
          params: { projectId: projectId.value },
        },
        icon: "invites",
      },
      {
        key: "settings",
        label: "設定",
        to: {
          name: ROUTE_NAMES.projectSettings,
          params: { projectId: projectId.value },
        },
        icon: "settings",
      },
    ] satisfies DashboardNavItem[],
);

const sidebarProjects = computed(() =>
  projectList.value.map((entry, index) => ({
    key: entry.id,
    label: entry.name,
    to: { name: ROUTE_NAMES.projectDashboard, params: { projectId: entry.id } },
    accent: ["primary", "secondary", "accent"][index % 3] as
      | "primary"
      | "secondary"
      | "accent",
  })),
);

const profileInfo = computed(() => ({
  name: profile.value?.nickname || profile.value?.fullName || `${appName} User`,
  email: profile.value?.email || "",
}));

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
  return memberNameMap.value.get(invite.createdBy) || invite.createdBy || "—";
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

function loadProjectList() {
  if (!user.value) return;
  getDocs(collection(db, "userProjects", user.value.uid, "projects")).then(
    (snap) => {
      projectList.value = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        name: (docSnap.data().projectName as string) || "Project",
      }));
    },
  );
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

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value;
}

function closeSidebar() {
  isSidebarOpen.value = false;
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

onMounted(() => {
  if (window.matchMedia("(max-width: 1200px)").matches) {
    isSidebarOpen.value = false;
  }
  loadProjectList();
  watchProject();
  watchInvites();
});

watch(
  () => route.params.projectId,
  (newId) => {
    if (!newId) return;
    projectId.value = String(newId);
    watchProject();
    watchInvites();
  },
);

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
  <div :class="['demo', { 'demo--sidebar-collapsed': !isSidebarOpen }]">
    <DashboardSidebar
      :open="isSidebarOpen"
      :nav-items="navItems"
      :projects="sidebarProjects"
      :profile="profileInfo"
      brand-subtitle="プロジェクト"
      @close="closeSidebar"
    />
    <div v-if="isSidebarOpen" class="demo__overlay" @click="closeSidebar" />

    <div v-if="isSidebarOpen" class="demo__overlay" @click="closeSidebar" />

    <div class="demo__main">
      <PageSkeleton v-if="isInitialLoading" variant="invites" />
      <template v-else>
        <header class="demo__topbar">
          <div class="demo__topbar-left">
            <button
              type="button"
              class="demo__menu-button"
              @click="toggleSidebar"
            >
              <span class="sr-only">サイドバーを切り替え</span>
              <svg
                aria-hidden="true"
                class="demo__menu-icon"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <div>
              <p class="demo__breadcrumb">プロジェクト &gt; 招待リンク</p>
              <h1 class="demo__heading">
                {{ project?.name || "プロジェクト" }}
              </h1>
            </div>
          </div>
        </header>

        <div class="demo__content demo__content--condensed">
          <section class="invites-page">
            <header class="invites-page__header">
              <div>
                <h2>招待リンク</h2>
                <p>招待リンクの発行状況と無効化を管理できます。</p>
              </div>
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

              <div class="invites-page__table">
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
                    <tr v-else-if="!filteredInvites.length">
                      <td colspan="7" class="empty">
                        招待リンクがありません。
                      </td>
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
    </div>

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
@import "@/pages/demo/styles/demo-shell.css";

.demo__main {
  overflow: hidden;
}

.demo__content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  height: calc(100vh - 64px);
  min-height: 0;
  box-sizing: border-box;
}

@supports (height: 100dvh) {
  .demo__content {
    height: calc(100dvh - 64px);
  }
}

.invites-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-height: 0;
}

.invites-page__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.invites-page__header h2 {
  margin: 0;
}

.invites-page__header p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
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
  gap: 1rem;
  min-height: 0;
}

.invites-page__toolbar {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.invites-page__filters {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.invites-page__filters select {
  border-radius: 0.85rem;
  border: 1px solid var(--border-light);
  padding: 0.6rem 0.75rem;
  font-size: 0.95rem;
  background: var(--surface-card);
  color: var(--text);
}

.invites-page__search {
  width: min(320px, 100%);
}

.invites-page__search input {
  width: 100%;
  border-radius: 0.85rem;
  border: 1px solid var(--border-light);
  padding: 0.6rem 0.75rem;
  font-size: 0.95rem;
  background: var(--surface-card);
  color: var(--text);
}

.invites-page__permission {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.invites-page__message,
.invites-page__error {
  margin: 0;
  font-weight: 600;
}

.invites-page__message {
  color: var(--text-strong);
}

.invites-page__error {
  color: var(--accent-danger);
}

.invites-page__table {
  border: 1px solid var(--border-light);
  border-radius: 1rem;
  overflow: hidden;
  background: var(--surface-card);
}

.invites-page__table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.invites-page__table th,
.invites-page__table td {
  padding: 0.85rem 0.9rem;
  text-align: left;
  border-bottom: 1px solid var(--border-light);
  vertical-align: middle;
}

.invites-page__table th {
  background: color-mix(in srgb, var(--primary) 10%, white);
  color: var(--text);
  font-weight: 700;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
}

.invites-page__table td {
  color: var(--text);
}

.invites-page__table tr:last-child td {
  border-bottom: none;
}

.invites-page__table td.actions {
  display: flex;
  gap: 0.5rem;
}

.invites-page__table td.actions button {
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text);
  border-radius: 0.7rem;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
}

.invites-page__table td.actions button:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.invites-page__table td.actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.invites-page__table .empty {
  text-align: center;
  color: var(--text-muted);
  padding: 1.5rem;
}

.invites-page__status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.7rem;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.75rem;
  border: 1px solid var(--border-light);
  background: var(--surface-muted);
  color: var(--text);
}

.invites-page__status.status-active {
  color: var(--accent-success);
  border-color: color-mix(in srgb, var(--accent-success) 40%, transparent);
}

.invites-page__status.status-expired {
  color: var(--accent-danger);
  border-color: color-mix(in srgb, var(--accent-danger) 40%, transparent);
}

.invites-page__status.status-revoked {
  color: var(--accent-danger);
  border-color: color-mix(in srgb, var(--accent-danger) 40%, transparent);
}

.invites-page__more {
  display: flex;
  justify-content: center;
}

.invites-page__more-button {
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text);
  border-radius: 0.85rem;
  padding: 0.6rem 1.2rem;
  cursor: pointer;
  font-weight: 600;
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

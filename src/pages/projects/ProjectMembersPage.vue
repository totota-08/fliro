<script setup lang="ts">
import InviteLinksMiniCard from "@/components/invites/InviteLinksMiniCard.vue";
import MemberDetailPanel from "@/components/members/MemberDetailPanel.vue";
import ProjectInviteForm from "@/components/projects/ProjectInviteForm.vue";
import AppEmptyState from "@/components/ui/AppEmptyState.vue";
import { usePageTitle } from "@/composables/usePageTitle";
import { ProjectPermission } from "@/constants/permissions";
import { buildPermissionsFromRoles } from "@/constants/roles";
import { ROUTE_NAMES } from "@/constants/routes";
import { useProjectAccess } from "@/composables/useProjectAccess";
import { useProjectIdRoute } from "@/composables/useProjectIdRoute";
import { db } from "@/lib/firebase";
import {
  removeProjectMember,
  updateProjectMemberRole,
  type ProjectMember,
} from "@/services/projectMembers";
import { listenProjectRoles, type ProjectRole } from "@/services/rolesService";
import { useAuthStore } from "@/store/auth";
import type { ProjectDoc } from "@/types/project";
import { getLogger } from "@logtape/logtape";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

const logger = getLogger("app.pages.projects.ProjectMembers");
type MemberRole = ProjectMember["role"];
type MemberDisplay = {
  id: string;
  userId: string;
  role: MemberRole;
  roles: string[];
  displayName: string;
  email?: string;
  avatarUrl?: string;
  statusLabel: string;
  statusClass: "online" | "away" | "offline";
  lastAccessedAt?: { seconds: number; nanoseconds: number };
  permissions: ReturnType<typeof buildPermissionsFromRoles>;
};

const router = useRouter();
const { user, profile } = useAuthStore();
const { projectId } = useProjectIdRoute();
const project = ref<ProjectDoc | null>(null);

// ページタイトル設定
const { setTitle } = usePageTitle(
  "チーム",
  "メンバーの状態と権限をまとめて確認",
);
watch(
  project,
  (p) => {
    if (p?.name) setTitle(p.name);
  },
  { immediate: true },
);
const members = ref<MemberDisplay[]>([]);
const selectedMemberId = ref<string | null>(null);
const latestInviteLink = ref("");
const memberQuery = ref("");
const isInviteOpen = ref(false);
const projectRoles = ref<ProjectRole[]>([]);
let stopRoles: (() => void) | null = null;

// ロールオプション（owner以外のすべてのロール）
const roleOptions = computed(() => {
  return projectRoles.value
    .filter((role) => role.id !== "owner")
    .map((role) => role.id);
});

// ロール情報のマップ（表示名と色）
// Owner のデフォルト色（CSS変数 --ui-brand-900 と同値）
const OWNER_DEFAULT_COLOR = "#0b2e33";

const roleInfoMap = computed(() => {
  const map = new Map<string, { id: string; name: string; color: string }>();
  // ownerを追加
  map.set("owner", { id: "owner", name: "Owner", color: OWNER_DEFAULT_COLOR });
  // その他のロール
  for (const role of projectRoles.value) {
    map.set(role.id, { id: role.id, name: role.name, color: role.color });
  }
  return map;
});

const roleOrder: MemberRole[] = ["owner", "admin", "member", "viewer"];

const saveRoleHandler = async (role: string) => {
  if (!selectedMember.value) return;
  await handleSaveRole(selectedMember.value, role as MemberRole);
};

const removeMemberHandler = async () => {
  if (!selectedMember.value) return;
  await handleRemoveMember(selectedMember.value);
};

let stopProject: (() => void) | null = null;
let stopMembers: (() => void) | null = null;

// useProjectAccess で権限管理を統一
const { can } = useProjectAccess(projectId);

// MANAGE_INVITES / MANAGE_ROLES 権限判定（ボタン表示制御用）
const canManageInvitesViaAccess = computed(() =>
  can(ProjectPermission.MANAGE_INVITES),
);
const canManageRolesViaAccess = computed(() =>
  can(ProjectPermission.MANAGE_ROLES),
);

const memberStats = computed(() => {
  const total = members.value.length;
  const adminCount = members.value.filter(
    (member) => member.role === "owner" || member.role === "admin",
  ).length;
  const online = members.value.filter(
    (member) => member.statusClass === "online",
  ).length;
  return { total, adminCount, online };
});

const filteredMembers = computed(() => {
  const query = memberQuery.value.trim().toLowerCase();
  if (!query) return members.value;
  return members.value.filter((member) => {
    const targets = [member.displayName, member.email, member.userId, member.id]
      .filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
      .map((value) => value.toLowerCase());
    return targets.some((value) => value.includes(query));
  });
});

const roleBreakdown = computed(() => {
  const counts: Record<MemberRole, number> = {
    owner: 0,
    admin: 0,
    manager: 0,
    pm: 0,
    member: 0,
    viewer: 0,
    observer: 0,
  };
  members.value.forEach((member) => {
    counts[member.role] = (counts[member.role] ?? 0) + 1;
  });
  return counts;
});

const active24hCount = computed(() => {
  const now = Date.now();
  return members.value.filter((member) => {
    const seconds = member.lastAccessedAt?.seconds;
    if (typeof seconds !== "number") return false;
    return now - seconds * 1000 <= 1000 * 60 * 60 * 24;
  }).length;
});

const missingEmailCount = computed(() => {
  return members.value.filter((member) => {
    if (!member.email) return true;
    return member.email.trim().length === 0;
  }).length;
});

const inviteStatus = computed(() =>
  latestInviteLink.value ? "作成済み" : "未作成",
);

const recentAccessMembers = computed(() => {
  return [...members.value]
    .sort((a, b) => {
      const aSeconds =
        typeof a.lastAccessedAt?.seconds === "number"
          ? a.lastAccessedAt.seconds
          : null;
      const bSeconds =
        typeof b.lastAccessedAt?.seconds === "number"
          ? b.lastAccessedAt.seconds
          : null;
      if (aSeconds !== null && bSeconds !== null) {
        return bSeconds - aSeconds;
      }
      if (aSeconds !== null) return -1;
      if (bSeconds !== null) return 1;
      return 0;
    })
    .slice(0, 5);
});

const selectedMember = computed(
  () =>
    members.value.find((member) => member.userId === selectedMemberId.value) ??
    null,
);

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
const canManageInvites = computed(
  () =>
    currentPermissions.value.canInviteMembers ||
    currentPermissions.value.canManageMembers,
);
const canManageMembers = computed(
  () =>
    currentPermissions.value.canEditRoles ||
    currentPermissions.value.canInviteMembers ||
    currentPermissions.value.canManageMembers,
);

function setMemberQuery(memberId: string | null) {
  // Use history API directly to avoid Vue Router triggering component updates
  const url = new URL(window.location.href);
  if (memberId) {
    url.searchParams.set("memberId", memberId);
  } else {
    url.searchParams.delete("memberId");
  }
  window.history.replaceState({}, "", url.toString());
}

function openMemberPanel(member: MemberDisplay) {
  selectedMemberId.value = member.userId;
  setMemberQuery(member.userId);
}

function closeMemberPanel() {
  selectedMemberId.value = null;
  setMemberQuery(null);
}

function getRoleLabel(role: MemberRole) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "member") return "Member";
  return "Viewer";
}

function watchProject() {
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
          const role: MemberRole = data.role || "member";
          const roles = (data.roles as string[] | undefined) ?? [role];
          const permissions =
            data.permissions ?? buildPermissionsFromRoles(roles);
          const statusLabel = getStatusLabel(data.lastAccessedAt);
          // Check member document fields first (nickname and fullName are what we store)
          const baseName = [
            data.nickname,
            data.fullName,
            data.displayName,
            data.name,
            data.userName,
            data.username,
          ].find(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0,
          );
          let displayName = baseName ? baseName.trim() : "";

          // Helper to check if a string looks like a UID
          const looksLikeUid = (name: string) =>
            !name ||
            name === userId ||
            name === docSnap.id ||
            /^[a-zA-Z0-9]{20,}$/.test(name);

          // If no valid name or looks like UID, try fetching from profile
          if (looksLikeUid(displayName)) {
            try {
              const profileSnap = await getDoc(doc(db, "profiles", userId));
              if (profileSnap.exists()) {
                const profile = profileSnap.data() as {
                  nickname?: string;
                  fullName?: string;
                  displayName?: string;
                };
                const profileName = [
                  profile.nickname,
                  profile.fullName,
                  profile.displayName,
                ].find(
                  (value): value is string =>
                    typeof value === "string" &&
                    value.trim().length > 0 &&
                    !looksLikeUid(value.trim()),
                );
                if (profileName) {
                  displayName = profileName.trim();
                }
              }
            } catch (error) {
              logger.error`Failed to fetch profile for ${userId}: ${error}`;
            }
          }

          // Final fallback
          if (looksLikeUid(displayName)) {
            displayName = `メンバー ${userId.slice(-4)}`;
          }

          return {
            id: docSnap.id,
            userId,
            role,
            roles,
            displayName,
            email: data.email || null,
            avatarUrl: data.avatarUrl || null,
            statusLabel,
            statusClass: getStatusClass(statusLabel),
            lastAccessedAt: data.lastAccessedAt,
            permissions,
          } satisfies MemberDisplay;
        }),
      );
      const rank: Record<string, number> = {
        owner: 0,
        admin: 1,
        member: 2,
        viewer: 3,
      };
      members.value = list.sort(
        (a, b) => (rank[a.role] ?? 99) - (rank[b.role] ?? 99),
      );
    },
  );

  // ロールの監視
  stopRoles = listenProjectRoles(projectId.value, (roles) => {
    projectRoles.value = roles;
  });
}

function resetWatchers() {
  stopProject?.();
  stopMembers?.();
  stopRoles?.();
  watchProject();
}

function openInviteModal() {
  isInviteOpen.value = true;
}

function closeInviteModal() {
  isInviteOpen.value = false;
}

function goToInvites() {
  void router.push({
    name: ROUTE_NAMES.projectInvites,
    params: { projectId: projectId.value },
  });
}

function goToRoles() {
  void router.push({
    name: ROUTE_NAMES.projectRoles,
    params: { projectId: projectId.value },
  });
}

function goToTimeline() {
  void router.push({
    name: ROUTE_NAMES.projectActivity,
    params: { projectId: projectId.value },
  });
}

function handleLinkGenerated(link: string) {
  latestInviteLink.value = link;
}

function handleInviteKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    closeInviteModal();
  }
}

function formatRelativeTime(timestamp?: {
  seconds: number;
  nanoseconds: number;
}) {
  if (!timestamp?.seconds) return "—";
  const diffMs = Math.max(0, Date.now() - timestamp.seconds * 1000);
  if (diffMs < 1000 * 60 * 5) return "たった今";
  if (diffMs < 1000 * 60 * 60) {
    return `${Math.floor(diffMs / (1000 * 60))}分前`;
  }
  if (diffMs < 1000 * 60 * 60 * 24) {
    return `${Math.floor(diffMs / (1000 * 60 * 60))}時間前`;
  }
  return `${Math.floor(diffMs / (1000 * 60 * 60 * 24))}日前`;
}

async function handleRemoveMember(member: MemberDisplay) {
  if (!canManageMembers.value) {
    const error = new Error("permission-denied") as { code?: string };
    error.code = "permission-denied";
    throw error;
  }
  if (member.role === "owner" || member.userId === user.value?.uid) {
    const error = new Error("permission-denied") as { code?: string };
    error.code = "permission-denied";
    throw error;
  }
  try {
    await removeProjectMember(projectId.value, member.userId, {
      id: user.value?.uid ?? null,
      name: profile.value?.nickname || profile.value?.fullName || "",
      origin: "ui",
    });
  } catch (error) {
    logger.error`Failed to remove member: ${error}`;
    throw error;
  }
}

async function handleSaveRole(member: MemberDisplay, nextRole: MemberRole) {
  if (!currentPermissions.value.canEditRoles) {
    const error = new Error("permission-denied") as { code?: string };
    error.code = "permission-denied";
    throw error;
  }
  if (member.role === "owner") {
    const error = new Error("permission-denied") as { code?: string };
    error.code = "permission-denied";
    throw error;
  }
  try {
    const actorName =
      profile.value?.nickname ||
      profile.value?.fullName ||
      user.value?.uid ||
      "System";
    await updateProjectMemberRole(projectId.value, member.userId, nextRole, {
      previousRole: member.role,
      memberName: member.displayName || member.email || member.userId,
      actor: {
        id: user.value?.uid ?? null,
        name: actorName,
        origin: "ui",
      },
    });
  } catch (error) {
    logger.error`Failed to update role: ${error}`;
    throw error;
  }
}

function getStatusLabel(timestamp?: { seconds: number }) {
  if (!timestamp?.seconds) return "オフライン";
  const diff = Date.now() - timestamp.seconds * 1000;
  if (diff < 1000 * 60 * 5) return "オンライン";
  if (diff < 1000 * 60 * 60) return "離席中";
  return "オフライン";
}

function getStatusClass(label: string): MemberDisplay["statusClass"] {
  if (label === "オンライン") return "online";
  if (label === "離席中") return "away";
  return "offline";
}

function getInitials(name: string) {
  if (!name) return "??";
  const trimmed = name.trim();
  return trimmed.length <= 2 ? trimmed : trimmed.slice(0, 2);
}

// Sync from URL on initial load only (when members are loaded)
watch(
  members,
  (list) => {
    // Only sync from URL if we don't have a selection yet
    if (selectedMemberId.value) return;

    // Check URL for memberId parameter
    const urlParams = new URLSearchParams(window.location.search);
    const memberId = urlParams.get("memberId");
    if (!memberId) return;

    // If member exists in list, select it
    const exists = list.some((member) => member.userId === memberId);
    if (exists) {
      selectedMemberId.value = memberId;
    }
  },
  { immediate: true },
);

onMounted(() => {
  resetWatchers();
});

watch(projectId, (newId, oldId) => {
  if (!newId || newId === oldId) return;
  closeMemberPanel();
  resetWatchers();
});

watch(isInviteOpen, (open) => {
  if (typeof window === "undefined") return;
  window.removeEventListener("keydown", handleInviteKeydown);
  if (open) {
    window.addEventListener("keydown", handleInviteKeydown);
  }
});

onBeforeUnmount(() => {
  stopProject?.();
  stopMembers?.();
  stopRoles?.();
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", handleInviteKeydown);
  }
});

// ロール設定ページへのナビゲーションハンドラ
const goToRoleSettingsHandler = () => {
  closeMemberPanel();
  goToRoles();
};
</script>

<template>
  <div class="project-members-page">
    <div class="members-content">
      <section class="team-page">
        <header v-if="canManageMembers" class="team-page__header">
          <div class="team-page__header-actions">
            <button
              type="button"
              class="team-page__invite"
              @click="openInviteModal"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M12 5v14M5 12h14"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              メンバーを招待
            </button>
            <button
              v-if="canManageInvitesViaAccess"
              type="button"
              class="team-page__invite-link"
              @click="goToInvites"
            >
              招待リンク管理 →
            </button>
            <button
              v-if="canManageRolesViaAccess"
              type="button"
              class="team-page__invite-link"
              @click="goToRoles"
            >
              ロール管理 →
            </button>
          </div>
        </header>

        <div class="team-page__stats">
          <article>
            <p>総メンバー</p>
            <strong>{{ memberStats.total }}</strong>
          </article>
          <article>
            <p>管理者</p>
            <strong>{{ memberStats.adminCount }}</strong>
          </article>
          <article>
            <p>オンライン</p>
            <strong>{{ memberStats.online }}</strong>
          </article>
        </div>

        <div class="team-page__layout">
          <div class="team-page__members">
            <div class="team-page__members-header">
              <div>
                <h3>メンバー一覧</h3>
                <p class="team-page__members-count">
                  表示: {{ filteredMembers.length }} / {{ members.length }}
                </p>
              </div>
              <div class="team-page__search">
                <label class="sr-only" for="member-search">
                  メンバーを検索
                </label>
                <input
                  id="member-search"
                  v-model="memberQuery"
                  type="search"
                  placeholder="名前・メール・IDで検索"
                  autocomplete="off"
                />
              </div>
            </div>
            <div class="team-page__members-list">
              <ul class="team-member__list">
                <li
                  v-for="member in filteredMembers"
                  :key="member.userId"
                  :class="[
                    'team-member',
                    'team-member--clickable',
                    {
                      'team-member--selected':
                        member.userId === selectedMemberId,
                    },
                  ]"
                  role="button"
                  tabindex="0"
                  :aria-label="`${member.displayName}の詳細を開く`"
                  @click="openMemberPanel(member)"
                  @keydown.enter.prevent="openMemberPanel(member)"
                  @keydown.space.prevent="openMemberPanel(member)"
                >
                  <div class="team-member__persona">
                    <div class="avatar" aria-hidden="true">
                      <span>{{ getInitials(member.displayName) }}</span>
                    </div>
                    <div>
                      <p class="team-member__name">
                        {{ member.displayName }}
                      </p>
                      <p class="team-member__email">
                        {{ member.email || "メール未登録" }}
                      </p>
                    </div>
                  </div>

                  <div class="team-member__role">
                    <span class="badge" :class="`role-${member.role}`">
                      {{ getRoleLabel(member.role) }}
                    </span>
                  </div>

                  <div class="team-member__details">
                    <span
                      class="status-indicator"
                      :class="`status-${member.statusClass}`"
                      >{{ member.statusLabel }}</span
                    >
                  </div>
                </li>
                <li v-if="!filteredMembers.length" class="team-member--empty">
                  <AppEmptyState
                    :icon="members.length ? 'search' : 'empty'"
                    :title="
                      members.length
                        ? '検索結果がありません'
                        : 'まだメンバーがいません'
                    "
                    :description="
                      members.length
                        ? '検索キーワードを変更してください。'
                        : 'メンバーを招待してチームを作りましょう。'
                    "
                  />
                </li>
              </ul>
            </div>
          </div>

          <aside class="team-page__aside">
            <section class="team-page__aside-card">
              <h3>チームの状態</h3>
              <div class="team-page__summary-grid">
                <div class="team-page__summary-item">
                  <p>オンライン</p>
                  <strong>{{ memberStats.online }}</strong>
                </div>
                <div class="team-page__summary-item">
                  <p>アクティブ(24h)</p>
                  <strong>{{ active24hCount }}</strong>
                </div>
                <div class="team-page__summary-item">
                  <p>メール未登録</p>
                  <strong>{{ missingEmailCount }}</strong>
                </div>
                <div
                  class="team-page__summary-item team-page__summary-item--status"
                >
                  <p>招待リンク</p>
                  <span class="team-page__summary-badge">
                    {{ inviteStatus }}
                  </span>
                </div>
              </div>
              <button
                v-if="canManageInvites"
                type="button"
                class="team-page__summary-link"
                @click="goToInvites"
              >
                招待リンクへ
              </button>
            </section>

            <InviteLinksMiniCard
              :project-id="projectId"
              :can-manage="canManageInvites"
            />

            <section class="team-page__aside-card">
              <h3>ロール内訳</h3>
              <ul class="team-page__role-list">
                <li
                  v-for="role in roleOrder"
                  :key="role"
                  class="team-page__role-row"
                >
                  <span class="badge" :class="`role-${role}`">
                    {{ getRoleLabel(role) }}
                  </span>
                  <span class="team-page__role-count">
                    {{ roleBreakdown[role] }}
                  </span>
                </li>
              </ul>
            </section>

            <section class="team-page__aside-card">
              <h3>最近アクセス</h3>
              <ul class="team-page__recent-list">
                <li
                  v-for="member in recentAccessMembers"
                  :key="member.userId"
                  class="team-page__recent-row"
                >
                  <div class="avatar avatar--sm" aria-hidden="true">
                    <span>{{ getInitials(member.displayName) }}</span>
                  </div>
                  <div class="team-page__recent-info">
                    <p class="team-page__recent-name">
                      {{ member.displayName }}
                    </p>
                    <p class="team-page__recent-meta">
                      <span>{{
                        formatRelativeTime(member.lastAccessedAt)
                      }}</span>
                      <span class="team-page__recent-sep">・</span>
                      <span>{{ member.statusLabel }}</span>
                    </p>
                  </div>
                </li>
                <li
                  v-if="!recentAccessMembers.length"
                  class="team-page__recent-empty"
                >
                  最近アクセスがありません。
                </li>
              </ul>
            </section>

            <section class="team-page__aside-card">
              <h3>クイック操作</h3>
              <div class="team-page__actions">
                <button
                  type="button"
                  class="team-page__action-button"
                  :disabled="!canManageMembers"
                  @click="openInviteModal"
                >
                  メンバーを招待
                </button>
                <button
                  type="button"
                  class="team-page__action-button team-page__action-button--ghost"
                  @click="goToTimeline"
                >
                  ログを見る
                </button>
              </div>
            </section>
          </aside>
        </div>
        <MemberDetailPanel
          :open="Boolean(selectedMember)"
          :member="selectedMember"
          :role-options="roleOptions"
          :role-info-map="roleInfoMap"
          :can-edit-role="currentPermissions.canEditRoles"
          :can-remove="currentPermissions.canManageMembers"
          :can-manage-roles="canManageRolesViaAccess"
          :current-user-id="user?.uid"
          :save-role="saveRoleHandler"
          :remove-member="removeMemberHandler"
          :go-to-role-settings="goToRoleSettingsHandler"
          @close="closeMemberPanel"
        />
      </section>
    </div>

    <Teleport to="body">
      <div
        v-if="isInviteOpen"
        class="invite-modal__overlay"
        @click="closeInviteModal"
      >
        <div
          class="invite-modal__panel invite-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-dialog-title"
          @click.stop
        >
          <button
            type="button"
            class="invite-modal__close"
            aria-label="閉じる"
            @click="closeInviteModal"
          >
            ✕
          </button>
          <header>
            <div>
              <h3 id="invite-dialog-title">参加リンクを共有</h3>
              <p>
                リンクをコピーして共有すると、メンバーはこのプロジェクトに参加できます。
              </p>
            </div>
            <p class="invite-panel__hint">
              必要に応じてパスワードを設定してください。
            </p>
          </header>

          <ProjectInviteForm
            :project-id="projectId"
            :project-name="project?.name"
            @generated="handleLinkGenerated"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.members-content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-8);
  padding: var(--ui-space-8);
  height: calc(100vh - var(--ui-topbar-height));
  min-height: 0;
  box-sizing: border-box;
}

@supports (height: 100dvh) {
  .members-content {
    height: calc(100dvh - var(--ui-topbar-height));
  }
}

.team-page {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6, 1.5rem);
  flex: 1;
  min-height: 0;
}

.team-page__header {
  display: flex;
  justify-content: space-between;
  gap: var(--ui-space-4, 1rem);
  align-items: center;
}

.team-page__header-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-4, 1rem);
}

.team-page__header h2 {
  margin: 0;
}

.team-page__header p {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  color: var(--ui-text-muted, #64748b);
}

.team-page__invite {
  border: none;
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  display: inline-flex;
  gap: var(--ui-space-2, 0.5rem);
  align-items: center;
  background: var(--ui-brand-900, #0b2e33);
  color: var(--ui-surface, #ffffff);
  font-weight: var(--ui-font-semibold, 600);
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.team-page__invite:hover {
  background: var(--ui-brand-800, #1a4a52);
}

.team-page__invite:focus {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

.team-page__invite svg {
  width: 1.25rem;
  height: 1.25rem;
}

.team-page__invite-link {
  border: none;
  background: transparent;
  color: var(--ui-text, #0b2e33);
  font-weight: var(--ui-font-semibold, 600);
  padding: 0;
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.team-page__invite-link:hover {
  color: var(--ui-brand-600, #4f7c82);
}

.team-page__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--ui-space-4, 1rem);
}

.team-page__stats article {
  border-radius: var(--ui-radius-lg, 1rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  padding: var(--ui-space-4, 1rem);
  background: var(--ui-surface, #ffffff);
}

.team-page__stats p {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.team-page__stats strong {
  font-size: var(--ui-text-3xl, 1.875rem);
  color: var(--ui-brand-900, #0b2e33);
}

.team-page__members {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.team-page__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: var(--ui-space-6, 1.5rem);
  flex: 1;
  min-height: 0;
}

.team-page__aside {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
  position: sticky;
  top: 96px;
  align-self: start;
}

.team-page__aside-card {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-xl, 1.25rem);
  padding: var(--ui-space-5, 1.25rem);
  background: var(--ui-surface, #ffffff);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.team-page__aside-card h3 {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  color: var(--ui-text-strong, #0f172a);
}

.team-page__summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-space-3, 0.75rem);
}

.team-page__summary-item {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.team-page__summary-grid p {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.team-page__summary-grid strong {
  font-size: var(--ui-text-xl, 1.25rem);
  color: var(--ui-text-strong, #0f172a);
}

.team-page__summary-item--status {
  justify-content: space-between;
}

.team-page__summary-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-full, 9999px);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  background: var(--ui-surface-muted, #f1f5f9);
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.team-page__summary-link {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  background: transparent;
  color: var(--ui-text, #0b2e33);
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  cursor: pointer;
  text-align: center;
  transition: var(--ui-transition-all);
}

.team-page__summary-link:hover {
  border-color: var(--ui-brand-600, #4f7c82);
  color: var(--ui-brand-600, #4f7c82);
}

.team-page__summary-link:focus {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

.team-page__summary-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.team-page__role-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.team-page__role-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
}

.team-page__role-count {
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.team-page__recent-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.team-page__recent-row {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
}

.team-page__recent-info {
  min-width: 0;
}

.team-page__recent-name {
  margin: 0;
  font-weight: var(--ui-font-semibold, 600);
  font-size: var(--ui-text-sm, 0.875rem);
}

.team-page__recent-meta {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  display: flex;
  gap: var(--ui-space-1, 0.25rem);
  align-items: center;
}

.team-page__recent-sep {
  opacity: 0.6;
}

.team-page__recent-empty {
  color: var(--ui-text-muted, #64748b);
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
}

.team-page__actions {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.team-page__action-button {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text, #0b2e33);
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  cursor: pointer;
  text-align: center;
  transition: var(--ui-transition-all);
}

.team-page__action-button:hover {
  border-color: var(--ui-brand-600, #4f7c82);
  color: var(--ui-brand-600, #4f7c82);
}

.team-page__action-button:focus {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

.team-page__action-button--ghost {
  background: transparent;
}

.team-page__action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.team-page__members-header {
  display: flex;
  justify-content: space-between;
  gap: var(--ui-space-4, 1rem);
  align-items: center;
}

.team-page__members-header h3 {
  margin: 0;
}

.team-page__members-count {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.team-page__search {
  width: 100%;
  max-width: 320px;
}

.team-page__search input {
  width: 100%;
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  font-size: var(--ui-text-sm, 0.875rem);
  background: var(--ui-surface, #ffffff);
  color: var(--ui-text, #0b2e33);
  transition: var(--ui-transition-all);
}

.team-page__search input:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.team-page__members-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.team-member__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.team-member {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-xl, 1.25rem);
  padding: var(--ui-space-4, 1rem);
  display: grid;
  grid-template-columns: minmax(240px, 2fr) 160px 1fr;
  gap: var(--ui-space-4, 1rem);
  align-items: center;
  background: var(--ui-surface, #ffffff);
}

.team-member--clickable {
  cursor: pointer;
  transition: var(--ui-transition-all);
}

.team-member--clickable:hover {
  border-color: var(--ui-border, rgba(11, 46, 51, 0.12));
  box-shadow: var(--ui-shadow-lg);
  transform: translateY(-1px);
}

.team-member--selected {
  position: relative;
  border-color: var(--ui-brand-600, #4f7c82);
  background: var(--ui-surface-elevated, #f8fafc);
  box-shadow: var(--ui-shadow-md);
}

.team-member--selected::before {
  content: "";
  position: absolute;
  left: var(--ui-space-1, 0.25rem);
  top: var(--ui-space-3, 0.75rem);
  bottom: var(--ui-space-3, 0.75rem);
  width: 3px;
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-brand-600, #4f7c82);
}

.team-member--empty {
  justify-content: center;
  color: var(--ui-text-muted, #64748b);
}

.team-member__persona {
  display: flex;
  gap: var(--ui-space-3, 0.75rem);
  align-items: center;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: var(--ui-radius-full, 9999px);
  background: color-mix(in srgb, var(--ui-brand-600) 15%, transparent);
  color: var(--ui-brand-900, #0b2e33);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--ui-font-bold, 700);
}

.avatar--sm {
  width: 36px;
  height: 36px;
  font-size: var(--ui-text-xs, 0.75rem);
}

.team-member__name {
  margin: 0;
  font-weight: var(--ui-font-semibold, 600);
}

.team-member__email {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.team-member__details {
  display: flex;
  gap: var(--ui-space-3, 0.75rem);
  align-items: center;
  flex-wrap: wrap;
}

.badge {
  border-radius: var(--ui-radius-full, 9999px);
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
  font-size: var(--ui-text-sm, 0.875rem);
  text-transform: capitalize;
}

.badge.role-owner {
  background: color-mix(in srgb, var(--ui-brand-900) 10%, transparent);
  color: var(--ui-brand-900, #0b2e33);
}

.badge.role-admin {
  background: color-mix(in srgb, var(--ui-brand-600) 20%, transparent);
  color: var(--ui-brand-900, #0b2e33);
}

.badge.role-member,
.badge.role-viewer {
  background: var(--ui-surface-muted, #f1f5f9);
  color: var(--ui-text-muted, #64748b);
}

.status-indicator {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
}

.status-indicator.status-online {
  color: var(--ui-success, #16a34a);
}

.status-indicator.status-away {
  color: var(--ui-warning-dark, #b45309);
}

.status-indicator.status-offline {
  color: var(--ui-text-muted, #64748b);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.invite-panel {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-xl, 1.25rem);
  padding: var(--ui-space-6, 1.5rem);
  background: var(--ui-surface, #ffffff);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.invite-modal__overlay {
  position: fixed;
  inset: 0;
  background: var(--ui-surface-overlay);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 6rem var(--ui-space-4, 1rem) var(--ui-space-4, 1rem);
  z-index: var(--ui-z-modal, 50);
  overflow: auto;
}

.invite-modal__panel {
  width: min(640px, 100%);
  position: relative;
  box-shadow: var(--ui-shadow-xl);
}

.invite-modal__close {
  position: absolute;
  top: var(--ui-space-3, 0.75rem);
  right: var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  background: transparent;
  border-radius: var(--ui-radius-md, 0.75rem);
  width: 2.25rem;
  height: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--ui-text, #0b2e33);
  transition: var(--ui-transition-all);
}

.invite-modal__close:hover {
  border-color: var(--ui-brand-600, #4f7c82);
  color: var(--ui-brand-600, #4f7c82);
}

.invite-modal__close:focus {
  outline: none;
  box-shadow: var(--ui-ring-focus);
}

.invite-panel__hint {
  margin: 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.invite-panel__actions {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.invite-panel__error {
  color: var(--ui-danger, #ef4444);
  margin: 0;
  font-weight: var(--ui-font-semibold, 600);
}

@media (max-width: 960px) {
  .team-page__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .team-page__layout {
    grid-template-columns: 1fr;
  }

  .team-page__aside {
    position: static;
  }

  .team-page__members-header {
    flex-direction: column;
    align-items: stretch;
  }

  .team-member {
    grid-template-columns: 1fr;
    align-items: flex-start;
  }
}

@media (max-width: 640px) {
  .invite-modal__overlay {
    padding: 5rem var(--ui-space-4, 1rem) var(--ui-space-4, 1rem);
  }
}
</style>

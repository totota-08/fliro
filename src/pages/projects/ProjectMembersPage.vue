```vue
<script setup lang="ts">
import InviteLinksMiniCard from "@/components/invites/InviteLinksMiniCard.vue";
import MemberDetailPanel from "@/components/members/MemberDetailPanel.vue";
import DashboardSidebar from "@/components/projectDashboard/DashboardSidebar.vue";
import ProjectInviteForm from "@/components/projects/ProjectInviteForm.vue";
import { appName } from "@/constants/appMeta";
import { buildPermissionsFromRoles } from "@/constants/roles";
import { ROUTE_NAMES } from "@/constants/routes";
import { db } from "@/lib/firebase";
import {
  removeProjectMember,
  updateProjectMemberRole,
} from "@/services/projectMembers";
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

const logger = getLogger("app.pages.projects.ProjectMembers");
type MemberRole = "owner" | "admin" | "member" | "viewer";
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

const route = useRoute();
const router = useRouter();
const { user, profile } = useAuthStore();
const projectId = ref(String(route.params.projectId || ""));
const project = ref<ProjectDoc | null>(null);
const projectList = ref<{ id: string; name: string }[]>([]);
const members = ref<MemberDisplay[]>([]);
const selectedMemberId = ref<string | null>(null);
const isSidebarOpen = ref(true);
const latestInviteLink = ref("");
const memberQuery = ref("");
const isInviteOpen = ref(false);
const roleOptions: MemberRole[] = ["admin", "member", "viewer"];
const roleOrder: MemberRole[] = ["owner", "admin", "member", "viewer"];

const saveRoleHandler = async (role: MemberRole) => {
  if (!selectedMember.value) return;
  await handleSaveRole(selectedMember.value, role);
};

const removeMemberHandler = async () => {
  if (!selectedMember.value) return;
  await handleRemoveMember(selectedMember.value);
};

let stopProject: (() => void) | null = null;
let stopMembers: (() => void) | null = null;

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
        label: "ログ",
        to: {
          name: ROUTE_NAMES.projectTimeline,
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
    member: 0,
    viewer: 0,
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

const queryMemberId = computed(() => {
  const value = route.query.memberId;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] || null;
  return null;
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
  const nextQuery = { ...route.query };
  if (memberId) {
    nextQuery.memberId = memberId;
  } else {
    delete nextQuery.memberId;
  }
  void router.replace({ query: nextQuery });
}

function openMemberPanel(member: MemberDisplay) {
  selectedMemberId.value = member.userId;
  if (queryMemberId.value !== member.userId) {
    setMemberQuery(member.userId);
  }
}

function closeMemberPanel() {
  if (selectedMemberId.value) {
    selectedMemberId.value = null;
  }
  if (queryMemberId.value) {
    setMemberQuery(null);
  }
}

function getRoleLabel(role: MemberRole) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "member") return "Member";
  return "Viewer";
}

async function loadProjectList() {
  if (!user.value) return;
  const snap = await getDocs(
    collection(db, "userProjects", user.value.uid, "projects"),
  );
  projectList.value = snap.docs.map((docSnap) => ({
    id: docSnap.id,
    name: (docSnap.data().projectName as string) || "Project",
  }));
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
      const rank: Record<MemberRole, number> = {
        owner: 0,
        admin: 1,
        member: 2,
        viewer: 3,
      };
      members.value = list.sort((a, b) => rank[a.role] - rank[b.role]);
    },
  );
}

function resetWatchers() {
  stopProject?.();
  stopMembers?.();
  watchProject();
}

function closeSidebar() {
  isSidebarOpen.value = false;
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value;
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

function goToTimeline() {
  void router.push({
    name: ROUTE_NAMES.projectTimeline,
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

watch(
  [queryMemberId, members],
  ([memberId, list]) => {
    if (!memberId) {
      selectedMemberId.value = null;
      return;
    }
    const exists = list.some((member) => member.userId === memberId);
    if (exists) {
      selectedMemberId.value = memberId;
      return;
    }
    selectedMemberId.value = null;
    if (queryMemberId.value) {
      setMemberQuery(null);
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (window.matchMedia("(max-width: 1200px)").matches) {
    isSidebarOpen.value = false;
  }
  loadProjectList();
  resetWatchers();
});

watch(
  () => route.params.projectId,
  (newId) => {
    if (!newId) return;
    projectId.value = String(newId);
    closeMemberPanel();
    resetWatchers();
  },
);

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
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", handleInviteKeydown);
  }
});
</script>

<template>
  <div class="project-members-page">
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

      <div class="demo__main">
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
              <p class="demo__breadcrumb">プロジェクト &gt; メンバー</p>
              <h1 class="demo__heading">
                {{ project?.name || "プロジェクト" }}
              </h1>
            </div>
          </div>
        </header>

        <div class="demo__content demo__content--condensed">
          <section class="team-page">
            <header class="team-page__header">
              <div>
                <h2>チーム</h2>
                <p>メンバーの状態と権限をまとめて確認できます。</p>
              </div>
              <div v-if="canManageMembers" class="team-page__header-actions">
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
                  v-if="canManageInvites"
                  type="button"
                  class="team-page__invite-link"
                  @click="goToInvites"
                >
                  招待リンク管理 →
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
                    <li
                      v-if="!filteredMembers.length"
                      class="team-member team-member--empty"
                    >
                      {{
                        members.length
                          ? "検索結果がありません。"
                          : "まだメンバーがいません。"
                      }}
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
              :can-edit-role="currentPermissions.canEditRoles"
              :can-remove="currentPermissions.canManageMembers"
              :current-user-id="user?.uid"
              :save-role="saveRoleHandler"
              :remove-member="removeMemberHandler"
              @close="closeMemberPanel"
            />
          </section>
        </div>
      </div>
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

.team-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  flex: 1;
  min-height: 0;
}

.team-page__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.team-page__header-actions {
  display: inline-flex;
  align-items: center;
  gap: 1rem;
}

.team-page__header h2 {
  margin: 0;
}

.team-page__header p {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
}

.team-page__invite {
  border: none;
  border-radius: 0.9rem;
  padding: 0.65rem 1rem;
  display: inline-flex;
  gap: 0.5rem;
  align-items: center;
  background: #0b2e33;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.team-page__invite svg {
  width: 1.25rem;
  height: 1.25rem;
}

.team-page__invite-link {
  border: none;
  background: transparent;
  color: var(--text);
  font-weight: 600;
  padding: 0;
  cursor: pointer;
  transition: color 0.2s ease;
}

.team-page__invite-link:hover {
  color: var(--primary);
}

.team-page__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.team-page__stats article {
  border-radius: 1rem;
  border: 1px solid rgba(11, 46, 51, 0.08);
  padding: 1rem;
  background: #fff;
}

.team-page__stats p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.team-page__stats strong {
  font-size: 2rem;
  color: #0b2e33;
}

.team-page__members {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.team-page__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 1.5rem;
  flex: 1;
  min-height: 0;
}

.team-page__aside {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: sticky;
  top: 96px;
  align-self: start;
}

.team-page__aside-card {
  border: 1px solid var(--border-light);
  border-radius: 1.25rem;
  padding: 1.25rem;
  background: var(--surface-card);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.team-page__aside-card h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-strong);
}

.team-page__summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.team-page__summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.team-page__summary-grid p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.team-page__summary-grid strong {
  font-size: 1.3rem;
  color: var(--text-strong);
}

.team-page__summary-item--status {
  justify-content: space-between;
}

.team-page__summary-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  border: 1px solid var(--border-light);
  background: var(--surface-muted);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text);
}

.team-page__summary-link {
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text);
  border-radius: 0.85rem;
  padding: 0.6rem 1rem;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  transition:
    border-color 0.2s ease,
    color 0.2s ease;
}

.team-page__summary-link:hover {
  border-color: var(--primary);
  color: var(--primary);
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
  gap: 0.6rem;
}

.team-page__role-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.team-page__role-count {
  font-weight: 600;
  color: var(--text);
}

.team-page__recent-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.team-page__recent-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.team-page__recent-info {
  min-width: 0;
}

.team-page__recent-name {
  margin: 0;
  font-weight: 600;
  font-size: 0.9rem;
}

.team-page__recent-meta {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  color: var(--text-muted);
  display: flex;
  gap: 0.35rem;
  align-items: center;
}

.team-page__recent-sep {
  opacity: 0.6;
}

.team-page__recent-empty {
  color: var(--text-muted);
  margin: 0;
  font-size: 0.85rem;
}

.team-page__actions {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.team-page__action-button {
  border: 1px solid var(--border-light);
  background: var(--surface-card);
  color: var(--text);
  border-radius: 0.85rem;
  padding: 0.65rem 1rem;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  transition:
    border-color 0.2s ease,
    color 0.2s ease,
    background 0.2s ease;
}

.team-page__action-button:hover {
  border-color: var(--primary);
  color: var(--primary);
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
  gap: 1rem;
  align-items: center;
}

.team-page__members-header h3 {
  margin: 0;
}

.team-page__members-count {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.team-page__search {
  width: 100%;
  max-width: 320px;
}

.team-page__search input {
  width: 100%;
  border-radius: 0.85rem;
  border: 1px solid var(--border-light);
  padding: 0.65rem 1rem;
  font-size: 0.95rem;
  background: var(--surface-card);
  color: var(--text);
}

.team-page__search input:focus {
  outline: 2px solid color-mix(in srgb, var(--primary) 35%, transparent);
  outline-offset: 2px;
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
  gap: 1rem;
}

.team-member {
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 1.25rem;
  padding: 1rem;
  display: grid;
  grid-template-columns: minmax(240px, 2fr) 160px 1fr;
  gap: 1rem;
  align-items: center;
  background: #fff;
}

.team-member--clickable {
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.team-member--clickable:hover {
  border-color: var(--border);
  box-shadow: 0 12px 24px color-mix(in srgb, var(--text) 12%, transparent);
  transform: translateY(-1px);
}

.team-member--selected {
  position: relative;
  border-color: var(--primary);
  background: var(--surface-elevated);
  box-shadow: 0 10px 20px color-mix(in srgb, var(--primary) 18%, transparent);
}

.team-member--selected::before {
  content: "";
  position: absolute;
  left: 0.35rem;
  top: 0.65rem;
  bottom: 0.65rem;
  width: 3px;
  border-radius: 999px;
  background: var(--primary);
}

.team-member--empty {
  justify-content: center;
  color: var(--text-muted);
}

.team-member__persona {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: rgba(79, 124, 130, 0.15);
  color: #0b2e33;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.avatar--sm {
  width: 36px;
  height: 36px;
  font-size: 0.75rem;
}

.team-member__name {
  margin: 0;
  font-weight: 600;
}

.team-member__email {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.team-member__details {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.badge {
  border-radius: 999px;
  padding: 0.2rem 0.75rem;
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: capitalize;
}

.badge.role-owner {
  background: rgba(11, 46, 51, 0.1);
  color: #0b2e33;
}

.badge.role-admin {
  background: rgba(79, 124, 130, 0.2);
  color: #0b2e33;
}

.badge.role-member,
.badge.role-viewer {
  background: rgba(11, 46, 51, 0.05);
  color: #496167;
}

.status-indicator {
  font-size: 0.85rem;
  font-weight: 600;
}

.status-indicator.status-online {
  color: #1d9160;
}

.status-indicator.status-away {
  color: #b07816;
}

.status-indicator.status-offline {
  color: #9da8b6;
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
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 1.25rem;
  padding: 1.5rem;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.invite-modal__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 6rem 1rem 1rem;
  z-index: 9999;
  overflow: auto;
}

.invite-modal__panel {
  width: min(640px, 100%);
  position: relative;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
}

.invite-modal__close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  border: 1px solid var(--border-light);
  background: transparent;
  border-radius: 0.75rem;
  width: 2.25rem;
  height: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text);
}

.invite-modal__close:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.invite-panel__hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.invite-panel__actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.invite-panel__error {
  color: #d64545;
  margin: 0;
  font-weight: 600;
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
    padding: 5rem 1rem 1rem;
  }
}
</style>

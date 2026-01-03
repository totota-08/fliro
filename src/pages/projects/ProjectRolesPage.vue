<script setup lang="ts">
import DashboardSidebar from "@/components/projectDashboard/DashboardSidebar.vue";
import { appName } from "@/constants/appMeta";
import { buildPermissionsFromRoles } from "@/constants/roles";
import { ROUTE_NAMES } from "@/constants/routes";
import { db } from "@/lib/firebase";
import {
  listenProjectMembers,
  updateProjectMemberRole,
  type ProjectMember,
} from "@/services/projectMembers";
import { useAuthStore } from "@/store/auth";
import type { DashboardNavItem } from "@/types/projectDashboard";
import { doc, getDoc } from "firebase/firestore";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const { user, profile } = useAuthStore();

type MemberRole = ProjectMember["role"];

const projectId = ref(String(route.params.projectId || ""));
const members = ref<ProjectMember[]>([]);
const isSidebarOpen = ref(true);
const updating = ref<string | null>(null);
const canEdit = ref(false);

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
        key: "roles",
        label: "ロール",
        to: {
          name: ROUTE_NAMES.projectRoles,
          params: { projectId: projectId.value },
        },
        icon: "members",
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
  members.value.map((member, index) => ({
    key: member.userId,
    label: member.displayName || member.userId,
    to: {
      name: ROUTE_NAMES.projectDashboard,
      params: { projectId: projectId.value },
    },
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

const roleOptions: MemberRole[] = ["admin", "member", "viewer"];

async function evaluatePermissions() {
  if (!user.value) {
    canEdit.value = false;
    return;
  }
  const snap = await getDoc(
    doc(db, "projects", projectId.value, "members", user.value.uid),
  );
  const data = snap.data();
  if (data?.permissions && typeof data.permissions.canEditRoles === "boolean") {
    canEdit.value = data.permissions.canEditRoles;
    return;
  }
  if (Array.isArray(data?.roles)) {
    canEdit.value = buildPermissionsFromRoles(data.roles).canEditRoles;
    return;
  }
  canEdit.value = Boolean(
    data?.role === "admin" || data?.projectRole === "owner",
  );
}

function watchMembers() {
  stopMembers = listenProjectMembers(projectId.value, (list) => {
    members.value = list;
  });
}

async function changeRole(member: ProjectMember, next: MemberRole) {
  if (!canEdit.value || member.role === "owner") return;
  updating.value = member.userId;
  try {
    const actorName =
      profile.value?.nickname ||
      profile.value?.fullName ||
      user.value?.uid ||
      "System";
    await updateProjectMemberRole(projectId.value, member.userId, next, {
      previousRole: member.role,
      memberName: member.displayName || member.userId,
      actor: {
        id: user.value?.uid ?? null,
        name: actorName,
        origin: "ui",
      },
    });
  } finally {
    updating.value = null;
  }
}

function closeSidebar() {
  isSidebarOpen.value = false;
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value;
}

onMounted(() => {
  if (window.matchMedia("(max-width: 1200px)").matches) {
    isSidebarOpen.value = false;
  }
  evaluatePermissions();
  watchMembers();
});

watch(
  () => route.params.projectId,
  (newId) => {
    if (!newId) return;
    projectId.value = String(newId);
    evaluatePermissions();
    stopMembers?.();
    watchMembers();
  },
);

onBeforeUnmount(() => {
  stopMembers?.();
});
</script>

<template>
  <div
    :class="[
      'roles-shell',
      { 'roles-shell--sidebar-collapsed': !isSidebarOpen },
    ]"
  >
    <DashboardSidebar
      :open="isSidebarOpen"
      :nav-items="navItems"
      :projects="sidebarProjects"
      :profile="profileInfo"
      brand-subtitle="ロール設定"
      @close="closeSidebar"
    />
    <div
      v-if="isSidebarOpen"
      class="roles-shell__overlay"
      @click="closeSidebar"
    />

    <main class="roles-shell__main">
      <header class="roles-shell__topbar">
        <div class="roles-shell__topbar-left">
          <button
            type="button"
            class="roles-shell__menu-button"
            @click="toggleSidebar"
          >
            <span class="sr-only">サイドバーを切り替え</span>
            <svg
              aria-hidden="true"
              class="roles-shell__menu-icon"
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
            <p class="roles-shell__breadcrumb">プロジェクト &gt; ロール</p>
            <h1 class="roles-shell__heading">ロール設定</h1>
            <p class="muted">Discord風にメンバーのロールと権限を管理します。</p>
          </div>
        </div>
      </header>

      <div class="roles-content">
        <section class="roles-legend">
          <h3>ロール概要</h3>
          <ul>
            <li><strong>admin</strong> — すべての設定とメンバー管理が可能</li>
            <li>
              <strong>member</strong> — タスク作成・更新、スレッド参加が可能
            </li>
            <li><strong>viewer</strong> — 閲覧のみ</li>
          </ul>
        </section>

        <section class="roles-card">
          <header class="roles-card__header">
            <div>
              <p class="eyebrow">Members</p>
              <h2>メンバーごとのロール割り当て</h2>
            </div>
          </header>
          <ul class="roles-list">
            <li
              v-for="member in members"
              :key="member.userId"
              class="roles-item"
            >
              <div class="roles-item__persona">
                <div class="avatar" aria-hidden="true">
                  {{ (member.displayName || member.userId).slice(0, 2) }}
                </div>
                <div>
                  <p class="roles-item__name">
                    {{ member.displayName || member.userId }}
                  </p>
                  <p class="roles-item__meta">
                    {{ member.email || member.userId }}
                  </p>
                </div>
              </div>
              <div class="roles-item__selector">
                <label class="sr-only" :for="`role-${member.userId}`"
                  >ロール</label
                >
                <select
                  :id="`role-${member.userId}`"
                  :value="member.role"
                  :disabled="
                    !canEdit ||
                    member.role === 'owner' ||
                    updating === member.userId
                  "
                  @change="
                    changeRole(
                      member,
                      ($event.target as HTMLSelectElement).value as MemberRole,
                    )
                  "
                >
                  <option v-for="role in roleOptions" :key="role" :value="role">
                    {{ role }}
                  </option>
                </select>
              </div>
              <span class="badge" :class="`badge-${member.role}`">{{
                member.role
              }}</span>
            </li>
            <li v-if="!members.length" class="roles-item roles-item--empty">
              メンバーがいません。
            </li>
          </ul>
          <p v-if="!canEdit" class="muted">管理者のみ変更できます。</p>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
@import "@/pages/demo/styles/demo-shell.css";

.roles-shell {
  display: flex;
  min-height: 100vh;
  background: #f6f8fa;
}

.roles-shell__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.18);
}

.roles-shell__main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.roles-shell__topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
}

.roles-shell__topbar-left {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.roles-shell__breadcrumb {
  margin: 0;
  color: var(--text-muted);
}

.roles-shell__heading {
  margin: 0;
}

.roles-shell__menu-button {
  border: none;
  border-radius: 0.75rem;
  background: #fff;
  padding: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.roles-shell__menu-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.roles-content {
  padding: 0 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 900px;
}

.roles-legend {
  background: #fff;
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 1rem;
  padding: 1rem 1.25rem;
}

.roles-legend h3 {
  margin: 0 0 0.5rem;
}

.roles-legend ul {
  margin: 0;
  padding-left: 1.2rem;
  color: var(--text-muted);
}

.roles-card {
  background: #fff;
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 1rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.roles-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.roles-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.roles-item {
  border: 1px solid rgba(11, 46, 51, 0.08);
  border-radius: 0.9rem;
  padding: 0.75rem 0.9rem;
  background: #fdfefe;
  display: grid;
  grid-template-columns: 2fr 1fr auto;
  gap: 0.75rem;
  align-items: center;
}

.roles-item--empty {
  justify-content: center;
  color: var(--text-muted);
}

.roles-item__persona {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(11, 46, 51, 0.12);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.roles-item__name {
  margin: 0;
  font-weight: 700;
}

.roles-item__meta {
  margin: 0.15rem 0 0;
  color: var(--text-muted);
}

.roles-item__selector select {
  border: 1px solid #d5dde5;
  border-radius: 0.75rem;
  padding: 0.55rem 0.8rem;
  background: #f8fafc;
}

.badge {
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-weight: 700;
  text-transform: capitalize;
}

.badge-admin {
  background: rgba(79, 124, 130, 0.2);
  color: #0b2e33;
}

.badge-member {
  background: rgba(11, 46, 51, 0.08);
  color: #0b2e33;
}

.badge-viewer {
  background: rgba(148, 163, 184, 0.2);
  color: #1f2937;
}

.muted {
  color: var(--text-muted);
}

.eyebrow {
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0;
  font-size: 0.82rem;
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

@media (max-width: 768px) {
  .roles-shell__topbar {
    padding: 1rem;
  }

  .roles-content {
    padding: 0 1rem 2rem;
  }

  .roles-item {
    grid-template-columns: 1fr;
    align-items: flex-start;
  }
}
</style>

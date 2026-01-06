<script setup lang="ts">
import { appName } from "@/constants/appMeta";
import { buildPermissionsFromRoles } from "@/constants/roles";
import { ROUTE_NAMES } from "@/constants/routes";
import { buildProjectNavItems } from "@/constants/projectNav";
import { useProjectIdRoute } from "@/composables/useProjectIdRoute";
import ProjectAppShell from "@/layouts/ProjectAppShell.vue";
import { db } from "@/lib/firebase";
import {
  listenProjectMembers,
  updateProjectMemberRole,
  type ProjectMember,
} from "@/services/projectMembers";
import { useAuthStore } from "@/store/auth";
import { doc, getDoc } from "firebase/firestore";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const { user, profile } = useAuthStore();

type MemberRole = ProjectMember["role"];

const { projectId } = useProjectIdRoute();
const members = ref<ProjectMember[]>([]);
const updating = ref<string | null>(null);
const canEdit = ref(false);

let stopMembers: (() => void) | null = null;

const navItems = computed(() => buildProjectNavItems(projectId.value));

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

onMounted(() => {
  evaluatePermissions();
  watchMembers();
});

watch(projectId, (newId, oldId) => {
  if (!newId || newId === oldId) return;
  evaluatePermissions();
  stopMembers?.();
  watchMembers();
});

onBeforeUnmount(() => {
  stopMembers?.();
});
</script>

<template>
  <ProjectAppShell
    :project-id="projectId"
    :nav-items="navItems"
    :sidebar-projects="sidebarProjects"
    :profile-info="profileInfo"
    brand-subtitle="ロール設定"
  >
    <template #headerTitle>
      <p class="project-app-shell__breadcrumb">プロジェクト &gt; ロール</p>
      <h1 class="project-app-shell__heading">ロール設定</h1>
      <p class="muted">Discord風にメンバーのロールと権限を管理します。</p>
    </template>

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
          <li v-for="member in members" :key="member.userId" class="roles-item">
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
  </ProjectAppShell>
</template>

<style scoped>
@import "@/pages/demo/styles/demo-shell.css";

.roles-content {
  padding: 0 var(--ui-space-6, 1.5rem) var(--ui-space-8, 2rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
  max-width: 900px;
}

.roles-legend {
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-4, 1rem) var(--ui-space-5, 1.25rem);
}

.roles-legend h3 {
  margin: 0 0 var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.roles-legend ul {
  margin: 0;
  padding-left: var(--ui-space-5, 1.25rem);
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
  line-height: var(--ui-leading-relaxed, 1.625);
}

.roles-card {
  background: var(--ui-surface, #ffffff);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  padding: var(--ui-space-5, 1.25rem);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.roles-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--ui-space-4, 1rem);
}

.roles-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.roles-item {
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  background: var(--ui-surface, #ffffff);
  display: grid;
  grid-template-columns: 2fr 1fr auto;
  gap: var(--ui-space-3, 0.75rem);
  align-items: center;
  transition: var(--ui-transition-all);
}

.roles-item:hover {
  border-color: var(--ui-border, rgba(11, 46, 51, 0.12));
  box-shadow: var(--ui-shadow-sm);
}

.roles-item--empty {
  justify-content: center;
  color: var(--ui-text-muted, #64748b);
}

.roles-item__persona {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-brand-300, #b8e3e9);
  color: var(--ui-brand-900, #0b2e33);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--ui-font-bold, 700);
  font-size: var(--ui-text-sm, 0.875rem);
}

.roles-item__name {
  margin: 0;
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text, #0b2e33);
}

.roles-item__meta {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  color: var(--ui-text-muted, #64748b);
  font-size: var(--ui-text-sm, 0.875rem);
}

.roles-item__selector select {
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  background: var(--ui-surface-muted, #f1f5f9);
  font-size: var(--ui-text-sm, 0.875rem);
  transition: var(--ui-transition-colors);
}

.roles-item__selector select:focus {
  outline: none;
  border-color: var(--ui-border-focus, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.badge {
  border-radius: var(--ui-radius-full, 9999px);
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  font-weight: var(--ui-font-bold, 700);
  font-size: var(--ui-text-xs, 0.75rem);
  text-transform: capitalize;
}

.badge-admin {
  background: rgba(79, 124, 130, 0.2);
  color: var(--ui-brand-900, #0b2e33);
}

.badge-member {
  background: var(--ui-border-light, rgba(11, 46, 51, 0.08));
  color: var(--ui-brand-900, #0b2e33);
}

.badge-viewer {
  background: rgba(148, 163, 184, 0.2);
  color: var(--ui-text-strong, #0f172a);
}

.muted {
  color: var(--ui-text-muted, #64748b);
}

.eyebrow {
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ui-text-muted, #64748b);
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
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
  .roles-content {
    padding: 0 var(--ui-space-4, 1rem) var(--ui-space-8, 2rem);
  }

  .roles-item {
    grid-template-columns: 1fr;
    align-items: flex-start;
  }
}
</style>

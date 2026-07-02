<script setup lang="ts">
/**
 * MyPage.vue - マイページ
 *
 * プロジェクト一覧、タスク状況を表示
 * プロフィール編集はAccountSettingsPageに移動
 *
 * 1カラムレイアウト：
 * - プロフィール（トップ）
 * - プロジェクト一覧
 * - 今週のタスク
 * - アカウント設定リンク
 */
import ProfileSummaryCard from "@/components/mypage/ProfileSummaryCard.vue";
import JoinedProjectsCard, {
  type ProjectItem,
  type ProjectInvite as InviteItem,
} from "@/components/mypage/JoinedProjectsCard.vue";
import WeeklyTasksCard, {
  type TaskDoc,
} from "@/components/mypage/WeeklyTasksCard.vue";
import { appName } from "@/constants/appMeta";
import { ROUTE_NAMES } from "@/constants/routes";
import { db } from "@/lib/firebase";
import AppShell from "@/layouts/AppShell.vue";
import {
  listenUserInvites,
  redeemInvite,
  type ProjectInvite,
} from "@/services/projectInvites";
import { signOutUser, useAuthStore } from "@/store/auth";
import { getLogger } from "@logtape/logtape";
import { collection, getDocs, query } from "firebase/firestore";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";

const logger = getLogger("app.pages.account.MyPage");

const { user, profile } = useAuthStore();
const router = useRouter();
const loading = ref(true);
const taskList = ref<TaskDoc[]>([]);
const projectCount = ref(0);
const projects = ref<ProjectItem[]>([]);

// Invite-related state
const invites = ref<ProjectInvite[]>([]);
const joiningInviteId = ref<string | null>(null);
let unsubscribeInvites: (() => void) | null = null;

// Computed
const avatarUrl = computed(
  () => profile.value?.avatarUrl || user.value?.photoURL || "",
);

const upcomingTasks = computed(() => {
  const now = Date.now();
  const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
  return taskList.value
    .filter((task) => task.dueDate?.seconds)
    .filter((task) => {
      const due = task.dueDate!.seconds * 1000;
      return due >= now && due <= weekAhead;
    })
    .sort((a, b) => a.dueDate!.seconds - b.dueDate!.seconds);
});

const totalTasks = computed(() => taskList.value.length);
const completedThisWeek = computed(
  () =>
    taskList.value.filter(
      (task) => task.status === "done" || task.status === "completed",
    ).length,
);

const pendingInvites = computed(() => {
  const joinedProjectIds = new Set(projects.value.map((p) => p.id));
  return invites.value.filter(
    (invite) => !joinedProjectIds.has(invite.projectId),
  ) as InviteItem[];
});

const profileData = computed(() => ({
  nickname: profile.value?.nickname,
  fullName: profile.value?.fullName,
  email: profile.value?.email,
  avatarUrl: avatarUrl.value,
}));

const stats = computed(() => ({
  projectCount: projectCount.value,
  totalTasks: totalTasks.value,
  completedThisWeek: completedThisWeek.value,
}));

// Functions
async function fetchTasks() {
  if (!user.value) return;
  loading.value = true;
  try {
    const items: TaskDoc[] = [];
    const projectItems: ProjectItem[] = [];
    const projectsSnap = await getDocs(
      collection(db, "userProjects", user.value.uid, "projects"),
    );
    projectCount.value = projectsSnap.size;
    for (const docSnap of projectsSnap.docs) {
      const projectId = docSnap.id;
      const data = docSnap.data();
      const projectName = (data.projectName as string) || "プロジェクト";
      const lastAccessedAt = data.lastAccessedAt?.toDate?.() || null;
      projectItems.push({
        id: projectId,
        name: projectName,
        role: data.role as string,
        lastAccessedAt,
        color: (data.color as string) || undefined,
        iconUrl: (data.iconUrl as string) || undefined,
      });
      const tasksSnap = await getDocs(
        query(collection(db, "projects", projectId, "tasks")),
      );
      tasksSnap.forEach((task) => {
        const taskData = task.data();
        items.push({
          title: taskData.title ?? "タスク",
          status: taskData.status ?? "todo",
          dueDate: taskData.dueDate,
          projectId,
          projectName,
        });
      });
    }
    taskList.value = items;
    projects.value = projectItems;
  } catch (error) {
    logger.error`Failed to load tasks: ${error}`;
  } finally {
    loading.value = false;
  }
}

function setupInviteListener() {
  if (unsubscribeInvites) {
    unsubscribeInvites();
    unsubscribeInvites = null;
  }

  const email = profile.value?.email;
  if (!email) {
    invites.value = [];
    return;
  }

  unsubscribeInvites = listenUserInvites(email, (list) => {
    invites.value = list;
  });
}

async function handleJoinProject(invite: InviteItem) {
  if (!user.value || joiningInviteId.value) return;

  joiningInviteId.value = invite.id;
  try {
    const projectId = await redeemInvite(
      (invite as ProjectInvite).token,
      user.value.uid,
      user.value.email || profile.value?.email || "",
    );
    await fetchTasks();
    router.push({
      name: ROUTE_NAMES.projectDashboard,
      params: { projectId },
    });
  } catch (error) {
    logger.error`Failed to join project: ${error}`;
  } finally {
    joiningInviteId.value = null;
  }
}

// Sign out
async function handleSignOut() {
  await signOutUser();
  await router.push({ name: ROUTE_NAMES.login });
}

onMounted(async () => {
  await fetchTasks();
  setupInviteListener();
});

watch(
  () => profile.value?.email,
  () => {
    setupInviteListener();
  },
);

onBeforeUnmount(() => {
  if (unsubscribeInvites) {
    unsubscribeInvites();
    unsubscribeInvites = null;
  }
});
</script>

<template>
  <AppShell>
    <div class="mypage">
      <!-- Profile Section -->
      <ProfileSummaryCard
        :profile="profileData"
        :stats="stats"
        :app-name="appName"
        @sign-out="handleSignOut"
      />

      <!-- Projects Section -->
      <JoinedProjectsCard
        :projects="projects"
        :pending-invites="pendingInvites"
        :joining-invite-id="joiningInviteId"
        @join-project="handleJoinProject"
      />

      <!-- Tasks Section -->
      <WeeklyTasksCard
        :loading="loading"
        :tasks="taskList"
        :upcoming-tasks="upcomingTasks"
      />

      <!-- Account Settings Link (Inline) -->
      <div class="mypage__settings-link">
        <RouterLink
          :to="{ name: ROUTE_NAMES.accountSettings }"
          class="settings-link"
        >
          <span class="settings-link__text">アカウント設定</span>
          <svg
            class="settings-link__icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M9 18l6-6-6-6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </RouterLink>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.mypage {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6, 1.5rem);
  max-width: 800px;
  margin: 0 auto;
}

/* Settings Link (Inline) */
.mypage__settings-link {
  display: flex;
  justify-content: center;
  padding: var(--ui-space-2, 0.5rem) 0;
}

.settings-link {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1, 0.25rem);
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-4, 1rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  text-decoration: none;
  border-radius: var(--ui-radius-md, 0.75rem);
  transition: var(--ui-transition-all);
}

.settings-link:hover {
  color: var(--ui-brand-600, #4f7c82);
  background: var(--ui-surface-muted, #f1f5f9);
}

.settings-link__text {
  font-weight: var(--ui-font-medium, 500);
}

.settings-link__icon {
  opacity: 0.6;
  transition: var(--ui-transition-all);
}

.settings-link:hover .settings-link__icon {
  opacity: 1;
  transform: translateX(2px);
}
</style>

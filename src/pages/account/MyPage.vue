<script setup lang="ts">
/**
 * MyPage.vue - マイページ
 *
 * プロジェクト一覧、タスク状況を表示
 * プロフィール編集はAccountSettingsPageに移動
 *
 * 2カラムレイアウト：
 * - 左: 参加プロジェクト（主）
 * - 右: 今週のタスク（従）
 */
import ProfileSummaryCard from "@/components/mypage/ProfileSummaryCard.vue";
import JoinedProjectsCard, {
  type ProjectItem,
  type ProjectInvite as InviteItem,
} from "@/components/mypage/JoinedProjectsCard.vue";
import WeeklyTasksCard, {
  type TaskDoc,
} from "@/components/mypage/WeeklyTasksCard.vue";
import SectionCard from "@/components/ui/SectionCard.vue";
import AppButton from "@/components/ui/AppButton.vue";
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
import { useRouter } from "vue-router";

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

      <!-- Two Column Layout -->
      <div class="mypage__columns">
        <!-- Left Column: Projects (Primary) -->
        <div class="mypage__column mypage__column--primary">
          <JoinedProjectsCard
            :projects="projects"
            :pending-invites="pendingInvites"
            :joining-invite-id="joiningInviteId"
            @join-project="handleJoinProject"
          />
        </div>

        <!-- Right Column: Tasks (Secondary) -->
        <div class="mypage__column mypage__column--secondary">
          <WeeklyTasksCard
            :loading="loading"
            :tasks="taskList"
            :upcoming-tasks="upcomingTasks"
          />
        </div>
      </div>

      <!-- Account Settings Link -->
      <SectionCard size="sm">
        <div class="settings-link">
          <div class="settings-link__info">
            <p class="settings-link__title">アカウント設定</p>
            <p class="settings-link__description">
              プロフィール編集やアカウントの削除などを行えます
            </p>
          </div>
          <AppButton
            variant="outline"
            size="sm"
            :to="{ name: ROUTE_NAMES.accountSettings }"
          >
            設定を開く
          </AppButton>
        </div>
      </SectionCard>
    </div>
  </AppShell>
</template>

<style scoped>
.mypage {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6, 1.5rem);
}

/* Two Column Layout */
.mypage__columns {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: var(--ui-space-6, 1.5rem);
  align-items: start;
}

.mypage__column--primary {
  min-width: 0; /* Prevent overflow */
}

.mypage__column--secondary {
  min-width: 0;
}

/* Settings Link */
.settings-link {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--ui-space-4, 1rem);
}

.settings-link__info {
  flex: 1;
}

.settings-link__title {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.settings-link__description {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

/* Responsive */
@media (max-width: 960px) {
  .mypage__columns {
    grid-template-columns: 1fr;
  }

  .mypage__column--secondary {
    order: -1; /* タスクを上に表示（モバイルではより重要） */
  }
}

@media (max-width: 768px) {
  .settings-link {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }
}
</style>

<script setup lang="ts">
import AppBadge from "@/components/ui/AppBadge.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppEmptyState from "@/components/ui/AppEmptyState.vue";
import SectionCard from "@/components/ui/SectionCard.vue";
import { appName } from "@/constants/appMeta";
import { ROUTE_NAMES } from "@/constants/routes";
import { db } from "@/lib/firebase";
import AppShell from "@/layouts/AppShell.vue";
import { useAuthStore } from "@/store/auth";
import { getLogger } from "@logtape/logtape";
import { collection, getDocs, query } from "firebase/firestore";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const logger = getLogger("app.pages.account.MyPage");

interface TaskDoc {
  title: string;
  status: string;
  dueDate?: { seconds: number };
  projectId: string;
  projectName: string;
}

interface ProjectItem {
  id: string;
  name: string;
  role?: string;
  lastAccessedAt?: Date;
}

const { user, profile } = useAuthStore();
const loading = ref(true);
const taskList = ref<TaskDoc[]>([]);
const projectCount = ref(0);
const projects = ref<ProjectItem[]>([]);
const keyBuffer = ref("");
const SECRET = appName.toLowerCase();
const router = useRouter();

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
        const data = task.data() as any;
        items.push({
          title: data.title ?? "タスク",
          status: data.status ?? "todo",
          dueDate: data.dueDate,
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

function getRoleBadgeVariant(
  role?: string,
): "owner" | "admin" | "member" | "viewer" {
  if (!role) return "member";
  const normalized = role.toLowerCase();
  if (normalized === "owner") return "owner";
  if (normalized === "admin") return "admin";
  if (normalized === "viewer") return "viewer";
  return "member";
}

function formatRelativeDate(date?: Date): string {
  if (!date) return "";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "今日";
  if (days === 1) return "昨日";
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  return date.toLocaleDateString("ja-JP");
}

function handleKeydown(event: KeyboardEvent) {
  keyBuffer.value = (keyBuffer.value + event.key.toLowerCase()).slice(
    -SECRET.length,
  );
  if (keyBuffer.value === SECRET) {
    router.push({ name: ROUTE_NAMES.secretAccess });
  }
}

onMounted(async () => {
  await fetchTasks();
  window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <AppShell>
    <div class="mypage">
      <!-- Profile Section -->
      <SectionCard elevated>
        <div class="profile">
          <div class="profile__info">
            <p class="profile__eyebrow">My Page</p>
            <h1 class="profile__name">
              {{
                profile?.nickname || profile?.fullName || `${appName} ユーザー`
              }}
            </h1>
            <p class="profile__email">{{ profile?.email }}</p>
            <div class="profile__actions">
              <AppButton
                :to="{ name: ROUTE_NAMES.authDebug }"
                variant="outline"
              >
                アカウント設定
              </AppButton>
              <AppButton :to="{ name: ROUTE_NAMES.projectCreate }">
                新しいプロジェクト
              </AppButton>
            </div>
          </div>
          <dl class="profile__stats">
            <div class="profile__stat">
              <dt>参加プロジェクト</dt>
              <dd>{{ projectCount }}</dd>
            </div>
            <div class="profile__stat">
              <dt>タスク総数</dt>
              <dd>{{ totalTasks }}</dd>
            </div>
            <div class="profile__stat">
              <dt>完了タスク（週）</dt>
              <dd>{{ completedThisWeek }}</dd>
            </div>
          </dl>
        </div>
      </SectionCard>

      <!-- Projects Section -->
      <SectionCard
        title="参加中のプロジェクト"
        subtitle="プロジェクトを選択して開く"
      >
        <AppEmptyState
          v-if="!projects.length"
          icon="folder"
          title="プロジェクトがありません"
          description="新しいプロジェクトを作成するか、招待リンクから参加してください。"
        >
          <template #action>
            <AppButton :to="{ name: ROUTE_NAMES.projectCreate }">
              プロジェクトを作成
            </AppButton>
          </template>
        </AppEmptyState>
        <ul v-else class="project-list">
          <li
            v-for="project in projects"
            :key="project.id"
            class="project-item"
          >
            <div class="project-item__info">
              <div class="project-item__header">
                <p class="project-item__name">{{ project.name }}</p>
                <AppBadge
                  :variant="getRoleBadgeVariant(project.role)"
                  size="sm"
                >
                  {{ project.role || "member" }}
                </AppBadge>
              </div>
              <p v-if="project.lastAccessedAt" class="project-item__activity">
                最終アクセス: {{ formatRelativeDate(project.lastAccessedAt) }}
              </p>
            </div>
            <AppButton
              variant="outline"
              size="sm"
              :to="{
                name: ROUTE_NAMES.projectDashboard,
                params: { projectId: project.id },
              }"
            >
              開く
            </AppButton>
          </li>
        </ul>
      </SectionCard>

      <!-- Tasks Section -->
      <SectionCard
        title="今週のタスク状況"
        subtitle="期限が近いタスクをチェックして、優先順位を整えましょう。"
      >
        <div v-if="loading" class="loading-state">読み込み中...</div>
        <AppEmptyState
          v-else-if="!taskList.length"
          icon="empty"
          title="タスクがありません"
          description="プロジェクトでタスクを追加してみましょう。"
        />
        <AppEmptyState
          v-else-if="!upcomingTasks.length"
          icon="search"
          title="今週の予定タスクはありません"
          description="期限のあるタスクがあると、ここに表示されます。"
        />
        <div v-else class="task-grid">
          <article
            v-for="task in upcomingTasks"
            :key="task.title + task.projectId"
            class="task-card"
          >
            <p class="task-card__title">{{ task.title }}</p>
            <p class="task-card__project">{{ task.projectName }}</p>
            <p class="task-card__due">
              期限:
              {{ new Date(task.dueDate!.seconds * 1000).toLocaleDateString() }}
            </p>
          </article>
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

/* Profile */
.profile {
  display: grid;
  gap: var(--ui-space-6, 1.5rem);
  grid-template-columns: 1fr auto;
  align-items: start;
}

.profile__eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-brand-600, #4f7c82);
}

.profile__name {
  margin: var(--ui-space-2, 0.5rem) 0 0;
  font-size: var(--ui-text-2xl, 1.5rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.profile__email {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.profile__actions {
  display: flex;
  gap: var(--ui-space-3, 0.75rem);
  margin-top: var(--ui-space-4, 1rem);
  flex-wrap: wrap;
}

.profile__stats {
  display: flex;
  gap: var(--ui-space-6, 1.5rem);
  margin: 0;
}

.profile__stat {
  text-align: center;
}

.profile__stat dt {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.profile__stat dd {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-2xl, 1.5rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

/* Projects */
.project-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
}

.project-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--ui-space-4, 1rem);
  padding: var(--ui-space-4, 1rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-lg, 1rem);
  background: var(--ui-surface, #ffffff);
  transition: var(--ui-transition-all);
}

.project-item:hover {
  border-color: var(--ui-border, rgba(11, 46, 51, 0.12));
  box-shadow: var(--ui-shadow-sm);
}

.project-item__info {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
  min-width: 0;
}

.project-item__header {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
}

.project-item__name {
  margin: 0;
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.project-item__activity {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

/* Tasks */
.loading-state {
  text-align: center;
  padding: var(--ui-space-8, 2rem);
  color: var(--ui-text-muted, #64748b);
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--ui-space-4, 1rem);
}

.task-card {
  padding: var(--ui-space-4, 1rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface-muted, #f1f5f9);
}

.task-card__title {
  margin: 0;
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
}

.task-card__project,
.task-card__due {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

/* Responsive */
@media (max-width: 768px) {
  .profile {
    grid-template-columns: 1fr;
  }

  .profile__stats {
    justify-content: flex-start;
  }
}
</style>

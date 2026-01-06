<script setup lang="ts">
import AppButton from "@/components/ui/AppButton.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import SectionCard from "@/components/ui/SectionCard.vue";
import { appName } from "@/constants/appMeta";
import { ROLE_LABELS, type RoleKey } from "@/constants/roles";
import { ROUTE_NAMES } from "@/constants/routes";
import { db } from "@/lib/firebase";
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

const { user, profile } = useAuthStore();
const loading = ref(true);
const taskList = ref<TaskDoc[]>([]);
const projectCount = ref(0);
const projects = ref<{ id: string; name: string; role?: string }[]>([]);
const keyBuffer = ref("");
const SECRET = appName.toLowerCase();
const router = useRouter();

function getRoleLabel(role?: string): string {
  if (!role) return ROLE_LABELS.member;
  return ROLE_LABELS[role as RoleKey] || ROLE_LABELS.member;
}

async function fetchTasks() {
  if (!user.value) return;
  loading.value = true;
  try {
    const items: TaskDoc[] = [];
    const projectItems: { id: string; name: string; role?: string }[] = [];
    const projectsSnap = await getDocs(
      collection(db, "userProjects", user.value.uid, "projects"),
    );
    projectCount.value = projectsSnap.size;
    for (const docSnap of projectsSnap.docs) {
      const projectId = docSnap.id;
      const projectName =
        (docSnap.data().projectName as string) || "プロジェクト";
      projectItems.push({
        id: projectId,
        name: projectName,
        role: docSnap.data().role as string,
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
  <div class="mypage-shell">
    <PageHeader
      title="マイページ"
      :breadcrumbs="[{ label: 'ホーム', to: { name: ROUTE_NAMES.home } }]"
    >
      <template #actions>
        <AppButton :to="{ name: ROUTE_NAMES.authDebug }" variant="outline">
          アカウント設定
        </AppButton>
        <AppButton :to="{ name: ROUTE_NAMES.projectCreate }">
          新しいプロジェクト
        </AppButton>
      </template>
    </PageHeader>

    <div class="mypage-content">
      <!-- プロフィールカード -->
      <SectionCard size="lg" elevated>
        <div class="profile-header">
          <div class="profile-info">
            <p class="profile-greeting">こんにちは、</p>
            <h2 class="profile-name">
              {{
                profile?.nickname || profile?.fullName || `${appName} ユーザー`
              }}
            </h2>
            <p class="profile-email">{{ profile?.email }}</p>
          </div>
          <div class="profile-stats">
            <div class="stat-item">
              <span class="stat-value">{{ projectCount }}</span>
              <span class="stat-label">プロジェクト</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ totalTasks }}</span>
              <span class="stat-label">タスク総数</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ completedThisWeek }}</span>
              <span class="stat-label">今週完了</span>
            </div>
          </div>
        </div>
      </SectionCard>

      <!-- 参加中のプロジェクト -->
      <SectionCard>
        <template #header>
          <h3 class="section-title">参加中のプロジェクト</h3>
          <p class="section-description">
            クリックしてプロジェクトのダッシュボードにアクセスできます。
          </p>
        </template>

        <div v-if="!projects.length" class="empty-state">
          <p>まだプロジェクトに参加していません。</p>
          <AppButton :to="{ name: ROUTE_NAMES.projectCreate }">
            プロジェクトを作成
          </AppButton>
        </div>

        <ul v-else class="project-list">
          <li v-for="project in projects" :key="project.id" class="project-row">
            <div class="project-info">
              <p class="project-name">{{ project.name }}</p>
              <span class="role-badge" :class="`role-${project.role}`">
                {{ getRoleLabel(project.role) }}
              </span>
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

      <!-- 今週のタスク状況 -->
      <SectionCard>
        <template #header>
          <h3 class="section-title">今週のタスク状況</h3>
          <p class="section-description">
            期限が近いタスクをチェックして、優先順位を整えましょう。
          </p>
        </template>

        <div v-if="loading" class="empty-state">
          <p>読み込み中...</p>
        </div>
        <div v-else-if="!taskList.length" class="empty-state">
          <p>
            まだタスクがありません。新しいプロジェクトでタスクを追加してみましょう。
          </p>
        </div>
        <div v-else-if="!upcomingTasks.length" class="empty-state">
          <p>今週期限のタスクはありません。</p>
        </div>
        <div v-else class="task-grid">
          <article
            v-for="task in upcomingTasks"
            :key="task.title + task.projectId"
            class="task-card"
          >
            <p class="task-title">{{ task.title }}</p>
            <p class="task-project">{{ task.projectName }}</p>
            <p class="task-due" v-if="task.dueDate">
              期限:
              {{ new Date(task.dueDate.seconds * 1000).toLocaleDateString() }}
            </p>
          </article>
        </div>
      </SectionCard>
    </div>
  </div>
</template>

<style scoped>
.mypage-shell {
  min-height: 100vh;
  padding: var(--space-lg) var(--space-xl);
  background: var(--surface);
}

.mypage-content {
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

/* プロフィールヘッダー */
.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-lg);
}

.profile-greeting {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--font-sm);
}

.profile-name {
  margin: var(--space-xs) 0;
  font-size: var(--font-2xl);
  color: var(--brand);
}

.profile-email {
  margin: 0;
  color: var(--text-muted);
}

.profile-stats {
  display: flex;
  gap: var(--space-xl);
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: var(--font-2xl);
  font-weight: 700;
  color: var(--brand);
}

.stat-label {
  font-size: var(--font-sm);
  color: var(--text-muted);
}

/* セクションスタイル */
.section-title {
  margin: 0;
  font-size: var(--font-lg);
  color: var(--brand);
}

.section-description {
  margin: var(--space-xs) 0 0;
  color: var(--text-muted);
  font-size: var(--font-sm);
}

/* 空状態 */
.empty-state {
  text-align: center;
  padding: var(--space-xl);
  color: var(--text-muted);
}

.empty-state p {
  margin: 0 0 var(--space-md);
}

/* プロジェクトリスト */
.project-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.project-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  transition: border-color var(--transition-fast);
}

.project-row:hover {
  border-color: var(--brand-muted);
}

.project-info {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.project-name {
  margin: 0;
  font-weight: 600;
  color: var(--brand);
}

.role-badge {
  padding: var(--space-2xs) var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--font-xs);
  font-weight: 600;
}

.role-owner {
  background: rgba(234, 179, 8, 0.2);
  color: #78350f;
}

.role-admin {
  background: rgba(79, 124, 130, 0.2);
  color: var(--brand);
}

.role-manager {
  background: rgba(34, 197, 94, 0.2);
  color: #14532d;
}

.role-pm {
  background: rgba(59, 130, 246, 0.2);
  color: #1e3a8a;
}

.role-member {
  background: rgba(11, 46, 51, 0.08);
  color: var(--brand);
}

.role-viewer,
.role-observer {
  background: rgba(148, 163, 184, 0.2);
  color: #475569;
}

/* タスクグリッド */
.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-md);
}

.task-card {
  padding: var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.task-title {
  margin: 0;
  font-weight: 600;
  color: var(--brand);
}

.task-project,
.task-due {
  margin: var(--space-xs) 0 0;
  color: var(--text-muted);
  font-size: var(--font-sm);
}

/* レスポンシブ */
@media (max-width: 768px) {
  .mypage-shell {
    padding: var(--space-md);
  }

  .profile-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .profile-stats {
    width: 100%;
    justify-content: space-around;
  }

  .project-info {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
  }
}
</style>

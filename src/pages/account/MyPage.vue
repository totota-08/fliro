<script setup lang="ts">
/**
 * MyPage.vue - マイページ（アカウント設定統合版）
 *
 * プロジェクト一覧、タスク状況に加えて、
 * プロフィール編集、アバター変更、アカウント設定を統合
 */
import PageSkeleton from "@/components/loading/PageSkeleton.vue";
import UserAvatar from "@/components/common/UserAvatar.vue";
import AppBadge from "@/components/ui/AppBadge.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppEmptyState from "@/components/ui/AppEmptyState.vue";
import AppModal from "@/components/ui/AppModal.vue";
import SectionCard from "@/components/ui/SectionCard.vue";
import DangerZoneCard from "@/components/settings/DangerZoneCard.vue";
import { appName } from "@/constants/appMeta";
import { ROUTE_NAMES } from "@/constants/routes";
import { db } from "@/lib/firebase";
import AppShell from "@/layouts/AppShell.vue";
import {
  listenUserInvites,
  redeemInvite,
  type ProjectInvite,
} from "@/services/projectInvites";
import {
  removeAccountWithPassword,
  updateAccountAvatar,
  updateProfile,
} from "@/services/accountActions";
import { signOutUser, useAuthStore } from "@/store/auth";
import { getLogger } from "@logtape/logtape";
import { collection, getDocs, query } from "firebase/firestore";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
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
const router = useRouter();
const loading = ref(true);
const taskList = ref<TaskDoc[]>([]);
const projectCount = ref(0);
const projects = ref<ProjectItem[]>([]);

// Invite-related state
const invites = ref<ProjectInvite[]>([]);
const inviteLoading = ref(false);
const joiningInviteId = ref<string | null>(null);
let unsubscribeInvites: (() => void) | null = null;

// Profile editing state
const isEditingProfile = ref(false);
const editNickname = ref("");
const editFullName = ref("");
const profileSaving = ref(false);
const profileError = ref("");

// Avatar upload state
const avatarUploading = ref(false);
const avatarMessage = ref("");

// Account deletion state
const showDeleteModal = ref(false);
const deletePassword = ref("");
const deleteLoading = ref(false);
const deleteError = ref("");

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
  );
});

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

  inviteLoading.value = true;
  unsubscribeInvites = listenUserInvites(email, (list) => {
    invites.value = list;
    inviteLoading.value = false;
  });
}

async function handleJoinProject(invite: ProjectInvite) {
  if (!user.value || joiningInviteId.value) return;

  joiningInviteId.value = invite.id;
  try {
    const projectId = await redeemInvite(
      invite.token,
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

// Profile editing
function startEditProfile() {
  editNickname.value = profile.value?.nickname || "";
  editFullName.value = profile.value?.fullName || "";
  profileError.value = "";
  isEditingProfile.value = true;
}

function cancelEditProfile() {
  isEditingProfile.value = false;
  profileError.value = "";
}

async function saveProfile() {
  if (profileSaving.value) return;

  profileSaving.value = true;
  profileError.value = "";
  try {
    await updateProfile({
      nickname: editNickname.value.trim(),
      fullName: editFullName.value.trim(),
    });
    isEditingProfile.value = false;
  } catch (error) {
    logger.error`Profile update failed: ${error}`;
    profileError.value = "プロフィールの更新に失敗しました。";
  } finally {
    profileSaving.value = false;
  }
}

// Avatar upload
async function handleAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  avatarMessage.value = "";

  if (!file) return;

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    avatarMessage.value = "ファイルサイズは5MB以下にしてください。";
    input.value = "";
    return;
  }

  avatarUploading.value = true;
  try {
    await updateAccountAvatar(file);
    avatarMessage.value = "アイコンを更新しました。";
  } catch (error) {
    logger.error`Avatar upload failed: ${error}`;
    avatarMessage.value = "アイコンのアップロードに失敗しました。";
  } finally {
    avatarUploading.value = false;
    input.value = "";
  }
}

// Sign out
async function handleSignOut() {
  await signOutUser();
  await router.push({ name: ROUTE_NAMES.login });
}

// Account deletion
function openDeleteModal() {
  deletePassword.value = "";
  deleteError.value = "";
  showDeleteModal.value = true;
}

function closeDeleteModal() {
  showDeleteModal.value = false;
  deletePassword.value = "";
  deleteError.value = "";
}

async function handleDeleteAccount() {
  if (deleteLoading.value) return;
  if (!deletePassword.value) {
    deleteError.value = "パスワードを入力してください。";
    return;
  }

  deleteLoading.value = true;
  deleteError.value = "";
  try {
    await removeAccountWithPassword(deletePassword.value);
    await router.push({ name: ROUTE_NAMES.login });
  } catch (error: any) {
    logger.error`Account deletion failed: ${error}`;
    if (
      error?.code === "auth/wrong-password" ||
      error?.code === "auth/invalid-credential"
    ) {
      deleteError.value = "パスワードが正しくありません。";
    } else if (error?.code === "auth/too-many-requests") {
      deleteError.value =
        "試行回数が多すぎます。しばらく待ってから再度お試しください。";
    } else {
      deleteError.value =
        "アカウントを削除できませんでした。再度お試しください。";
    }
  } finally {
    deleteLoading.value = false;
  }
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
      <!-- Profile Section with Avatar and Edit -->
      <SectionCard elevated>
        <div class="profile">
          <div class="profile__avatar-section">
            <div class="profile__avatar-wrapper">
              <UserAvatar
                :url="avatarUrl"
                :name="profile?.nickname || profile?.fullName"
                :size="80"
              />
              <label
                class="profile__avatar-upload"
                :class="{ 'is-uploading': avatarUploading }"
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  :disabled="avatarUploading"
                  @change="handleAvatarChange"
                />
                <span class="profile__avatar-upload-icon">
                  {{ avatarUploading ? "..." : "📷" }}
                </span>
              </label>
            </div>
            <p
              v-if="avatarMessage"
              class="profile__avatar-message"
              :class="{ 'is-error': avatarMessage.includes('失敗') }"
            >
              {{ avatarMessage }}
            </p>
          </div>

          <div class="profile__info">
            <p class="profile__eyebrow">My Page</p>

            <template v-if="!isEditingProfile">
              <h1 class="profile__name">
                {{
                  profile?.nickname ||
                  profile?.fullName ||
                  `${appName} ユーザー`
                }}
              </h1>
              <p
                v-if="profile?.fullName && profile?.nickname"
                class="profile__fullname"
              >
                {{ profile.fullName }}
              </p>
              <p class="profile__email">{{ profile?.email }}</p>
              <div class="profile__actions">
                <AppButton
                  variant="outline"
                  size="sm"
                  @click="startEditProfile"
                >
                  プロフィール編集
                </AppButton>
                <AppButton variant="outline" size="sm" @click="handleSignOut">
                  サインアウト
                </AppButton>
                <AppButton :to="{ name: ROUTE_NAMES.projectCreate }">
                  新しいプロジェクト
                </AppButton>
              </div>
            </template>

            <template v-else>
              <div class="profile__edit-form">
                <div class="profile__edit-field">
                  <label for="edit-nickname">ニックネーム</label>
                  <input
                    id="edit-nickname"
                    v-model="editNickname"
                    type="text"
                    placeholder="ニックネームを入力"
                  />
                </div>
                <div class="profile__edit-field">
                  <label for="edit-fullname">本名</label>
                  <input
                    id="edit-fullname"
                    v-model="editFullName"
                    type="text"
                    placeholder="本名を入力"
                  />
                </div>
                <p v-if="profileError" class="profile__edit-error">
                  {{ profileError }}
                </p>
                <div class="profile__edit-actions">
                  <AppButton
                    variant="secondary"
                    size="sm"
                    :disabled="profileSaving"
                    @click="cancelEditProfile"
                  >
                    キャンセル
                  </AppButton>
                  <AppButton
                    variant="primary"
                    size="sm"
                    :loading="profileSaving"
                    @click="saveProfile"
                  >
                    保存
                  </AppButton>
                </div>
              </div>
            </template>
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

      <!-- Invited Projects Section -->
      <SectionCard
        v-if="pendingInvites.length > 0"
        title="招待されたプロジェクト"
        subtitle="以下のプロジェクトに招待されています"
      >
        <ul class="project-list">
          <li
            v-for="invite in pendingInvites"
            :key="invite.id"
            class="project-item project-item--invite"
          >
            <div class="project-item__info">
              <div class="project-item__header">
                <p class="project-item__name">
                  {{ invite.projectName || "プロジェクト" }}
                </p>
                <AppBadge variant="info" size="sm">招待</AppBadge>
              </div>
            </div>
            <AppButton
              variant="primary"
              size="sm"
              :loading="joiningInviteId === invite.id"
              :disabled="joiningInviteId !== null"
              @click="handleJoinProject(invite)"
            >
              参加する
            </AppButton>
          </li>
        </ul>
      </SectionCard>

      <!-- Tasks Section -->
      <SectionCard
        title="今週のタスク状況"
        subtitle="期限が近いタスクをチェックして、優先順位を整えましょう。"
      >
        <PageSkeleton v-if="loading" variant="default" />
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

      <!-- Danger Zone - Account Deletion -->
      <DangerZoneCard title="アカウント設定">
        <div class="danger-content">
          <div class="danger-content__item">
            <div class="danger-content__info">
              <p class="danger-content__title">アカウントを削除</p>
              <p class="danger-content__description">
                アカウントを削除すると、すべてのデータが完全に削除されます。この操作は取り消せません。
              </p>
            </div>
            <AppButton variant="danger" size="sm" @click="openDeleteModal">
              アカウントを削除
            </AppButton>
          </div>
        </div>
      </DangerZoneCard>
    </div>

    <!-- Delete Account Modal -->
    <AppModal
      :open="showDeleteModal"
      title="アカウントの削除"
      @close="closeDeleteModal"
    >
      <div class="delete-modal">
        <p class="delete-modal__warning">
          アカウントを削除すると、すべてのデータが完全に削除され、復元することはできません。
        </p>
        <p class="delete-modal__instruction">
          続行するには、パスワードを入力してください。
        </p>
        <div class="delete-modal__field">
          <label for="delete-password">パスワード</label>
          <input
            id="delete-password"
            v-model="deletePassword"
            type="password"
            placeholder="パスワードを入力"
            @keydown.enter="handleDeleteAccount"
          />
        </div>
        <p v-if="deleteError" class="delete-modal__error">{{ deleteError }}</p>
        <div class="delete-modal__actions">
          <AppButton
            variant="secondary"
            :disabled="deleteLoading"
            @click="closeDeleteModal"
          >
            キャンセル
          </AppButton>
          <AppButton
            variant="danger"
            :loading="deleteLoading"
            @click="handleDeleteAccount"
          >
            削除する
          </AppButton>
        </div>
      </div>
    </AppModal>
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
  grid-template-columns: auto 1fr auto;
  align-items: start;
}

.profile__avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--ui-space-2);
}

.profile__avatar-wrapper {
  position: relative;
}

.profile__avatar-upload {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--ui-brand-600, #4f7c82);
  border: 2px solid var(--ui-surface, #fff);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--ui-transition-colors);
}

.profile__avatar-upload:hover {
  background: var(--ui-brand-700, #1a4a51);
}

.profile__avatar-upload.is-uploading {
  opacity: 0.6;
  cursor: not-allowed;
}

.profile__avatar-upload input {
  display: none;
}

.profile__avatar-upload-icon {
  font-size: 14px;
}

.profile__avatar-message {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-success, #16a34a);
  margin: 0;
  text-align: center;
}

.profile__avatar-message.is-error {
  color: var(--ui-danger, #d64545);
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

.profile__fullname {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
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
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  background: var(--ui-surface-muted, #f1f5f9);
  border-radius: var(--ui-radius-lg, 1rem);
  min-width: 90px;
}

.profile__stat dt {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.profile__stat dd {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-2xl, 1.5rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-brand-700, #1a4a51);
}

/* Profile Edit Form */
.profile__edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-3, 0.75rem);
  margin-top: var(--ui-space-2, 0.5rem);
}

.profile__edit-field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.profile__edit-field label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text-muted, #64748b);
}

.profile__edit-field input {
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text, #0b2e33);
  background: var(--ui-surface, #fff);
  transition: var(--ui-transition-colors);
}

.profile__edit-field input:focus {
  outline: none;
  border-color: var(--ui-brand-600, #4f7c82);
  box-shadow: var(--ui-ring-focus);
}

.profile__edit-error {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-danger, #d64545);
}

.profile__edit-actions {
  display: flex;
  gap: var(--ui-space-2, 0.5rem);
  margin-top: var(--ui-space-2, 0.5rem);
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

.project-item--invite {
  border-color: var(--ui-brand-200, #b8e3e9);
  background: var(--ui-brand-50, #f0fafb);
}

.project-item--invite:hover {
  border-color: var(--ui-brand-400, #7ec3cc);
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
.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--ui-space-4, 1rem);
}

.task-card {
  padding: var(--ui-space-4, 1rem);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-surface, #ffffff);
  transition: var(--ui-transition-all);
}

.task-card:hover {
  border-color: var(--ui-brand-300, #b8e3e9);
  box-shadow: var(--ui-shadow-sm);
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

/* Danger Zone Content */
.danger-content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.danger-content__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--ui-space-4, 1rem);
}

.danger-content__info {
  flex: 1;
}

.danger-content__title {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.danger-content__description {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

/* Delete Modal */
.delete-modal {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.delete-modal__warning {
  margin: 0;
  padding: var(--ui-space-3, 0.75rem);
  background: var(--ui-danger-light, #fee2e2);
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-danger-text, #991b1b);
}

.delete-modal__instruction {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text, #0b2e33);
}

.delete-modal__field {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.delete-modal__field label {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text-muted, #64748b);
}

.delete-modal__field input {
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
  border-radius: var(--ui-radius-md, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text, #0b2e33);
  background: var(--ui-surface, #fff);
  transition: var(--ui-transition-colors);
}

.delete-modal__field input:focus {
  outline: none;
  border-color: var(--ui-danger, #d64545);
  box-shadow: 0 0 0 3px rgba(214, 69, 69, 0.1);
}

.delete-modal__error {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-danger, #d64545);
}

.delete-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ui-space-2, 0.5rem);
}

/* Responsive */
@media (max-width: 768px) {
  .profile {
    grid-template-columns: 1fr;
  }

  .profile__avatar-section {
    justify-self: center;
  }

  .profile__info {
    text-align: center;
  }

  .profile__actions {
    justify-content: center;
  }

  .profile__stats {
    justify-content: center;
  }

  .danger-content__item {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }
}
</style>

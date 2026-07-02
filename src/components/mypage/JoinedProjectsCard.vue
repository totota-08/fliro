<script setup lang="ts">
/**
 * JoinedProjectsCard - 参加中プロジェクトリスト
 *
 * 参加しているプロジェクトと招待されているプロジェクトを表示
 * 最近アクセスしたプロジェクトを強調表示
 */
import SectionCard from "@/components/ui/SectionCard.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppBadge from "@/components/ui/AppBadge.vue";
import AppEmptyState from "@/components/ui/AppEmptyState.vue";
import { ROUTE_NAMES } from "@/constants/routes";

export interface ProjectItem {
  id: string;
  name: string;
  role?: string;
  lastAccessedAt?: Date;
  /** プロジェクトのテーマカラー */
  color?: string;
  /** プロジェクトアイコン画像URL */
  iconUrl?: string;
}

export interface ProjectInvite {
  id: string;
  projectId: string;
  projectName?: string;
}

defineProps<{
  projects: ProjectItem[];
  pendingInvites: ProjectInvite[];
  joiningInviteId: string | null;
}>();

const emit = defineEmits<{
  joinProject: [invite: ProjectInvite];
}>();

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

function isRecentAccess(project: ProjectItem): boolean {
  if (!project.lastAccessedAt) return false;
  const now = new Date();
  const diff = now.getTime() - project.lastAccessedAt.getTime();
  const hours = diff / (1000 * 60 * 60);
  return hours < 24;
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
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

function getRoleLabel(role?: string): string {
  if (!role) return "メンバー";
  const normalized = role.toLowerCase();
  if (normalized === "owner") return "オーナー";
  if (normalized === "admin") return "管理者";
  if (normalized === "viewer") return "閲覧者";
  return "メンバー";
}
</script>

<template>
  <div class="joined-projects">
    <!-- Joined Projects -->
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
          :class="{ 'project-item--recent': isRecentAccess(project) }"
        >
          <div class="project-item__avatar" aria-hidden="true">
            <img
              v-if="project.iconUrl"
              :src="project.iconUrl"
              alt=""
              class="project-item__avatar-image"
            />
            <span
              v-else
              class="project-item__avatar-fallback"
              :style="project.color ? { backgroundColor: project.color } : {}"
            >
              {{ project.name.charAt(0) }}
            </span>
          </div>
          <div class="project-item__info">
            <div class="project-item__header">
              <p class="project-item__name">{{ project.name }}</p>
              <AppBadge :variant="getRoleBadgeVariant(project.role)" size="sm">
                {{ getRoleLabel(project.role) }}
              </AppBadge>
            </div>
            <p v-if="project.lastAccessedAt" class="project-item__activity">
              {{ formatRelativeDate(project.lastAccessedAt) }}
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

    <!-- Invited Projects -->
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
            @click="emit('joinProject', invite)"
          >
            参加する
          </AppButton>
        </li>
      </ul>
    </SectionCard>
  </div>
</template>

<style scoped>
.joined-projects {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6, 1.5rem);
}

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
  min-height: 64px;
}

.project-item:hover {
  border-color: var(--ui-border, rgba(11, 46, 51, 0.12));
  box-shadow: var(--ui-shadow-sm);
  transform: translateY(-1px);
}

.project-item--recent {
  border-left: 3px solid var(--ui-brand-500, #5a9ca6);
  background: var(--ui-brand-50, #f0fafb);
}

.project-item--recent:hover {
  border-left-color: var(--ui-brand-600, #4f7c82);
}

.project-item--invite {
  border-color: var(--ui-brand-200, #b8e3e9);
  background: var(--ui-brand-50, #f0fafb);
}

.project-item--invite:hover {
  border-color: var(--ui-brand-400, #7ec3cc);
}

.project-item__avatar {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: var(--ui-radius-md, 0.75rem);
  overflow: hidden;
}

.project-item__avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.project-item__avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: var(--ui-brand-600, #4f7c82);
  color: var(--ui-text-inverse, #ffffff);
  font-weight: var(--ui-font-bold, 700);
  font-size: var(--ui-text-base, 1rem);
}

.project-item__info {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
  min-width: 0;
  flex: 1;
}

.project-item__header {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
  flex-wrap: wrap;
}

.project-item__name {
  margin: 0;
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text, #0b2e33);
  min-width: 80px;
}

.project-item__activity {
  margin: 0;
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

.project-item--recent .project-item__activity {
  color: var(--ui-brand-600, #4f7c82);
  font-weight: var(--ui-font-medium, 500);
}
</style>

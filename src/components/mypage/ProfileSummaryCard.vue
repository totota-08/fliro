<script setup lang="ts">
/**
 * ProfileSummaryCard - プロフィール情報カード
 *
 * マイページ上部のプロフィール、統計、アクションボタンを表示
 * 2行構成でコンパクトに情報を整理
 */
import { computed } from "vue";
import SectionCard from "@/components/ui/SectionCard.vue";
import UserAvatar from "@/components/common/UserAvatar.vue";
import AppButton from "@/components/ui/AppButton.vue";
import { ROUTE_NAMES } from "@/constants/routes";

interface Stats {
  projectCount: number;
  totalTasks: number;
  completedThisWeek: number;
}

interface ProfileData {
  nickname?: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string;
}

const props = defineProps<{
  profile: ProfileData | null;
  stats: Stats;
  appName: string;
}>();

const emit = defineEmits<{
  signOut: [];
}>();

const displayName = computed(
  () =>
    props.profile?.nickname ||
    props.profile?.fullName ||
    `${props.appName} ユーザー`,
);
</script>

<template>
  <SectionCard elevated>
    <div class="profile">
      <!-- 上段: アバター + 名前/メール + サインアウト -->
      <div class="profile__header">
        <UserAvatar
          :src="profile?.avatarUrl || ''"
          :name="profile?.nickname || profile?.fullName"
          :size="56"
        />
        <div class="profile__info">
          <h1 class="profile__name">{{ displayName }}</h1>
          <p
            v-if="profile?.fullName && profile?.nickname"
            class="profile__meta"
          >
            {{ profile.fullName }}
          </p>
          <p class="profile__meta">{{ profile?.email }}</p>
        </div>
        <AppButton variant="ghost" size="sm" @click="emit('signOut')">
          サインアウト
        </AppButton>
      </div>

      <!-- 下段: 統計 + 新規プロジェクトボタン -->
      <div class="profile__footer">
        <dl class="profile__stats">
          <div class="profile__stat">
            <dd>{{ stats.projectCount }}</dd>
            <dt>プロジェクト</dt>
          </div>
          <div class="profile__stat-divider" aria-hidden="true"></div>
          <div class="profile__stat">
            <dd>{{ stats.totalTasks }}</dd>
            <dt>タスク</dt>
          </div>
          <div class="profile__stat-divider" aria-hidden="true"></div>
          <div class="profile__stat profile__stat--highlight">
            <dd>{{ stats.completedThisWeek }}</dd>
            <dt>今週完了</dt>
          </div>
        </dl>
        <AppButton :to="{ name: ROUTE_NAMES.projectCreate }">
          + 新しいプロジェクト
        </AppButton>
      </div>
    </div>
  </SectionCard>
</template>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

/* 上段: ヘッダー */
.profile__header {
  display: flex;
  align-items: center;
  gap: var(--ui-space-4, 1rem);
}

.profile__info {
  flex: 1;
  min-width: 0;
}

.profile__name {
  margin: 0;
  font-size: var(--ui-text-xl, 1.25rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
  line-height: 1.3;
}

.profile__meta {
  margin: var(--ui-space-1, 0.25rem) 0 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  line-height: 1.4;
}

/* 下段: フッター */
.profile__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4, 1rem);
  padding-top: var(--ui-space-4, 1rem);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

/* 統計 */
.profile__stats {
  display: flex;
  align-items: center;
  gap: var(--ui-space-4, 1rem);
  margin: 0;
}

.profile__stat {
  text-align: center;
  min-width: 64px;
}

.profile__stat dt {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
  margin-top: var(--ui-space-1, 0.25rem);
}

.profile__stat dd {
  margin: 0;
  font-size: var(--ui-text-2xl, 1.5rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-brand-700, #1a4a51);
  line-height: 1;
}

.profile__stat--highlight dd {
  color: var(--ui-success, #16a34a);
}

.profile__stat--highlight dt {
  color: var(--ui-success, #16a34a);
}

.profile__stat-divider {
  width: 1px;
  height: 32px;
  background: var(--ui-border-light, rgba(11, 46, 51, 0.08));
}

/* Responsive */
@media (max-width: 768px) {
  .profile__header {
    flex-wrap: wrap;
  }

  .profile__info {
    flex: 1 1 calc(100% - 72px);
    order: 1;
  }

  .profile__header > :last-child {
    order: 2;
    margin-left: auto;
  }

  .profile__footer {
    flex-direction: column;
    align-items: stretch;
    gap: var(--ui-space-4, 1rem);
  }

  .profile__stats {
    justify-content: center;
  }

  .profile__footer > :last-child {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .profile__stat {
    min-width: 48px;
  }

  .profile__stat dd {
    font-size: var(--ui-text-xl, 1.25rem);
  }

  .profile__stats {
    gap: var(--ui-space-2, 0.5rem);
  }
}
</style>

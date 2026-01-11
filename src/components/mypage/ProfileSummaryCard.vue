<script setup lang="ts">
/**
 * ProfileSummaryCard - プロフィール情報カード
 *
 * マイページ上部のプロフィール、統計、アクションボタンを表示
 * プロフィール編集はAccountSettingsPageに移動
 */
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

const displayName =
  props.profile?.nickname ||
  props.profile?.fullName ||
  `${props.appName} ユーザー`;
</script>

<template>
  <SectionCard elevated>
    <div class="profile">
      <div class="profile__avatar-section">
        <UserAvatar
          :url="profile?.avatarUrl || ''"
          :name="profile?.nickname || profile?.fullName"
          :size="80"
        />
      </div>

      <div class="profile__info">
        <p class="profile__eyebrow">My Page</p>
        <h1 class="profile__name">{{ displayName }}</h1>
        <p
          v-if="profile?.fullName && profile?.nickname"
          class="profile__fullname"
        >
          {{ profile.fullName }}
        </p>
        <p class="profile__email">{{ profile?.email }}</p>
        <div class="profile__actions">
          <AppButton variant="outline" size="sm" @click="emit('signOut')">
            サインアウト
          </AppButton>
          <AppButton :to="{ name: ROUTE_NAMES.projectCreate }">
            新しいプロジェクト
          </AppButton>
        </div>
      </div>

      <dl class="profile__stats">
        <div class="profile__stat">
          <dt>参加プロジェクト</dt>
          <dd>{{ stats.projectCount }}</dd>
        </div>
        <div class="profile__stat">
          <dt>タスク総数</dt>
          <dd>{{ stats.totalTasks }}</dd>
        </div>
        <div class="profile__stat">
          <dt>完了タスク（週）</dt>
          <dd>{{ stats.completedThisWeek }}</dd>
        </div>
      </dl>
    </div>
  </SectionCard>
</template>

<style scoped>
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
}
</style>

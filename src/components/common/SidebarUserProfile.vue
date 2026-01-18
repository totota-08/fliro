<script setup lang="ts">
import UserAvatar from "@/components/common/UserAvatar.vue";
import { appName } from "@/constants/appMeta";
import { ROUTE_NAMES } from "@/constants/routes";
import { useAuthStore } from "@/store/auth";
import { computed } from "vue";

type ProfileInput = {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  avatar?: string | null;
  nickname?: string | null;
  fullName?: string | null;
};

const props = defineProps<{
  profile?: ProfileInput | null;
}>();

const { profile: storeProfile, user } = useAuthStore();

const profileInfo = computed(() => {
  const provided = props.profile;
  const store = storeProfile.value;

  const name =
    provided?.name ||
    provided?.nickname ||
    provided?.fullName ||
    store?.nickname ||
    store?.fullName ||
    `${appName} User`;

  const email = provided?.email || store?.email || "";
  const avatarUrl =
    provided?.avatarUrl ??
    provided?.avatar ??
    store?.avatarUrl ??
    user.value?.photoURL ??
    null;

  return { name, email, avatarUrl };
});
</script>

<template>
  <router-link :to="{ name: ROUTE_NAMES.myPage }" class="user-profile">
    <div class="user-avatar-container">
      <UserAvatar
        :src="profileInfo.avatarUrl"
        :name="profileInfo.name"
        :size="36"
      />
    </div>
    <div class="user-info">
      <div class="user-name">{{ profileInfo.name }}</div>
      <div class="user-email">{{ profileInfo.email }}</div>
    </div>
  </router-link>
</template>

<style scoped>
.user-profile {
  margin-top: auto;
  padding: var(--ui-space-4) var(--ui-space-5);
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  border-top: 1px solid var(--ui-surface-glass-12);
  cursor: pointer;
  text-decoration: none;
  transition: background var(--ui-duration-base) var(--ui-ease-standard);
}

.user-profile:hover {
  background: var(--ui-surface-glass-08);
}

.user-avatar-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-info {
  flex: 1;
  overflow: hidden;
}

.user-name {
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-semibold);
  color: var(--ui-text-inverse);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 0.6875rem;
  color: var(--ui-sidebar-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

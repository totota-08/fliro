<script setup lang="ts">
import UserAvatar from '@/components/common/UserAvatar.vue'
import { ROUTE_NAMES } from '@/constants/routes'
import { useAuthStore } from '@/store/auth'
import { computed } from 'vue'

type ProfileInput = {
  name?: string | null
  email?: string | null
  avatarUrl?: string | null
  avatar?: string | null
  nickname?: string | null
  fullName?: string | null
}

const props = defineProps<{
  profile?: ProfileInput | null
}>()

const { profile: storeProfile, user } = useAuthStore()

const profileInfo = computed(() => {
  const provided = props.profile
  const store = storeProfile.value

  const name =
    provided?.name ||
    provided?.nickname ||
    provided?.fullName ||
    store?.nickname ||
    store?.fullName ||
    'Teamie User'

  const email = provided?.email || store?.email || ''
  const avatarUrl = provided?.avatarUrl ?? provided?.avatar ?? store?.avatarUrl ?? user.value?.photoURL ?? null

  return { name, email, avatarUrl }
})
</script>

<template>
  <router-link :to="{ name: ROUTE_NAMES.myPage }" class="user-profile">
    <div class="user-avatar-container">
      <UserAvatar :src="profileInfo.avatarUrl" :name="profileInfo.name" :size="36" />
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
  padding: 15px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  text-decoration: none;
  transition: background 0.2s ease;
}

.user-profile:hover {
  background: rgba(255, 255, 255, 0.05);
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
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

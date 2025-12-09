<script setup lang="ts">
type NotificationType = 'info' | 'warning' | 'critical'

defineProps<{
  notifications: { id: string; type: NotificationType; message: string }[]
}>()

const typeLabel: Record<NotificationType, string> = {
  info: 'お知らせ',
  warning: '警告',
  critical: '重要',
}
</script>

<template>
  <div class="notification-bar" v-if="notifications.length">
    <div
      v-for="item in notifications"
      :key="item.id"
      class="notification"
      :class="`notification--${item.type}`"
    >
      <span class="notification__label">{{ typeLabel[item.type] }}</span>
      <span class="notification__message">{{ item.message }}</span>
    </div>
  </div>
</template>

<style scoped>
.notification-bar {
  display: grid;
  gap: 0.4rem;
  margin-bottom: 0.8rem;
}

.notification {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem;
  border-radius: 0.75rem;
  font-size: 0.95rem;
}

.notification__label {
  font-weight: 700;
  font-size: 0.85rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0.65rem;
  background: rgba(0, 0, 0, 0.08);
}

.notification--info {
  background: rgba(79, 124, 130, 0.08);
  color: #0b2e33;
}

.notification--info .notification__label {
  background: rgba(79, 124, 130, 0.18);
}

.notification--warning {
  background: rgba(255, 202, 99, 0.16);
  color: #7c4a00;
}

.notification--warning .notification__label {
  background: rgba(255, 202, 99, 0.35);
}

.notification--critical {
  background: rgba(220, 38, 38, 0.15);
  color: #991b1b;
}

.notification--critical .notification__label {
  background: rgba(220, 38, 38, 0.25);
}
</style>

<script setup lang="ts">
type NotificationType = "info" | "warning" | "critical";

defineProps<{
  notifications: { id: string; type: NotificationType; message: string }[];
}>();

const typeLabel: Record<NotificationType, string> = {
  info: "お知らせ",
  warning: "警告",
  critical: "重要",
};
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
  gap: var(--ui-space-1);
  margin-bottom: var(--ui-space-3);
}

.notification {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-2) var(--ui-space-3);
  border-radius: var(--ui-radius-md);
  font-size: var(--ui-text-base);
}

.notification__label {
  font-weight: var(--ui-font-bold);
  font-size: var(--ui-text-sm);
  padding: var(--ui-space-1) var(--ui-space-2);
  border-radius: var(--ui-radius-sm);
  background: var(--ui-border-light);
}

.notification--info {
  background: var(--ui-notify-info-bg);
  color: var(--ui-brand-900);
}

.notification--info .notification__label {
  background: var(--ui-notify-info-label);
}

.notification--warning {
  background: var(--ui-notify-warning-bg);
  color: var(--ui-warning-text);
}

.notification--warning .notification__label {
  background: var(--ui-notify-warning-label);
}

.notification--critical {
  background: var(--ui-notify-critical-bg);
  color: var(--ui-danger-text);
}

.notification--critical .notification__label {
  background: var(--ui-notify-critical-label);
}
</style>

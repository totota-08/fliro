import { ref } from "vue";

type NotificationType = "info" | "warning" | "critical";

type NotificationItem = {
  id: string;
  type: NotificationType;
  message: string;
};

const notifications = ref<NotificationItem[]>([]);

function sendNotification(type: NotificationType, message: string) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  notifications.value.push({ id, type, message });
  return id;
}

function clearNotification(id: string) {
  notifications.value = notifications.value.filter((item) => item.id !== id);
}

export function useNotificationCenter() {
  return {
    notifications,
    sendNotification,
    clearNotification,
  };
}

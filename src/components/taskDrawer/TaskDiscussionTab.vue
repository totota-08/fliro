<script setup lang="ts">
import {
  listenTaskDiscussion,
  sendTaskDiscussionMessage,
  type TaskDiscussionMessage,
} from "@/services/taskDiscussionService";
import { useAuthStore } from "@/store/auth";
import { getLogger } from "@logtape/logtape";
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{
  projectId: string;
  taskId: string;
}>();

const logger = getLogger("app.components.taskDrawer.TaskDiscussionTab");
const { user, profile } = useAuthStore();
const messages = ref<TaskDiscussionMessage[]>([]);
const input = ref("");
const listContainer = ref<HTMLElement | null>(null);
const sending = ref(false);

let unsubscribe: (() => void) | null = null;

function setupListener() {
  unsubscribe?.();
  if (!props.projectId || !props.taskId) return;

  unsubscribe = listenTaskDiscussion(
    props.projectId,
    props.taskId,
    (params) => {
      messages.value = params;
      scrollToBottom();
    },
  );
}

function scrollToBottom() {
  nextTick(() => {
    if (listContainer.value) {
      listContainer.value.scrollTop = listContainer.value.scrollHeight;
    }
  });
}

function formatTime(date: Date | null) {
  if (!date) return "--:--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function handleSend() {
  const text = input.value.trim();
  if (!text || !user.value || sending.value) return;

  sending.value = true;
  try {
    await sendTaskDiscussionMessage(props.projectId, props.taskId, {
      text,
      senderId: user.value.uid,
      senderName: profile.value?.nickname || profile.value?.fullName || "User",
    });
    input.value = "";
    scrollToBottom();
  } catch (e) {
    logger.error`Failed to send message: ${e}`;
  } finally {
    sending.value = false;
  }
}

watch(
  () => [props.projectId, props.taskId],
  () => {
    setupListener();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  unsubscribe?.();
});
</script>

<template>
  <div class="discussion-tab">
    <div class="list" ref="listContainer">
      <div v-if="messages.length === 0" class="empty-state">
        <p>No messages yet. Start the discussion!</p>
      </div>
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="msg"
        :class="{ decision: msg.type === 'decision' }"
      >
        <div class="meta">
          <span class="sender">{{ msg.senderName }}</span>
          <span class="time">{{ formatTime(msg.createdAt) }}</span>
        </div>
        <div class="text">{{ msg.text }}</div>
      </div>
    </div>

    <div class="composer">
      <div class="input-wrapper">
        <input
          v-model="input"
          @keydown.enter="handleSend"
          placeholder="Comment on this task... (/decide for decision)"
          :disabled="sending"
        />
        <p class="hint">Example: <strong>/decide CTA is approved</strong></p>
      </div>
      <button
        class="send-btn"
        @click="handleSend"
        type="button"
        :disabled="sending || !input.trim()"
      >
        Send
      </button>
    </div>
  </div>
</template>

<style scoped>
.discussion-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1;
  min-height: 0; /* Important for flex nested scrolling */
}

.list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
  padding-right: var(--ui-space-1);
  padding-bottom: var(--ui-space-3);
}

.empty-state {
  text-align: center;
  color: var(--ui-text-muted);
  padding: var(--ui-space-5);
  font-size: var(--ui-text-sm);
}

.msg {
  border: 1px solid var(--ui-border-light);
  border-radius: var(--ui-radius-lg);
  padding: var(--ui-space-3);
  background: var(--ui-surface);
}

.msg.decision {
  background: var(--ui-success-light);
  border-color: var(--ui-success-200);
}

.meta {
  display: flex;
  justify-content: space-between;
  gap: var(--ui-space-2);
  color: var(--ui-text-muted);
  font-weight: var(--ui-font-bold);
  font-size: var(--ui-text-xs);
  margin-bottom: var(--ui-space-1);
}

.sender {
  font-weight: var(--ui-font-bold);
  color: var(--ui-text-strong);
}

.text {
  line-height: var(--ui-leading-relaxed);
  white-space: pre-wrap;
  color: var(--ui-text);
  font-size: var(--ui-text-sm);
}

.composer {
  display: flex;
  gap: var(--ui-space-2);
  border-top: 1px solid var(--ui-border);
  padding-top: var(--ui-space-3);
  align-items: flex-start;
  margin-top: auto;
}

.input-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

input {
  width: 100%;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-md);
  padding: var(--ui-space-3);
  outline: none;
  font-size: var(--ui-text-sm);
  background: var(--ui-surface);
  transition: border-color var(--ui-duration-base) var(--ui-ease-standard);
}

input:focus {
  border-color: var(--ui-brand-600);
}

.hint {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-bold);
}

.send-btn {
  border: none;
  cursor: pointer;
  border-radius: var(--ui-radius-md);
  padding: var(--ui-space-3) var(--ui-space-4);
  font-weight: var(--ui-font-bold);
  background: var(--ui-brand-600);
  color: var(--ui-text-inverse);
  transition: opacity var(--ui-duration-base) var(--ui-ease-standard);
  height: var(--ui-touch-target-min);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-btn:hover:not(:disabled) {
  opacity: 0.9;
}
</style>

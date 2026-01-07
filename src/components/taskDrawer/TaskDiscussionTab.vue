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
  gap: 10px;
  padding-right: 4px;
  padding-bottom: 12px;
}

.empty-state {
  text-align: center;
  color: var(--text-muted);
  padding: 20px;
  font-size: 14px;
}

.msg {
  border: 1px solid var(--border-light);
  border-radius: 16px;
  padding: 12px;
  background: var(--surface);
}

.msg.decision {
  background: var(--color-success-bg);
  border-color: rgba(22, 163, 74, 0.2);
}

.meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--text-muted);
  font-weight: 750;
  font-size: 12px;
  margin-bottom: 6px;
}

.sender {
  font-weight: 800;
  color: var(--text-strong);
}

.text {
  line-height: 1.55;
  white-space: pre-wrap;
  color: var(--text);
  font-size: 14px;
}

.composer {
  display: flex;
  gap: 10px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
  align-items: flex-start;
  margin-top: auto;
}

.input-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 12px;
  outline: none;
  font-size: 14px;
  background: var(--surface);
  transition: border-color 0.2s;
}

input:focus {
  border-color: var(--brand);
}

.hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.send-btn {
  border: none;
  cursor: pointer;
  border-radius: 14px;
  padding: 12px 14px;
  font-weight: 900;
  background: var(--brand);
  color: var(--text-inverse);
  transition: opacity 0.2s;
  height: 44px;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-btn:hover:not(:disabled) {
  opacity: 0.9;
}
</style>

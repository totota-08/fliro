<script setup lang="ts">
/**
 * AppAnnouncementBanner - アプリ上部の通知バナー
 *
 * タイプに応じた色分け（info=青、warning=黄、danger=赤）
 * 閉じた場合はlocalStorageで記憶
 */
import { computed, onMounted, ref } from "vue";

const props = withDefaults(
  defineProps<{
    message: string;
    type?: "info" | "warning" | "danger";
    link?: string;
    linkText?: string;
    dismissible?: boolean;
    storageKey?: string;
  }>(),
  {
    type: "info",
    link: undefined,
    linkText: undefined,
    dismissible: false,
    storageKey: "announcement-dismissed",
  },
);

const emit = defineEmits<{
  dismiss: [];
}>();

const isDismissed = ref(false);

const shouldShow = computed(() => {
  if (!props.dismissible) return true;
  return !isDismissed.value;
});

function handleDismiss() {
  isDismissed.value = true;
  if (props.storageKey) {
    try {
      localStorage.setItem(props.storageKey, "true");
    } catch {
      // localStorage unavailable
    }
  }
  emit("dismiss");
}

onMounted(() => {
  if (props.dismissible && props.storageKey) {
    try {
      isDismissed.value = localStorage.getItem(props.storageKey) === "true";
    } catch {
      // localStorage unavailable
    }
  }
});
</script>

<template>
  <Transition name="announcement-banner">
    <div
      v-if="shouldShow"
      :class="['announcement-banner', `announcement-banner--${type}`]"
      role="alert"
      :aria-live="type === 'danger' ? 'assertive' : 'polite'"
    >
      <div class="announcement-banner__content">
        <div class="announcement-banner__icon" aria-hidden="true">
          <!-- Info Icon -->
          <svg v-if="type === 'info'" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
              clip-rule="evenodd"
            />
          </svg>
          <!-- Warning Icon -->
          <svg
            v-else-if="type === 'warning'"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clip-rule="evenodd"
            />
          </svg>
          <!-- Danger Icon -->
          <svg v-else viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clip-rule="evenodd"
            />
          </svg>
        </div>

        <p class="announcement-banner__message">
          {{ message }}
          <a
            v-if="link"
            :href="link"
            class="announcement-banner__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ linkText || link }}
          </a>
        </p>
      </div>

      <button
        v-if="dismissible"
        type="button"
        class="announcement-banner__dismiss"
        aria-label="閉じる"
        @click="handleDismiss"
      >
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path
            d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
          />
        </svg>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.announcement-banner {
  position: sticky;
  top: 0;
  z-index: var(--ui-z-sticky, 20);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  width: 100%;
}

.announcement-banner__content {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
  flex: 1;
  min-width: 0;
}

.announcement-banner__icon {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
}

.announcement-banner__icon svg {
  width: 100%;
  height: 100%;
}

.announcement-banner__message {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  line-height: var(--ui-leading-normal, 1.5);
  font-weight: var(--ui-font-medium, 500);
}

.announcement-banner__link {
  margin-left: var(--ui-space-2, 0.5rem);
  font-weight: var(--ui-font-semibold, 600);
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: var(--ui-transition-colors);
}

.announcement-banner__link:hover {
  text-decoration-thickness: 2px;
}

.announcement-banner__dismiss {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--ui-touch-target-min, 44px);
  height: var(--ui-touch-target-min, 44px);
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: var(--ui-radius-sm, 0.5rem);
  transition: var(--ui-transition-colors);
}

.announcement-banner__dismiss svg {
  width: 1.25rem;
  height: 1.25rem;
}

/* Info variant (blue) */
.announcement-banner--info {
  background: var(--ui-info-light, #e0f2fe);
  color: #0c4a6e;
}

.announcement-banner--info .announcement-banner__icon {
  color: var(--ui-info, #0284c7);
}

.announcement-banner--info .announcement-banner__link {
  color: var(--ui-info, #0284c7);
}

.announcement-banner--info .announcement-banner__link:hover {
  color: #0369a1;
}

.announcement-banner--info .announcement-banner__dismiss {
  color: #0c4a6e;
}

.announcement-banner--info .announcement-banner__dismiss:hover {
  background: rgba(2, 132, 199, 0.15);
}

/* Warning variant (yellow) */
.announcement-banner--warning {
  background: var(--ui-warning-light, #fef3c7);
  color: #78350f;
}

.announcement-banner--warning .announcement-banner__icon {
  color: var(--ui-warning, #f59e0b);
}

.announcement-banner--warning .announcement-banner__link {
  color: #b45309;
}

.announcement-banner--warning .announcement-banner__link:hover {
  color: #92400e;
}

.announcement-banner--warning .announcement-banner__dismiss {
  color: #78350f;
}

.announcement-banner--warning .announcement-banner__dismiss:hover {
  background: rgba(245, 158, 11, 0.2);
}

/* Danger variant (red) */
.announcement-banner--danger {
  background: var(--ui-danger-light, #fee2e2);
  color: #7f1d1d;
}

.announcement-banner--danger .announcement-banner__icon {
  color: var(--ui-danger, #d64545);
}

.announcement-banner--danger .announcement-banner__link {
  color: #b91c1c;
}

.announcement-banner--danger .announcement-banner__link:hover {
  color: #991b1b;
}

.announcement-banner--danger .announcement-banner__dismiss {
  color: #7f1d1d;
}

.announcement-banner--danger .announcement-banner__dismiss:hover {
  background: rgba(214, 69, 69, 0.15);
}

/* Transition */
.announcement-banner-enter-active,
.announcement-banner-leave-active {
  transition:
    opacity var(--ui-duration-base, 180ms) var(--ui-ease-standard),
    transform var(--ui-duration-base, 180ms) var(--ui-ease-standard);
}

.announcement-banner-enter-from,
.announcement-banner-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

/* Responsive */
@media (max-width: 640px) {
  .announcement-banner {
    padding: var(--ui-space-3, 0.75rem);
  }

  .announcement-banner__message {
    font-size: var(--ui-text-xs, 0.75rem);
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .announcement-banner-enter-active,
  .announcement-banner-leave-active {
    transition: none;
  }
}
</style>

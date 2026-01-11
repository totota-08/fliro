<script setup lang="ts">
/**
 * MobileBottomNav - モバイル専用ボトムナビゲーション
 *
 * スマホアプリライクなタブバーを提供
 */
import { computed } from "vue";
import { useRoute } from "vue-router";

interface NavItem {
  name: string;
  label: string;
  icon: string;
  to: string | { name: string; params?: Record<string, string> };
}

const props = defineProps<{
  items: NavItem[];
}>();

const route = useRoute();

const activeItemName = computed(() => {
  return (
    props.items.find((item) => {
      if (typeof item.to === "string") {
        return route.path === item.to;
      }
      return route.name === item.to.name;
    })?.name || props.items[0]?.name
  );
});
</script>

<template>
  <nav class="mobile-bottom-nav">
    <RouterLink
      v-for="item in items"
      :key="item.name"
      :to="item.to"
      class="mobile-bottom-nav__item"
      :class="{ 'is-active': activeItemName === item.name }"
    >
      <div class="mobile-bottom-nav__icon">
        <svg
          v-if="item.icon === 'home'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <polyline points="9 22 9 12 15 12 15 22" stroke-width="2" />
        </svg>
        <svg
          v-else-if="item.icon === 'tasks'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" stroke-width="2" />
          <rect x="14" y="3" width="7" height="7" rx="1" stroke-width="2" />
          <rect x="3" y="14" width="7" height="7" rx="1" stroke-width="2" />
          <rect x="14" y="14" width="7" height="7" rx="1" stroke-width="2" />
        </svg>
        <svg
          v-else-if="item.icon === 'users'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="9" cy="7" r="4" stroke-width="2" />
          <path
            d="M23 21v-2a4 4 0 0 0-3-3.87"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M16 3.13a4 4 0 0 1 0 7.75"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <svg
          v-else-if="item.icon === 'settings'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <circle cx="12" cy="12" r="3" stroke-width="2" />
          <path
            d="M12 1v6m0 6v6M1 12h6m6 0h6"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <span class="mobile-bottom-nav__label">{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.mobile-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  background: var(--ui-surface, #ffffff);
  border-top: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  padding-bottom: env(safe-area-inset-bottom);
  z-index: var(--ui-z-sticky, 20);
  box-shadow: 0 -2px 8px rgba(11, 46, 51, 0.08);
}

.mobile-bottom-nav__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  min-height: 56px;
  color: var(--ui-text-muted, #64748b);
  text-decoration: none;
  transition: var(--ui-transition-colors);
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.mobile-bottom-nav__item:active {
  transform: scale(0.95);
  transition: transform 0.1s ease;
}

.mobile-bottom-nav__item.is-active {
  color: var(--ui-brand-600, #4f7c82);
}

.mobile-bottom-nav__icon {
  width: 24px;
  height: 24px;
  margin-bottom: var(--ui-space-1, 0.25rem);
}

.mobile-bottom-nav__icon svg {
  width: 100%;
  height: 100%;
}

.mobile-bottom-nav__label {
  font-size: var(--ui-text-xs, 0.75rem);
  font-weight: var(--ui-font-semibold, 600);
  line-height: 1;
}

/* アクティブ時のアニメーション */
.mobile-bottom-nav__item.is-active .mobile-bottom-nav__icon {
  animation: bounce 0.3s ease;
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

/* prefers-reduced-motion対応 */
@media (prefers-reduced-motion: reduce) {
  .mobile-bottom-nav__item.is-active .mobile-bottom-nav__icon {
    animation: none;
  }
}
</style>

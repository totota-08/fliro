<script setup lang="ts">
import SidebarUserProfile from "@/components/common/SidebarUserProfile.vue";
import BrandLogo from "@/components/common/BrandLogo.vue";
import { appName } from "@/constants/appMeta";
import { computed } from "vue";
import { useRoute } from "vue-router";

type BaseNavItem = {
  key: "dashboard" | "tasks" | "team" | "settings";
  label: string;
  to?: string;
  icon: "dashboard" | "tasks" | "team" | "settings";
  disabled?: boolean;
};

type NavItem = BaseNavItem & { active: boolean };

type ProjectItem = {
  key: string;
  label: string;
  accent: "primary" | "secondary" | "accent";
};

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const route = useRoute();

const baseNavItems: BaseNavItem[] = [
  {
    key: "dashboard",
    label: "ダッシュボード",
    to: "/demo/dashboard",
    icon: "dashboard",
  },
  { key: "tasks", label: "マイタスク", to: "/demo/tasks", icon: "tasks" },
  { key: "team", label: "チーム", to: "/demo/team", icon: "team" },
  { key: "settings", label: "設定", icon: "settings", disabled: true },
];

const currentSection = computed(() => {
  if (typeof route.meta.section === "string") {
    return route.meta.section as BaseNavItem["key"];
  }

  if (typeof route.name === "string" && route.name.startsWith("demo.")) {
    return route.name.split(".")[1] as BaseNavItem["key"];
  }

  if (typeof route.name === "string" && route.name.startsWith("demo-")) {
    return route.name.split("-")[1] as BaseNavItem["key"];
  }

  return undefined;
});

const navigationItems = computed<NavItem[]>(() =>
  baseNavItems.map((item) => {
    const matchesPath = item.to ? route.path.startsWith(item.to) : false;
    return {
      ...item,
      active: currentSection.value === item.key || matchesPath,
    };
  }),
);

const projectItems: ProjectItem[] = [
  { key: "web", label: "Webサイトリニューアル", accent: "primary" },
  { key: "mobile", label: "モバイルアプリ開発", accent: "secondary" },
  { key: "marketing", label: "マーケティングキャンペーン", accent: "accent" },
];

const rootClasses = computed(() => [
  "sidebar",
  { "is-hidden": !props.open, "is-open": props.open },
]);

const handleClose = () => emit("close");

const handleNavigate = () => {
  if (window.matchMedia("(max-width: 1200px)").matches) {
    emit("close");
  }
};
</script>

<template>
  <aside :class="rootClasses">
    <div class="sidebar__header">
      <div class="sidebar__brand">
        <div class="sidebar__logo">
          <BrandLogo class="sidebar__logo-icon" />
          <span>{{ appName }}</span>
        </div>
        <p class="sidebar__subtitle">デモ体験</p>
      </div>
      <button type="button" class="sidebar__toggle" @click="handleClose">
        <span aria-hidden="true">X</span>
        <span class="sr-only">サイドバーを閉じる</span>
      </button>
    </div>

    <nav class="sidebar__nav">
      <p class="sidebar__section">ナビゲーション</p>
      <ul>
        <li v-for="item in navigationItems" :key="item.key">
          <RouterLink
            v-if="item.to"
            :to="item.to"
            class="sidebar__nav-button"
            :class="{ 'is-active': item.active }"
            @click="handleNavigate"
          >
            <span class="sidebar__nav-icon" aria-hidden="true">
              <svg
                v-if="item.icon === 'dashboard'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M4 12h16M12 4v16"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
              </svg>
              <svg
                v-else-if="item.icon === 'tasks'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M5 6h14M5 12h14M5 18h8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
              </svg>
              <svg
                v-else-if="item.icon === 'team'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M7 17c0-2.21 1.79-4 4-4h2c2.21 0 4 1.79 4 4M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
              </svg>
              <svg
                v-else-if="item.icon === 'settings'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .69.28 1.35.76 1.84.48.49 1.15.76 1.84.76H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.3"
                />
              </svg>
            </span>
            {{ item.label }}
          </RouterLink>
          <button
            v-else
            type="button"
            class="sidebar__nav-button is-disabled"
            disabled
            title="近日公開"
            aria-disabled="true"
          >
            <span class="sidebar__nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .69.28 1.35.76 1.84.48.49 1.15.76 1.84.76H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.3"
                />
              </svg>
            </span>
            {{ item.label }}
          </button>
        </li>
      </ul>
    </nav>

    <div class="sidebar__projects">
      <div class="sidebar__projects-header">
        <p class="sidebar__section">プロジェクト</p>
        <button
          type="button"
          class="sidebar__add"
          aria-label="プロジェクトを追加"
        >
          +
        </button>
      </div>
      <ul>
        <li v-for="project in projectItems" :key="project.key">
          <span class="dot" :class="`dot--${project.accent}`" />
          {{ project.label }}
        </li>
      </ul>
    </div>

    <SidebarUserProfile />
  </aside>
</template>

<style scoped src="@/components/common/sidebar.css"></style>

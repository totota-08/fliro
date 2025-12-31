<script setup lang="ts">
import DashboardSidebar from "@/components/projectDashboard/DashboardSidebar.vue";
import { appName } from "@/constants/appMeta";
import { ROUTE_NAMES } from "@/constants/routes";
import { listUserProjectRefs } from "@/services/projectRefs";
import { useAuthStore } from "@/store/auth";
import type {
  DashboardNavItem,
  DashboardProfileInfo,
  DashboardProjectItem,
} from "@/types/projectDashboard";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

const props = withDefaults(
  defineProps<{
    projectId: string;
    open: boolean;
    brandSubtitle?: string;
  }>(),
  {
    brandSubtitle: "プロジェクト",
  },
);

const emit = defineEmits<{
  (e: "close"): void;
}>();

const { user, profile } = useAuthStore();
const route = useRoute();
const projectList = ref<DashboardProjectItem[]>([]);

const navItems = computed<DashboardNavItem[]>(() => [
  {
    key: "dashboard",
    label: "ダッシュボード",
    to: {
      name: ROUTE_NAMES.projectDashboard,
      params: { projectId: props.projectId },
    },
    icon: "dashboard",
  },
  {
    key: "tasks",
    label: "マイタスク",
    to: { name: ROUTE_NAMES.myTasks },
    icon: "tasks",
  },
  {
    key: "team",
    label: "チャット",
    to: {
      name: ROUTE_NAMES.projectThreads,
      params: { projectId: props.projectId },
    },
    icon: "team",
  },
  {
    key: "timeline",
    label: "ログ",
    to: {
      name: ROUTE_NAMES.projectTimeline,
      params: { projectId: props.projectId },
    },
    icon: "tasks",
  },
  {
    key: "categories",
    label: "カテゴリ",
    to: {
      name: ROUTE_NAMES.projectCategories,
      params: { projectId: props.projectId },
    },
    icon: "settings",
  },
  {
    key: "members",
    label: "メンバー",
    to: {
      name: ROUTE_NAMES.projectMembers,
      params: { projectId: props.projectId },
    },
    icon: "members",
  },
  {
    key: "settings",
    label: "設定",
    to: {
      name: ROUTE_NAMES.projectSettings,
      params: { projectId: props.projectId },
    },
    icon: "settings",
  },
]);

const sidebarProjects = computed(() => projectList.value);

const profileInfo = computed<DashboardProfileInfo>(() => ({
  name: profile.value?.nickname || profile.value?.fullName || `${appName} User`,
  email: profile.value?.email || "",
}));

async function loadProjectList() {
  if (!user.value) return;
  const refs = await listUserProjectRefs(user.value.uid);
  projectList.value = refs.map((refItem, index) => ({
    key: refItem.id,
    label: refItem.projectName || "Project",
    to: {
      name: ROUTE_NAMES.projectDashboard,
      params: { projectId: refItem.id },
    },
    accent: ["primary", "secondary", "accent"][index % 3] as
      | "primary"
      | "secondary"
      | "accent",
  }));
}

const handleClose = () => emit("close");

onMounted(() => {
  loadProjectList();
});

watch(
  () => route.params.projectId,
  () => {
    loadProjectList();
  },
);
</script>

<template>
  <DashboardSidebar
    :open="open"
    :nav-items="navItems"
    :projects="sidebarProjects"
    :profile="profileInfo"
    :brand-subtitle="brandSubtitle"
    @close="handleClose"
  />
</template>

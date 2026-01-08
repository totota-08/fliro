<script setup lang="ts">
import DashboardSidebar from "@/components/projectDashboard/DashboardSidebar.vue";
import { useProjectAccess } from "@/composables/useProjectAccess";
import { appName } from "@/constants/appMeta";
import { buildFilteredProjectNavItems } from "@/constants/projectNav";
import { ROUTE_NAMES } from "@/constants/routes";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/store/auth";
import type {
  DashboardProfileInfo,
  DashboardProjectItem,
} from "@/types/projectDashboard";
import { collection, getDocs } from "firebase/firestore";
import { computed, onMounted, ref, toRef, watch } from "vue";
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

// 権限フィルタリング付きナビゲーション
const projectIdRef = toRef(props, "projectId");
const { can } = useProjectAccess(projectIdRef);
const navItems = computed(() =>
  buildFilteredProjectNavItems(props.projectId, can),
);

const dashboardTo = computed(() => ({
  name: ROUTE_NAMES.projectDashboard,
  params: { projectId: props.projectId },
}));

const sidebarProjects = computed(() => projectList.value);

const profileInfo = computed<DashboardProfileInfo>(() => ({
  name: profile.value?.nickname || profile.value?.fullName || `${appName} User`,
  email: profile.value?.email || "",
}));

async function loadProjectList() {
  if (!user.value) return;
  const snap = await getDocs(
    collection(db, "userProjects", user.value.uid, "projects"),
  );
  projectList.value = snap.docs.map((docSnap, index) => ({
    key: docSnap.id,
    label: (docSnap.data().projectName as string) || "Project",
    to: {
      name: ROUTE_NAMES.projectDashboard,
      params: { projectId: docSnap.id },
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
    :dashboard-to="dashboardTo"
    @close="handleClose"
  />
</template>

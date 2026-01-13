/**
 * useProjectShellData - ProjectAppShell用のデータを準備するcomposable
 *
 * navItems、sidebarProjects、profileInfoを計算して返す
 */
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
import { computed, onMounted, ref, watch, type Ref } from "vue";
import { useRoute } from "vue-router";

export function useProjectShellData(projectIdRef: Ref<string>) {
  const { user, profile } = useAuthStore();
  const route = useRoute();
  const projectList = ref<DashboardProjectItem[]>([]);

  // 権限フィルタリング付きナビゲーション
  const { can } = useProjectAccess(projectIdRef);
  const navItems = computed(() =>
    buildFilteredProjectNavItems(projectIdRef.value, can),
  );

  const sidebarProjects = computed(() => projectList.value);

  const profileInfo = computed<DashboardProfileInfo>(() => ({
    name:
      profile.value?.nickname || profile.value?.fullName || `${appName} User`,
    email: profile.value?.email || "",
    avatar: profile.value?.avatarUrl || user.value?.photoURL || undefined,
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

  onMounted(() => {
    loadProjectList();
  });

  watch(
    () => route.params.projectId,
    () => {
      loadProjectList();
    },
  );

  return {
    navItems,
    sidebarProjects,
    profileInfo,
  };
}

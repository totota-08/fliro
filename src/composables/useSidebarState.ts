import { onBeforeUnmount, onMounted, ref } from "vue";

export function useSidebarState() {
  const isSidebarOpen = ref(true);
  let mediaQuery: MediaQueryList | null = null;

  const handleMediaChange = (event: MediaQueryListEvent) => {
    // 画面が小さくなった場合はサイドバーを閉じる
    // 画面が大きくなった場合はサイドバーを開く
    isSidebarOpen.value = !event.matches;
  };

  onMounted(() => {
    if (typeof window === "undefined") return;
    mediaQuery = window.matchMedia("(max-width: 1200px)");
    isSidebarOpen.value = !mediaQuery.matches;
    mediaQuery.addEventListener("change", handleMediaChange);
  });

  onBeforeUnmount(() => {
    mediaQuery?.removeEventListener("change", handleMediaChange);
  });

  const toggleSidebar = () => {
    isSidebarOpen.value = !isSidebarOpen.value;
  };

  const closeSidebar = () => {
    isSidebarOpen.value = false;
  };

  return { isSidebarOpen, toggleSidebar, closeSidebar };
}

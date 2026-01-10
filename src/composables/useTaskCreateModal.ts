import { listenTaskCategories } from "@/services/taskCategoryService";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, getDoc, doc } from "firebase/firestore";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref,
} from "vue";
import type { TaskCategory } from "@/services/taskCategoryService";

// Global state - shared across all composable instances
const isTaskModalOpen = ref(false);

function openTaskModal() {
  isTaskModalOpen.value = true;
}

function closeTaskModal() {
  isTaskModalOpen.value = false;
}

/**
 * useTaskCreateModal - タスク作成モーダルのグローバル状態管理
 *
 * - isTaskModalOpen: モーダルの開閉状態
 * - openTaskModal(): モーダルを開く
 * - closeTaskModal(): モーダルを閉じる
 *
 * キーボードショートカット（Nキー）は enableKeyboard: true で有効化
 * input/textareaにフォーカス中は無効
 */
export function useTaskCreateModal(options: { enableKeyboard?: boolean } = {}) {
  const { enableKeyboard = false } = options;

  function handleKeyDown(event: KeyboardEvent) {
    // Ignore if modal is already open
    if (isTaskModalOpen.value) return;

    // Check if N key is pressed (case insensitive)
    if (event.key.toLowerCase() !== "n") return;

    // Ignore if any modifier key is pressed
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
      return;

    // Ignore if focus is on input, textarea, select, or contenteditable
    const target = event.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    if (
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select" ||
      target.isContentEditable
    ) {
      return;
    }

    event.preventDefault();
    openTaskModal();
  }

  onMounted(() => {
    if (enableKeyboard && typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown);
    }
  });

  onBeforeUnmount(() => {
    if (enableKeyboard && typeof window !== "undefined") {
      window.removeEventListener("keydown", handleKeyDown);
    }
  });

  return {
    isTaskModalOpen,
    openTaskModal,
    closeTaskModal,
  };
}

export type MemberOption = {
  id: string;
  name: string;
};

/**
 * useTaskCreateData - タスク作成モーダルに必要なデータを購読
 *
 * categoriesとmembersをプロジェクトIDに基づいて取得
 */
export function useTaskCreateData(projectIdRef: Ref<string>) {
  const categories = ref<TaskCategory[]>([]);
  const members = ref<MemberOption[]>([]);

  let stopCategories: (() => void) | null = null;
  let stopMembers: (() => void) | null = null;

  function startWatchers() {
    const projectId = projectIdRef.value;
    if (!projectId) return;

    // Watch categories
    stopCategories = listenTaskCategories(projectId, (list) => {
      categories.value = list;
    });

    // Watch members
    stopMembers = onSnapshot(
      collection(db, "projects", projectId, "members"),
      async (snapshot) => {
        const promises = snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const memberId = data.userId || docSnap.id;
          let name = data.nickname || data.fullName;

          if (!name) {
            try {
              const profileSnap = await getDoc(doc(db, "profiles", memberId));
              if (profileSnap.exists()) {
                const profile = profileSnap.data();
                name = profile.nickname || profile.fullName;
              }
            } catch {
              // Ignore profile fetch errors
            }
          }

          return {
            id: memberId,
            name: name || docSnap.id,
          };
        });

        members.value = await Promise.all(promises);
      },
    );
  }

  function stopWatchers() {
    stopCategories?.();
    stopMembers?.();
    stopCategories = null;
    stopMembers = null;
  }

  onMounted(() => {
    startWatchers();
  });

  watch(projectIdRef, () => {
    stopWatchers();
    startWatchers();
  });

  onBeforeUnmount(() => {
    stopWatchers();
  });

  return {
    categories: computed(() => categories.value),
    members: computed(() => members.value),
  };
}

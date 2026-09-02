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
    if (!event.key || event.key.toLowerCase() !== "n") return;

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
 * categoriesとmembersをプロジェクトIDに基づいて取得する。
 *
 * これらはモーダルを開いたときにしか表示されないため、購読は
 * 初めてモーダルが開かれるまで遅延させる。プロジェクトページを開くたびに
 * members の購読 + メンバー人数分の profiles 取得（ダッシュボード側の
 * 購読と重複する）が走っていたのを避けるため。
 */
export function useTaskCreateData(projectIdRef: Ref<string>) {
  const categories = ref<TaskCategory[]>([]);
  const members = ref<MemberOption[]>([]);

  // モーダルが一度でも開かれたか（＝購読が必要になったか）
  let subscriptionRequested = false;
  let stopCategories: (() => void) | null = null;
  let stopMembers: (() => void) | null = null;
  // プロフィール取得の await 中に購読が切り替わった場合、
  // 古いスナップショットの結果で members を上書きしないための世代カウンタ
  let membersGeneration = 0;

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
        const generation = ++membersGeneration;
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
            // uidがそのまま表示されないようフォールバック
            name: name || `メンバー#${memberId.slice(-1)}`,
          };
        });

        const resolved = await Promise.all(promises);
        if (generation !== membersGeneration) return;
        members.value = resolved;
      },
    );
  }

  function stopWatchers() {
    stopCategories?.();
    stopMembers?.();
    stopCategories = null;
    stopMembers = null;
    // 解決待ちの古いスナップショット結果を無効化
    membersGeneration++;
  }

  // モーダルが初めて開かれたタイミングで購読を開始する
  watch(
    isTaskModalOpen,
    (open) => {
      if (open && !subscriptionRequested) {
        subscriptionRequested = true;
        startWatchers();
      }
    },
    { immediate: true },
  );

  watch(projectIdRef, () => {
    // モーダルが一度も開かれていない場合は購読しない
    if (!subscriptionRequested) return;
    stopWatchers();
    startWatchers();
  });

  onBeforeUnmount(() => {
    stopWatchers();
    subscriptionRequested = false;
  });

  return {
    categories: computed(() => categories.value),
    members: computed(() => members.value),
  };
}

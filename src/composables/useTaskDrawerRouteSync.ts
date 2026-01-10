import { computed, ref, watch } from "vue";
import type { Router, RouteLocationNormalizedLoaded } from "vue-router";

/**
 * useTaskDrawerRouteSync - タスクドロワーとURL queryの同期
 *
 * URLの ?taskId= パラメータとドロワーの開閉状態を同期する。
 * リロードしても同じタスクがドロワーで開く。
 */
export function useTaskDrawerRouteSync(
  router: Router,
  route: RouteLocationNormalizedLoaded,
) {
  const internalTaskId = ref<string | null>(null);

  // URLからtaskIdを取得
  const queryTaskId = computed(() => {
    const value = route.query.taskId;
    if (Array.isArray(value)) {
      return value[0] || null;
    }
    return value || null;
  });

  // 初期化: URLからtaskIdを復元
  if (queryTaskId.value) {
    internalTaskId.value = queryTaskId.value;
  }

  // URLの変更を監視
  watch(queryTaskId, (newId) => {
    internalTaskId.value = newId;
  });

  // ドロワーで表示中のtaskId
  const taskId = computed(() => internalTaskId.value);

  // ドロワーが開いているかどうか
  const isOpen = computed(() => !!internalTaskId.value);

  /**
   * タスクをドロワーで開く
   */
  function openTask(id: string) {
    if (internalTaskId.value === id) return;
    internalTaskId.value = id;

    // URLに反映（replaceで履歴を汚さない）
    const newQuery = { ...route.query, taskId: id };
    router.replace({ query: newQuery });
  }

  /**
   * ドロワーを閉じる
   */
  function closeTask() {
    internalTaskId.value = null;

    // URLからtaskIdを削除
    const { taskId: _, ...rest } = route.query;
    router.replace({ query: rest });
  }

  return {
    taskId,
    isOpen,
    openTask,
    closeTask,
  };
}

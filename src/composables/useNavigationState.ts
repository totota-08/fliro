import { readonly, ref } from "vue";

/**
 * ナビゲーション状態を管理するシングルトンcomposable
 *
 * ルーターのナビゲーション中かどうか、およびナビゲーション先のパスを
 * アプリ全体で共有する。サイドバーなどでローディング状態を表示するために使用。
 */

// モジュールスコープでシングルトン状態を管理
const isNavigating = ref(false);
const targetPath = ref<string | null>(null);
const fromPath = ref<string | null>(null);
const isProjectSwitch = ref(false);

/**
 * パスからプロジェクトIDを抽出
 */
function extractProjectId(path: string): string | null {
  const match = path.match(/^\/projects\/([^/]+)/);
  return match?.[1] ?? null;
}

export function useNavigationState() {
  /**
   * ナビゲーション開始時に呼び出す
   */
  function startNavigation(from: string, to: string) {
    isNavigating.value = true;
    fromPath.value = from;
    targetPath.value = to;

    // プロジェクト切り替えかどうかを判定
    const fromProjectId = extractProjectId(from);
    const toProjectId = extractProjectId(to);
    isProjectSwitch.value =
      fromProjectId !== null &&
      toProjectId !== null &&
      fromProjectId !== toProjectId;
  }

  /**
   * ナビゲーション完了時に呼び出す
   */
  function finishNavigation() {
    isNavigating.value = false;
    targetPath.value = null;
    fromPath.value = null;
    isProjectSwitch.value = false;
  }

  /**
   * 指定されたパスがナビゲーション中かどうかを判定
   */
  function isNavigatingTo(path: string): boolean {
    return isNavigating.value && targetPath.value === path;
  }

  return {
    isNavigating: readonly(isNavigating),
    targetPath: readonly(targetPath),
    fromPath: readonly(fromPath),
    isProjectSwitch: readonly(isProjectSwitch),
    startNavigation,
    finishNavigation,
    isNavigatingTo,
  };
}

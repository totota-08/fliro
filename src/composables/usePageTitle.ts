/**
 * usePageTitle - ページタイトルをProjectLayoutのtopbarに渡すためのcomposable
 *
 * provide/injectパターンを使用して、各ページからLayoutにタイトルを伝達
 */
import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

export interface PageTitleState {
  title: Ref<string>;
  subtitle: Ref<string>;
}

const PAGE_TITLE_KEY: InjectionKey<PageTitleState> = Symbol("pageTitle");

/**
 * ProjectLayoutで呼び出す - タイトル状態を提供
 */
export function providePageTitle() {
  const title = ref("");
  const subtitle = ref("");

  const state: PageTitleState = {
    title,
    subtitle,
  };

  provide(PAGE_TITLE_KEY, state);

  return state;
}

/**
 * 各ページで呼び出す - タイトルを設定
 */
export function usePageTitle(newTitle?: string, newSubtitle?: string) {
  const state = inject(PAGE_TITLE_KEY);

  if (!state) {
    // ProjectLayout外で使用された場合はダミーを返す
    return {
      title: ref(""),
      subtitle: ref(""),
      setTitle: () => {},
      setSubtitle: () => {},
    };
  }

  // 初期値が渡された場合は設定
  if (newTitle !== undefined) {
    state.title.value = newTitle;
  }
  if (newSubtitle !== undefined) {
    state.subtitle.value = newSubtitle;
  }

  function setTitle(value: string) {
    if (state) state.title.value = value;
  }

  function setSubtitle(value: string) {
    if (state) state.subtitle.value = value;
  }

  return {
    title: state.title,
    subtitle: state.subtitle,
    setTitle,
    setSubtitle,
  };
}

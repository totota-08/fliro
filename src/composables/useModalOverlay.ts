import { onBeforeUnmount, watch } from "vue";

/**
 * モーダル / ドロワー共通のオーバーレイ挙動。
 * open 中は背景スクロールを固定し、Esc キーで close を呼ぶ。
 * 破棄時にはスクロール固定とリスナーを必ず解除する。
 */
export function useModalOverlay(open: () => boolean, close: () => void) {
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      close();
    }
  }

  watch(
    open,
    (isOpen) => {
      if (isOpen) {
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeydown);
      } else {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeydown);
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    document.body.style.overflow = "";
    window.removeEventListener("keydown", handleKeydown);
  });
}

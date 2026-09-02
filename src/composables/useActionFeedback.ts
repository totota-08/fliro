import { onBeforeUnmount, ref } from "vue";

/**
 * 操作結果（成功メッセージ / エラー）の一時表示状態。
 * 成功は 2.5 秒、エラーは 3 秒で自動的に消える。
 * タイマーはコンポーネント破棄時に自動でクリアされる。
 */
export function useActionFeedback() {
  const actionMessage = ref("");
  const actionError = ref("");
  let timer: ReturnType<typeof setTimeout> | null = null;

  function setActionMessage(message: string) {
    actionMessage.value = message;
    actionError.value = "";
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      actionMessage.value = "";
    }, 2500);
  }

  function setActionError(message: string) {
    actionError.value = message;
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      actionError.value = "";
    }, 3000);
  }

  onBeforeUnmount(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });

  return { actionMessage, actionError, setActionMessage, setActionError };
}

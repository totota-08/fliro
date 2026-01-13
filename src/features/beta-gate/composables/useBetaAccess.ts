/**
 * ベータアクセス管理Composable
 *
 * ベータゲートの有効/無効判定とベータアクセス権の確認を行う
 */
import { computed, ref } from "vue";
import { useAuthStore } from "@/store/auth";
import { validateInviteCode } from "../services/betaGateService";
import type { ValidateCodeResult } from "../types/betaGate";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.features.beta-gate.composable");

/**
 * ベータゲートが有効かどうか（環境変数で制御）
 */
export const isBetaGateEnabled = computed(() => {
  return import.meta.env.VITE_BETA_INVITE_ONLY === "true";
});

/**
 * ベータアクセス管理
 */
export function useBetaAccess() {
  const auth = useAuthStore();
  const isValidating = ref(false);
  const validationError = ref<string | null>(null);

  /**
   * ベータアクセス権を持っているか
   * - ベータゲートが無効なら全員アクセス可
   * - プロファイルにbetaAccess: trueがあればアクセス可
   */
  const hasBetaAccess = computed(() => {
    // ベータゲートが無効なら全員アクセス可
    if (!isBetaGateEnabled.value) return true;

    // プロファイルにbetaAccess: trueがあればアクセス可
    return auth.profile.value?.betaAccess === true;
  });

  /**
   * 招待コードを送信してベータアクセス権を取得
   * @param code 招待コード（XXXX-XXXX-XXXX形式）
   */
  async function submitInviteCode(code: string): Promise<ValidateCodeResult> {
    isValidating.value = true;
    validationError.value = null;

    try {
      const result = await validateInviteCode(code);

      if (!result.success) {
        validationError.value =
          result.message ?? "招待コードの検証に失敗しました";
      }

      return result;
    } catch (error) {
      logger.error`Invite code validation failed: ${error}`;
      validationError.value = "エラーが発生しました";
      return { success: false, error: "server_error" };
    } finally {
      isValidating.value = false;
    }
  }

  /**
   * エラーをクリア
   */
  function clearError() {
    validationError.value = null;
  }

  return {
    isBetaGateEnabled,
    hasBetaAccess,
    isValidating,
    validationError,
    submitInviteCode,
    clearError,
  };
}

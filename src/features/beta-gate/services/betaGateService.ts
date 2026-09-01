/**
 * ベータゲートサービス
 *
 * Cloud Functionsを呼び出して招待コードの検証を行う
 */

import type { ValidateCodeResult } from "../types/betaGate";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.features.beta-gate.service");

interface ValidateInviteCodeRequest {
  code: string;
}

/**
 * 招待コードを検証し、ベータアクセス権を付与する
 * @param code 招待コード（XXXX-XXXX-XXXX形式）
 * @returns 検証結果
 */
export async function validateInviteCode(
  code: string,
): Promise<ValidateCodeResult> {
  try {
    // functions SDK は初回検証時にのみ読み込む（エントリチャンク削減）
    const [{ httpsCallable }, { functions }] = await Promise.all([
      import("firebase/functions"),
      import("@/lib/firebaseFunctions"),
    ]);
    const validateFn = httpsCallable<
      ValidateInviteCodeRequest,
      ValidateCodeResult
    >(functions, "validateInviteCode");

    const result = await validateFn({ code: code.toUpperCase().trim() });
    return result.data;
  } catch (error) {
    logger.error`Failed to validate invite code: ${error}`;
    return {
      success: false,
      error: "server_error",
      message: "サーバーとの通信に失敗しました",
    };
  }
}

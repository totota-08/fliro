/**
 * ベータゲート機能の型定義
 */

/**
 * 招待コードのFirestoreドキュメント構造
 */
export interface InvitationCode {
  code: string;
  status: "active" | "used" | "expired" | "revoked";
  maxUses: number | null;
  usedCount: number;
  usedBy: string[];
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: string;
  note?: string;
}

/**
 * 招待コード検証結果
 */
export interface ValidateCodeResult {
  success: boolean;
  error?:
    | "invalid_format"
    | "invalid_code"
    | "expired"
    | "max_uses_reached"
    | "already_used"
    | "server_error";
  message?: string;
}

/**
 * ベータアクセス状態
 */
export interface BetaAccessState {
  isLoading: boolean;
  hasBetaAccess: boolean;
  error: string | null;
}

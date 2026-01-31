/**
 * Cloud Functions エントリポイント
 *
 * - validateInviteCode: 招待制ベータゲート機能
 * - onUserSignedIn: サインイン時のプロファイル自動作成
 */
export { validateInviteCode } from "./validateInviteCode";
export { onUserSignedIn } from "./onUserSignedIn";

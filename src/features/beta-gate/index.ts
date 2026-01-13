/**
 * ベータゲート機能
 *
 * 招待制ベータ期間中、招待コードを持たないユーザーへのアクセス制限機能
 *
 * @example
 * // App.vue での使用
 * import { BetaGatePage, useBetaAccess } from "@/features/beta-gate";
 *
 * const { isBetaGateEnabled, hasBetaAccess } = useBetaAccess();
 *
 * // ベータゲートを表示すべきか判定
 * const shouldShowBetaGate = computed(() => {
 *   if (!isBetaGateEnabled.value) return false;
 *   if (!auth.isAuthenticated.value) return false;
 *   return !hasBetaAccess.value;
 * });
 */

export { default as BetaGatePage } from "./components/BetaGatePage.vue";
export { useBetaAccess, isBetaGateEnabled } from "./composables/useBetaAccess";
export * from "./types/betaGate";

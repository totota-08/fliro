export const APP_CONFIG = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "",
  /** サンプルプロジェクトのID（LPからのリンク先） */
  sampleProjectId: "A0u22ZoeJjCNqnJ3ydZx",
};

/**
 * デバッグモードかどうかを判定
 * VITE_DEBUG_MODE=true の場合はデバッグモード
 * 未設定の場合は開発環境（DEV）かどうかで判定
 */
export function isDebugMode(): boolean {
  const debugFlag = import.meta.env.VITE_DEBUG_MODE;
  if (debugFlag !== undefined) {
    return debugFlag === "true";
  }
  // 未設定の場合は開発環境かどうかで判定
  return import.meta.env.DEV;
}

/**
 * アプリのベースURLを取得
 * デバッグモード（VITE_DEBUG_MODE=true）: http://localhost:5173
 * 本番モード（VITE_DEBUG_MODE=false）: https://fliro.work
 */
export function getAppBaseUrl(): string {
  // 環境変数で明示的にURLが指定されている場合はそれを使用
  if (import.meta.env.VITE_APP_BASE_URL) {
    return import.meta.env.VITE_APP_BASE_URL;
  }

  // デバッグモードの場合はlocalhost
  if (isDebugMode()) {
    return "http://localhost:5173";
  }

  // 本番モードの場合
  return "https://fliro.work";
}

/**
 * Firebase ActionCodeSettingsを生成
 * メール認証やパスワードリセットのリダイレクトURLを設定
 */
export function getActionCodeSettings(continuePath: string = "/") {
  const baseUrl = getAppBaseUrl();
  return {
    url: `${baseUrl}${continuePath}`,
    handleCodeInApp: true,
  };
}

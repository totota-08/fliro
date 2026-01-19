import { useNotificationCenter } from "@/composables/useNotificationCenter";
import {
  configure,
  getConsoleSink,
  type LogLevel,
  type LogRecord,
  type Sink,
} from "@logtape/logtape";

const { sendNotification } = useNotificationCenter();

/**
 * ログレベル別のフラグ設定
 */
interface LogLevelFlags {
  debug: boolean;
  info: boolean;
  warning: boolean;
  error: boolean;
}

/**
 * 環境変数からログレベル別フラグを取得
 */
function getLogLevelFlags(): LogLevelFlags {
  const parseFlag = (
    value: string | undefined,
    defaultValue: boolean,
  ): boolean => {
    if (value === undefined) return defaultValue;
    return value === "true";
  };

  // 本番環境のデフォルト: warning と error のみ
  // 開発環境のデフォルト: すべて有効
  const isProd = import.meta.env.PROD;

  return {
    debug: parseFlag(import.meta.env.VITE_LOG_DEBUG, !isProd),
    info: parseFlag(import.meta.env.VITE_LOG_INFO, !isProd),
    warning: parseFlag(import.meta.env.VITE_LOG_WARNING, true),
    error: parseFlag(import.meta.env.VITE_LOG_ERROR, true),
  };
}

/**
 * すべてのログが無効かどうかをチェック
 */
function isAllLogsDisabled(flags: LogLevelFlags): boolean {
  return !flags.debug && !flags.info && !flags.warning && !flags.error;
}

/**
 * コンソール警告文を表示するかどうかを取得
 * デフォルト: 本番環境では true、開発環境では false
 */
function shouldShowConsoleWarning(): boolean {
  const flag = import.meta.env.VITE_LOG_CONSOLE_WARNING;
  if (flag === undefined) {
    return import.meta.env.PROD;
  }
  return flag === "true";
}

/**
 * コンソールに警告メッセージを表示
 * Discord や Spotify のような警告スタイル
 */
function showProductionConsoleWarning() {
  if (!shouldShowConsoleWarning()) return;

  const warningStyle = [
    "color: #ff6b6b",
    "font-size: 32px",
    "font-weight: bold",
    "text-shadow: 1px 1px 2px rgba(0,0,0,0.3)",
  ].join(";");

  const cautionStyle = [
    "color: #ffa502",
    "font-size: 16px",
    "font-weight: bold",
  ].join(";");

  const textStyle = ["color: #fbff00ff", "font-size: 14px"].join(";");

  console.log("%c⚠️ ちょっと待って！", warningStyle);
  console.log("%cこれは開発者向けのブラウザ機能です。", cautionStyle);
  console.log(
    "%c誰かに「ここに何かをコピー＆ペーストして」と言われた場合、\nそれは詐欺行為の可能性があります。\n\nコードを貼り付けると、悪意のある第三者にあなたの\nアカウントへのアクセス権を与えてしまうおそれがあります。\n\nもしあなたが開発者でないなら、このウィンドウを閉じてください。",
    textStyle,
  );
}

/**
 * レベル別フィルタリング付きのコンソールシンクを作成
 */
function createFilteredConsoleSink(flags: LogLevelFlags): Sink {
  const baseSink = getConsoleSink();

  return (record: LogRecord) => {
    // fatalは常に出力
    if (record.level === "fatal") {
      baseSink(record);
      return;
    }

    // レベル別にフィルタリング
    const levelMap: Record<LogLevel, keyof LogLevelFlags | null> = {
      trace: "debug", // traceはdebugとして扱う
      debug: "debug",
      info: "info",
      warning: "warning",
      error: "error",
      fatal: null, // 上で処理済み
    };

    const flagKey = levelMap[record.level];
    if (flagKey && flags[flagKey]) {
      baseSink(record);
    }
  };
}

/**
 * Custom sink that sends error logs to the notification center (Toast).
 */
function notificationSink(record: LogRecord) {
  if (record.level === "error" || record.level === "fatal") {
    // Format the message for the toast
    let message = "";
    if (typeof record.message === "string") {
      message = record.message;
    } else {
      // Handle template literal messages or other objects
      message = record.message.map(String).join("");
    }

    sendNotification("critical", `Error: ${message}`);
  }
}

/**
 * logtapeのメタロガーのログレベルを決定
 * メタロガーのINFOメッセージを抑制するため、通常は error 以上に設定
 */
function getMetaLogLevel(flags: LogLevelFlags): LogLevel {
  // debug/info が有効な場合のみ warning を表示、それ以外は error 以上のみ
  if (flags.debug || flags.info) {
    return "warning";
  }
  return "error";
}

export async function initLogger() {
  // 本番環境でコンソール警告を表示
  showProductionConsoleWarning();

  const flags = getLogLevelFlags();
  const metaLogLevel = getMetaLogLevel(flags);

  // すべてのログが無効の場合はコンソール出力を完全に無効化
  if (isAllLogsDisabled(flags)) {
    await configure({
      // 既存の設定をリセット（HMRや自動設定対策）
      reset: true,
      sinks: {
        notification: notificationSink,
      },
      loggers: [
        // 通知シンクのみ（エラー通知は継続）
        { category: "app", sinks: ["notification"] },
        { category: ["logtape", "meta"], sinks: [], lowestLevel: "fatal" },
      ],
    });
    return;
  }

  await configure({
    // 既存の設定をリセット（HMRや自動設定対策）
    reset: true,
    sinks: {
      console: createFilteredConsoleSink(flags),
      notification: notificationSink,
    },
    loggers: [
      // debugレベルから受け取り、シンク側でフィルタリング
      {
        category: "app",
        sinks: ["console", "notification"],
        lowestLevel: "debug",
      },
      // メタロガーはフラグに応じて設定
      {
        category: ["logtape", "meta"],
        sinks: ["console"],
        lowestLevel: metaLogLevel,
      },
    ],
  });
}

/**
 * 現在のログレベル設定をエクスポート（他のモジュールで使用可能）
 */
export { getLogLevelFlags, type LogLevelFlags };

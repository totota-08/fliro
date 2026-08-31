/**
 * 日付・時刻の共通ユーティリティ
 * Firestore Timestamp / Date / ミリ秒数値が混在する値を一律に扱う。
 */

/** Firestore Timestamp・Date・数値をミリ秒に正規化する。解決できない場合は null */
export function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  const v = value as { toMillis?: () => number; seconds?: number };
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  return null;
}

/** ja-JP ロケールの日付文字列。解決できない場合は "—" */
export function formatDateJa(value: unknown): string {
  const ms = toMillis(value);
  if (ms === null) return "—";
  return new Date(ms).toLocaleDateString("ja-JP");
}

/** HH:MM 形式の時刻文字列。解決できない場合は空文字 */
export function formatTimeShort(value: unknown): string {
  const ms = toMillis(value);
  if (ms === null) return "";
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

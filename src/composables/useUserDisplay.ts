import { db } from "@/lib/firebase";
import type { ProjectMember } from "@/services/projectMembers";
import { getLogger } from "@logtape/logtape";
import { doc, getDoc } from "firebase/firestore";
import { reactive, type Ref } from "vue";

const logger = getLogger("app.composables.useUserDisplay");

// バックグラウンド取得の完了時に表示へ反映されるよう、リアクティブな Map にする
const nameCache = reactive(new Map<string, string>());
const fetching = new Set<string>();

/**
 * ユーザーIDから短縮表示名を生成
 * 例: "abc123def456" → "ユーザー#6"
 */
function formatUserIdFallback(userId: string): string {
  if (!userId) return "不明なユーザー";
  // 最後の1文字を使用して短い識別子を作成
  const suffix = userId.slice(-1);
  return `ユーザー#${suffix}`;
}

async function fetchProfileName(userId: string): Promise<string | null> {
  if (!userId || fetching.has(userId)) return null;
  if (nameCache.has(userId)) return nameCache.get(userId) || null;

  fetching.add(userId);
  try {
    const snap = await getDoc(doc(db, "profiles", userId));
    if (snap.exists()) {
      const data = snap.data() as any;
      const name = data?.nickname || data?.fullName || data?.displayName;
      if (name) {
        nameCache.set(userId, name);
        return name;
      }
    }
    return null;
  } catch (error) {
    logger.warn`Failed to fetch profile for ${userId}: ${error}`;
    return null;
  } finally {
    fetching.delete(userId);
  }
}

export interface UseUserDisplayOptions {
  /** 名前が見つからない場合のフォールバック表示 */
  fallback?: "short-id" | "empty" | "unknown";
}

export function useUserDisplay(
  members?: Ref<ProjectMember[]>,
  options: UseUserDisplayOptions = {},
) {
  const { fallback = "short-id" } = options;

  /**
   * ユーザーIDから表示名を取得
   * - メンバー配列から検索
   * - キャッシュから取得
   * - Firestoreから非同期取得（バックグラウンド）
   * - 見つからない場合はフォールバック
   */
  function getDisplayName(userId?: string | null): string {
    if (!userId) {
      return fallback === "empty" ? "" : "不明なユーザー";
    }

    // キャッシュから取得
    if (nameCache.has(userId)) {
      return nameCache.get(userId) || getFallbackName(userId);
    }

    // メンバー配列から検索
    const member = members?.value?.find((m) => m.userId === userId);
    const memberName =
      member?.nickname || member?.fullName || member?.displayName;
    if (memberName) {
      nameCache.set(userId, memberName);
      return memberName;
    }

    // バックグラウンドでプロフィールを取得
    fetchProfileName(userId);

    // 取得中はフォールバックを返す
    return getFallbackName(userId);
  }

  function getFallbackName(userId: string): string {
    switch (fallback) {
      case "empty":
        return "";
      case "unknown":
        return "不明なユーザー";
      case "short-id":
      default:
        return formatUserIdFallback(userId);
    }
  }

  /**
   * 非同期でユーザー名を取得（確実に名前を取得したい場合）
   */
  async function getDisplayNameAsync(userId?: string | null): Promise<string> {
    if (!userId) {
      return fallback === "empty" ? "" : "不明なユーザー";
    }

    // キャッシュから取得
    if (nameCache.has(userId)) {
      return nameCache.get(userId) || getFallbackName(userId);
    }

    // メンバー配列から検索
    const member = members?.value?.find((m) => m.userId === userId);
    const memberName =
      member?.nickname || member?.fullName || member?.displayName;
    if (memberName) {
      nameCache.set(userId, memberName);
      return memberName;
    }

    // Firestoreから取得
    const name = await fetchProfileName(userId);
    return name || getFallbackName(userId);
  }

  return { getDisplayName, getDisplayNameAsync, formatUserIdFallback };
}

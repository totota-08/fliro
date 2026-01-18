/**
 * 招待コード検証 Cloud Function
 *
 * 招待コードの検証と使用処理を行う
 * - コード形式バリデーション（XXXX-XXXX-XXXX）
 * - ステータス・有効期限・使用回数チェック
 * - トランザクションでコード使用とユーザープロファイル更新
 */
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

admin.initializeApp();
const db = admin.firestore();

interface ValidateRequest {
  code: string;
}

interface ValidateResponse {
  success: boolean;
  error?: string;
  message?: string;
}

export const validateInviteCode = onCall<ValidateRequest>(
  {
    region: "asia-northeast1",
    cors: [
      "https://fliro.work",
      "https://fliro-cbai.vercel.app",
      "http://localhost:5173",
    ],
  },
  async (request): Promise<ValidateResponse> => {
    const { auth, data } = request;

    // 認証チェック
    if (!auth?.uid) {
      throw new HttpsError("unauthenticated", "ログインが必要です");
    }

    const { code } = data;

    // コード形式バリデーション（XXXX-XXXX-XXXX）
    const codePattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!code || !codePattern.test(code.toUpperCase())) {
      return {
        success: false,
        error: "invalid_format",
        message: "招待コードの形式が正しくありません",
      };
    }

    const normalizedCode = code.toUpperCase();

    try {
      // トランザクションで招待コード検証・使用処理
      const result = await db.runTransaction(async (transaction) => {
        // 招待コード取得
        const codeSnapshot = await transaction.get(
          db
            .collection("invitationCodes")
            .where("code", "==", normalizedCode)
            .limit(1),
        );

        if (codeSnapshot.empty) {
          return {
            success: false,
            error: "invalid_code",
            message: "無効な招待コードです",
          };
        }

        const codeDoc = codeSnapshot.docs[0];
        const codeData = codeDoc.data();

        // ステータスチェック
        if (codeData.status !== "active") {
          return {
            success: false,
            error: "invalid_code",
            message: "この招待コードは使用できません",
          };
        }

        // 有効期限チェック
        if (codeData.expiresAt && codeData.expiresAt.toDate() < new Date()) {
          return {
            success: false,
            error: "expired",
            message: "招待コードの有効期限が切れています",
          };
        }

        // 使用回数チェック
        if (
          codeData.maxUses !== null &&
          codeData.usedCount >= codeData.maxUses
        ) {
          return {
            success: false,
            error: "max_uses_reached",
            message: "招待コードの使用回数上限に達しています",
          };
        }

        // 既に使用済みかチェック
        if (codeData.usedBy?.includes(auth.uid)) {
          return {
            success: false,
            error: "already_used",
            message: "この招待コードは既に使用済みです",
          };
        }

        // 招待コード使用処理
        const newUsedCount = (codeData.usedCount || 0) + 1;
        const shouldMarkUsed =
          codeData.maxUses !== null && newUsedCount >= codeData.maxUses;

        transaction.update(codeDoc.ref, {
          usedCount: admin.firestore.FieldValue.increment(1),
          usedBy: admin.firestore.FieldValue.arrayUnion(auth.uid),
          ...(shouldMarkUsed ? { status: "used" } : {}),
        });

        // ユーザープロファイル更新
        const profileRef = db.collection("profiles").doc(auth.uid);
        transaction.set(
          profileRef,
          {
            betaAccess: true,
            betaCodeUsed: normalizedCode,
            betaAccessAt: new Date().toISOString(),
          },
          { merge: true },
        );

        return { success: true };
      });

      return result;
    } catch (error) {
      console.error("validateInviteCode error:", error);
      return {
        success: false,
        error: "server_error",
        message: "サーバーエラーが発生しました",
      };
    }
  },
);

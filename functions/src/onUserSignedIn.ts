/**
 * ユーザーサインイン時トリガー Cloud Function
 *
 * 注意: 自動プロファイル作成は無効化されています。
 * プロファイルはクライアント側の登録フロー（SignUp）でのみ作成されます。
 * これにより、未登録のSNSアカウントでログインしようとした場合、
 * エラーページにリダイレクトされます。
 */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2";

// firebase-admin の初期化（複数回呼ばれても安全）
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Firebase Auth でユーザーがサインインする直前にトリガーされる
 * 現在は何もしない（自動プロファイル作成は無効化）
 */
export const onUserSignedIn = functions.identity.beforeUserSignedIn(
  {
    region: "asia-northeast1",
  },
  async (event) => {
    const user = event.data;

    // 自動プロファイル作成は無効化
    // ログイン時にプロファイルを作成しないことで、
    // 未登録ユーザーがログインしようとした場合はエラーになる
    console.log(
      `Sign-in attempt for user ${user.uid} - auto profile creation disabled`,
    );

    return;
  },
);

/**
 * ユーザーサインイン時トリガー Cloud Function
 *
 * Firebase Auth でユーザーがサインインする直前に実行され、
 * プロファイルが存在しない場合は自動的に作成する
 *
 * beforeUserSignedIn を使用することで：
 * - ユーザーは既に Firebase Auth に存在している
 * - サインイントークンが発行される前にプロファイルを作成できる
 * - クライアントがトークンを受け取る時点でプロファイルが存在する
 *
 * これにより、クライアント側の認証トークン伝播遅延問題を完全に回避できる
 */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2";

// firebase-admin の初期化（複数回呼ばれても安全）
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Firebase Auth でユーザーがサインインする直前にトリガーされる
 * プロファイルが存在しない場合は Firestore に作成する
 */
export const onUserSignedIn = functions.identity.beforeUserSignedIn(
  {
    region: "asia-northeast1",
  },
  async (event) => {
    const user = event.data;

    if (!user.uid) {
      console.error("User UID is missing");
      return;
    }

    try {
      const profileRef = db.collection("profiles").doc(user.uid);
      const existingProfile = await profileRef.get();

      // 既存のプロファイルがある場合はスキップ
      if (existingProfile.exists) {
        console.log(`Profile already exists for user ${user.uid}`);
        return;
      }

      const now = new Date().toISOString();

      // 基本的なプロファイルを作成
      // setUp: false なので、ユーザーはサインアップページでプロファイル設定を完了する必要がある
      const profile = {
        uid: user.uid,
        email: user.email ?? "",
        emailLower: (user.email ?? "").toLowerCase(),
        fullName: user.displayName ?? "",
        nickname: user.displayName ?? "",
        birthday: "",
        avatarUrl: user.photoURL ?? "",
        jobRole: "",
        jobTitle: "",
        createdAt: now,
        updatedAt: now,
        setUp: false, // プロファイル設定未完了
        hasUsedInviteCode: false,
        hideAvatarInProjects: false,
        // betaAccess, betaCodeUsed, betaAccessAt はCloud Functionsのみで設定可能
      };

      await profileRef.set(profile);
      console.log(`Profile created for user ${user.uid} (new user sign-in)`);
    } catch (error) {
      console.error(`Failed to create profile for user ${user.uid}:`, error);
      // プロファイル作成に失敗してもサインインは続行
      // クライアント側でフォールバック処理される
    }

    // サインインを続行
    return;
  },
);

import { before, after, afterEach, describe, it } from "node:test";
import assert from "node:assert";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import fs from "node:fs";

let testEnv;
let app;
let auth;
let db;

const TEST_EMAIL = "test@example.com";
const TEST_PASSWORD = "password123";

/**
 * persistProfile のロジックを再現（authService.ts と同じロジック）
 * SNS認証後のプロフィール永続化をシミュレート
 */
async function persistProfileLogic(adminDb, user, overrides = {}) {
  const profileRef = doc(adminDb, "profiles", user.uid);
  const snapshot = await getDoc(profileRef);
  const existing = snapshot.exists() ? snapshot.data() : null;

  const now = new Date().toISOString();
  const profile = {
    uid: user.uid,
    email: user.email ?? overrides.email ?? existing?.email ?? "",
    emailLower: (
      user.email ??
      overrides.email ??
      existing?.email ??
      ""
    ).toLowerCase(),
    fullName:
      overrides.fullName ?? existing?.fullName ?? user.displayName ?? "",
    nickname:
      overrides.nickname ?? existing?.nickname ?? user.displayName ?? "",
    birthday: overrides.birthday ?? existing?.birthday ?? "",
    avatarUrl:
      overrides.avatarUrl ?? existing?.avatarUrl ?? user.photoURL ?? "",
    jobRole: overrides.jobRole ?? existing?.jobRole ?? "",
    jobTitle: overrides.jobTitle ?? existing?.jobTitle ?? "",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    setUp: overrides.setUp ?? existing?.setUp ?? false,
    hasUsedInviteCode:
      overrides.hasUsedInviteCode ?? existing?.hasUsedInviteCode ?? false,
    // ベータアクセス関連フィールドを既存データから引き継ぐ
    betaAccess: overrides.betaAccess ?? existing?.betaAccess,
    betaCodeUsed: overrides.betaCodeUsed ?? existing?.betaCodeUsed,
    betaAccessAt: overrides.betaAccessAt ?? existing?.betaAccessAt,
    // プロジェクト内でのアバター表示設定
    hideAvatarInProjects:
      overrides.hideAvatarInProjects ?? existing?.hideAvatarInProjects ?? false,
  };

  // undefinedフィールドを削除
  Object.keys(profile).forEach((key) => {
    if (profile[key] === undefined) {
      delete profile[key];
    }
  });

  await setDoc(profileRef, profile, { merge: true });
  return profile;
}

/**
 * checksetUp のロジックを再現（LoginPage.vue と同じロジック）
 * ログイン後のセットアップ状態チェック
 */
async function checksetUpLogic(adminDb, userId) {
  const profileRef = doc(adminDb, "profiles", userId);
  const snapshot = await getDoc(profileRef);

  if (!snapshot.exists()) {
    return { needsSetup: true, profile: null };
  }

  const profile = snapshot.data();
  return {
    needsSetup: profile.setUp === false,
    profile,
  };
}

describe("認証フロー テスト", () => {
  before(async () => {
    // Firestore Rules テスト環境を初期化
    testEnv = await initializeTestEnvironment({
      projectId: "test-project",
      firestore: {
        rules: fs.readFileSync("firestore.rules", "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });

    // Firebase App を初期化（Auth用）
    app = initializeApp(
      {
        apiKey: "fake-api-key",
        projectId: "test-project",
      },
      "auth-test-app"
    );

    auth = getAuth(app);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });

    db = getFirestore(app);
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  });

  afterEach(async () => {
    // テスト後にサインアウト
    if (auth.currentUser) {
      await signOut(auth);
    }
    // Firestoreをクリア
    await testEnv.clearFirestore();
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
    if (app) {
      await deleteApp(app);
    }
  });

  describe("Email/Password 認証", () => {
    it("新規ユーザーを作成できる", async () => {
      const credential = await createUserWithEmailAndPassword(
        auth,
        TEST_EMAIL,
        TEST_PASSWORD
      );

      assert.ok(credential.user, "ユーザーが作成されるべき");
      assert.strictEqual(
        credential.user.email,
        TEST_EMAIL,
        "メールアドレスが一致するべき"
      );
      assert.ok(credential.user.uid, "UIDが生成されるべき");
    });

    it("作成したユーザーでログインできる", async () => {
      // まずユーザーを作成
      await createUserWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
      await signOut(auth);

      // ログイン
      const credential = await signInWithEmailAndPassword(
        auth,
        TEST_EMAIL,
        TEST_PASSWORD
      );

      assert.ok(credential.user, "ログインに成功するべき");
      assert.strictEqual(credential.user.email, TEST_EMAIL);
    });

    it("間違ったパスワードでログインできない", async () => {
      // まずユーザーを作成
      await createUserWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
      await signOut(auth);

      // 間違ったパスワードでログイン
      await assert.rejects(
        signInWithEmailAndPassword(auth, TEST_EMAIL, "wrongpassword"),
        (error) => {
          return error.code === "auth/invalid-credential";
        },
        "間違ったパスワードでは認証エラーになるべき"
      );
    });

    it("存在しないユーザーでログインできない", async () => {
      await assert.rejects(
        signInWithEmailAndPassword(auth, "nonexistent@example.com", "password"),
        (error) => {
          return error.code === "auth/invalid-credential";
        },
        "存在しないユーザーでは認証エラーになるべき"
      );
    });
  });

  describe("プロフィール設定フロー", () => {
    it("新規ユーザーのプロフィールはsetUp=falseで作成される", async () => {
      // ユーザーを作成
      const credential = await createUserWithEmailAndPassword(
        auth,
        TEST_EMAIL,
        TEST_PASSWORD
      );

      const user = credential.user;

      // persistProfile と同様のロジックでプロフィールを作成
      const now = new Date().toISOString();
      const profile = {
        uid: user.uid,
        email: user.email || "",
        emailLower: (user.email || "").toLowerCase(),
        fullName: user.displayName || "",
        nickname: user.displayName || "",
        birthday: "",
        avatarUrl: user.photoURL || "",
        jobRole: "",
        jobTitle: "",
        createdAt: now,
        updatedAt: now,
        setUp: false, // 新規ユーザーは setUp: false
        hasUsedInviteCode: false,
        hideAvatarInProjects: false,
      };

      // Firestore にプロフィールを保存（Admin SDK経由でエミュレータに直接書き込み）
      const adminDb = testEnv
        .authenticatedContext(user.uid)
        .firestore();
      await setDoc(doc(adminDb, "profiles", user.uid), profile);

      // プロフィールを取得して確認
      const savedProfile = await getDoc(doc(adminDb, "profiles", user.uid));
      assert.ok(savedProfile.exists(), "プロフィールが保存されるべき");
      assert.strictEqual(
        savedProfile.data().setUp,
        false,
        "setUp は false であるべき"
      );
      assert.strictEqual(
        savedProfile.data().email,
        TEST_EMAIL,
        "メールアドレスが一致するべき"
      );
    });

    it("プロフィール設定完了後、setUp=trueになる", async () => {
      // ユーザーを作成
      const credential = await createUserWithEmailAndPassword(
        auth,
        TEST_EMAIL,
        TEST_PASSWORD
      );

      const user = credential.user;
      const adminDb = testEnv
        .authenticatedContext(user.uid)
        .firestore();

      // 初期プロフィールを作成（setUp: false）
      const now = new Date().toISOString();
      await setDoc(doc(adminDb, "profiles", user.uid), {
        uid: user.uid,
        email: user.email || "",
        emailLower: (user.email || "").toLowerCase(),
        fullName: "",
        nickname: "",
        birthday: "",
        avatarUrl: "",
        jobRole: "",
        jobTitle: "",
        createdAt: now,
        updatedAt: now,
        setUp: false,
        hasUsedInviteCode: false,
        hideAvatarInProjects: false,
      });

      // プロフィール設定を完了（saveProfileDetails と同様のロジック）
      const updatedNow = new Date().toISOString();
      await setDoc(
        doc(adminDb, "profiles", user.uid),
        {
          fullName: "テスト ユーザー",
          nickname: "テスト",
          birthday: "1990-01-01",
          jobRole: "engineer",
          jobTitle: "ソフトウェアエンジニア",
          setUp: true, // 設定完了
          updatedAt: updatedNow,
        },
        { merge: true }
      );

      // プロフィールを取得して確認
      const savedProfile = await getDoc(doc(adminDb, "profiles", user.uid));
      assert.ok(savedProfile.exists(), "プロフィールが存在するべき");
      assert.strictEqual(
        savedProfile.data().setUp,
        true,
        "setUp は true であるべき"
      );
      assert.strictEqual(
        savedProfile.data().fullName,
        "テスト ユーザー",
        "本名が設定されるべき"
      );
      assert.strictEqual(
        savedProfile.data().jobRole,
        "engineer",
        "職業が設定されるべき"
      );
    });

    it("既存プロフィールはマージ更新される", async () => {
      const credential = await createUserWithEmailAndPassword(
        auth,
        TEST_EMAIL,
        TEST_PASSWORD
      );

      const user = credential.user;
      const adminDb = testEnv
        .authenticatedContext(user.uid)
        .firestore();

      // 初期プロフィールを作成
      const now = new Date().toISOString();
      await setDoc(doc(adminDb, "profiles", user.uid), {
        uid: user.uid,
        email: user.email || "",
        emailLower: (user.email || "").toLowerCase(),
        fullName: "初期名前",
        nickname: "初期ニックネーム",
        birthday: "1990-01-01",
        avatarUrl: "https://example.com/avatar.png",
        jobRole: "engineer",
        jobTitle: "",
        createdAt: now,
        updatedAt: now,
        setUp: true,
        hasUsedInviteCode: false,
        hideAvatarInProjects: false,
        betaAccess: true, // ベータアクセスフラグ
      });

      // 部分更新（ニックネームのみ）
      await setDoc(
        doc(adminDb, "profiles", user.uid),
        {
          nickname: "新しいニックネーム",
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // プロフィールを取得して確認
      const savedProfile = await getDoc(doc(adminDb, "profiles", user.uid));
      assert.strictEqual(
        savedProfile.data().nickname,
        "新しいニックネーム",
        "ニックネームが更新されるべき"
      );
      assert.strictEqual(
        savedProfile.data().fullName,
        "初期名前",
        "本名は維持されるべき"
      );
      assert.strictEqual(
        savedProfile.data().betaAccess,
        true,
        "ベータアクセスは維持されるべき"
      );
    });
  });

  describe("Firestore Rules - profiles", () => {
    it("ユーザーは自分のプロフィールを作成できる", async () => {
      const credential = await createUserWithEmailAndPassword(
        auth,
        TEST_EMAIL,
        TEST_PASSWORD
      );

      const user = credential.user;
      const userDb = testEnv.authenticatedContext(user.uid).firestore();

      const now = new Date().toISOString();
      const profile = {
        uid: user.uid,
        email: user.email || "",
        emailLower: (user.email || "").toLowerCase(),
        fullName: "テスト ユーザー",
        nickname: "テスト",
        birthday: "",
        avatarUrl: "",
        jobRole: "engineer",
        jobTitle: "",
        createdAt: now,
        updatedAt: now,
        setUp: true,
        hasUsedInviteCode: false,
        hideAvatarInProjects: false,
      };

      // 自分のプロフィールを作成できる
      await setDoc(doc(userDb, "profiles", user.uid), profile);

      const savedProfile = await getDoc(doc(userDb, "profiles", user.uid));
      assert.ok(savedProfile.exists(), "プロフィールが作成されるべき");
    });

    it("ユーザーは他人のプロフィールを作成できない", async () => {
      const credential = await createUserWithEmailAndPassword(
        auth,
        TEST_EMAIL,
        TEST_PASSWORD
      );

      const user = credential.user;
      const userDb = testEnv.authenticatedContext(user.uid).firestore();

      const now = new Date().toISOString();
      const otherProfile = {
        uid: "other-user-id",
        email: "other@example.com",
        emailLower: "other@example.com",
        fullName: "他人",
        nickname: "他人",
        birthday: "",
        avatarUrl: "",
        jobRole: "designer",
        jobTitle: "",
        createdAt: now,
        updatedAt: now,
        setUp: true,
        hasUsedInviteCode: false,
        hideAvatarInProjects: false,
      };

      // 他人のプロフィールは作成できない
      await assert.rejects(
        setDoc(doc(userDb, "profiles", "other-user-id"), otherProfile),
        (error) => {
          return error.code === "permission-denied";
        },
        "他人のプロフィール作成は拒否されるべき"
      );
    });

    it("ユーザーはベータアクセスフィールドを設定できない", async () => {
      const credential = await createUserWithEmailAndPassword(
        auth,
        TEST_EMAIL,
        TEST_PASSWORD
      );

      const user = credential.user;
      const userDb = testEnv.authenticatedContext(user.uid).firestore();

      const now = new Date().toISOString();
      const profileWithBeta = {
        uid: user.uid,
        email: user.email || "",
        emailLower: (user.email || "").toLowerCase(),
        fullName: "テスト ユーザー",
        nickname: "テスト",
        birthday: "",
        avatarUrl: "",
        jobRole: "engineer",
        jobTitle: "",
        createdAt: now,
        updatedAt: now,
        setUp: true,
        hasUsedInviteCode: false,
        hideAvatarInProjects: false,
        betaAccess: true, // ベータアクセスを設定しようとする
      };

      // ベータアクセスフィールドを含むプロフィールは作成できない
      await assert.rejects(
        setDoc(doc(userDb, "profiles", user.uid), profileWithBeta),
        (error) => {
          return error.code === "permission-denied";
        },
        "ベータアクセスフィールドを含む作成は拒否されるべき"
      );
    });
  });

  describe("パスワード要件", () => {
    it("8文字未満のパスワードは拒否される", async () => {
      await assert.rejects(
        createUserWithEmailAndPassword(auth, TEST_EMAIL, "short"),
        (error) => {
          return error.code === "auth/weak-password";
        },
        "短いパスワードは拒否されるべき"
      );
    });

    it("8文字以上のパスワードは受け入れられる", async () => {
      const credential = await createUserWithEmailAndPassword(
        auth,
        TEST_EMAIL,
        "password123" // 11文字
      );
      assert.ok(credential.user, "8文字以上のパスワードは受け入れられるべき");
    });
  });

  describe("SNS認証フロー（シミュレーション）", () => {
    it("新規SNSユーザーのログイン → プロフィール作成 → setUp=false になる", async () => {
      // SNS認証を Email/Password でシミュレート（Emulatorの制限）
      const credential = await createUserWithEmailAndPassword(
        auth,
        "sns-user@example.com",
        TEST_PASSWORD
      );

      const user = credential.user;

      // SNSログインからの情報を模倣（displayName, photoURL がある）
      await updateProfile(user, {
        displayName: "Google User",
        photoURL: "https://example.com/google-avatar.png",
      });

      // Auth ユーザー情報を再取得
      const updatedUser = {
        uid: user.uid,
        email: user.email,
        displayName: "Google User",
        photoURL: "https://example.com/google-avatar.png",
      };

      // loginWithProvider → persistProfile のフローをシミュレート
      const adminDb = testEnv.authenticatedContext(user.uid).firestore();
      const profile = await persistProfileLogic(adminDb, updatedUser);

      // 検証
      assert.strictEqual(
        profile.setUp,
        false,
        "新規ユーザーは setUp=false であるべき"
      );
      assert.strictEqual(
        profile.fullName,
        "Google User",
        "displayName が fullName にコピーされるべき"
      );
      assert.strictEqual(
        profile.nickname,
        "Google User",
        "displayName が nickname にコピーされるべき"
      );
      assert.strictEqual(
        profile.avatarUrl,
        "https://example.com/google-avatar.png",
        "photoURL が avatarUrl にコピーされるべき"
      );
      assert.strictEqual(
        profile.email,
        "sns-user@example.com",
        "メールアドレスが保存されるべき"
      );
    });

    it("SNS認証後、checksetUp で setUp=false の場合はプロフィール設定画面へ遷移すべき", async () => {
      const credential = await createUserWithEmailAndPassword(
        auth,
        "sns-user2@example.com",
        TEST_PASSWORD
      );

      const user = credential.user;
      const adminDb = testEnv.authenticatedContext(user.uid).firestore();

      // SNSログイン後のプロフィール作成
      await persistProfileLogic(adminDb, {
        uid: user.uid,
        email: user.email,
        displayName: "GitHub User",
        photoURL: null,
      });

      // checksetUp のロジックをテスト
      const result = await checksetUpLogic(adminDb, user.uid);

      assert.strictEqual(
        result.needsSetup,
        true,
        "setUp=false なのでセットアップが必要"
      );
      assert.strictEqual(
        result.profile.setUp,
        false,
        "プロフィールの setUp は false"
      );
    });

    it("プロフィール設定完了後、checksetUp で setUp=true の場合は通常画面へ遷移すべき", async () => {
      const credential = await createUserWithEmailAndPassword(
        auth,
        "sns-user3@example.com",
        TEST_PASSWORD
      );

      const user = credential.user;
      const adminDb = testEnv.authenticatedContext(user.uid).firestore();

      // 初回ログイン（プロフィール作成）
      await persistProfileLogic(adminDb, {
        uid: user.uid,
        email: user.email,
        displayName: "New User",
        photoURL: null,
      });

      // プロフィール設定完了（saveProfileDetails と同等）
      await persistProfileLogic(adminDb, user, {
        fullName: "設定済み ユーザー",
        nickname: "設定済み",
        birthday: "1990-01-01",
        jobRole: "engineer",
        jobTitle: "エンジニア",
        setUp: true, // 設定完了！
      });

      // checksetUp のロジックをテスト
      const result = await checksetUpLogic(adminDb, user.uid);

      assert.strictEqual(
        result.needsSetup,
        false,
        "setUp=true なのでセットアップ不要"
      );
      assert.strictEqual(
        result.profile.setUp,
        true,
        "プロフィールの setUp は true"
      );
      assert.strictEqual(
        result.profile.fullName,
        "設定済み ユーザー",
        "fullName が更新されているべき"
      );
    });

    it("既存ユーザーが再ログインしても setUp フラグは維持される", async () => {
      const credential = await createUserWithEmailAndPassword(
        auth,
        "returning-user@example.com",
        TEST_PASSWORD
      );

      const user = credential.user;
      const adminDb = testEnv.authenticatedContext(user.uid).firestore();

      // 初回ログイン & プロフィール設定完了
      await persistProfileLogic(adminDb, {
        uid: user.uid,
        email: user.email,
        displayName: "Returning User",
        photoURL: "https://example.com/avatar.png",
      });

      await persistProfileLogic(adminDb, user, {
        fullName: "既存 ユーザー",
        nickname: "既存",
        jobRole: "designer",
        setUp: true,
      });

      // 再ログイン（persistProfile が再度呼ばれる）
      // overrides なしで呼ばれた場合の挙動をテスト
      const profileAfterReLogin = await persistProfileLogic(adminDb, {
        uid: user.uid,
        email: user.email,
        displayName: "Returning User",
        photoURL: "https://example.com/avatar.png",
      });

      // 検証: 既存の setUp=true が維持されるべき
      assert.strictEqual(
        profileAfterReLogin.setUp,
        true,
        "再ログイン後も setUp=true が維持されるべき"
      );
      assert.strictEqual(
        profileAfterReLogin.fullName,
        "既存 ユーザー",
        "既存の fullName が維持されるべき"
      );
      assert.strictEqual(
        profileAfterReLogin.jobRole,
        "designer",
        "既存の jobRole が維持されるべき"
      );
    });

    it("displayName がない場合、空文字が設定される", async () => {
      const credential = await createUserWithEmailAndPassword(
        auth,
        "no-displayname@example.com",
        TEST_PASSWORD
      );

      const user = credential.user;
      const adminDb = testEnv.authenticatedContext(user.uid).firestore();

      // displayName なしでログイン
      const profile = await persistProfileLogic(adminDb, {
        uid: user.uid,
        email: user.email,
        displayName: null, // SNS認証でも displayName がない場合がある
        photoURL: null,
      });

      assert.strictEqual(
        profile.fullName,
        "",
        "displayName がない場合は空文字"
      );
      assert.strictEqual(
        profile.nickname,
        "",
        "displayName がない場合は空文字"
      );
      assert.strictEqual(profile.setUp, false, "setUp は false");
    });
  });

  describe("Email/Password 登録フロー", () => {
    it("メール登録 → メール認証 → プロフィール設定 の完全フロー", async () => {
      // Step 1: registerCredentials（メール登録）
      const credential = await createUserWithEmailAndPassword(
        auth,
        "newuser@example.com",
        TEST_PASSWORD
      );

      const user = credential.user;
      assert.ok(user, "ユーザーが作成されるべき");
      assert.strictEqual(
        user.emailVerified,
        false,
        "初期状態ではメール未認証"
      );

      const adminDb = testEnv.authenticatedContext(user.uid).firestore();

      // Step 2: メール認証完了（Emulatorでは自動認証をシミュレート）
      // 実際のアプリではメールリンクをクリックして認証

      // Step 3: プロフィール設定（saveProfileDetails）
      await persistProfileLogic(adminDb, user, {
        fullName: "新規 ユーザー",
        nickname: "新規",
        birthday: "1995-05-15",
        jobRole: "product",
        jobTitle: "PM",
        setUp: true,
      });

      // 最終確認
      const result = await checksetUpLogic(adminDb, user.uid);
      assert.strictEqual(result.needsSetup, false, "セットアップ完了済み");
      assert.strictEqual(
        result.profile.fullName,
        "新規 ユーザー",
        "本名が設定されている"
      );
    });
  });

  describe("エッジケース", () => {
    it("プロフィールが存在しない場合、checksetUp は needsSetup=true を返す", async () => {
      const credential = await createUserWithEmailAndPassword(
        auth,
        "no-profile@example.com",
        TEST_PASSWORD
      );

      const user = credential.user;
      const adminDb = testEnv.authenticatedContext(user.uid).firestore();

      // プロフィールを作成せずに checksetUp を呼ぶ
      const result = await checksetUpLogic(adminDb, user.uid);

      assert.strictEqual(
        result.needsSetup,
        true,
        "プロフィールがない場合はセットアップ必要"
      );
      assert.strictEqual(result.profile, null, "プロフィールは null");
    });

    it("同じメールアドレスで重複登録できない", async () => {
      // 最初のユーザーを作成
      await createUserWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);

      // 同じメールで再登録を試みる
      await assert.rejects(
        createUserWithEmailAndPassword(auth, TEST_EMAIL, "differentpassword"),
        (error) => {
          return error.code === "auth/email-already-in-use";
        },
        "重複メールアドレスは拒否されるべき"
      );
    });

    it("無効なメールアドレス形式は拒否される", async () => {
      await assert.rejects(
        createUserWithEmailAndPassword(auth, "invalid-email", TEST_PASSWORD),
        (error) => {
          return error.code === "auth/invalid-email";
        },
        "無効なメールアドレスは拒否されるべき"
      );
    });
  });
});

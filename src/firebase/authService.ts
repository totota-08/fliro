import { getActionCodeSettings } from "@/config/appConfig";
import {
  auth,
  db,
  githubProvider,
  googleProvider,
  storage,
} from "@/lib/firebase";
import { getCurrentUser } from "@/lib/getCurrentUser";
import type {
  CredentialSignUpPayload,
  LinkedProvider,
  LoginPayload,
  ProfileSetupPayload,
  SocialProvider,
  UserProfile,
} from "@/types/auth";
import {
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  linkWithPopup,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  reauthenticateWithCredential,
  RecaptchaVerifier,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  TotpMultiFactorGenerator,
  TotpSecret,
  unlink,
  updateProfile,
  type AuthProvider,
  type MultiFactorResolver,
  type MultiFactorSession,
  type User,
  type UserInfo,
} from "firebase/auth";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

const providerMap: Record<SocialProvider, AuthProvider> = {
  google: googleProvider,
  github: githubProvider,
};

export async function registerCredentials(payload: CredentialSignUpPayload) {
  const credential = await createUserWithEmailAndPassword(
    auth,
    payload.email,
    payload.password,
  );
  // メール認証後のリダイレクト先を設定
  const actionCodeSettings = getActionCodeSettings("/auth/verify");
  await sendEmailVerification(credential.user, actionCodeSettings);
  return credential.user;
}

export async function resendVerificationEmail() {
  const user = await requireCurrentUser();
  // メール認証後のリダイレクト先を設定
  const actionCodeSettings = getActionCodeSettings("/auth/verify");
  await sendEmailVerification(user, actionCodeSettings);
}

export async function refreshCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  await reload(user);
  return user;
}

export async function sendPasswordReset(email: string) {
  // パスワードリセット後のリダイレクト先を設定
  const actionCodeSettings = getActionCodeSettings("/auth/reset/confirm");
  await sendPasswordResetEmail(auth, email, actionCodeSettings);
}

export async function applyEmailVerificationCode(oobCode: string) {
  await applyActionCode(auth, oobCode);
  await refreshCurrentUser();
}

export async function confirmPasswordResetWithCode(
  oobCode: string,
  newPassword: string,
) {
  await confirmPasswordReset(auth, oobCode, newPassword);
}

export async function saveProfileDetails(payload: ProfileSetupPayload) {
  const user = await requireCurrentUser();

  const displayName = payload.nickname?.trim() || payload.fullName;
  await updateProfile(user, { displayName });

  return persistProfile(user, {
    fullName: payload.fullName,
    nickname: payload.nickname,
    birthday: payload.birthday ?? "",
    jobRole: payload.jobRole,
    jobTitle: payload.jobTitle ?? "",
    setUp: true,
  });
}

export async function loginWithEmail(payload: LoginPayload) {
  const credential = await signInWithEmailAndPassword(
    auth,
    payload.email,
    payload.password,
  );
  // Cloud Functions (onUserSignedIn) がプロファイルを作成するため、
  // ここでは既存プロファイルの更新のみ行う
  return persistProfile(credential.user);
}

/**
 * ソーシャルプロバイダーでログイン（既存ユーザーのみ）
 * プロファイルが存在しない場合は即座にサインアウトしてエラーをスロー
 */
export async function loginWithProvider(provider: SocialProvider) {
  const authProvider = providerMap[provider];
  const credential = await signInWithPopup(auth, authProvider);

  // プロファイルの存在を確認
  const existingProfile = await fetchProfile(credential.user.uid);

  if (!existingProfile) {
    // プロファイルが存在しない場合は即座にサインアウト
    await auth.signOut();
    const error = new Error("User not registered");
    (error as Error & { code: string }).code = "auth/user-not-found";
    throw error;
  }

  // 既存プロファイルの更新（プロバイダー情報の同期など）
  return persistProfile(credential.user);
}

/**
 * ソーシャルプロバイダーで新規登録
 * 既にプロファイルが存在する場合はエラーをスロー
 */
export async function registerWithProvider(provider: SocialProvider) {
  const authProvider = providerMap[provider];
  const credential = await signInWithPopup(auth, authProvider);

  // プロファイルの存在を確認
  const existingProfile = await fetchProfile(credential.user.uid);

  if (existingProfile) {
    // 既にプロファイルが存在する場合はエラー
    const error = new Error("User already registered");
    (error as Error & { code: string }).code =
      "auth/account-exists-with-different-credential";
    throw error;
  }

  // 新規プロファイルを作成
  return persistProfile(credential.user);
}

/**
 * ソーシャルログイン後のプロファイル永続化
 * Google Identity Services等で既にFirebase Authにログイン済みの場合に使用
 */
export async function persistProfileAfterSocialLogin(user: User) {
  return persistProfile(user);
}

export async function fetchProfile(uid: string) {
  const ref = doc(db, "profiles", uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as UserProfile;
}

export async function uploadAvatar(file: File) {
  const user = await requireCurrentUser();

  const fileRef = storageRef(storage, `avatars/${user.uid}/${Date.now()}`);
  await uploadBytes(fileRef, file, { contentType: file.type });
  const url = await getDownloadURL(fileRef);

  await updateProfile(user, { photoURL: url });
  return persistProfile(user, { avatarUrl: url });
}

export async function deleteCurrentAccount() {
  const user = await requireCurrentUser();

  await deleteDoc(doc(db, "profiles", user.uid));
  await deleteUser(user);
}

export async function deleteAccountWithPassword(password: string) {
  const user = await requireCurrentUser();

  if (!user.email) {
    throw new Error("メールアドレスが設定されていません。");
  }

  // Re-authenticate before deletion
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);

  await deleteDoc(doc(db, "profiles", user.uid));
  await deleteUser(user);
}

export async function updateUserProfile(payload: {
  nickname?: string;
  fullName?: string;
  hideAvatarInProjects?: boolean;
}) {
  const user = await requireCurrentUser();

  const displayName = payload.nickname?.trim() || payload.fullName;
  if (displayName) {
    await updateProfile(user, { displayName });
  }

  return persistProfile(user, {
    nickname: payload.nickname,
    fullName: payload.fullName,
    hideAvatarInProjects: payload.hideAvatarInProjects,
  });
}

async function persistProfile(
  user: User,
  overrides: Partial<UserProfile> = {},
) {
  const ref = doc(db, "profiles", user.uid);
  const snapshot = await getDoc(ref);
  const existing = snapshot.exists() ? (snapshot.data() as UserProfile) : null;

  const now = new Date().toISOString();
  const profile: UserProfile = {
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

  await setDoc(ref, profile, { merge: true });
  return profile;
}

/**
 * 招待コード使用済みフラグをtrueに更新する
 */
export async function markInviteCodeAsUsed() {
  const user = await requireCurrentUser();
  return persistProfile(user, { hasUsedInviteCode: true });
}

async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("ユーザーが認証されていません。");
  }

  return user;
}

/**
 * MFA（多要素認証）関連の関数
 */

/**
 * MFAの登録状態を取得
 */
export async function getMFAEnrollmentStatus() {
  const user = await requireCurrentUser();
  const mfaUser = multiFactor(user);
  return {
    enrolled: mfaUser.enrolledFactors.length > 0,
    factors: mfaUser.enrolledFactors.map((factor) => ({
      uid: factor.uid,
      displayName: factor.displayName ?? null,
      factorId: factor.factorId,
      enrollmentTime: factor.enrollmentTime,
    })),
  };
}

/**
 * TOTP（Time-based One-Time Password）用のシークレットを生成
 * Google Authenticatorなどのアプリで使用
 */
export async function generateTOTPSecret(
  session: MultiFactorSession,
): Promise<TotpSecret> {
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  return secret;
}

/**
 * TOTPを使用してMFAを登録
 */
export async function enrollTOTP(
  secret: TotpSecret,
  verificationCode: string,
  displayName: string,
) {
  const user = await requireCurrentUser();
  const mfaUser = multiFactor(user);

  const multiFactorAssertion = TotpMultiFactorGenerator.assertionForEnrollment(
    secret,
    verificationCode,
  );

  await mfaUser.enroll(multiFactorAssertion, displayName);
}

/**
 * MFAセッションを開始（登録用）
 */
export async function startMFAEnrollment(): Promise<MultiFactorSession> {
  const user = await requireCurrentUser();
  const mfaUser = multiFactor(user);
  return mfaUser.getSession();
}

/**
 * 電話番号を使用したMFA登録を開始
 */
export async function enrollPhoneMFA(
  phoneNumber: string,
  recaptchaVerifier: RecaptchaVerifier,
) {
  const user = await requireCurrentUser();
  const mfaUser = multiFactor(user);
  const session = await mfaUser.getSession();

  const phoneAuthProvider = new PhoneAuthProvider(auth);
  const verificationId = await phoneAuthProvider.verifyPhoneNumber(
    { phoneNumber, session },
    recaptchaVerifier,
  );

  return verificationId;
}

/**
 * 電話番号MFAの登録を完了
 */
export async function completePhoneMFAEnrollment(
  verificationId: string,
  verificationCode: string,
  displayName: string,
) {
  const user = await requireCurrentUser();
  const mfaUser = multiFactor(user);

  const cred = PhoneAuthProvider.credential(verificationId, verificationCode);
  const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);

  await mfaUser.enroll(multiFactorAssertion, displayName);
}

/**
 * MFAの登録を解除
 */
export async function unenrollMFA(factorUid: string) {
  const user = await requireCurrentUser();
  const mfaUser = multiFactor(user);

  const factor = mfaUser.enrolledFactors.find((f) => f.uid === factorUid);
  if (!factor) {
    throw new Error("指定されたMFAファクターが見つかりません。");
  }

  await mfaUser.unenroll(factor);
}

/**
 * MFAサインイン時の検証コード送信
 */
export async function verifyMFACode(
  resolver: MultiFactorResolver,
  verificationCode: string,
  selectedIndex: number = 0,
) {
  const selectedHint = resolver.hints[selectedIndex];

  if (!selectedHint) {
    throw new Error("MFAヒントが見つかりません。");
  }

  if (selectedHint.factorId === PhoneMultiFactorGenerator.FACTOR_ID) {
    // 電話番号MFA
    // Note: 実際のサインインフローでは、recaptchaVerifierが必要
    throw new Error("電話番号MFAのサインインは現在サポートされていません。");
  } else if (selectedHint.factorId === TotpMultiFactorGenerator.FACTOR_ID) {
    // TOTP MFA
    const multiFactorAssertion = TotpMultiFactorGenerator.assertionForSignIn(
      selectedHint.uid,
      verificationCode,
    );
    return resolver.resolveSignIn(multiFactorAssertion);
  }

  throw new Error("サポートされていないMFAタイプです。");
}

/**
 * アカウント連携（Account Linking）関連の関数
 */

/**
 * 現在のユーザーに連携されているプロバイダー一覧を取得
 */
export async function getLinkedProviders(): Promise<LinkedProvider[]> {
  const user = await requireCurrentUser();

  return user.providerData.map((provider: UserInfo) => ({
    providerId: provider.providerId,
    displayName: provider.displayName,
    email: provider.email,
    photoURL: provider.photoURL,
    uid: provider.uid,
  }));
}

/**
 * 現在のアカウントに新しいプロバイダーを連携
 * @param provider - 連携するプロバイダー（"google" | "github"）
 * @throws auth/credential-already-in-use - 別アカウントで既に使用中
 * @throws auth/provider-already-linked - 既に連携済み
 */
export async function linkProvider(
  provider: SocialProvider,
): Promise<LinkedProvider[]> {
  const user = await requireCurrentUser();
  const authProvider = providerMap[provider];

  const result = await linkWithPopup(user, authProvider);
  return result.user.providerData.map((p: UserInfo) => ({
    providerId: p.providerId,
    displayName: p.displayName,
    email: p.email,
    photoURL: p.photoURL,
    uid: p.uid,
  }));
}

/**
 * プロバイダーの連携を解除
 * @param providerId - 解除するプロバイダーID（例: "google.com", "github.com"）
 * @throws Error - 最後の認証方法を解除しようとした場合
 */
export async function unlinkProvider(
  providerId: string,
): Promise<LinkedProvider[]> {
  const user = await requireCurrentUser();

  // 最低1つの認証方法が残るかチェック
  if (user.providerData.length <= 1) {
    throw new Error("最低1つの認証方法が必要です。");
  }

  // パスワード認証のみ残っている状態でメールが設定されていない場合を防ぐ
  const remainingProviders = user.providerData.filter(
    (p) => p.providerId !== providerId,
  );

  if (
    remainingProviders.length === 1 &&
    remainingProviders[0]?.providerId === "password" &&
    !user.email
  ) {
    throw new Error(
      "メールアドレスが設定されていないため、連携を解除できません。",
    );
  }

  const result = await unlink(user, providerId);
  return result.providerData.map((p: UserInfo) => ({
    providerId: p.providerId,
    displayName: p.displayName,
    email: p.email,
    photoURL: p.photoURL,
    uid: p.uid,
  }));
}

/**
 * 特定のプロバイダーが連携済みかチェック
 */
export function isProviderLinked(
  providerData: LinkedProvider[],
  providerId: string,
): boolean {
  return providerData.some((p) => p.providerId === providerId);
}

import { getActionCodeSettings } from "@/config/appConfig";
import { auth, db, githubProvider, googleProvider } from "@/lib/firebase";
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
  getMultiFactorResolver,
  linkWithPopup,
  multiFactor,
  PhoneMultiFactorGenerator,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  TotpMultiFactorGenerator,
  TotpSecret,
  unlink,
  updatePassword,
  updateProfile,
  type AuthProvider,
  type MultiFactorError,
  type MultiFactorResolver,
  type MultiFactorSession,
  type User,
  type UserInfo,
} from "firebase/auth";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.firebase.authService");

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
  logger.info`saveProfileDetails called with payload: ${JSON.stringify(payload)}`;

  const user = await requireCurrentUser();
  logger.info`saveProfileDetails user found: ${user.uid}`;

  const displayName = payload.nickname?.trim() || payload.fullName;
  await updateProfile(user, { displayName });
  logger.info`saveProfileDetails displayName updated to: ${displayName}`;

  const result = await persistProfile(user, {
    fullName: payload.fullName,
    nickname: payload.nickname,
    birthday: payload.birthday ?? "",
    jobRole: payload.jobRole,
    jobTitle: payload.jobTitle ?? "",
    setUp: true,
  });

  logger.info`saveProfileDetails completed, setUp=${result.setUp}`;
  return result;
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
  const { signInWithPopup } = await import("firebase/auth");
  const credential = await signInWithPopup(auth, authProvider);

  // プロファイルの存在を確認する。
  // 認証直後はトークンが Firestore に伝播しておらず一時的に取得失敗（null）に
  // なることがあるため、リトライしてから「未登録」と判定する。
  // 1回の失敗で判定すると、登録済みユーザーを誤ってサインアウトさせてしまう。
  let existingProfile = null;
  const retryDelays = [500, 1000, 2000];
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    existingProfile = await fetchProfile(credential.user.uid);
    if (existingProfile) break;
    if (attempt < retryDelays.length) {
      await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
    }
  }

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
  const { signInWithPopup } = await import("firebase/auth");
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

  try {
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data() as UserProfile;
  } catch (error) {
    // 認証直後のタイミングでトークンがFirestoreに伝播していない場合
    // パーミッションエラーが発生することがある
    logger.warn`Failed to fetch profile (auth token may not be synced yet): ${error}`;
    return null;
  }
}

export async function uploadAvatar(file: File) {
  const user = await requireCurrentUser();

  // storage SDK はアップロード時にのみ読み込む（エントリチャンク削減）
  const [{ getDownloadURL, ref: storageRef, uploadBytes }, { storage }] =
    await Promise.all([
      import("firebase/storage"),
      import("@/lib/firebaseStorage"),
    ]);
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
  logger.info`persistProfile called for user ${user.uid}`;
  logger.info`persistProfile overrides: ${JSON.stringify(overrides)}`;

  const ref = doc(db, "profiles", user.uid);
  let existing: UserProfile | null = null;

  // リトライ機構付きでプロファイルを読み取り
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const snapshot = await getDoc(ref);
      existing = snapshot.exists() ? (snapshot.data() as UserProfile) : null;
      break; // 成功したらループを抜ける
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      if (isLastAttempt) {
        // 最後の試行でも失敗した場合は新規ユーザーとして扱う
        logger.warn`Failed to read existing profile after ${maxRetries} attempts (treating as new user): ${error}`;
        existing = null;
      } else {
        // リトライ前に少し待つ（指数バックオフ）
        const delay = Math.pow(2, attempt) * 500; // 500ms, 1000ms, 2000ms
        logger.info`Retrying profile read in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  const now = new Date().toISOString();

  // 基本プロファイルデータ（ベータフィールドを除く）
  const baseProfile: Omit<
    UserProfile,
    "betaAccess" | "betaCodeUsed" | "betaAccessAt"
  > = {
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
    hideAvatarInProjects:
      overrides.hideAvatarInProjects ?? existing?.hideAvatarInProjects ?? false,
  };

  // 新規作成時はベータフィールドを含めない（セキュリティルールでブロックされるため）
  // 既存プロファイルの更新時のみベータフィールドを引き継ぐ（ただしundefinedは除外）
  let profile: UserProfile;
  if (existing) {
    profile = { ...baseProfile };
    // ベータフィールドは実際の値がある場合のみ含める
    if (existing.betaAccess !== undefined) {
      profile.betaAccess = overrides.betaAccess ?? existing.betaAccess;
    }
    if (existing.betaCodeUsed !== undefined) {
      profile.betaCodeUsed = overrides.betaCodeUsed ?? existing.betaCodeUsed;
    }
    if (existing.betaAccessAt !== undefined) {
      profile.betaAccessAt = overrides.betaAccessAt ?? existing.betaAccessAt;
    }
  } else {
    profile = baseProfile;
  }

  logger.info`persistProfile existing profile found: ${existing !== null}`;
  logger.info`persistProfile existing setUp value: ${existing?.setUp}`;
  logger.info`persistProfile overrides.setUp: ${overrides.setUp}`;
  logger.info`persistProfile profile to write (setUp=${profile.setUp}): ${JSON.stringify({ uid: profile.uid, setUp: profile.setUp, fullName: profile.fullName })}`;

  // 書き込みもリトライ機構を追加（トークン伝播の遅延対策）
  const writeMaxRetries = 3;
  for (let attempt = 0; attempt < writeMaxRetries; attempt++) {
    try {
      logger.info`persistProfile attempting write (attempt ${attempt + 1}/${writeMaxRetries})...`;
      await setDoc(ref, profile, { merge: true });
      logger.info`persistProfile write SUCCESS for user ${user.uid}`;
      return profile;
    } catch (error) {
      const isLastAttempt = attempt === writeMaxRetries - 1;
      if (isLastAttempt) {
        logger.error`Failed to save profile after ${writeMaxRetries} attempts: ${error}`;
        throw error;
      }
      // リトライ前に少し待つ（指数バックオフ）
      const delay = Math.pow(2, attempt) * 500;
      logger.info`Retrying profile write in ${delay}ms (attempt ${attempt + 1}/${writeMaxRetries})`;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // ここには到達しないはずだが、TypeScriptのために
  return profile;
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
  logger.info`[MFA] generateTOTPSecret called`;
  logger.info`[MFA] Session type: ${typeof session}`;

  try {
    logger.info`[MFA] Calling TotpMultiFactorGenerator.generateSecret...`;
    const secret = await TotpMultiFactorGenerator.generateSecret(session);
    logger.info`[MFA] TOTP secret generated successfully`;
    return secret;
  } catch (error) {
    logger.error`[MFA] TotpMultiFactorGenerator.generateSecret failed: ${error}`;
    throw error;
  }
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
  logger.info`[MFA] startMFAEnrollment called`;

  const user = await requireCurrentUser();
  logger.info`[MFA] User obtained: ${user.uid}`;
  logger.info`[MFA] User email: ${user.email}`;
  logger.info`[MFA] Email verified: ${user.emailVerified}`;
  logger.info`[MFA] Provider IDs: ${user.providerData.map((p) => p.providerId).join(", ")}`;

  const mfaUser = multiFactor(user);
  logger.info`[MFA] MultiFactor object created`;
  logger.info`[MFA] Enrolled factors count: ${mfaUser.enrolledFactors.length}`;

  try {
    logger.info`[MFA] Calling mfaUser.getSession()...`;
    const session = await mfaUser.getSession();
    logger.info`[MFA] Session obtained successfully`;
    return session;
  } catch (error) {
    logger.error`[MFA] mfaUser.getSession() failed: ${error}`;
    throw error;
  }
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

/**
 * 重要操作前のMFA検証関連の関数
 */

/**
 * パスワードを使用して再認証し、MFAが必要な場合はリゾルバーを返す
 *
 * @param password - 現在のパスワード
 * @returns MFAが必要な場合は { requiresMFA: true, resolver }、不要な場合は { requiresMFA: false }
 */
export async function reauthenticateWithPassword(password: string): Promise<{
  requiresMFA: boolean;
  resolver?: MultiFactorResolver;
}> {
  const user = await requireCurrentUser();

  if (!user.email) {
    throw new Error("メールアドレスが設定されていません。");
  }

  const credential = EmailAuthProvider.credential(user.email, password);

  try {
    await reauthenticateWithCredential(user, credential);
    return { requiresMFA: false };
  } catch (error) {
    const authError = error as { code?: string };

    if (authError.code === "auth/multi-factor-auth-required") {
      // MFAが必要
      const resolver = getMultiFactorResolver(auth, error as MultiFactorError);
      return { requiresMFA: true, resolver };
    }

    // その他のエラー
    throw error;
  }
}

/**
 * MFAリゾルバーを使用してTOTPコードで再認証を完了する
 *
 * @param resolver - MultiFactorResolver
 * @param verificationCode - 6桁のTOTPコード
 */
export async function completeMFAReauthentication(
  resolver: MultiFactorResolver,
  verificationCode: string,
): Promise<void> {
  const totpHint = resolver.hints.find(
    (hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID,
  );

  if (!totpHint) {
    throw new Error("TOTP認証が見つかりません。");
  }

  const assertion = TotpMultiFactorGenerator.assertionForSignIn(
    totpHint.uid,
    verificationCode,
  );

  await resolver.resolveSignIn(assertion);
}

/**
 * SNSプロバイダを使用して再認証する
 *
 * @param providerId - プロバイダID ('google.com', 'github.com')
 * @returns MFAが必要な場合は { requiresMFA: true, resolver }、不要な場合は { requiresMFA: false }
 */
export async function reauthenticateWithProvider(providerId: string): Promise<{
  requiresMFA: boolean;
  resolver?: MultiFactorResolver;
}> {
  const user = await requireCurrentUser();

  // プロバイダを取得
  let provider: AuthProvider;
  if (providerId === "google.com") {
    provider = googleProvider;
  } else if (providerId === "github.com") {
    provider = githubProvider;
  } else {
    throw new Error(`サポートされていないプロバイダです: ${providerId}`);
  }

  try {
    await reauthenticateWithPopup(user, provider);
    return { requiresMFA: false };
  } catch (error) {
    const authError = error as { code?: string };

    if (authError.code === "auth/multi-factor-auth-required") {
      // MFAが必要
      const resolver = getMultiFactorResolver(auth, error as MultiFactorError);
      return { requiresMFA: true, resolver };
    }

    // その他のエラー
    throw error;
  }
}

/**
 * ユーザーの認証プロバイダ情報を取得する
 *
 * @returns プロバイダ情報（パスワード認証かSNS認証か）
 */
export async function getAuthProviderInfo(): Promise<{
  hasPassword: boolean;
  providers: string[];
  primaryProvider: string | null;
}> {
  const user = await requireCurrentUser();

  const providers = user.providerData.map((p) => p.providerId);
  const hasPassword = providers.includes("password");

  // 主要なプロバイダを決定（パスワード以外を優先）
  const snsProviders = providers.filter((p) => p !== "password");
  const primaryProvider: string | null =
    snsProviders.length > 0
      ? (snsProviders[0] ?? null)
      : hasPassword
        ? "password"
        : null;

  return {
    hasPassword,
    providers,
    primaryProvider,
  };
}

/**
 * パスワードを変更する
 *
 * @param currentPassword - 現在のパスワード
 * @param newPassword - 新しいパスワード
 * @param mfaCode - MFAコード（MFAが有効な場合）
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  mfaCode?: string,
): Promise<void> {
  const user = await requireCurrentUser();

  if (!user.email) {
    throw new Error("メールアドレスが設定されていません。");
  }

  // まず再認証
  const reauthResult = await reauthenticateWithPassword(currentPassword);

  if (reauthResult.requiresMFA) {
    if (!mfaCode) {
      throw new Error("MFA_REQUIRED");
    }
    if (!reauthResult.resolver) {
      throw new Error("MFAリゾルバーが見つかりません。");
    }
    await completeMFAReauthentication(reauthResult.resolver, mfaCode);
  }

  // パスワードを更新
  // 再認証後にユーザーオブジェクトを再取得
  const freshUser = await requireCurrentUser();
  await updatePassword(freshUser, newPassword);
}

/**
 * MFA付きでアカウントを削除する
 *
 * @param password - 現在のパスワード
 * @param mfaCode - MFAコード（MFAが有効な場合）
 */
export async function deleteAccountWithMFA(
  password: string,
  mfaCode?: string,
): Promise<void> {
  const user = await requireCurrentUser();

  if (!user.email) {
    throw new Error("メールアドレスが設定されていません。");
  }

  // まず再認証
  const reauthResult = await reauthenticateWithPassword(password);

  if (reauthResult.requiresMFA) {
    if (!mfaCode) {
      throw new Error("MFA_REQUIRED");
    }
    if (!reauthResult.resolver) {
      throw new Error("MFAリゾルバーが見つかりません。");
    }
    await completeMFAReauthentication(reauthResult.resolver, mfaCode);
  }

  // アカウントを削除
  const freshUser = await requireCurrentUser();
  await deleteDoc(doc(db, "profiles", freshUser.uid));
  await deleteUser(freshUser);
}

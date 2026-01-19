import {
  auth,
  db,
  githubProvider,
  googleProvider,
  storage,
} from "@/lib/firebase";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { getActionCodeSettings } from "@/config/appConfig";
import type {
  CredentialSignUpPayload,
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
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  TotpMultiFactorGenerator,
  TotpSecret,
  updateProfile,
  type AuthProvider,
  type MultiFactorResolver,
  type MultiFactorSession,
  type User,
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
  const actionCodeSettings = getActionCodeSettings("/auth/verify-email");
  await sendEmailVerification(credential.user, actionCodeSettings);
  return credential.user;
}

export async function resendVerificationEmail() {
  const user = await requireCurrentUser();
  // メール認証後のリダイレクト先を設定
  const actionCodeSettings = getActionCodeSettings("/auth/verify-email");
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
  const actionCodeSettings = getActionCodeSettings(
    "/auth/reset-password/confirm",
  );
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
  return persistProfile(credential.user);
}

export async function loginWithProvider(provider: SocialProvider) {
  const credential = await signInWithPopup(auth, providerMap[provider]);
  return persistProfile(credential.user);
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
}) {
  const user = await requireCurrentUser();

  const displayName = payload.nickname?.trim() || payload.fullName;
  if (displayName) {
    await updateProfile(user, { displayName });
  }

  return persistProfile(user, {
    nickname: payload.nickname,
    fullName: payload.fullName,
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

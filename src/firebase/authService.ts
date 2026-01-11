import {
  type AuthProvider,
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type User,
} from "firebase/auth";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
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
  LoginPayload,
  ProfileSetupPayload,
  SocialProvider,
  UserProfile,
} from "@/types/auth";

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
  await sendEmailVerification(credential.user);
  return credential.user;
}

export async function resendVerificationEmail() {
  const user = await requireCurrentUser();
  await sendEmailVerification(user);
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
  await sendPasswordResetEmail(auth, email);
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
  };

  await setDoc(ref, profile, { merge: true });
  return profile;
}

async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("ユーザーが認証されていません。");
  }

  return user;
}

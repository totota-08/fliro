import {
  type AuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type User,
} from 'firebase/auth'
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { auth, db, githubProvider, googleProvider, storage } from '@/firebase/config'
import type {
  CredentialSignUpPayload,
  LoginPayload,
  ProfileSetupPayload,
  SocialProvider,
  UserProfile,
} from '@/types/auth'

const providerMap: Record<SocialProvider, AuthProvider> = {
  google: googleProvider,
  github: githubProvider,
}

export async function registerCredentials(payload: CredentialSignUpPayload) {
  const credential = await createUserWithEmailAndPassword(auth, payload.email, payload.password)
  await sendEmailVerification(credential.user)
  return credential.user
}

export async function resendVerificationEmail() {
  const user = auth.currentUser
  if (!user) {
    throw new Error('ユーザーが認証されていません。')
  }
  await sendEmailVerification(user)
}

export async function refreshCurrentUser() {
  const user = auth.currentUser
  if (!user) {
    return null
  }
  await reload(user)
  return user
}

export async function saveProfileDetails(payload: ProfileSetupPayload) {
  const user = auth.currentUser

  if (!user) {
    throw new Error('ユーザーが認証されていません。')
  }

  const displayName = payload.nickname?.trim() || payload.fullName
  await updateProfile(user, { displayName })

  return persistProfile(user, {
    fullName: payload.fullName,
    nickname: payload.nickname,
    birthday: payload.birthday ?? '',
  })
}

export async function loginWithEmail(payload: LoginPayload) {
  const credential = await signInWithEmailAndPassword(auth, payload.email, payload.password)
  return persistProfile(credential.user)
}

export async function loginWithProvider(provider: SocialProvider) {
  const credential = await signInWithPopup(auth, providerMap[provider])
  return persistProfile(credential.user)
}

export async function fetchProfile(uid: string) {
  const ref = doc(db, 'profiles', uid)
  const snapshot = await getDoc(ref)

  if (!snapshot.exists()) {
    return null
  }

  return snapshot.data() as UserProfile
}

export async function uploadAvatar(file: File) {
  const user = auth.currentUser

  if (!user) {
    throw new Error('ユーザーが認証されていません。')
  }

  const fileRef = storageRef(storage, `avatars/${user.uid}/${Date.now()}`)
  await uploadBytes(fileRef, file, { contentType: file.type })
  const url = await getDownloadURL(fileRef)

  await updateProfile(user, { photoURL: url })
  return persistProfile(user, { avatarUrl: url })
}

export async function deleteCurrentAccount() {
  const user = auth.currentUser

  if (!user) {
    throw new Error('ユーザーが認証されていません。')
  }

  await deleteDoc(doc(db, 'profiles', user.uid))
  await deleteUser(user)
}

async function persistProfile(user: User, overrides: Partial<UserProfile> = {}) {
  const ref = doc(db, 'profiles', user.uid)
  const snapshot = await getDoc(ref)
  const existing = snapshot.exists() ? (snapshot.data() as UserProfile) : null

  const now = new Date().toISOString()
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email ?? overrides.email ?? existing?.email ?? '',
    fullName: overrides.fullName ?? existing?.fullName ?? user.displayName ?? '',
    nickname: overrides.nickname ?? existing?.nickname ?? user.displayName ?? '',
    birthday: overrides.birthday ?? existing?.birthday ?? '',
    avatarUrl: overrides.avatarUrl ?? existing?.avatarUrl ?? user.photoURL ?? '',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  await setDoc(ref, profile, { merge: true })
  return profile
}

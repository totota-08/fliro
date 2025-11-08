import {
  deleteCurrentAccount,
  loginWithEmail,
  loginWithProvider,
  registerWithEmail,
  uploadAvatar,
} from '@/firebase/authService'
import { setProfile } from '@/store/auth'
import type { LoginPayload, SignUpPayload, SocialProvider } from '@/types/auth'

export async function createAccount(payload: SignUpPayload) {
  const profile = await registerWithEmail(payload)
  setProfile(profile)
  return profile
}

export async function authenticateWithEmail(payload: LoginPayload) {
  const profile = await loginWithEmail(payload)
  setProfile(profile)
  return profile
}

export async function authenticateWithProvider(provider: SocialProvider) {
  const profile = await loginWithProvider(provider)
  setProfile(profile)
  return profile
}

export async function updateAccountAvatar(file: File) {
  const profile = await uploadAvatar(file)
  setProfile(profile)
  return profile
}

export async function removeAccount(): Promise<void> {
  await deleteCurrentAccount()
  setProfile(null)
}

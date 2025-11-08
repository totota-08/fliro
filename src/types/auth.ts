export interface UserProfile {
  uid: string
  email: string
  fullName: string
  nickname: string
  birthday: string
  avatarUrl: string
  createdAt: string
  updatedAt: string
}

export interface SignUpPayload {
  email: string
  password: string
  fullName: string
  nickname: string
  birthday: string
  avatarUrl?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export type SocialProvider = 'google' | 'github'

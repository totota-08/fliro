const STORAGE_KEY = 'teamie_invite_token'

export function rememberInviteToken(token: string) {
  try {
    localStorage.setItem(STORAGE_KEY, token)
  } catch (error) {
    console.warn('Failed to persist invite token', error)
  }
}

export function consumeInviteToken() {
  try {
    const token = localStorage.getItem(STORAGE_KEY)
    if (token) {
      localStorage.removeItem(STORAGE_KEY)
    }
    return token
  } catch (error) {
    console.warn('Failed to read invite token', error)
    return null
  }
}

export function peekInviteToken() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch (error) {
    return null
  }
}

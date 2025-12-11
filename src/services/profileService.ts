import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { UserProfile } from '@/types/auth'

async function queryProfileByField(field: 'email' | 'emailLower', value: string) {
  try {
    const profilesRef = collection(db, 'profiles')
    const snapshot = await getDocs(query(profilesRef, where(field, '==', value), limit(1)))
    if (snapshot.empty) {
      return null
    }
    const docSnap = snapshot.docs[0]
    return docSnap ? (docSnap.data() as UserProfile) : null
  } catch {
    return null
  }
}

export async function findProfileByEmail(email: string) {
  const normalized = email.trim()
  if (!normalized) {
    return null
  }
  const emailLower = normalized.toLowerCase()
  const byLower = await queryProfileByField('emailLower', emailLower)
  if (byLower) {
    return byLower
  }
  return queryProfileByField('email', normalized)
}

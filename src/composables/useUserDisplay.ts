import { db } from '@/firebase/config'
import type { ProjectMember } from '@/services/projectMembers'
import { doc, getDoc } from 'firebase/firestore'
import type { Ref } from 'vue'

const nameCache = new Map<string, string>()
const fetching = new Set<string>()

async function fetchProfileName(userId: string) {
  if (!userId || fetching.has(userId) || nameCache.has(userId)) return
  fetching.add(userId)
  try {
    const snap = await getDoc(doc(db, 'profiles', userId))
    if (snap.exists()) {
      const data = snap.data() as any
      const name = data?.nickname || data?.fullName || data?.displayName
      if (name) {
        nameCache.set(userId, name)
      }
    }
  } catch (error) {
    console.warn('Failed to fetch profile for', userId, error)
  } finally {
    fetching.delete(userId)
  }
}

export function useUserDisplay(members?: Ref<ProjectMember[]>) {
  function getDisplayName(userId?: string | null) {
    if (!userId) return ''
    if (nameCache.has(userId)) return nameCache.get(userId) || ''

    const member = members?.value?.find((m) => m.userId === userId)
    const memberName = member?.nickname || member?.fullName || member?.displayName
    if (memberName) {
      nameCache.set(userId, memberName)
      return memberName
    }

    fetchProfileName(userId)
    return ''
  }

  return { getDisplayName }
}

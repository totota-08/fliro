import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { addProjectMember } from '@/services/projectMembers'

interface CreateInviteOptions {
  projectId: string
  createdBy: string
  password?: string | null
}

export interface ProjectInviteDoc {
  projectId: string
  token: string
  createdBy: string
  createdAt: Date | null
  acceptedAt?: Date | null
  acceptedBy?: string
  status: 'pending' | 'accepted'
  passwordHash?: string | null
}

function createToken() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 10)
}

async function hashInvitePassword(password: string) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return password
  }
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function createProjectInvite({ projectId, createdBy, password }: CreateInviteOptions) {
  const token = createToken()
  const ref = doc(db, 'projectInvites', token)
  const passwordHash = password?.trim() ? await hashInvitePassword(password.trim()) : null
  await setDoc(ref, {
    projectId,
    createdBy,
    token,
    passwordHash,
    createdAt: serverTimestamp(),
    status: 'pending',
  })
  return token
}

export async function redeemInvite(token: string, userId: string, email: string, options?: { password?: string }) {
  const ref = doc(db, 'projectInvites', token)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    throw new Error('招待リンクが無効です。')
  }
  const data = snap.data() as ProjectInviteDoc
  if (data.passwordHash) {
    const provided = options?.password?.trim()
    if (!provided) {
      throw new Error('invite-password-required')
    }
    const hashed = await hashInvitePassword(provided)
    if (hashed !== data.passwordHash) {
      throw new Error('invite-password-invalid')
    }
  }
  if (data.status === 'accepted') {
    return data.projectId
  }

  const projectSnap = await getDoc(doc(db, 'projects', data.projectId))
  const projectName = projectSnap.exists() ? (projectSnap.data().name as string) : undefined

  await addProjectMember({ projectId: data.projectId, userId, role: 'member', invitedBy: data.createdBy, projectName })
  await updateDoc(ref, {
    status: 'accepted',
    acceptedAt: serverTimestamp(),
    acceptedBy: userId,
    acceptedEmail: email,
  })
  return data.projectId
}

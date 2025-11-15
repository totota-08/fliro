import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { addProjectMember } from '@/services/projectMembers'

interface CreateInviteOptions {
  projectId: string
  email: string
  createdBy: string
}

export interface ProjectInviteDoc {
  projectId: string
  email: string
  token: string
  createdBy: string
  createdAt: Date | null
  acceptedAt?: Date | null
  acceptedBy?: string
  status: 'pending' | 'accepted'
}

function createToken() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 10)
}

export async function createProjectInvite({ projectId, email, createdBy }: CreateInviteOptions) {
  const token = createToken()
  const ref = doc(db, 'projectInvites', token)
  await setDoc(ref, {
    projectId,
    email,
    createdBy,
    token,
    createdAt: serverTimestamp(),
    status: 'pending',
  })
  return token
}

export async function sendProjectInvites(projectId: string, emails: string[], createdBy: string, openMail: boolean) {
  const sentTokens: string[] = []
  for (const email of emails) {
    const token = await createProjectInvite({ projectId, email, createdBy })
    sentTokens.push(token)
    if (openMail && typeof window !== 'undefined') {
      const mailto = buildInviteMailTo(token, email)
      window.open(mailto, '_blank')
    }
  }
  return sentTokens
}

export async function redeemInvite(token: string, userId: string, email: string) {
  const ref = doc(db, 'projectInvites', token)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    throw new Error('招待リンクが無効です。')
  }
  const data = snap.data() as ProjectInviteDoc
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

export function buildInviteMailTo(token: string, email: string) {
  const inviteUrl = `${window.location.origin}/invite/${token}`
  const subject = encodeURIComponent('Teamie プロジェクトへの招待')
  const body = encodeURIComponent(`Teamie のプロジェクトに参加してください。以下のリンクからアクセスできます:\n${inviteUrl}`)
  return `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`
}

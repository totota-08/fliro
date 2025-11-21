import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'

interface AddProjectMemberOptions {
  projectId: string
  userId: string
  role?: 'owner' | 'admin' | 'member' | 'viewer'
  invitedBy: string
  projectName?: string
  profile?: {
    nickname?: string
    fullName?: string
    email?: string
    avatarUrl?: string
  }
}

export async function addProjectMember({
  projectId,
  userId,
  role = 'member',
  invitedBy,
  projectName,
  profile,
}: AddProjectMemberOptions) {
  const timestamp = serverTimestamp()
  const profileData = profile ?? {}
  await setDoc(
    doc(db, 'projects', projectId, 'members', userId),
    {
      userId,
      role,
      invitedBy,
      nickname: profileData.nickname ?? null,
      fullName: profileData.fullName ?? null,
      email: profileData.email ?? null,
      avatarUrl: profileData.avatarUrl ?? null,
      permissions: {
        canEditProject: role === 'owner' || role === 'admin',
        canDeleteTasks: role === 'owner' || role === 'admin',
        canInviteMembers: role === 'owner' || role === 'admin',
        canManageSettings: role === 'owner',
      },
      joinedAt: timestamp,
      lastAccessedAt: timestamp,
    },
    { merge: true },
  )

  await setDoc(
    doc(db, 'userProjects', userId, 'projects', projectId),
    {
      projectName: projectName ?? '参加中プロジェクト',
      role,
      lastAccessedAt: timestamp,
    },
    { merge: true },
  )
}

export async function removeProjectMember(projectId: string, userId: string) {
  await deleteDoc(doc(db, 'projects', projectId, 'members', userId))
  await deleteDoc(doc(db, 'userProjects', userId, 'projects', projectId))
}

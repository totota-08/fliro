import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'

interface AddProjectMemberOptions {
  projectId: string
  userId: string
  role?: 'owner' | 'admin' | 'member' | 'viewer'
  invitedBy: string
  projectName?: string
}

export async function addProjectMember({ projectId, userId, role = 'member', invitedBy, projectName }: AddProjectMemberOptions) {
  const timestamp = serverTimestamp()
  await setDoc(
    doc(db, 'projects', projectId, 'members', userId),
    {
      userId,
      role,
      invitedBy,
      permissions: {
        canEditProject: role === 'owner' || role === 'admin',
        canDeleteTasks: role === 'owner' || role === 'admin',
        canInviteMembers: role === 'owner' || role === 'admin',
        canManageSettings: role === 'owner'
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

import { database, db } from '@/firebase/config'
import { ref, remove, set } from 'firebase/database'
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'

export interface ProjectMember {
  userId: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  projectRole: 'owner' | 'member'
  nickname?: string
  fullName?: string
  email?: string
  avatarUrl?: string
  displayName?: string // Computed property for display
}

interface AddProjectMemberOptions {
  projectId: string
  userId: string
  role?: 'owner' | 'admin' | 'member' | 'viewer'
  projectRole?: 'owner' | 'member'
  invitedBy: string
  projectName?: string
  profile?: {
    nickname?: string
    fullName?: string
    email?: string
    avatarUrl?: string
  }
}

function getPermissionsFromRole(role: ProjectMember['role']) {
  const isAdmin = role === 'owner' || role === 'admin'
  return {
    canEditProject: isAdmin,
    canDeleteTasks: isAdmin,
    canInviteMembers: isAdmin,
    canManageSettings: role === 'owner',
  }
}

export function listenProjectMembers(projectId: string, callback: (members: ProjectMember[]) => void) {
  const membersRef = collection(db, 'projects', projectId, 'members')
  return onSnapshot(membersRef, (snapshot) => {
    const members: ProjectMember[] = []
    snapshot.forEach((doc) => {
      const data = doc.data()
      members.push({
        userId: doc.id,
        role: data.role,
        projectRole: data.projectRole,
        nickname: data.nickname,
        fullName: data.fullName,
        email: data.email,
        avatarUrl: data.avatarUrl,
        displayName: data.nickname || data.fullName || 'Unknown User',
      })
    })
    callback(members)
  })
}

export async function addProjectMember({
  projectId,
  userId,
  role = 'member',
  projectRole = 'member',
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
      projectRole,
      invitedBy,
      nickname: profileData.nickname ?? null,
      fullName: profileData.fullName ?? null,
      email: profileData.email ?? null,
      avatarUrl: profileData.avatarUrl ?? null,
      permissions: getPermissionsFromRole(role),
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

  // Sync to Realtime Database for chat rules
  const rtdbRef = ref(database, `projects/${projectId}/members/${userId}`)
  await set(rtdbRef, {
    role,
    joinedAt: Date.now(),
  })
}

export async function removeProjectMember(projectId: string, userId: string) {
  await deleteDoc(doc(db, 'projects', projectId, 'members', userId))
  await deleteDoc(doc(db, 'userProjects', userId, 'projects', projectId))

  // Remove from Realtime Database
  const rtdbRef = ref(database, `projects/${projectId}/members/${userId}`)
  await remove(rtdbRef)
}

export async function updateProjectMemberRole(projectId: string, userId: string, role: ProjectMember['role']) {
  const permissions = getPermissionsFromRole(role)
  await setDoc(
    doc(db, 'projects', projectId, 'members', userId),
    {
      role,
      permissions,
    },
    { merge: true },
  )
  await setDoc(
    doc(db, 'userProjects', userId, 'projects', projectId),
    {
      role,
      lastAccessedAt: serverTimestamp(),
    },
    { merge: true },
  )

  const rtdbRef = ref(database, `projects/${projectId}/members/${userId}`)
  await set(rtdbRef, {
    role,
    joinedAt: Date.now(),
  })
}

import { before, after, afterEach, describe, it } from 'node:test'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import fs from 'node:fs'

let testEnv

async function createInvite(db, token = 'invite123') {
  await setDoc(doc(db, 'projectInvites', token), {
    projectId: 'project1',
    projectName: 'Test Project',
    createdBy: 'owner1',
    status: 'pending',
    createdAt: serverTimestamp(),
    usedCount: 0,
    maxUses: 10,
    expiresAt: null,
    passwordHash: null,
  })
}

describe('Firestore rules / 招待機能', () => {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'test-project',
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    })
  })

  after(async () => {
    await testEnv?.cleanup()
  })

  afterEach(async () => {
    await testEnv?.clearFirestore()
  })

  it('未認証ユーザーは招待情報を読み取れる', async () => {
    const ownerDb = testEnv.authenticatedContext('owner1').firestore()
    await createInvite(ownerDb, 'invite-read')

    const guestDb = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(doc(guestDb, 'projectInvites', 'invite-read')))
  })

  it('未認証ユーザーは招待の作成・更新はできない', async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore()

    await assertFails(
      setDoc(doc(guestDb, 'projectInvites', 'invite-create'), {
        projectId: 'project1',
        createdBy: 'guest',
        status: 'pending',
        createdAt: serverTimestamp(),
        usedCount: 0,
        maxUses: 1,
        expiresAt: null,
        passwordHash: null,
      }),
    )

    const ownerDb = testEnv.authenticatedContext('owner1').firestore()
    await createInvite(ownerDb, 'invite-update')

    await assertFails(
      updateDoc(doc(guestDb, 'projectInvites', 'invite-update'), {
        projectId: 'project1',
        createdBy: 'owner1',
        status: 'accepted',
        acceptedBy: 'guest',
        acceptedAt: serverTimestamp(),
        usedCount: 1,
        maxUses: 10,
        expiresAt: null,
        passwordHash: null,
      }),
    )
  })

  it('認証済みユーザーは自身の招待受諾として更新できる', async () => {
    const ownerDb = testEnv.authenticatedContext('owner1').firestore()
    await createInvite(ownerDb, 'invite-accept')

    const userDb = testEnv.authenticatedContext('user2').firestore()
    await assertSucceeds(
      updateDoc(doc(userDb, 'projectInvites', 'invite-accept'), {
        projectId: 'project1',
        createdBy: 'owner1',
        status: 'accepted',
        acceptedBy: 'user2',
        acceptedAt: serverTimestamp(),
        usedCount: 1,
        maxUses: 10,
        expiresAt: null,
        passwordHash: null,
      }),
    )
  })

  it('認証済みユーザーでも acceptedBy が一致しない更新は拒否される', async () => {
    const ownerDb = testEnv.authenticatedContext('owner1').firestore()
    await createInvite(ownerDb, 'invite-mismatch')

    const userDb = testEnv.authenticatedContext('user2').firestore()
    await assertFails(
      updateDoc(doc(userDb, 'projectInvites', 'invite-mismatch'), {
        projectId: 'project1',
        createdBy: 'owner1',
        status: 'accepted',
        acceptedBy: 'other-user',
        acceptedAt: serverTimestamp(),
        usedCount: 1,
        maxUses: 10,
        expiresAt: null,
        passwordHash: null,
      }),
    )
  })
})

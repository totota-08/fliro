import { before, after, afterEach, describe, it } from "node:test";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import fs from "node:fs";

let testEnv;

async function createInvite(
  db,
  token = "invite123",
  createdAt = null,
  { maxUses = 10 } = {},
) {
  const timestamp = createdAt || Timestamp.now();
  await setDoc(doc(db, "projectInvites", token), {
    projectId: "project1",
    projectName: "Test Project",
    createdBy: "owner1",
    status: "pending",
    createdAt: timestamp,
    usedCount: 0,
    maxUses,
    expiresAt: null,
    passwordHash: null,
  });
  return timestamp;
}

async function createTestProject(db, projectId = "project1", owner = "owner1") {
  await setDoc(doc(db, "projects", projectId), {
    name: "Test Project",
    description: "Test description",
    ownerUserId: owner,
    status: "active",
    settings: {
      isPublic: false,
      allowGuestView: false,
      defaultTaskStatus: "todo",
    },
    stats: {
      totalTasks: 0,
      completedTasks: 0,
      totalMembers: 1,
      lastActivityAt: null,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

describe("Firestore rules / 招待機能", () => {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "test-project",
      firestore: {
        rules: fs.readFileSync("firestore.rules", "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  after(async () => {
    await testEnv?.cleanup();
  });

  afterEach(async () => {
    await testEnv?.clearFirestore();
  });

  it("未認証ユーザーは招待情報を読み取れる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createInvite(ownerDb, "invite-read");

    const guestDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(guestDb, "projectInvites", "invite-read")));
  });

  it("未認証ユーザーは招待の作成・更新はできない", async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(
      setDoc(doc(guestDb, "projectInvites", "invite-create"), {
        projectId: "project1",
        createdBy: "guest",
        status: "pending",
        createdAt: serverTimestamp(),
        usedCount: 0,
        maxUses: 1,
        expiresAt: null,
        passwordHash: null,
      }),
    );

    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createInvite(ownerDb, "invite-update");

    await assertFails(
      updateDoc(doc(guestDb, "projectInvites", "invite-update"), {
        projectId: "project1",
        createdBy: "owner1",
        status: "accepted",
        acceptedBy: "guest",
        acceptedAt: serverTimestamp(),
        usedCount: 1,
        maxUses: 10,
        expiresAt: null,
        passwordHash: null,
      }),
    );
  });

  it("認証済みユーザーは自身の招待受諾として更新できる（上限未達なら pending のまま）", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    const createdAt = await createInvite(ownerDb, "invite-accept");

    const userDb = testEnv.authenticatedContext("user2").firestore();
    await assertSucceeds(
      updateDoc(doc(userDb, "projectInvites", "invite-accept"), {
        projectId: "project1",
        projectName: "Test Project",
        createdBy: "owner1",
        createdAt: createdAt,
        status: "pending",
        acceptedBy: "user2",
        acceptedAt: serverTimestamp(),
        usedCount: 1,
        maxUses: 10,
        expiresAt: null,
        passwordHash: null,
      }),
    );
  });

  it("使用回数上限に達する受諾は accepted になる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    const createdAt = await createInvite(ownerDb, "invite-last-use", null, {
      maxUses: 1,
    });

    const userDb = testEnv.authenticatedContext("user2").firestore();
    await assertSucceeds(
      updateDoc(doc(userDb, "projectInvites", "invite-last-use"), {
        projectId: "project1",
        projectName: "Test Project",
        createdBy: "owner1",
        createdAt: createdAt,
        status: "accepted",
        acceptedBy: "user2",
        acceptedAt: serverTimestamp(),
        usedCount: 1,
        maxUses: 1,
        expiresAt: null,
        passwordHash: null,
      }),
    );
  });

  it("上限未達なのに accepted へ変更する更新は拒否される", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    const createdAt = await createInvite(ownerDb, "invite-early-accept");

    const userDb = testEnv.authenticatedContext("user2").firestore();
    await assertFails(
      updateDoc(doc(userDb, "projectInvites", "invite-early-accept"), {
        projectId: "project1",
        projectName: "Test Project",
        createdBy: "owner1",
        createdAt: createdAt,
        status: "accepted",
        acceptedBy: "user2",
        acceptedAt: serverTimestamp(),
        usedCount: 1,
        maxUses: 10,
        expiresAt: null,
        passwordHash: null,
      }),
    );
  });

  it("無制限（maxUses が null）の招待は pending のまま受諾できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    const createdAt = await createInvite(ownerDb, "invite-unlimited", null, {
      maxUses: null,
    });

    const userDb = testEnv.authenticatedContext("user2").firestore();
    await assertSucceeds(
      updateDoc(doc(userDb, "projectInvites", "invite-unlimited"), {
        projectId: "project1",
        projectName: "Test Project",
        createdBy: "owner1",
        createdAt: createdAt,
        status: "pending",
        acceptedBy: "user2",
        acceptedAt: serverTimestamp(),
        usedCount: 1,
        maxUses: null,
        expiresAt: null,
        passwordHash: null,
      }),
    );
  });

  it("プロジェクトオーナーは招待を削除できるが、他ユーザーは削除できない", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb);
    await createInvite(ownerDb, "invite-delete");

    const userDb = testEnv.authenticatedContext("user2").firestore();
    await assertFails(deleteDoc(doc(userDb, "projectInvites", "invite-delete")));

    await assertSucceeds(
      deleteDoc(doc(ownerDb, "projectInvites", "invite-delete")),
    );
  });

  it("認証済みユーザーでも acceptedBy が一致しない更新は拒否される", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createInvite(ownerDb, "invite-mismatch");

    const userDb = testEnv.authenticatedContext("user2").firestore();
    await assertFails(
      updateDoc(doc(userDb, "projectInvites", "invite-mismatch"), {
        projectId: "project1",
        createdBy: "owner1",
        status: "accepted",
        acceptedBy: "other-user",
        acceptedAt: serverTimestamp(),
        usedCount: 1,
        maxUses: 10,
        expiresAt: null,
        passwordHash: null,
      }),
    );
  });
});

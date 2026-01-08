import { before, after, afterEach, describe, it } from "node:test";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import fs from "node:fs";

let testEnv;

// Helper: Create a project with owner and settings
async function createTestProject(db, projectId, ownerUserId) {
  await setDoc(doc(db, "projects", projectId), {
    name: "Test Project",
    description: "Test description",
    ownerUserId,
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

// Helper: Create a public project
async function createPublicProject(db, projectId, ownerUserId) {
  await setDoc(doc(db, "projects", projectId), {
    name: "Public Project",
    description: "Public description",
    ownerUserId,
    status: "active",
    settings: {
      isPublic: true,
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

// Helper: Add a member to project
async function addProjectMember(
  db,
  projectId,
  memberId,
  role = "member",
  invitedBy = "owner1",
  permissions = {},
) {
  await setDoc(doc(db, "projects", projectId, "members", memberId), {
    userId: memberId,
    role,
    permissions: {
      canManageSettings: false,
      canInviteMembers: false,
      ...permissions,
    },
    joinedAt: serverTimestamp(),
    lastAccessedAt: serverTimestamp(),
    invitedBy,
    email: null,
    avatarUrl: null,
  });
}

// Helper: Create a task
async function createTestTask(db, projectId, taskId, createdBy) {
  await setDoc(doc(db, "projects", projectId, "tasks", taskId), {
    title: "Test Task",
    description: "Test description",
    status: "todo",
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

describe("Firestore rules / プロファイル (profiles)", () => {
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

  it("認証済みユーザーは自分のプロファイルを作成できる", async () => {
    const userDb = testEnv.authenticatedContext("user1").firestore();
    await assertSucceeds(
      setDoc(doc(userDb, "profiles", "user1"), {
        nickname: "Test User",
        email: "test@example.com",
      }),
    );
  });

  it("認証済みユーザーは他人のプロファイルを作成できない", async () => {
    const userDb = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
      setDoc(doc(userDb, "profiles", "user2"), {
        nickname: "Other User",
        email: "other@example.com",
      }),
    );
  });

  it("認証済みユーザーは既存の自分のプロファイルを更新できる", async () => {
    const userDb = testEnv.authenticatedContext("user1").firestore();
    // Create first
    await setDoc(doc(userDb, "profiles", "user1"), {
      nickname: "Test User",
      email: "test@example.com",
    });
    // Update
    await assertSucceeds(
      updateDoc(doc(userDb, "profiles", "user1"), {
        nickname: "Updated User",
      }),
    );
  });

  it("認証済みユーザーは自分のプロファイルを読み取れる", async () => {
    const userDb = testEnv.authenticatedContext("user1").firestore();
    await setDoc(doc(userDb, "profiles", "user1"), {
      nickname: "Test User",
      email: "test@example.com",
    });
    await assertSucceeds(getDoc(doc(userDb, "profiles", "user1")));
  });

  it("認証済みユーザーは他人のプロファイルを読み取れない", async () => {
    const user1Db = testEnv.authenticatedContext("user1").firestore();
    await setDoc(doc(user1Db, "profiles", "user1"), {
      nickname: "Test User",
      email: "test@example.com",
    });

    const user2Db = testEnv.authenticatedContext("user2").firestore();
    await assertFails(getDoc(doc(user2Db, "profiles", "user1")));
  });

  it("未認証ユーザーはプロファイルを作成できない", async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(guestDb, "profiles", "guest"), {
        nickname: "Guest",
        email: "guest@example.com",
      }),
    );
  });
});

describe("Firestore rules / プロジェクト (projects)", () => {
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

  it("認証済みユーザーは自分がオーナーのプロジェクトを作成できる", async () => {
    const userDb = testEnv.authenticatedContext("user1").firestore();
    await assertSucceeds(createTestProject(userDb, "project1", "user1"));
  });

  it("認証済みユーザーは他人がオーナーのプロジェクトを作成できない", async () => {
    const userDb = testEnv.authenticatedContext("user1").firestore();
    await assertFails(createTestProject(userDb, "project1", "other-owner"));
  });

  it("未認証ユーザーはプロジェクトを作成できない", async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(createTestProject(guestDb, "project1", "guest"));
  });

  it("オーナーは自分のプロジェクトを読み取れる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await assertSucceeds(getDoc(doc(ownerDb, "projects", "project1")));
  });

  it("メンバーはプロジェクトを読み取れる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertSucceeds(getDoc(doc(memberDb, "projects", "project1")));
  });

  it("非メンバーはプライベートプロジェクトを読み取れない", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");

    const otherDb = testEnv.authenticatedContext("other1").firestore();
    await assertFails(getDoc(doc(otherDb, "projects", "project1")));
  });

  it("公開プロジェクトは誰でも読み取れる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createPublicProject(ownerDb, "project1", "owner1");

    const otherDb = testEnv.authenticatedContext("other1").firestore();
    await assertSucceeds(getDoc(doc(otherDb, "projects", "project1")));
  });

  it("オーナーはプロジェクトを更新できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await assertSucceeds(
      updateDoc(doc(ownerDb, "projects", "project1"), {
        name: "Updated Project",
        ownerUserId: "owner1", // Must keep same owner
      }),
    );
  });

  it("オーナーはプロジェクトのオーナーを変更できない", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await assertFails(
      updateDoc(doc(ownerDb, "projects", "project1"), {
        ownerUserId: "new-owner",
      }),
    );
  });

  it("オーナーはプロジェクトを削除できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await assertSucceeds(deleteDoc(doc(ownerDb, "projects", "project1")));
  });

  it("メンバーはプロジェクトを削除できない", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertFails(deleteDoc(doc(memberDb, "projects", "project1")));
  });
});

describe("Firestore rules / メンバー (members)", () => {
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

  it("オーナーはメンバーを追加できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await assertSucceeds(
      addProjectMember(ownerDb, "project1", "member1", "member", "owner1"),
    );
  });

  it("招待権限を持つメンバーはメンバーを追加できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "admin1", "admin", "owner1", {
      canInviteMembers: true,
    });

    const adminDb = testEnv.authenticatedContext("admin1").firestore();
    await assertSucceeds(
      addProjectMember(adminDb, "project1", "member1", "member", "admin1"),
    );
  });

  it("招待権限を持たないメンバーはメンバーを追加できない", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertFails(
      addProjectMember(memberDb, "project1", "member2", "member", "member1"),
    );
  });

  it("プロジェクトメンバーはメンバー一覧を読み取れる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertSucceeds(
      getDoc(doc(memberDb, "projects", "project1", "members", "member1")),
    );
  });

  it("非メンバーはメンバー一覧を読み取れない", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const otherDb = testEnv.authenticatedContext("other1").firestore();
    await assertFails(
      getDoc(doc(otherDb, "projects", "project1", "members", "member1")),
    );
  });

  it("オーナーはメンバーを削除できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    await assertSucceeds(
      deleteDoc(doc(ownerDb, "projects", "project1", "members", "member1")),
    );
  });

  it("メンバーは自分自身を削除できる（退出）", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertSucceeds(
      deleteDoc(doc(memberDb, "projects", "project1", "members", "member1")),
    );
  });
});

describe("Firestore rules / タスク (tasks)", () => {
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

  it("プロジェクトメンバーはタスクを作成できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, "projects", "project1", "tasks", "task1"), {
        title: "New Task",
        status: "todo",
        createdBy: "member1",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("非メンバーはタスクを作成できない", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");

    const otherDb = testEnv.authenticatedContext("other1").firestore();
    await assertFails(
      setDoc(doc(otherDb, "projects", "project1", "tasks", "task1"), {
        title: "New Task",
        status: "todo",
        createdBy: "other1",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("プロジェクトメンバーはタスクを読み取れる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await createTestTask(ownerDb, "project1", "task1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertSucceeds(
      getDoc(doc(memberDb, "projects", "project1", "tasks", "task1")),
    );
  });

  it("プロジェクトメンバーはタスクを更新できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await createTestTask(ownerDb, "project1", "task1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertSucceeds(
      updateDoc(doc(memberDb, "projects", "project1", "tasks", "task1"), {
        status: "in-progress",
      }),
    );
  });

  it("プロジェクトメンバーはタスクを削除できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await createTestTask(ownerDb, "project1", "task1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertSucceeds(
      deleteDoc(doc(memberDb, "projects", "project1", "tasks", "task1")),
    );
  });

  it("非メンバーはタスクを更新できない", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await createTestTask(ownerDb, "project1", "task1", "owner1");

    const otherDb = testEnv.authenticatedContext("other1").firestore();
    await assertFails(
      updateDoc(doc(otherDb, "projects", "project1", "tasks", "task1"), {
        status: "done",
      }),
    );
  });
});

describe("Firestore rules / タスクメッセージ (task messages)", () => {
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

  it("プロジェクトメンバーはタスクメッセージを作成できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await createTestTask(ownerDb, "project1", "task1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertSucceeds(
      addDoc(
        collection(
          memberDb,
          "projects",
          "project1",
          "tasks",
          "task1",
          "messages",
        ),
        {
          text: "Hello",
          senderId: "member1",
          senderName: "Member 1",
          createdAt: serverTimestamp(),
          type: "normal",
        },
      ),
    );
  });

  it("プロジェクトメンバーはタスクメッセージを読み取れる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await createTestTask(ownerDb, "project1", "task1", "owner1");
    const msgRef = await addDoc(
      collection(ownerDb, "projects", "project1", "tasks", "task1", "messages"),
      {
        text: "Hello",
        senderId: "owner1",
        senderName: "Owner",
        createdAt: serverTimestamp(),
        type: "normal",
      },
    );
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertSucceeds(
      getDoc(
        doc(
          memberDb,
          "projects",
          "project1",
          "tasks",
          "task1",
          "messages",
          msgRef.id,
        ),
      ),
    );
  });

  it("非メンバーはタスクメッセージを作成できない", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await createTestTask(ownerDb, "project1", "task1", "owner1");

    const otherDb = testEnv.authenticatedContext("other1").firestore();
    await assertFails(
      addDoc(
        collection(
          otherDb,
          "projects",
          "project1",
          "tasks",
          "task1",
          "messages",
        ),
        {
          text: "Hello",
          senderId: "other1",
          senderName: "Other",
          createdAt: serverTimestamp(),
          type: "normal",
        },
      ),
    );
  });

  it("senderIdが自分と一致しないメッセージは作成できない", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await createTestTask(ownerDb, "project1", "task1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertFails(
      addDoc(
        collection(
          memberDb,
          "projects",
          "project1",
          "tasks",
          "task1",
          "messages",
        ),
        {
          text: "Hello",
          senderId: "other-user", // Different from auth
          senderName: "Other",
          createdAt: serverTimestamp(),
          type: "normal",
        },
      ),
    );
  });
});

describe("Firestore rules / スレッド (threads)", () => {
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

  it("プロジェクトメンバーはスレッドを作成できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, "projects", "project1", "threads", "thread1"), {
        name: "Test Thread",
        createdBy: "member1",
        userId: "member1",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        description: null,
        isPublic: true,
        allowedUserIds: null,
      }),
    );
  });

  it("スレッド作成時はcreatedBy/userIdが自分と一致する必要がある", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertFails(
      setDoc(doc(memberDb, "projects", "project1", "threads", "thread1"), {
        name: "Test Thread",
        createdBy: "other-user", // Different from auth
        userId: "member1",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("プロジェクトメンバーはスレッドを読み取れる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await setDoc(doc(ownerDb, "projects", "project1", "threads", "thread1"), {
      name: "Test Thread",
      createdBy: "owner1",
      userId: "owner1",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      description: null,
      isPublic: null,
      allowedUserIds: null,
    });
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertSucceeds(
      getDoc(doc(memberDb, "projects", "project1", "threads", "thread1")),
    );
  });

  it("スレッド作成者は自分のスレッドを更新できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await setDoc(doc(memberDb, "projects", "project1", "threads", "thread1"), {
      name: "Test Thread",
      createdBy: "member1",
      userId: "member1",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      description: null,
      isPublic: null,
      allowedUserIds: null,
    });

    await assertSucceeds(
      updateDoc(doc(memberDb, "projects", "project1", "threads", "thread1"), {
        name: "Updated Thread",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("スレッド作成者は自分のスレッドを削除できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await setDoc(doc(memberDb, "projects", "project1", "threads", "thread1"), {
      name: "Test Thread",
      createdBy: "member1",
      userId: "member1",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      description: null,
      isPublic: null,
      allowedUserIds: null,
    });

    await assertSucceeds(
      deleteDoc(doc(memberDb, "projects", "project1", "threads", "thread1")),
    );
  });

  it("他のメンバーは他人のスレッドを削除できない", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await setDoc(doc(ownerDb, "projects", "project1", "threads", "thread1"), {
      name: "Owner Thread",
      createdBy: "owner1",
      userId: "owner1",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      description: null,
      isPublic: null,
      allowedUserIds: null,
    });
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertFails(
      deleteDoc(doc(memberDb, "projects", "project1", "threads", "thread1")),
    );
  });
});

describe("Firestore rules / カテゴリ (categories)", () => {
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

  it("オーナーはカテゴリを作成できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await assertSucceeds(
      setDoc(doc(ownerDb, "projects", "project1", "categories", "cat1"), {
        name: "Bug",
        color: "#ff0000",
      }),
    );
  });

  it("設定管理権限を持つメンバーはカテゴリを作成できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "admin1", "admin", "owner1", {
      canManageSettings: true,
    });

    const adminDb = testEnv.authenticatedContext("admin1").firestore();
    await assertSucceeds(
      setDoc(doc(adminDb, "projects", "project1", "categories", "cat1"), {
        name: "Feature",
        color: "#00ff00",
      }),
    );
  });

  it("設定管理権限を持たないメンバーはカテゴリを作成できない", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertFails(
      setDoc(doc(memberDb, "projects", "project1", "categories", "cat1"), {
        name: "Bug",
        color: "#ff0000",
      }),
    );
  });

  it("プロジェクトメンバーはカテゴリを読み取れる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await setDoc(doc(ownerDb, "projects", "project1", "categories", "cat1"), {
      name: "Bug",
      color: "#ff0000",
    });
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertSucceeds(
      getDoc(doc(memberDb, "projects", "project1", "categories", "cat1")),
    );
  });

  it("オーナーはカテゴリを削除できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await setDoc(doc(ownerDb, "projects", "project1", "categories", "cat1"), {
      name: "Bug",
      color: "#ff0000",
    });

    await assertSucceeds(
      deleteDoc(doc(ownerDb, "projects", "project1", "categories", "cat1")),
    );
  });
});

describe("Firestore rules / ロール (roles)", () => {
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

  it("オーナーはロールを作成できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await assertSucceeds(
      setDoc(doc(ownerDb, "projects", "project1", "roles", "designer"), {
        name: "Designer",
        color: "#9c27b0",
        permissions: ["canViewTasks"],
        position: 1,
        isDefault: false,
      }),
    );
  });

  it("設定管理権限を持つメンバーはロールを作成できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "admin1", "admin", "owner1", {
      canManageSettings: true,
    });

    const adminDb = testEnv.authenticatedContext("admin1").firestore();
    await assertSucceeds(
      setDoc(doc(adminDb, "projects", "project1", "roles", "tester"), {
        name: "Tester",
        color: "#ff9800",
        permissions: ["canViewTasks"],
        position: 2,
        isDefault: false,
      }),
    );
  });

  it("設定管理権限を持たないメンバーはロールを作成できない", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertFails(
      setDoc(doc(memberDb, "projects", "project1", "roles", "custom"), {
        name: "Custom Role",
        color: "#000000",
        permissions: [],
        position: 3,
        isDefault: false,
      }),
    );
  });

  it("プロジェクトメンバーはロールを読み取れる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await setDoc(doc(ownerDb, "projects", "project1", "roles", "admin"), {
      name: "Admin",
      color: "#4f7c82",
      permissions: ["canManageSettings"],
      position: 1,
      isDefault: true,
    });
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertSucceeds(
      getDoc(doc(memberDb, "projects", "project1", "roles", "admin")),
    );
  });
});

describe("Firestore rules / ユーザープロジェクト (userProjects)", () => {
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

  it("ユーザーは自分のuserProjectsを作成できる", async () => {
    const userDb = testEnv.authenticatedContext("user1").firestore();
    await assertSucceeds(
      setDoc(doc(userDb, "userProjects", "user1", "projects", "project1"), {
        projectName: "My Project",
        role: "owner",
        lastAccessedAt: serverTimestamp(),
      }),
    );
  });

  it("ユーザーは他人のuserProjectsを作成できない", async () => {
    const userDb = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
      setDoc(doc(userDb, "userProjects", "user2", "projects", "project1"), {
        projectName: "My Project",
        role: "member",
        lastAccessedAt: serverTimestamp(),
      }),
    );
  });

  it("ユーザーは自分のuserProjectsを読み取れる", async () => {
    const userDb = testEnv.authenticatedContext("user1").firestore();
    await setDoc(doc(userDb, "userProjects", "user1", "projects", "project1"), {
      projectName: "My Project",
      role: "owner",
      lastAccessedAt: serverTimestamp(),
    });
    await assertSucceeds(
      getDoc(doc(userDb, "userProjects", "user1", "projects", "project1")),
    );
  });

  it("ユーザーは他人のuserProjectsを読み取れない", async () => {
    const user1Db = testEnv.authenticatedContext("user1").firestore();
    await setDoc(
      doc(user1Db, "userProjects", "user1", "projects", "project1"),
      {
        projectName: "My Project",
        role: "owner",
        lastAccessedAt: serverTimestamp(),
      },
    );

    const user2Db = testEnv.authenticatedContext("user2").firestore();
    await assertFails(
      getDoc(doc(user2Db, "userProjects", "user1", "projects", "project1")),
    );
  });

  it("プロジェクトオーナーは他人のuserProjectsを更新できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await setDoc(
      doc(memberDb, "userProjects", "member1", "projects", "project1"),
      {
        projectName: "Test Project",
        role: "member",
        lastAccessedAt: serverTimestamp(),
      },
    );

    // Owner can update member's userProject
    await assertSucceeds(
      updateDoc(
        doc(ownerDb, "userProjects", "member1", "projects", "project1"),
        {
          projectName: "Updated Project Name",
          role: "admin",
          lastAccessedAt: serverTimestamp(),
        },
      ),
    );
  });
});

describe("Firestore rules / イベント (events)", () => {
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

  it("プロジェクトメンバーはイベントを作成できる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertSucceeds(
      addDoc(collection(memberDb, "projects", "project1", "events"), {
        v: 1,
        type: "task.created",
        origin: "ui",
        actorId: "member1",
        actorName: "Member 1",
        payload: { taskId: "task1", taskTitle: "Test Task" },
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("プロジェクトメンバーはイベントを読み取れる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");
    const eventRef = await addDoc(
      collection(ownerDb, "projects", "project1", "events"),
      {
        v: 1,
        type: "project.created",
        origin: "ui",
        actorId: "owner1",
        actorName: "Owner",
        payload: {},
        createdAt: serverTimestamp(),
      },
    );
    await addProjectMember(ownerDb, "project1", "member1", "member", "owner1");

    const memberDb = testEnv.authenticatedContext("member1").firestore();
    await assertSucceeds(
      getDoc(doc(memberDb, "projects", "project1", "events", eventRef.id)),
    );
  });

  it("非メンバーはイベントを作成できない", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createTestProject(ownerDb, "project1", "owner1");

    const otherDb = testEnv.authenticatedContext("other1").firestore();
    await assertFails(
      addDoc(collection(otherDb, "projects", "project1", "events"), {
        v: 1,
        type: "task.created",
        origin: "ui",
        actorId: "other1",
        actorName: "Other",
        payload: {},
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("公開プロジェクトのイベントは誰でも読み取れる", async () => {
    const ownerDb = testEnv.authenticatedContext("owner1").firestore();
    await createPublicProject(ownerDb, "project1", "owner1");
    const eventRef = await addDoc(
      collection(ownerDb, "projects", "project1", "events"),
      {
        v: 1,
        type: "project.created",
        origin: "ui",
        actorId: "owner1",
        actorName: "Owner",
        payload: {},
        createdAt: serverTimestamp(),
      },
    );

    const otherDb = testEnv.authenticatedContext("other1").firestore();
    await assertSucceeds(
      getDoc(doc(otherDb, "projects", "project1", "events", eventRef.id)),
    );
  });
});

describe("Firestore rules / 保留中の招待 (pendingInvites)", () => {
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

  it("誰でもpendingInvitesを作成できる（unauthenticated）", async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(
      setDoc(doc(guestDb, "pendingInvites", "invite1"), {
        inviteToken: "token123",
        email: "test@example.com",
        projectId: "project1",
        createdAt: serverTimestamp(),
        status: "pending",
      }),
    );
  });

  it("誰でもpendingInvitesを読み取れる", async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore();
    await setDoc(doc(guestDb, "pendingInvites", "invite1"), {
      inviteToken: "token123",
      email: "test@example.com",
      projectId: "project1",
      createdAt: serverTimestamp(),
      status: "pending",
    });
    await assertSucceeds(getDoc(doc(guestDb, "pendingInvites", "invite1")));
  });

  it("認証済みユーザーは自分のメールに関連するpendingInvitesを更新できる", async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore();
    await setDoc(doc(guestDb, "pendingInvites", "invite1"), {
      inviteToken: "token123",
      email: "test@example.com",
      projectId: "project1",
      createdAt: serverTimestamp(),
      status: "pending",
    });

    const userDb = testEnv
      .authenticatedContext("user1", { email: "test@example.com" })
      .firestore();
    await assertSucceeds(
      updateDoc(doc(userDb, "pendingInvites", "invite1"), {
        inviteToken: "token123",
        email: "test@example.com",
        projectId: "project1",
        createdAt: serverTimestamp(),
        status: "completed",
        userId: "user1",
      }),
    );
  });
});

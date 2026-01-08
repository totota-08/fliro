import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import fs from "node:fs";

let testEnv;

export async function setupTestEnv() {
  const projectId = "test-project-" + Date.now();
  testEnv = await initializeTestEnvironment({
    projectId: projectId,
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
  return testEnv;
}

export async function getTestEnv() {
  return testEnv;
}

export async function teardownTestEnv() {
  if (testEnv) {
    await testEnv.cleanup();
  }
}

export async function clearFirestore() {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
}

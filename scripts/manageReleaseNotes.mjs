#!/usr/bin/env node
/**
 * リリースノート管理スクリプト
 *
 * 使用方法:
 *   npm run release-notes add          # 対話形式で新しいリリースノートを追加
 *   npm run release-notes list         # 現在のリリースノート一覧を表示
 *   npm run release-notes init         # 初期データを投入
 *
 * 前提条件:
 *   1. gcloud認証: gcloud auth application-default login
 *   2. .envファイルにVITE_FIREBASE_PROJECT_IDが設定されていること
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as readline from "readline";

// .envファイルからプロジェクトIDを読み込む
function loadProjectIdFromEnv() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(__dirname, "../.env");

  try {
    const envContent = readFileSync(envPath, "utf-8");
    const match = envContent.match(
      /VITE_FIREBASE_PROJECT_ID=['"']?([^'"\n]+)['"']?/,
    );
    if (match) {
      return match[1];
    }
  } catch {
    // .envファイルが存在しない場合は無視
  }

  return null;
}

// 入力を受け取るユーティリティ
function createPrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return {
    question: (query) => new Promise((resolve) => rl.question(query, resolve)),
    close: () => rl.close(),
  };
}

// リリースノート一覧を表示
async function listReleaseNotes(db) {
  console.log("\n=== リリースノート一覧 ===\n");

  const snapshot = await db
    .collection("releaseNotes")
    .orderBy("createdAt", "desc")
    .get();

  if (snapshot.empty) {
    console.log("リリースノートがありません。");
    console.log("初期データを投入するには: npm run release-notes init\n");
    return;
  }

  snapshot.forEach((doc) => {
    const data = doc.data();
    const latest = data.isLatest ? " [最新]" : "";
    console.log(`${data.version}${latest} - ${data.date}`);
    data.changes.forEach((change) => {
      const type = change.type === "feat" ? "✨" : "🔧";
      console.log(`  ${type} ${change.text}`);
    });
    console.log("");
  });
}

// 新しいリリースノートを追加
async function addReleaseNote(db) {
  const prompt = createPrompt();

  console.log("\n=== 新しいリリースノートを追加 ===\n");

  const version = await prompt.question("バージョン (例: alpha-0.3): ");
  const date = await prompt.question("リリース日 (例: 2026年2月): ");

  const changes = [];
  console.log("\n変更内容を入力してください（空行で終了）:");

  while (true) {
    const type = await prompt.question("タイプ (feat/fix) または 空で終了: ");
    if (!type) break;

    if (type !== "feat" && type !== "fix") {
      console.log("featまたはfixを入力してください。");
      continue;
    }

    const text = await prompt.question("内容: ");
    if (text) {
      changes.push({ type, text });
    }
  }

  prompt.close();

  if (changes.length === 0) {
    console.log("変更内容がないため、キャンセルしました。");
    return;
  }

  // 既存の最新フラグを外す
  const existingLatest = await db
    .collection("releaseNotes")
    .where("isLatest", "==", true)
    .get();

  const batch = db.batch();

  existingLatest.forEach((doc) => {
    batch.update(doc.ref, { isLatest: false });
  });

  // 新しいリリースノートを追加
  const newDoc = db.collection("releaseNotes").doc();
  batch.set(newDoc, {
    version,
    date,
    isLatest: true,
    changes,
    createdAt: Timestamp.now(),
  });

  await batch.commit();

  console.log(`\n✓ リリースノート ${version} を追加しました。\n`);
}

// 初期データを投入
async function initReleaseNotes(db) {
  console.log("\n=== 初期データを投入 ===\n");

  const snapshot = await db.collection("releaseNotes").limit(1).get();
  if (!snapshot.empty) {
    console.log("既にリリースノートが存在します。");
    console.log("一覧を確認: npm run release-notes list\n");
    return;
  }

  const initialData = [
    {
      version: "alpha-0.1",
      date: "2025年12月",
      isLatest: true,
      changes: [
        { type: "feat", text: "プロジェクトダッシュボードをリリース" },
        {
          type: "feat",
          text: "タスク管理機能（作成・編集・削除・ステータス変更）",
        },
        { type: "feat", text: "リアルタイムチャット機能" },
        { type: "feat", text: "メンバー招待・ロール管理機能" },
        { type: "feat", text: "アクティビティログ機能" },
        { type: "feat", text: "スコア・成績表機能" },
      ],
      createdAt: Timestamp.fromDate(new Date("2025-12-01")),
    },
  ];

  const batch = db.batch();
  initialData.forEach((data) => {
    const docRef = db.collection("releaseNotes").doc();
    batch.set(docRef, data);
  });

  await batch.commit();

  console.log(`✓ ${initialData.length}件の初期データを投入しました。\n`);
}

// ヘルプを表示
function printHelp() {
  console.log(`
リリースノート管理スクリプト

使用方法:
  npm run release-notes list    リリースノート一覧を表示
  npm run release-notes add     新しいリリースノートを追加（対話形式）
  npm run release-notes init    初期データを投入
  npm run release-notes help    このヘルプを表示

前提条件:
  1. gcloud認証: gcloud auth application-default login
  2. .envファイルにVITE_FIREBASE_PROJECT_IDが設定されていること
`);
}

async function main() {
  const command = process.argv[2];

  if (
    !command ||
    command === "help" ||
    command === "--help" ||
    command === "-h"
  ) {
    printHelp();
    process.exit(0);
  }

  // プロジェクトID読み込み
  const projectId = loadProjectIdFromEnv();
  if (!projectId) {
    console.error("エラー: プロジェクトIDが見つかりません");
    console.error(".envファイルにVITE_FIREBASE_PROJECT_IDを設定してください");
    process.exit(1);
  }

  console.log(`Firebase初期化中... (プロジェクト: ${projectId})`);

  try {
    initializeApp({
      credential: applicationDefault(),
      projectId: projectId,
    });
  } catch (error) {
    console.error("Firebase初期化エラー:");
    console.error("gcloud auth application-default login を実行してください");
    process.exit(1);
  }

  const db = getFirestore();

  switch (command) {
    case "list":
      await listReleaseNotes(db);
      break;
    case "add":
      await addReleaseNote(db);
      break;
    case "init":
      await initReleaseNotes(db);
      break;
    default:
      console.error(`不明なコマンド: ${command}`);
      printHelp();
      process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("エラーが発生しました:", error.message);
  process.exit(1);
});

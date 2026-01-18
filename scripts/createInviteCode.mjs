#!/usr/bin/env node
/**
 * 招待コード作成スクリプト
 *
 * 使用方法:
 *   npm run create-invite-code
 *   npm run create-invite-code -- --max-uses 10 --expires 7d
 *
 * オプション:
 *   --max-uses <number>  使用回数上限（デフォルト: 無制限）
 *   --expires <duration> 有効期限（例: 24h, 7d, 30d）（デフォルト: 無期限）
 *   --count <number>     生成するコード数（デフォルト: 1）
 *
 * 前提条件:
 *   1. Firebase CLIでログイン済み: firebase login
 *   2. gcloud認証済み: gcloud auth application-default login
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// コマンドライン引数をパース
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    maxUses: null,
    expires: null,
    count: 1,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--max-uses":
        options.maxUses = parseInt(args[++i], 10);
        break;
      case "--expires":
        options.expires = args[++i];
        break;
      case "--count":
        options.count = parseInt(args[++i], 10);
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
招待コード作成スクリプト

使用方法:
  npm run create-invite-code
  npm run create-invite-code -- --max-uses 10 --expires 7d

オプション:
  --max-uses <number>  使用回数上限（デフォルト: 無制限）
  --expires <duration> 有効期限（例: 24h, 7d, 30d）（デフォルト: 無期限）
  --count <number>     生成するコード数（デフォルト: 1）
  --help, -h           このヘルプを表示

前提条件:
  1. gcloud認証: gcloud auth application-default login
  2. 正しいプロジェクトを設定: gcloud config set project <project-id>

例:
  npm run create-invite-code                           # 無制限の招待コードを1つ作成
  npm run create-invite-code -- --max-uses 5           # 5回使用可能な招待コードを作成
  npm run create-invite-code -- --expires 7d           # 7日間有効な招待コードを作成
  npm run create-invite-code -- --count 10 --expires 30d  # 30日有効なコードを10個作成
`);
}

// 招待コード生成（XXXX-XXXX-XXXX形式）
function generateCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segment = () =>
    Array.from(
      { length: 4 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  return `${segment()}-${segment()}-${segment()}`;
}

// 有効期限をパース
function parseExpires(expires) {
  if (!expires) return null;

  const match = expires.match(/^(\d+)(h|d)$/);
  if (!match) {
    console.error(`無効な有効期限形式: ${expires}`);
    console.error("有効な形式: 24h, 7d, 30d など");
    process.exit(1);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const now = new Date();
  if (unit === "h") {
    now.setHours(now.getHours() + value);
  } else if (unit === "d") {
    now.setDate(now.getDate() + value);
  }

  return Timestamp.fromDate(now);
}

async function main() {
  const options = parseArgs();

  console.log("Firebase初期化中...");

  try {
    // Application Default Credentialsを使用
    initializeApp({
      credential: applicationDefault(),
    });
  } catch (error) {
    console.error("Firebase初期化エラー:");
    console.error(
      "gcloud auth application-default login を実行してください"
    );
    process.exit(1);
  }

  const db = getFirestore();
  const expiresAt = parseExpires(options.expires);

  console.log("");
  console.log("=== 招待コード作成 ===");
  console.log(`生成数: ${options.count}`);
  console.log(`使用回数上限: ${options.maxUses ?? "無制限"}`);
  console.log(
    `有効期限: ${expiresAt ? expiresAt.toDate().toLocaleString("ja-JP") : "無期限"}`
  );
  console.log("");

  const codes = [];

  for (let i = 0; i < options.count; i++) {
    const code = generateCode();

    const docData = {
      code: code,
      status: "active",
      maxUses: options.maxUses,
      usedCount: 0,
      usedBy: [],
      expiresAt: expiresAt,
      createdAt: Timestamp.now(),
    };

    await db.collection("invitationCodes").add(docData);
    codes.push(code);
    console.log(`✓ 作成完了: ${code}`);
  }

  console.log("");
  console.log("=== 作成された招待コード ===");
  codes.forEach((code) => console.log(code));
  console.log("");

  process.exit(0);
}

main().catch((error) => {
  console.error("エラーが発生しました:", error.message);
  process.exit(1);
});

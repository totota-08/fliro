#!/usr/bin/env node
/**
 * checkAiDesign.mjs — 「AIっぽいデザイン」自動検出チェッカー
 * ========================================
 * Flilo の Deep Green / Card UI デザインシステムから逸脱した
 * 「AI生成にありがちなデザイン」を機械判定する。
 *
 * 使い方:
 *   node scripts/checkAiDesign.mjs <file...>     指定ファイル全体を検査
 *   node scripts/checkAiDesign.mjs --diff [ref]  ref (省略時 origin/develop との merge-base)
 *                                                以降に「追加された行」だけを検査
 *   node scripts/checkAiDesign.mjs --hook        Claude Code PostToolUse フック用
 *                                                (stdin の JSON から編集ファイルを特定し、
 *                                                 HEAD に存在しない行だけを検査。違反時 exit 2)
 *   node scripts/checkAiDesign.mjs --stop        Claude Code Stop フック用
 *                                                (--diff 相当。違反時 exit 2 で終了をブロック)
 *
 * 終了コード:
 *   CLI モード: ERROR 検出時 1 / クリーン時 0
 *   フックモード: ERROR 検出時 2 (stderr に修正指示) / それ以外 0 (fail-open)
 *
 * 検査対象: src 直下の *.vue / *.css
 * 除外: src/styles/ (トークン定義そのもの), src/assets/
 *
 * 判定基準の詳細: .claude/skills/design-review/references/ai-design-checklist.md
 */

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ========================================
// 対象ファイル判定
// ========================================

function isTarget(relPath) {
  const p = relPath.replaceAll("\\", "/");
  if (!p.startsWith("src/")) return false;
  if (p.startsWith("src/styles/")) return false; // トークン定義は生値を持つ
  if (p.startsWith("src/assets/")) return false;
  if (p.startsWith("src/pages/secret/")) return false; // イースターエッグ (意図的なネオン演出)
  if (p.startsWith("src/pages/debug/")) return false; // 開発用ツール画面
  return p.endsWith(".vue") || p.endsWith(".css");
}

// ========================================
// 色ユーティリティ (AIっぽい紫系の検出)
// ========================================

function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) {
    h = [...h].map((c) => c + c).join("");
  }
  if (h.length !== 6 && h.length !== 8) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === rn) h = 60 * (((gn - bn) / d) % 6);
  else if (max === gn) h = 60 * ((bn - rn) / d + 2);
  else h = 60 * ((rn - gn) / d + 4);
  if (h < 0) h += 360;
  return { h, s, l };
}

/**
 * AI生成UIの定番カラー(indigo/violet/purple/magenta 系)かどうか。
 * Flilo の Deep Green パレットに紫系は存在しないため、
 * 彩度のある紫系 = ほぼ確実に「AIっぽい配色」。
 * (info/chart 系の青は hue ≒ 200〜220 なので誤検出しない)
 */
function isAiPurple(rgb) {
  if (!rgb) return false;
  const { h, s, l } = rgbToHsl(rgb);
  return h >= 226 && h <= 335 && s >= 0.3 && l >= 0.3 && l <= 0.85;
}

// ========================================
// ルール定義
// ========================================

// クォート付きフォント名で判定する (font-family が複数行に折り返されても検出できる)
const AI_FONTS =
  /["'](Inter|Poppins|Montserrat|Space Grotesk|Sora|Manrope|DM Sans|Plus Jakarta Sans|Plus Jakarta|Nunito|Quicksand|Raleway|Outfit|Lexend)["']/i;

const SLOP_EMOJI = new Set([
  "✨",
  "🚀",
  "🎉",
  "🔥",
  "⚡",
  "🌟",
  "💫",
  "🪄",
  "🌈",
  "🤖",
  "💡",
  "🎯",
]);

// 絵文字プレゼンテーションのみ検出する (© ™ ↗ 等のテキスト記号は対象外。
// テキスト記号でも VS16 (U+FE0F) で絵文字表示を強制しているものは検出する)
const EMOJI_RE = /(\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F)/gu;
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const FUNC_COLOR_RE = /\b(rgba?|hsla?|oklch|color-mix)\(/;
const RGB_VALUES_RE = /\brgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/;

/**
 * 1ファイル分の違反を収集する。
 * 返り値: { line, severity: "error"|"warn", rule, message }
 */
function collectViolations(relPath, content) {
  const violations = [];
  const isCss = relPath.endsWith(".css");
  const lines = content.split("\n");

  // Vue SFC のトップレベルブロック追跡 (Prettier 整形前提でカラム0のタグを見る)
  let region = isCss ? "style" : "none";
  let inCssComment = false;
  let currentSelector = ""; // floaty-hover 判定用 (直近に開いたルールのセレクタ)

  const add = (line, severity, rule, message) => {
    violations.push({ line, severity, rule, message });
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    let line = lines[i];

    if (!isCss) {
      if (/^<template/.test(line)) {
        region = "template";
        continue;
      }
      if (/^<\/template>/.test(line)) {
        region = "none";
        continue;
      }
      if (/^<script/.test(line)) {
        region = "script";
        continue;
      }
      if (/^<\/script>/.test(line)) {
        region = "none";
        continue;
      }
      if (/^<style/.test(line)) {
        region = "style";
        continue;
      }
      if (/^<\/style>/.test(line)) {
        region = "none";
        continue;
      }
    }

    // ---------- style 領域 ----------
    if (region === "style") {
      // コメント除去 (行単位の簡易処理)
      if (inCssComment) {
        const end = line.indexOf("*/");
        if (end === -1) continue;
        line = line.slice(end + 2);
        inCssComment = false;
      }
      line = line.replace(/\/\*.*?\*\//g, "");
      const openComment = line.indexOf("/*");
      if (openComment !== -1) {
        line = line.slice(0, openComment);
        inCssComment = true;
      }
      if (!line.trim()) continue;

      // セレクタ追跡 (floaty-hover を :hover ルール内に限定するため)
      const braceOpen = line.match(/^\s*([^{}]+)\{/);
      if (braceOpen) currentSelector = braceOpen[1].trim();

      // var(--token, fallback) のフォールバック値は既存コード規約として許容し、
      // 色チェックの対象から外す (トークン参照が主、リテラルは従のため)
      const bare = line.replace(/var\([^)]*\)/g, "var()");

      // 紫系 / 直書きカラー
      const hexes = bare.match(HEX_RE) ?? [];
      for (const hex of hexes) {
        if (isAiPurple(hexToRgb(hex))) {
          add(
            lineNo,
            "error",
            "ai-purple",
            `AI定番の紫系カラー ${hex}。Deep Green パレット (--ui-brand-*) に置き換える`,
          );
        } else {
          add(
            lineNo,
            "error",
            "hardcoded-color",
            `色の直書き ${hex}。ui-tokens.css のトークンを参照する (無ければトークンを追加)`,
          );
        }
      }
      if (hexes.length === 0 && FUNC_COLOR_RE.test(bare)) {
        const rgbMatch = bare.match(RGB_VALUES_RE);
        if (
          rgbMatch &&
          isAiPurple({ r: +rgbMatch[1], g: +rgbMatch[2], b: +rgbMatch[3] })
        ) {
          add(
            lineNo,
            "error",
            "ai-purple",
            `AI定番の紫系カラー ${rgbMatch[0]})。Deep Green パレット (--ui-brand-*) に置き換える`,
          );
        } else {
          add(
            lineNo,
            "error",
            "hardcoded-color",
            "rgb()/hsla() 等の色の直書き。ui-tokens.css のトークンを参照する",
          );
        }
      }
      if (/:\s*[^;{]*\b(white|black)\b/.test(bare)) {
        add(
          lineNo,
          "error",
          "hardcoded-color",
          "名前付きカラー (white/black) の直書き。--ui-surface / --ui-text 系トークンを参照する",
        );
      }

      // グラデーション
      if (/linear-gradient\(\s*135deg/.test(bare)) {
        add(
          lineNo,
          "error",
          "ai-gradient",
          "linear-gradient(135deg …) はAI生成UIの典型。グラデ自体を再検討し、Hero 用途なら --ui-hero-gradient を使う",
        );
      } else if (/\b(linear|radial|conic)-gradient\(/.test(bare)) {
        add(
          lineNo,
          "warn",
          "gradient",
          "グラデーションの直書き。グラデは Hero 等の限定用途のみ (--ui-hero-gradient か新トークン)",
        );
      }

      // グラデ文字 (背景クリップテキスト)
      if (
        /(-webkit-)?background-clip\s*:\s*text/.test(line) ||
        /text-fill-color\s*:\s*transparent/.test(line)
      ) {
        add(
          lineNo,
          "error",
          "gradient-text",
          "グラデ文字 (background-clip: text) はAI生成UIの典型。通常のテキストカラーにする",
        );
      }

      // AI定番 Web フォント
      if (AI_FONTS.test(line)) {
        add(
          lineNo,
          "error",
          "ai-font",
          "AI生成UI定番の Web フォント。--ui-font-sans (system-ui スタック) を使う",
        );
      } else if (
        /font-family\s*:/.test(line) &&
        !/var\(/.test(line) &&
        !/font-family\s*:\s*inherit\b/.test(line)
      ) {
        add(
          lineNo,
          "warn",
          "token-font",
          "font-family の直書き。--ui-font-sans / --ui-font-mono を参照する",
        );
      }

      // ガラスモーフィズム
      if (/backdrop-filter\s*:[^;]*blur/.test(line)) {
        add(
          lineNo,
          "warn",
          "glassmorphism",
          "backdrop-filter: blur (ガラスモーフィズム) はAI生成UIの典型。Card UI (--ui-surface + --ui-shadow-*) で表現する",
        );
      }

      // トークン無視のサイズ系 (warn)
      if (/font-size\s*:\s*[\d.]+(px|rem|em)/.test(line)) {
        add(
          lineNo,
          "warn",
          "token-size",
          "font-size の直書き。--ui-text-xs〜3xl を参照する",
        );
      }
      const radiusMatch = line.match(/border-radius\s*:\s*([^;]+)/);
      if (radiusMatch && !/var\(/.test(radiusMatch[1])) {
        const value = radiusMatch[1].trim();
        if (!/^(0|50%|100%|9999px|inherit)$/.test(value)) {
          add(
            lineNo,
            "warn",
            "token-radius",
            "border-radius の直書き。--ui-radius-sm〜full を参照する",
          );
        }
      }

      // 浮遊ホバー (:hover ルール内のみ。エントランスアニメの開始オフセットは対象外)
      const floatMatch = line.match(/translateY\(\s*-(\d+(?:\.\d+)?)px/);
      if (
        floatMatch &&
        parseFloat(floatMatch[1]) >= 6 &&
        currentSelector.includes(":hover")
      ) {
        add(
          lineNo,
          "warn",
          "floaty-hover",
          `:hover での translateY(-${floatMatch[1]}px) の大きな浮遊はAI生成UIの典型。動きは控えめに (2px 程度まで)`,
        );
      }
      continue;
    }

    // ---------- template 領域 ----------
    if (region === "template") {
      const stripped = line.replace(/<!--.*?-->/g, "");

      // 絵文字 (装飾/アイコン用途の温床)
      for (const m of stripped.matchAll(EMOJI_RE)) {
        const ch = m[0];
        if (SLOP_EMOJI.has(ch)) {
          add(
            lineNo,
            "error",
            "ai-emoji",
            `絵文字 ${ch} はAI生成UIの典型的装飾。アイコンは SVG / 共通コンポーネントを使い、装飾絵文字は削除する`,
          );
        } else {
          add(
            lineNo,
            "warn",
            "emoji",
            `テンプレート内の絵文字 ${ch}。UI装飾なら SVG / 共通コンポーネントに置き換える (ユーザー入力の表示は除く)`,
          );
        }
      }

      // インラインスタイル / SVG の直書きカラー
      const hexes = stripped.match(HEX_RE) ?? [];
      for (const hex of hexes) {
        if (isAiPurple(hexToRgb(hex))) {
          add(
            lineNo,
            "error",
            "ai-purple",
            `テンプレート内のAI定番紫系カラー ${hex}。Deep Green トークンに置き換える`,
          );
        } else {
          add(
            lineNo,
            "warn",
            "template-color",
            `テンプレート内の色直書き ${hex}。SVG は currentColor、それ以外はトークン参照にする`,
          );
        }
      }
      if (/style\s*=\s*"[^"]*gradient/.test(stripped)) {
        add(
          lineNo,
          "error",
          "inline-style",
          "インライン style のグラデーション。scoped CSS + トークンに移す",
        );
      }
      if (/lorem\s+ipsum/i.test(stripped)) {
        add(
          lineNo,
          "error",
          "placeholder-copy",
          "Lorem ipsum は実コンテンツに置き換える",
        );
      }
    }
  }

  return violations;
}

// ========================================
// git ヘルパー
// ========================================

function git(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"],
  });
}

function resolveBaseRef(explicit) {
  if (explicit) return explicit;
  for (const candidate of ["origin/develop", "develop"]) {
    try {
      return git(["merge-base", "HEAD", candidate]).trim();
    } catch {
      /* try next */
    }
  }
  return "HEAD";
}

/** git diff -U0 から「追加された行番号」の集合を得る */
function addedLineNumbers(ref, relPath) {
  let out;
  try {
    out = git(["diff", "-U0", ref, "--", relPath]);
  } catch {
    return null; // diff 不能 → 全行対象
  }
  if (!out.trim()) {
    // 追跡外 (新規ファイル) は全行対象
    try {
      git(["ls-files", "--error-unmatch", relPath]);
      return new Set();
    } catch {
      return null;
    }
  }
  const set = new Set();
  for (const m of out.matchAll(/^@@ [^+]*\+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(m[1]);
    const count = m[2] === undefined ? 1 : Number(m[2]);
    for (let i = 0; i < count; i++) set.add(start + i);
  }
  return set;
}

function changedTargetFiles(ref) {
  const files = new Set();
  try {
    for (const f of git([
      "diff",
      "--name-only",
      "--diff-filter=ACMR",
      ref,
    ]).split("\n")) {
      if (f && isTarget(f)) files.add(f);
    }
    for (const f of git(["ls-files", "--others", "--exclude-standard"]).split(
      "\n",
    )) {
      if (f && isTarget(f)) files.add(f);
    }
  } catch {
    /* git が使えない場合は空 */
  }
  return [...files];
}

// ========================================
// レポート
// ========================================

const GUIDANCE = [
  "修正方針:",
  "  - 色 / 影 / 角丸 / 余白 / フォントは src/styles/ui-tokens.css のトークンを参照する",
  "  - UIパーツ (ボタン/カード/モーダル等) は src/components/ui/ の共通コンポーネントを使う",
  "  - 判定基準の詳細: .claude/skills/design-review/references/ai-design-checklist.md",
].join("\n");

function formatReport(results) {
  const lines = [];
  let errorCount = 0;
  let warnCount = 0;
  for (const { file, violations } of results) {
    for (const v of violations) {
      if (v.severity === "error") errorCount++;
      else warnCount++;
      lines.push(
        `[${v.severity === "error" ? "ERROR" : "WARN"}] ${file}:${v.line} (${v.rule}) ${v.message}`,
      );
    }
  }
  return { text: lines.join("\n"), errorCount, warnCount };
}

// ========================================
// 実行モード
// ========================================

function runCli(files, ref, diffMode) {
  const results = [];
  const targets = diffMode ? changedTargetFiles(ref) : files;
  for (const file of targets) {
    const rel = path.isAbsolute(file) ? path.relative(ROOT, file) : file;
    if (!isTarget(rel)) continue;
    const abs = path.join(ROOT, rel);
    if (!existsSync(abs)) continue;
    let violations = collectViolations(rel, readFileSync(abs, "utf8"));
    if (diffMode) {
      const added = addedLineNumbers(ref, rel);
      if (added !== null) {
        violations = violations.filter((v) => added.has(v.line));
      }
    }
    if (violations.length > 0) results.push({ file: rel, violations });
  }
  const { text, errorCount, warnCount } = formatReport(results);
  if (text) {
    console.log("=== AIっぽいデザインチェック ===");
    console.log(text);
    console.log(`----\nERROR ${errorCount} / WARN ${warnCount}`);
    console.log(GUIDANCE);
  } else {
    console.log(
      `OK: AIっぽいデザインは検出されませんでした (対象 ${targets.length} ファイル)`,
    );
  }
  process.exit(errorCount > 0 ? 1 : 0);
}

function readStdinJson() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

/** PostToolUse フック: 編集されたファイルの「HEAD に無い行」だけを検査 */
function runHook() {
  const input = readStdinJson();
  const filePath =
    input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
  if (!filePath) process.exit(0);
  const rel = path.relative(ROOT, path.resolve(ROOT, filePath));
  if (!isTarget(rel)) process.exit(0);
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) process.exit(0);

  let violations = collectViolations(rel, readFileSync(abs, "utf8"));
  // 既存コード由来の違反で毎回ブロックしないよう、HEAD に存在する行は除外
  let oldLines = null;
  try {
    oldLines = new Set(
      git(["show", `HEAD:${rel}`])
        .split("\n")
        .map((l) => l.trim()),
    );
  } catch {
    /* 新規ファイル → 全行が対象 */
  }
  if (oldLines) {
    const current = readFileSync(abs, "utf8").split("\n");
    violations = violations.filter(
      (v) => !oldLines.has((current[v.line - 1] ?? "").trim()),
    );
  }

  const errors = violations.filter((v) => v.severity === "error");
  if (errors.length === 0) process.exit(0);

  const { text } = formatReport([{ file: rel, violations }]);
  console.error(
    [
      "この編集は「AIっぽいデザイン」条件に該当します。以下を修正してください (やり直し):",
      text,
      GUIDANCE,
    ].join("\n"),
  );
  process.exit(2);
}

/** Stop フック: ターン全体の変更 (develop 比の追加行) を最終ゲートとして検査 */
function runStop() {
  const input = readStdinJson();
  // 無限ループ防止: すでに Stop フックで続行させられている場合は通す
  if (input?.stop_hook_active) process.exit(0);

  const ref = resolveBaseRef();
  const results = [];
  for (const rel of changedTargetFiles(ref)) {
    const abs = path.join(ROOT, rel);
    if (!existsSync(abs)) continue;
    let violations = collectViolations(rel, readFileSync(abs, "utf8")).filter(
      (v) => v.severity === "error",
    );
    const added = addedLineNumbers(ref, rel);
    if (added !== null) {
      violations = violations.filter((v) => added.has(v.line));
    }
    if (violations.length > 0) results.push({ file: rel, violations });
  }
  if (results.length === 0) process.exit(0);

  const { text, errorCount } = formatReport(results);
  console.error(
    [
      `変更内容に「AIっぽいデザイン」条件該当が ${errorCount} 件残っています。修正してから完了してください:`,
      text,
      GUIDANCE,
    ].join("\n"),
  );
  process.exit(2);
}

// ========================================
// main
// ========================================

const args = process.argv.slice(2);

try {
  if (args[0] === "--hook") {
    runHook();
  } else if (args[0] === "--stop") {
    runStop();
  } else if (args[0] === "--diff") {
    runCli([], resolveBaseRef(args[1]), true);
  } else if (args.length > 0) {
    runCli(args, null, false);
  } else {
    console.log(
      "使い方: node scripts/checkAiDesign.mjs <file...> | --diff [ref] | --hook | --stop",
    );
    process.exit(0);
  }
} catch (err) {
  // フックは fail-open (チェッカー自身の不具合で開発を止めない)
  if (args[0] === "--hook" || args[0] === "--stop") {
    console.error(`checkAiDesign: 内部エラーのためスキップ: ${err?.message}`);
    process.exit(0);
  }
  throw err;
}

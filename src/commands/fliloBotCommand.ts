import type { ChatCommand, CommandContext } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const randomPick = (options: string[]): string =>
  options[Math.floor(Math.random() * options.length)] ?? "";

type BotReply = {
  description: string;
  example?: string;
  /** "{mention}" はコマンド引数（例: /hero @tanaka）で置換される */
  replies: string[];
};

const botReplies: Record<string, BotReply> = {
  "/explain": {
    description: "今やっていることを一行で言語化",
    replies: [
      "これは“あとで困らないために今つらい作業”です。",
      "面倒ですが、必要な工程です。",
    ],
  },
  "/why": {
    description: "タスクの存在理由を雑に説明",
    replies: [
      "過去のあなたが未来のあなたを助けようとしました。",
      "消すより残す方が安全だったからです。",
    ],
  },
  "/simple": {
    description: "複雑化チェック",
    replies: [
      "その複雑さは、価値と釣り合っていますか。",
      "一度、削れないか考えてもいいかもしれません。",
    ],
  },
  "/python": {
    description: "思想リマインド",
    replies: ["Readability counts.", "賢さより、分かりやすさです。"],
  },
  "/todo?": {
    description: "次にやることを示す",
    replies: [
      "一番期限が近くて、まだ始まっていないものです。",
      "今はこれ以上増やさなくて大丈夫です。",
    ],
  },
  "/status": {
    description: "今のプロジェクト状態を一言",
    replies: [
      "進んでいます。速度は普通です。",
      "止まっているように見えて、理解は進んでいます。",
    ],
  },
  "/done": {
    description: "完了時の静かな肯定",
    replies: ["完了です。", "一区切りつきました。"],
  },
  "/tired": {
    description: "疲労時のケア",
    replies: ["今日はここまででも進捗です。", "8割で止める判断もあります。"],
  },
  "/panic": {
    description: "焦りの鎮静",
    replies: ["まだ取り返しはつきます。", "git pushは、まだです。"],
  },
  "/coffee": {
    description: "休憩提案",
    replies: [
      "一度席を立っても、タスクは逃げません。☕️",
      "戻ってきたら続きを考えましょう。",
    ],
  },
  "/blame": {
    description: "責任転嫁の冗談",
    replies: ["これは仕様ということで。", "誰かが悪いわけではなさそうです。"],
  },
  "/hero": {
    description: "MVP表彰",
    example: "/hero @tanaka",
    replies: [
      "{mention} は静かに問題を一つ消しました。",
      "目立たない仕事でした。",
    ],
  },
  "/silence": {
    description: "沈黙時の一言",
    replies: ["沈黙も、作業の一部です。", "今は入力中かもしれません。"],
  },
  "/task later": {
    description: "先送りの記録",
    replies: ["“あとで”という箱に入りました。", "忘れないための先送りです。"],
  },
  "/explain task": {
    description: "タスク要約",
    replies: ["やることは明確です。量は多めです。", "分解すると楽になります。"],
  },
  "/bot": {
    description: "Bot自己紹介",
    replies: ["私は進捗を評価しません。", "考えを整理する係です。"],
  },
  "/rules": {
    description: "Flilo思想の再確認",
    replies: ["少なく、分かりやすく。", "迷ったら削ります。"],
  },
  "/refactor": {
    description: "改修衝動の抑制",
    replies: [
      "動いているなら、今日は触らなくていいです。",
      "必要になったら直しましょう。",
    ],
  },
};

/** "/hero @xxx" のみ前方一致、それ以外は完全一致 */
function resolveKey(text: string): string | null {
  const normalized = text.trim().toLowerCase();
  if (normalized.startsWith("/hero")) return "/hero";
  return normalized in botReplies ? normalized : null;
}

export const fliloBotCommand: ChatCommand = {
  name: "Flilo Bot",
  description: "Flilo Bot のユーモラスコマンド",
  example: "/explain",
  humorousOnly: true,
  suggestions: Object.entries(botReplies).map(([name, entry]) => ({
    name,
    description: entry.description,
    example: entry.example ?? name,
  })),
  match: (text: string) => resolveKey(text) !== null,
  execute: async (text: string, _context: CommandContext) => {
    const key = resolveKey(text);
    if (!key) {
      return { success: false, message: "" };
    }
    const mention = text.trim().replace("/hero", "").trim() || "誰か";
    const message = randomPick(botReplies[key]!.replies).replace(
      "{mention}",
      mention,
    );
    if (!message) {
      return { success: false, message: "" };
    }
    await delay(1000);
    return { success: true, message };
  },
};

import type { ChatCommand, CommandContext } from "./types";

type Resolver = (text: string) => string | null;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const randomPick = (options: string[]): string =>
  options.length > 0
    ? (options[Math.floor(Math.random() * options.length)] ?? options[0] ?? "")
    : "";

type BotCommandEntry = {
  name: string;
  description: string;
  example?: string;
  resolve: Resolver;
  match: (normalized: string) => boolean;
};

const botCommands: BotCommandEntry[] = [
  {
    name: "/explain",
    description: "今やっていることを一行で言語化",
    resolve: () =>
      randomPick([
        "これは“あとで困らないために今つらい作業”です。",
        "面倒ですが、必要な工程です。",
      ]),
    match: (text) => text === "/explain",
  },
  {
    name: "/why",
    description: "タスクの存在理由を雑に説明",
    resolve: () =>
      randomPick([
        "過去のあなたが未来のあなたを助けようとしました。",
        "消すより残す方が安全だったからです。",
      ]),
    match: (text) => text === "/why",
  },
  {
    name: "/simple",
    description: "複雑化チェック",
    resolve: () =>
      randomPick([
        "その複雑さは、価値と釣り合っていますか。",
        "一度、削れないか考えてもいいかもしれません。",
      ]),
    match: (text) => text === "/simple",
  },
  {
    name: "/python",
    description: "思想リマインド",
    resolve: () =>
      randomPick(["Readability counts.", "賢さより、分かりやすさです。"]),
    match: (text) => text === "/python",
  },
  {
    name: "/todo?",
    description: "次にやることを示す",
    resolve: () =>
      randomPick([
        "一番期限が近くて、まだ始まっていないものです。",
        "今はこれ以上増やさなくて大丈夫です。",
      ]),
    match: (text) => text === "/todo?",
  },
  {
    name: "/status",
    description: "今のプロジェクト状態を一言",
    resolve: () =>
      randomPick([
        "進んでいます。速度は普通です。",
        "止まっているように見えて、理解は進んでいます。",
      ]),
    match: (text) => text === "/status",
  },
  {
    name: "/done",
    description: "完了時の静かな肯定",
    resolve: () => randomPick(["完了です。", "一区切りつきました。"]),
    match: (text) => text === "/done",
  },
  {
    name: "/tired",
    description: "疲労時のケア",
    resolve: () =>
      randomPick([
        "今日はここまででも進捗です。",
        "8割で止める判断もあります。",
      ]),
    match: (text) => text === "/tired",
  },
  {
    name: "/panic",
    description: "焦りの鎮静",
    resolve: () =>
      randomPick(["まだ取り返しはつきます。", "git pushは、まだです。"]),
    match: (text) => text === "/panic",
  },
  {
    name: "/coffee",
    description: "休憩提案",
    resolve: () =>
      randomPick([
        "一度席を立っても、タスクは逃げません。☕️",
        "戻ってきたら続きを考えましょう。",
      ]),
    match: (text) => text === "/coffee",
  },
  {
    name: "/blame",
    description: "責任転嫁の冗談",
    resolve: () =>
      randomPick([
        "これは仕様ということで。",
        "誰かが悪いわけではなさそうです。",
      ]),
    match: (text) => text === "/blame",
  },
  {
    name: "/hero",
    description: "MVP表彰",
    example: "/hero @tanaka",
    resolve: (text) => {
      const mention = text.replace("/hero", "").trim() || "誰か";
      return randomPick([
        `${mention} は静かに問題を一つ消しました。`,
        "目立たない仕事でした。",
      ]);
    },
    match: (text) => text.startsWith("/hero"),
  },
  {
    name: "/silence",
    description: "沈黙時の一言",
    resolve: () =>
      randomPick(["沈黙も、作業の一部です。", "今は入力中かもしれません。"]),
    match: (text) => text === "/silence",
  },
  {
    name: "/task later",
    description: "先送りの記録",
    resolve: () =>
      randomPick([
        "“あとで”という箱に入りました。",
        "忘れないための先送りです。",
      ]),
    match: (text) => text === "/task later",
  },
  {
    name: "/explain task",
    description: "タスク要約",
    resolve: () =>
      randomPick([
        "やることは明確です。量は多めです。",
        "分解すると楽になります。",
      ]),
    match: (text) => text === "/explain task",
  },
  {
    name: "/bot",
    description: "Bot自己紹介",
    resolve: () =>
      randomPick(["私は進捗を評価しません。", "考えを整理する係です。"]),
    match: (text) => text === "/bot",
  },
  {
    name: "/rules",
    description: "Flilo思想の再確認",
    resolve: () => randomPick(["少なく、分かりやすく。", "迷ったら削ります。"]),
    match: (text) => text === "/rules",
  },
  {
    name: "/refactor",
    description: "改修衝動の抑制",
    resolve: () =>
      randomPick([
        "動いているなら、今日は触らなくていいです。",
        "必要になったら直しましょう。",
      ]),
    match: (text) => text === "/refactor",
  },
];

export const fliloBotCommand: ChatCommand = {
  name: "Flilo Bot",
  description: "Flilo Bot のユーモラスコマンド",
  example: "/explain",
  suggestions: botCommands.map((entry) => ({
    name: entry.name,
    description: entry.description,
    example: entry.example ?? entry.name,
  })),
  match: (text: string) => {
    const normalized = text.trim().toLowerCase();
    return botCommands.some((entry) => entry.match(normalized));
  },
  execute: async (text: string, _context: CommandContext) => {
    const normalized = text.trim().toLowerCase();
    const entry = botCommands.find((item) => item.match(normalized));
    if (!entry) {
      return { success: false, message: "" };
    }
    const message = entry.resolve(text);
    if (!message) {
      return { success: false, message: "" };
    }
    await delay(1000);
    return { success: true, message };
  },
};

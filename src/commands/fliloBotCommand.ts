import type { ChatCommand, CommandContext } from "./types";

type Resolver = (text: string) => string | null;

const randomPick = (options: string[]): string =>
  options.length > 0
    ? (options[Math.floor(Math.random() * options.length)] ?? options[0] ?? "")
    : "";

const responseMap: Array<{
  match: (text: string) => boolean;
  resolve: Resolver;
}> = [
  {
    match: (text) => text.trim() === "/explain",
    resolve: () =>
      randomPick([
        "これは“あとで困らないために今つらい作業”です。",
        "面倒ですが、必要な工程です。",
      ]),
  },
  {
    match: (text) => text.trim() === "/why",
    resolve: () =>
      randomPick([
        "過去のあなたが未来のあなたを助けようとしました。",
        "消すより残す方が安全だったからです。",
      ]),
  },
  {
    match: (text) => text.trim() === "/simple",
    resolve: () =>
      randomPick([
        "その複雑さは、価値と釣り合っていますか。",
        "一度、削れないか考えてもいいかもしれません。",
      ]),
  },
  {
    match: (text) => text.trim() === "/python",
    resolve: () =>
      randomPick(["Readability counts.", "賢さより、分かりやすさです。"]),
  },
  {
    match: (text) => text.trim() === "/todo?",
    resolve: () =>
      randomPick([
        "一番期限が近くて、まだ始まっていないものです。",
        "今はこれ以上増やさなくて大丈夫です。",
      ]),
  },
  {
    match: (text) => text.trim() === "/status",
    resolve: () =>
      randomPick([
        "進んでいます。速度は普通です。",
        "止まっているように見えて、理解は進んでいます。",
      ]),
  },
  {
    match: (text) => text.trim() === "/done",
    resolve: () => randomPick(["完了です。", "一区切りつきました。"]),
  },
  {
    match: (text) => text.trim() === "/tired",
    resolve: () =>
      randomPick([
        "今日はここまででも進捗です。",
        "8割で止める判断もあります。",
      ]),
  },
  {
    match: (text) => text.trim() === "/panic",
    resolve: () =>
      randomPick(["まだ取り返しはつきます。", "git pushは、まだです。"]),
  },
  {
    match: (text) => text.trim() === "/coffee",
    resolve: () =>
      randomPick([
        "一度席を立っても、タスクは逃げません。☕️",
        "戻ってきたら続きを考えましょう。",
      ]),
  },
  {
    match: (text) => text.trim() === "/blame",
    resolve: () =>
      randomPick([
        "これは仕様ということで。",
        "誰かが悪いわけではなさそうです。",
      ]),
  },
  {
    match: (text) => text.trim().startsWith("/hero"),
    resolve: (text) => {
      const mention = text.trim().slice(5).trim() || "誰か";
      return randomPick([
        `${mention} は静かに問題を一つ消しました。`,
        "目立たない仕事でした。",
      ]);
    },
  },
  {
    match: (text) => text.trim() === "/silence",
    resolve: () =>
      randomPick(["沈黙も、作業の一部です。", "今は入力中かもしれません。"]),
  },
  {
    match: (text) => text.trim() === "/task",
    resolve: () => null,
  },
  {
    match: (text) => text.trim() === "/task later",
    resolve: () =>
      randomPick([
        "“あとで”という箱に入りました。",
        "忘れないための先送りです。",
      ]),
  },
  {
    match: (text) => text.trim() === "/explain task",
    resolve: () =>
      randomPick([
        "やることは明確です。量は多めです。",
        "分解すると楽になります。",
      ]),
  },
  {
    match: (text) => text.trim() === "/bot",
    resolve: () =>
      randomPick(["私は進捗を評価しません。", "考えを整理する係です。"]),
  },
  {
    match: (text) => text.trim() === "/rules",
    resolve: () => randomPick(["少なく、分かりやすく。", "迷ったら削ります。"]),
  },
  {
    match: (text) => text.trim() === "/refactor",
    resolve: () =>
      randomPick([
        "動いているなら、今日は触らなくていいです。",
        "必要になったら直しましょう。",
      ]),
  },
];

export const fliloBotCommand: ChatCommand = {
  name: "Flilo Bot",
  description: "Flilo Bot のユーモラスコマンド",
  example: "/explain",
  match: (text: string) =>
    responseMap.some((entry) => entry.match(text.toLowerCase())),
  execute: async (text: string, _context: CommandContext) => {
    const entry = responseMap.find((item) => item.match(text.toLowerCase()));
    if (!entry) {
      return { success: false, message: "" };
    }
    const message = entry.resolve(text);
    if (!message) {
      return { success: false, message: "" };
    }
    return { success: true, message };
  },
};

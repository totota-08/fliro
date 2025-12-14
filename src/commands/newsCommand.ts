import type { ChatCommand, CommandContext } from "./types";

export const newsCommand: ChatCommand = {
  name: "/news",
  description: "最新のテックニュースを取得します",
  example: "/news",
  match: (text: string) => text.startsWith("/news"),
  execute: async (_text: string, _context: CommandContext) => {
    try {
      // 1. Fetch top stories IDs
      const topRes = await fetch(
        "https://hacker-news.firebaseio.com/v0/topstories.json",
      );
      const topIds = await topRes.json();
      const targetIds = topIds.slice(0, 3); // Get top 3

      // 2. Fetch details for each
      const promises = targetIds.map((id: number) =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(
          (r) => r.json(),
        ),
      );
      const stories = await Promise.all(promises);

      // 3. Format message
      let newsText = "📰 **Latest Tech News**\n";
      stories.forEach((story: any) => {
        if (story && story.title) {
          newsText += `• [${story.title}](${
            story.url || `https://news.ycombinator.com/item?id=${story.id}`
          })\n`;
        }
      });

      return {
        success: true,
        message: newsText,
      };
    } catch (e) {
      return {
        success: false,
        message: "⚠️ Failed to fetch news.",
      };
    }
  },
};

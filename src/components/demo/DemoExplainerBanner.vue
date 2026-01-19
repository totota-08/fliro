<script setup lang="ts">
import { appName } from "@/constants/appMeta";

export type DemoPageType = "dashboard" | "tasks" | "team" | "chat";

interface Props {
  page?: DemoPageType;
}

const props = withDefaults(defineProps<Props>(), {
  page: "dashboard",
});

const pageContent: Record<
  DemoPageType,
  {
    title: string;
    description: string;
    highlights: string[];
  }
> = {
  dashboard: {
    title: "ダッシュボード",
    description:
      "プロジェクトの全体像をひと目で把握できるダッシュボードです。期限が迫っているタスクや進行中の作業をすぐに確認し、チーム全体の進捗を管理できます。",
    highlights: [
      "期限切れ・直近期限のタスクを優先表示",
      "タスクの進行状況をリアルタイムに確認",
      "フィルター機能で必要な情報にすぐアクセス",
    ],
  },
  tasks: {
    title: "マイタスク",
    description:
      "あなたに割り当てられたタスクを一覧で管理できます。ステータス、優先度、期限でフィルタリングして、今やるべきことに集中できます。",
    highlights: [
      "進行中・完了タスクをタブで切り替え",
      "優先度と期限で自動的にソート",
      "期限超過タスクは警告表示でお知らせ",
    ],
  },
  team: {
    title: "チーム",
    description:
      "プロジェクトメンバーの一覧と権限管理ができます。メンバーの活動状況やタスク進捗を確認し、チームの生産性を可視化します。",
    highlights: [
      "メンバーのオンライン状況をリアルタイム表示",
      "ロール別の権限管理で安全な運用",
      "招待リンクで簡単にメンバーを追加",
    ],
  },
  chat: {
    title: "スレッド",
    description:
      "チームメンバーとリアルタイムでコミュニケーションできます。タスクごとのスレッドで議論を整理し、重要な決定を見逃しません。",
    highlights: [
      "タスクに紐づいたスレッドで議論を集約",
      "カスタムスレッドで自由なトピック作成",
      "メンションやリアクションでスムーズな連携",
    ],
  },
};

const content = pageContent[props.page];
</script>

<template>
  <section class="banner">
    <div class="banner__content">
      <span class="banner__badge">{{ appName }} デモ</span>
      <h2>{{ content.title }}</h2>
      <p>{{ content.description }}</p>
    </div>
    <ul class="banner__highlights">
      <li v-for="(highlight, index) in content.highlights" :key="index">
        <span class="banner__icon" aria-hidden="true">{{
          String(index + 1).padStart(2, "0")
        }}</span>
        {{ highlight }}
      </li>
    </ul>
  </section>
</template>

<style scoped>
.banner {
  display: grid;
  gap: var(--ui-space-6, 1.5rem);
  grid-template-columns: 1.15fr 1fr;
  align-items: stretch;
  border-radius: var(--ui-radius-2xl, 1.5rem);
  padding: var(--ui-space-8, 2rem);
  background: linear-gradient(
    135deg,
    var(--ui-brand-200, #d4f1f5),
    var(--ui-brand-50, #f5fcff)
  );
  color: var(--ui-brand-900, #0b2e33);
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  box-shadow: var(--ui-shadow-xl, 0 20px 40px rgba(11, 46, 51, 0.12));
}

.banner__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-full, 9999px);
  background: var(--ui-brand-100, #e5f6f8);
  color: var(--ui-brand-900, #0b2e33);
  font-weight: var(--ui-font-semibold, 600);
  font-size: var(--ui-text-xs, 0.75rem);
  letter-spacing: var(--ui-tracking-wider, 0.08em);
  text-transform: uppercase;
}

.banner__content h2 {
  margin: var(--ui-space-3, 0.75rem) 0 0;
  font-size: var(--ui-text-2xl, 1.5rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
}

.banner__content p {
  margin: var(--ui-space-4, 1rem) 0 0;
  line-height: var(--ui-leading-relaxed, 1.625);
  color: var(--ui-text-muted, #64748b);
}

.banner__highlights {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--ui-space-3, 0.75rem);
}

.banner__highlights li {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-3, 0.75rem) var(--ui-space-4, 1rem);
  border-radius: var(--ui-radius-lg, 1rem);
  background: var(--ui-surface-glass, rgba(255, 255, 255, 0.8));
  border: 1px solid var(--ui-border-light, rgba(11, 46, 51, 0.08));
  backdrop-filter: blur(10px);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
  transition: var(--ui-transition-all, all 180ms ease);
}

.banner__highlights li:hover {
  background: var(--ui-surface, #ffffff);
  box-shadow: var(--ui-shadow-md, 0 4px 12px rgba(11, 46, 51, 0.08));
  transform: translateY(calc(-1 * var(--ui-space-1, 0.25rem)));
}

.banner__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--ui-space-10, 2.5rem);
  height: var(--ui-space-10, 2.5rem);
  border-radius: var(--ui-radius-md, 0.75rem);
  background: var(--ui-brand-900, #0b2e33);
  color: var(--ui-brand-50, #f5fcff);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-bold, 700);
  letter-spacing: var(--ui-tracking-wide, 0.05em);
}

/* prefers-reduced-motion 対応 */
@media (prefers-reduced-motion: reduce) {
  .banner__highlights li {
    transition: none;
  }
  .banner__highlights li:hover {
    transform: none;
  }
}

@media (max-width: 960px) {
  .banner {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup lang="ts">
import { appName } from "@/constants/appMeta";
</script>

<template>
  <section class="banner">
    <div class="banner__content">
      <span class="banner__badge">{{ appName }} デモ</span>
      <h2>{{ appName }} デモダッシュボード</h2>
      <p>
        少人数チームが毎日の働き方をどう最適化しているのかを、ハイライトに沿って体験しましょう。サイドバーで主要機能へ
        ナビゲートし、中央ではタスクの流れ、右側ではチームの気配をリアルタイムに確認できます。
      </p>
    </div>
    <ul class="banner__highlights">
      <li>
        <span class="banner__icon" aria-hidden="true">01</span>
        進捗カードでプロジェクト全体を手軽に管理
      </li>
      <li>
        <span class="banner__icon" aria-hidden="true">02</span>
        リアルタイムの会話や更新通知で最新情報をチェック
      </li>
      <li>
        <span class="banner__icon" aria-hidden="true">03</span>
        チームチャットとタスクが連動する情報ハブを活用
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
  letter-spacing: 0.08em;
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
  letter-spacing: 0.05em;
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

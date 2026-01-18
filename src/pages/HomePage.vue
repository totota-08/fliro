<script setup lang="ts">
import { RouterLink } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import BrandLogo from "@/components/common/BrandLogo.vue";
import { ROUTE_NAMES } from "@/constants/routes";
import { useAppMeta } from "@/composables/useAppMeta";

const { appName } = useAppMeta();

const featureCards = [
  {
    title: "直感的なタスク管理",
    description:
      "タスクの作成、担当者の割り当て、期限設定、ステータス変更がスムーズに。カテゴリで整理して効率的に管理できます。",
    icon: "board",
  },
  {
    title: "プロジェクトダッシュボード",
    description:
      "進捗状況、期限間近のタスク、滞留しているタスクを一目で把握。今やるべきことが明確になります。",
    icon: "kanban",
  },
  {
    title: "リアルタイムチャット",
    description:
      "プロジェクトごとのチャットルームで、チームメンバーとリアルタイムにコミュニケーション。",
    icon: "chat",
  },
  {
    title: "チーム＆ロール管理",
    description:
      "メンバーの招待、カスタムロールの作成、きめ細かな権限設定でチームを柔軟に管理できます。",
    icon: "team",
  },
  {
    title: "アクティビティログ",
    description:
      "プロジェクト内の操作履歴を自動記録。誰が何をしたかを追跡し、透明性のあるチーム運営を実現。",
    icon: "settings",
  },
  {
    title: "スコア＆成績表",
    description:
      "タスク完了数や貢献度をスコアで可視化。チームメンバーの活躍を見える化します。",
    icon: "spark",
  },
];

const pricingPlans = [
  {
    name: "フリー",
    price: "¥0",
    unit: "/月",
    highlight: false,
    features: [
      "最大3名まで",
      "タスク管理・チャット",
      "ダッシュボード",
      "基本的なロール設定",
    ],
    cta: "始める",
  },
  {
    name: "スタンダード",
    price: "¥1,200",
    unit: "/月",
    highlight: true,
    ribbon: "人気",
    features: [
      "最大15名まで",
      "すべての機能",
      "カスタムロール＆権限管理",
      "アクティビティログ",
      "スコア＆成績表",
    ],
    cta: "始める",
  },
  {
    name: "エンタープライズ",
    price: "お問い合わせ",
    unit: "",
    highlight: false,
    features: [
      "無制限のメンバー",
      "専任サポート",
      "SLA保証",
      "オンボーディング支援",
    ],
    cta: "お問い合わせ",
  },
];
</script>

<template>
  <div class="landing">
    <header class="landing__header">
      <nav class="landing__nav">
        <div class="landing__brand">
          <span class="landing__logo">
            <BrandLogo class="landing__logo-icon" />
          </span>
          <span class="landing__title">{{ appName }}</span>
        </div>
        <div class="landing__links">
          <a href="#features">機能</a>
          <a href="#pricing">料金</a>
          <RouterLink
            class="landing__link"
            :to="{ name: ROUTE_NAMES.demoDashboard }"
            >デモ</RouterLink
          >
          <AppButton
            :to="{ name: ROUTE_NAMES.login }"
            variant="secondary"
            class="landing__login"
          >
            ログイン
          </AppButton>
          <AppButton :to="{ name: ROUTE_NAMES.signup }" variant="primary"
            >新規登録</AppButton
          >
        </div>
      </nav>
    </header>

    <main>
      <section class="hero" id="demo">
        <div class="hero__content">
          <p class="hero__eyebrow">小〜中規模チームのためのプロジェクト管理</p>
          <h1>「今やるべきこと」が一目でわかる</h1>
          <p>
            {{
              appName
            }}は、タスク管理・チャット・進捗可視化を統合したプロジェクト管理ツールです。
            管理のための管理ではなく、チームの意思決定と実行を加速します。
          </p>
          <div class="hero__actions">
            <AppButton :to="{ name: ROUTE_NAMES.signup }" variant="primary"
              >無料で始める</AppButton
            >
            <AppButton
              :to="{ name: ROUTE_NAMES.demoDashboard }"
              variant="outline"
              >デモを見る</AppButton
            >
          </div>
          <p class="hero__note">フリープランは永久無料 • 3名まで利用可能</p>
        </div>
        <div class="hero__visual">
          <div class="hero-card">
            <header>
              <span />
              <span />
              <span />
            </header>
            <div class="hero-card__body">
              <div>
                <p>Backlog</p>
                <ul>
                  <li>オンボーディング資料の更新</li>
                  <li>初回ユーザー調査の準備</li>
                </ul>
              </div>
              <div>
                <p>In Progress</p>
                <ul>
                  <li>チームダッシュボードの実装</li>
                  <li>デイリースタンドアップの自動化</li>
                </ul>
              </div>
              <div>
                <p>Done</p>
                <ul>
                  <li>Firebase 認証のセットアップ</li>
                  <li>UI コンポーネントの設計</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" class="features">
        <div class="section-heading">
          <p>主な機能</p>
          <h2>チームの生産性を高める機能が揃っています</h2>
        </div>
        <div class="features__grid">
          <article
            v-for="card in featureCards"
            :key="card.title"
            class="feature-card"
          >
            <div class="feature-card__icon" :data-icon="card.icon" />
            <h3>{{ card.title }}</h3>
            <p>{{ card.description }}</p>
          </article>
        </div>
      </section>

      <section id="pricing" class="pricing">
        <div class="section-heading">
          <p>シンプルな料金プラン</p>
          <h2>チームの規模に合わせて選べるプラン</h2>
        </div>
        <div class="pricing__grid">
          <article
            v-for="plan in pricingPlans"
            :key="plan.name"
            class="pricing-card"
            :class="{ 'pricing-card--highlight': plan.highlight }"
          >
            <div v-if="plan.ribbon" class="pricing-card__ribbon">
              {{ plan.ribbon }}
            </div>
            <h3>{{ plan.name }}</h3>
            <div class="pricing-card__price">
              <span>{{ plan.price }}</span>
              <small>{{ plan.unit }}</small>
            </div>
            <ul>
              <li v-for="item in plan.features" :key="item">{{ item }}</li>
            </ul>
            <AppButton
              :to="
                plan.price === 'お問い合わせ'
                  ? undefined
                  : { name: ROUTE_NAMES.signup }
              "
              variant="primary"
              block
            >
              {{ plan.cta }}
            </AppButton>
          </article>
        </div>
      </section>

      <section class="cta">
        <div class="cta__inner">
          <h2>今すぐ{{ appName }}を始めましょう</h2>
          <p>
            フリープランで今すぐ始められます。
            チームの「今やるべきこと」を明確にし、プロジェクトを前に進めましょう。
          </p>
          <AppButton :to="{ name: ROUTE_NAMES.signup }" variant="secondary"
            >無料で始める</AppButton
          >
        </div>
      </section>
    </main>

    <footer class="landing__footer">
      <div class="landing__footer-grid">
        <div>
          <div class="landing__brand landing__brand--footer">
            <span class="landing__logo">
              <BrandLogo class="landing__logo-icon" />
            </span>
            <span class="landing__title">{{ appName }}</span>
          </div>
          <p>チームの「今やるべきこと」を明確にするプロジェクト管理ツール。</p>
        </div>
        <ul>
          <li>製品</li>
          <li><a href="#features">機能</a></li>
          <li><a href="#pricing">料金</a></li>
          <li><a href="#">セキュリティ</a></li>
        </ul>
        <ul>
          <li>サポート</li>
          <li><a href="#">ヘルプセンター</a></li>
          <li><a href="#">お問い合わせ</a></li>
          <li><a href="#">ステータス</a></li>
        </ul>
        <ul>
          <li>会社</li>
          <li><a href="#">会社概要</a></li>
          <li><a href="#">ブログ</a></li>
          <li><a href="#">採用情報</a></li>
        </ul>
      </div>
      <p class="landing__copyright">
        © {{ new Date().getFullYear() }} {{ appName }}. All rights reserved.
      </p>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  min-height: 100vh;
  background: linear-gradient(
    135deg,
    var(--ui-brand-300),
    var(--ui-surface) 45%,
    var(--ui-brand-400)
  );
  color: var(--ui-brand-900);
  display: flex;
  flex-direction: column;
}

.landing__header {
  position: sticky;
  top: 0;
  background: var(--ui-surface-glass);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--ui-border);
  z-index: var(--ui-z-sticky);
}

.landing__nav {
  max-width: 1140px;
  margin: 0 auto;
  padding: var(--ui-space-4) var(--ui-space-6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-4);
}

.landing__brand {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
}

.landing__logo {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.landing__logo-icon {
  width: 100%;
  height: 100%;
}

.landing__title {
  font-size: var(--ui-text-xl);
  font-weight: var(--ui-font-bold);
}

.landing__links {
  display: flex;
  align-items: center;
  gap: var(--ui-space-4);
  flex-wrap: wrap;
}

.landing__links a {
  text-decoration: none;
  color: var(--ui-brand-600);
  font-weight: var(--ui-font-semibold);
}

.landing__links a:hover {
  color: var(--ui-brand-900);
}

.hero {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--ui-space-12);
  align-items: center;
  padding: var(--ui-space-16) var(--ui-space-6) var(--ui-space-8);
  max-width: 1140px;
  margin: 0 auto;
}

.hero__content h1 {
  font-size: clamp(2.5rem, 5vw, 3.75rem);
  margin: var(--ui-space-3) 0 var(--ui-space-4);
}

.hero__content p {
  color: var(--ui-brand-600);
  font-size: var(--ui-text-lg);
  line-height: var(--ui-leading-relaxed);
}

.hero__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: var(--ui-font-semibold);
  color: var(--ui-brand-600);
  font-size: var(--ui-text-sm);
}

.hero__actions {
  display: flex;
  gap: var(--ui-space-4);
  flex-wrap: wrap;
  margin-top: var(--ui-space-8);
}

.hero__note {
  margin-top: var(--ui-space-4);
  font-size: var(--ui-text-sm);
  color: var(--ui-brand-400);
}

.hero__visual {
  display: flex;
  justify-content: center;
}

.hero-card {
  width: min(460px, 100%);
  border-radius: var(--ui-radius-2xl);
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  box-shadow: var(--ui-shadow-2xl);
}

.hero-card header {
  display: flex;
  gap: var(--ui-space-2);
  padding: var(--ui-space-3) var(--ui-space-4);
  border-bottom: 1px solid var(--ui-border-light);
}

.hero-card header span {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: var(--ui-radius-full);
  background: var(--ui-brand-400);
}

.hero-card__body {
  padding: var(--ui-space-5) var(--ui-space-6);
  display: grid;
  gap: var(--ui-space-4);
}

.hero-card__body div {
  padding: var(--ui-space-4);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-surface-accent);
}

.hero-card__body p {
  margin: 0 0 var(--ui-space-1);
  font-weight: var(--ui-font-semibold);
}

.hero-card__body ul {
  margin: 0;
  padding-left: var(--ui-space-4);
  color: var(--ui-brand-600);
}

.section-heading {
  text-align: center;
  max-width: 720px;
  margin: 0 auto var(--ui-space-10);
}

.section-heading p {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ui-brand-600);
  font-weight: var(--ui-font-semibold);
  margin: 0;
}

.section-heading h2 {
  margin: var(--ui-space-2) 0 0;
  font-size: clamp(2rem, 4vw, 3rem);
}

.features,
.pricing,
.cta {
  padding: var(--ui-space-16) var(--ui-space-6);
  background: var(--ui-surface);
}

.features__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--ui-space-6);
  max-width: 1140px;
  margin: 0 auto;
}

.feature-card {
  border: 1px solid var(--ui-brand-300);
  border-radius: var(--ui-radius-2xl);
  padding: var(--ui-space-6);
  background: var(--ui-brand-50);
  transition: var(--ui-transition-all);
}

.feature-card:hover {
  box-shadow: var(--ui-shadow-xl);
  transform: translateY(-4px);
}

.feature-card__icon {
  width: 3rem;
  height: 3rem;
  border-radius: var(--ui-radius-md);
  background: var(--ui-brand-300);
  margin-bottom: var(--ui-space-4);
}

.pricing {
  background: linear-gradient(
    135deg,
    rgba(184, 227, 233, 0.25),
    var(--ui-surface)
  );
}

.pricing__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--ui-space-6);
  max-width: 1140px;
  margin: 0 auto;
}

.pricing-card {
  background: var(--ui-surface);
  border: 2px solid var(--ui-brand-300);
  border-radius: var(--ui-radius-2xl);
  padding: var(--ui-space-8);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6);
}

.pricing-card--highlight {
  border-color: var(--ui-brand-600);
  box-shadow: var(--ui-shadow-2xl);
}

.pricing-card__ribbon {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ui-brand-600);
  color: var(--ui-text-inverse);
  padding: var(--ui-space-1) var(--ui-space-5);
  border-radius: var(--ui-radius-full);
  font-size: var(--ui-text-sm);
  font-weight: var(--ui-font-semibold);
}

.pricing-card__price span {
  font-size: var(--ui-text-3xl);
  font-weight: var(--ui-font-bold);
}

.pricing-card__price small {
  color: var(--ui-brand-400);
  margin-left: var(--ui-space-1);
}

.pricing-card ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.65rem;
  color: var(--ui-brand-600);
}

.cta {
  background: var(--ui-brand-600);
  color: var(--ui-text-inverse);
}

.cta__inner {
  max-width: 720px;
  margin: 0 auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4);
}

.cta__inner p {
  color: var(--ui-brand-300);
  margin: 0;
  line-height: var(--ui-leading-relaxed);
}

.landing__footer {
  background: var(--ui-brand-900);
  color: var(--ui-text-inverse);
  padding: var(--ui-space-12) var(--ui-space-6);
}

.landing__footer-grid {
  max-width: 1140px;
  margin: 0 auto var(--ui-space-8);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--ui-space-8);
}

.landing__footer-grid ul {
  list-style: none;
  margin: 0;
  padding: 0;
  color: var(--ui-brand-400);
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.landing__footer-grid li:first-child {
  font-weight: var(--ui-font-bold);
  color: var(--ui-text-inverse);
}

.landing__footer-grid a {
  color: inherit;
  text-decoration: none;
}

.landing__footer-grid a:hover {
  color: var(--ui-text-inverse);
}

.landing__copyright {
  text-align: center;
  color: var(--ui-brand-400);
  margin: 0;
  font-size: var(--ui-text-sm);
}

@media (max-width: 768px) {
  .landing__nav {
    flex-direction: column;
  }

  .landing__links {
    justify-content: center;
  }

  .hero__actions {
    justify-content: center;
  }
}
</style>

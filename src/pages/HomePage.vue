<script setup lang="ts">
import { RouterLink } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import { ROUTE_NAMES } from "@/constants/routes";
import { useAppMeta } from "@/composables/useAppMeta";

const { appName } = useAppMeta();

const featureCards = [
  {
    title: "直感的なタスク管理",
    description:
      "ドラッグ&ドロップでタスクを簡単に管理。担当者の割り当て、期限設定、ステータス変更がスムーズに行えます。",
    icon: "board",
  },
  {
    title: "リアルタイムチャット",
    description:
      "プロジェクトごとのチャットルームで、チームメンバーとリアルタイムにコミュニケーション。",
    icon: "chat",
  },
  {
    title: "カンバンボード",
    description:
      "視覚的にタスクの進捗を把握。ToDo、進行中、完了のステータスを一目で確認できます。",
    icon: "kanban",
  },
  {
    title: "チーム管理",
    description:
      "メンバーの招待、役割の設定、進捗の確認が簡単。10名前後のチームに最適化されています。",
    icon: "team",
  },
  {
    title: "柔軟な設定",
    description:
      "通知設定、プロジェクトのカスタマイズ、権限管理など、チームに合わせた設定が可能です。",
    icon: "settings",
  },
  {
    title: "チャットからタスク生成",
    description:
      "チャットメッセージから直接タスクを作成。会話の流れを止めずにタスク管理ができます。",
    icon: "spark",
  },
];

const pricingPlans = [
  {
    name: "フリー",
    price: "¥0",
    unit: "/月",
    highlight: false,
    features: ["最大3名まで", "基本的なタスク管理", "チャット機能"],
    cta: "始める",
  },
  {
    name: "スタンダード",
    price: "¥1,200",
    unit: "/月",
    highlight: true,
    ribbon: "人気",
    features: [
      "最大10名まで",
      "すべての機能",
      "優先サポート",
      "データエクスポート",
    ],
    cta: "始める",
  },
  {
    name: "エンタープライズ",
    price: "お問い合わせ",
    unit: "",
    highlight: false,
    features: ["無制限のメンバー", "専任サポート", "カスタム統合", "SLA保証"],
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
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
              />
            </svg>
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
            >無料で始める</AppButton
          >
        </div>
      </nav>
    </header>

    <main>
      <section class="hero" id="demo">
        <div class="hero__content">
          <p class="hero__eyebrow">
            クレジットカード不要・14日間無料トライアル
          </p>
          <h1>チームのタスク管理とコミュニケーションを一つに</h1>
          <p>
            {{
              appName
            }}は、タスク管理とチャットを統合した新しいコラボレーションツールです。
            シンプルで直感的なインターフェースで、チームの生産性を最大化します。
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
          <p class="hero__note">クレジットカード不要 • 14日間無料トライアル</p>
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
            14日間の無料トライアルで、すべての機能をお試しいただけます。
            クレジットカードの登録は不要です。
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
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
                />
              </svg>
            </span>
            <span class="landing__title">{{ appName }}</span>
          </div>
          <p>チームのタスク管理とコミュニケーションを一つに。</p>
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
  background: linear-gradient(135deg, #b8e3e9, #fff 45%, #93b1b5);
  color: #0b2e33;
  display: flex;
  flex-direction: column;
}

.landing__header {
  position: sticky;
  top: 0;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(147, 177, 181, 0.4);
  z-index: 10;
}

.landing__nav {
  max-width: 1140px;
  margin: 0 auto;
  padding: 1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.landing__brand {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
}

.landing__logo {
  width: 40px;
  height: 40px;
  border-radius: 0.75rem;
  background: #4f7c82;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.landing__logo svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: #fff;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.landing__title {
  font-size: 1.25rem;
  font-weight: 700;
}

.landing__links {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.landing__links a {
  text-decoration: none;
  color: #4f7c82;
  font-weight: 600;
}

.landing__links a:hover {
  color: #0b2e33;
}

.hero {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 3rem;
  align-items: center;
  padding: 4rem 1.5rem 2rem;
  max-width: 1140px;
  margin: 0 auto;
}

.hero__content h1 {
  font-size: clamp(2.5rem, 5vw, 3.75rem);
  margin: 0.75rem 0 1rem;
}

.hero__content p {
  color: #4f7c82;
  font-size: 1.1rem;
  line-height: 1.75;
}

.hero__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 600;
  color: #4f7c82;
  font-size: 0.85rem;
}

.hero__actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 2rem;
}

.hero__note {
  margin-top: 1rem;
  font-size: 0.85rem;
  color: #93b1b5;
}

.hero__visual {
  display: flex;
  justify-content: center;
}

.hero-card {
  width: min(460px, 100%);
  border-radius: 1.5rem;
  background: #fff;
  border: 1px solid rgba(147, 177, 181, 0.35);
  box-shadow: 0 40px 70px rgba(11, 46, 51, 0.18);
}

.hero-card header {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(147, 177, 181, 0.2);
}

.hero-card header span {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 999px;
  background: rgba(147, 177, 181, 0.6);
}

.hero-card__body {
  padding: 1.25rem 1.5rem;
  display: grid;
  gap: 1rem;
}

.hero-card__body div {
  padding: 1rem;
  border-radius: 1rem;
  background: rgba(184, 227, 233, 0.35);
}

.hero-card__body p {
  margin: 0 0 0.35rem;
  font-weight: 600;
}

.hero-card__body ul {
  margin: 0;
  padding-left: 1rem;
  color: #4f7c82;
}

.section-heading {
  text-align: center;
  max-width: 720px;
  margin: 0 auto 2.5rem;
}

.section-heading p {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #4f7c82;
  font-weight: 600;
  margin: 0;
}

.section-heading h2 {
  margin: 0.5rem 0 0;
  font-size: clamp(2rem, 4vw, 3rem);
}

.features,
.pricing,
.cta {
  padding: 4rem 1.5rem;
  background: #fff;
}

.features__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  max-width: 1140px;
  margin: 0 auto;
}

.feature-card {
  border: 1px solid #b8e3e9;
  border-radius: 1.5rem;
  padding: 1.75rem;
  background: #f8fcfd;
  transition:
    box-shadow 150ms ease,
    transform 150ms ease;
}

.feature-card:hover {
  box-shadow: 0 25px 40px rgba(11, 46, 51, 0.15);
  transform: translateY(-4px);
}

.feature-card__icon {
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  background: #b8e3e9;
  margin-bottom: 1rem;
}

.pricing {
  background: linear-gradient(135deg, rgba(184, 227, 233, 0.25), #fff);
}

.pricing__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
  max-width: 1140px;
  margin: 0 auto;
}

.pricing-card {
  background: #fff;
  border: 2px solid #b8e3e9;
  border-radius: 1.5rem;
  padding: 2rem;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.pricing-card--highlight {
  border-color: #4f7c82;
  box-shadow: 0 30px 60px rgba(11, 46, 51, 0.25);
}

.pricing-card__ribbon {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: #4f7c82;
  color: #fff;
  padding: 0.3rem 1.2rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
}

.pricing-card__price span {
  font-size: 2.5rem;
  font-weight: 700;
}

.pricing-card__price small {
  color: #93b1b5;
  margin-left: 0.3rem;
}

.pricing-card ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.65rem;
  color: #4f7c82;
}

.cta {
  background: #4f7c82;
  color: #fff;
}

.cta__inner {
  max-width: 720px;
  margin: 0 auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cta__inner p {
  color: #b8e3e9;
  margin: 0;
  line-height: 1.7;
}

.landing__footer {
  background: #0b2e33;
  color: #fff;
  padding: 3rem 1.5rem;
}

.landing__footer-grid {
  max-width: 1140px;
  margin: 0 auto 2rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 2rem;
}

.landing__footer-grid ul {
  list-style: none;
  margin: 0;
  padding: 0;
  color: #93b1b5;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.landing__footer-grid li:first-child {
  font-weight: 700;
  color: #fff;
}

.landing__footer-grid a {
  color: inherit;
  text-decoration: none;
}

.landing__footer-grid a:hover {
  color: #fff;
}

.landing__copyright {
  text-align: center;
  color: #93b1b5;
  margin: 0;
  font-size: 0.9rem;
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

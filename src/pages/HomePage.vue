<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import { ROUTE_NAMES } from '@/constants/routes'
const features = [
  {
    title: '直感的なタスク管理',
    description:
      'ドラッグ&ドロップでタスクを簡単に管理。担当者の割り当て、期限設定、ステータス変更がスムーズに行えます。',
    icon: 'board',
  },
  {
    title: 'リアルタイムチャット',
    description:
      'プロジェクトごとのチャットルームで、チームメンバーとリアルタイムにコミュニケーション。',
    icon: 'chat',
  },
  {
    title: 'カンバンボード',
    description: '視覚的にタスクの進捗を把握。ToDo、進行中、完了のステータスを一目で確認できます。',
    icon: 'kanban',
  },
  {
    title: 'チーム管理',
    description: 'メンバーの招待、役割の設定、進捗の確認が簡単。10名前後のチームに最適化されています。',
    icon: 'team',
  },
  {
    title: '柔軟な設定',
    description: '通知設定、プロジェクトのカスタマイズ、権限管理など、チームに合わせた設定が可能です。',
    icon: 'settings',
  },
  {
    title: 'チャットからタスク生成',
    description: 'チャットメッセージから直接タスクを作成。会話の流れを止めずにタスク管理ができます。',
    icon: 'spark',
  },
]

const pricingPlans = [
  {
    name: 'フリー',
    price: '¥0',
    unit: '/月',
    highlight: false,
    features: ['最大3名まで', '基本的なタスク管理', 'チャット機能'],
    cta: '始める',
  },
  {
    name: 'スタンダード',
    price: '¥1,200',
    unit: '/月',
    highlight: true,
    ribbon: '人気',
    features: ['最大10名まで', 'すべての機能', '優先サポート', 'データエクスポート'],
    cta: '始める',
  },
  {
    name: 'エンタープライズ',
    price: 'お問い合わせ',
    unit: '',
    highlight: false,
    features: ['無制限のメンバー', '専任サポート', 'カスタム統合', 'SLA保証'],
    cta: 'お問い合わせ',
  },
]
</script>

<template>
  <div class="landing">
    <header class="landing__header">
      <div class="landing__brand">
        <span class="landing__logo">Teamie</span>
        <span class="landing__tagline">少人数チームのためのプロジェクト管理</span>
      </div>
      <nav class="landing__nav">
        <a class="landing__link" href="#features">機能</a>
        <a class="landing__link" href="#workflow">ワークフロー</a>
        <a class="landing__link" href="#faq">FAQ</a>
        <RouterLink class="landing__cta" :to="{ name: ROUTE_NAMES.login }">ログイン</RouterLink>
        <RouterLink class="landing__cta landing__cta--primary" :to="{ name: ROUTE_NAMES.signup }">
          無料で始める
        </RouterLink>
      </nav>
    </header>

    <main class="landing__main">
      <section class="hero">
        <div class="hero__content">
          <h1>チームの動きを可視化し、スムーズな連携を。</h1>
          <p>
            Teamie は、少人数チームのための軽量なプロジェクト管理ツールです。
            タスク、進捗、コミュニケーションをひとつにまとめ、日々の連携を滑らかにします。
            ここに書いてあることは全て仮です無視してください。
          </p>
          <div class="hero__actions">
            <AppButton :to="{ name: ROUTE_NAMES.signup }" variant="primary">
              無料で始める
            </AppButton>
            <AppButton :to="{ name: ROUTE_NAMES.login }" variant="secondary">
              ログイン
            </AppButton>
          </div>
        </div>
        <div class="hero__visual">
          <div class="dashboard-mock">
            <div class="dashboard-mock__header">
              <span class="dot" />
              <span class="dot" />
              <span class="dot" />
            </div>
            <div class="dashboard-mock__body">
              <div class="card card--backlog">
                <h3>Backlog</h3>
                <ul>
                  <li>オンボーディング資料の更新</li>
                  <li>初回ユーザー調査の準備</li>
                </ul>
              </div>
              <div class="card card--progress">
                <h3>In Progress</h3>
                <ul>
                  <li>チームダッシュボードの実装</li>
                  <li>デイリースタンドアップの自動化</li>
                </ul>
              </div>
              <div class="card card--done">
                <h3>Done</h3>
                <ul>
                  <li>Firebase 認証のセットアップ</li>
                  <li>UI コンポーネントの設計</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" class="section">
        <h2>Teamie が提供すること</h2>
        <div class="feature-grid">
          <article v-for="feature in features" :key="feature.title" class="feature-card">
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.description }}</p>
          </article>
        </div>
      </section>

      <section id="workflow" class="section">
        <h2>導入から運用までのシンプルなステップ</h2>
        <ol class="workflow-list">
          <li v-for="step in workflowSteps" :key="step.step">
            <h3>{{ step.step }}</h3>
            <p>{{ step.detail }}</p>
          </li>
        </ol>
      </section>

      <section id="faq" class="section">
        <h2>よくあるご質問</h2>
        <div class="faq">
          <details>
            <summary>小規模チームでも使いやすいですか？</summary>
            <p>最大 10 名ほどのチームでの運用を想定したシンプルな UI/UX を提供します。</p>
          </details>
          <details>
            <summary>どのような認証に対応していますか？</summary>
            <p>Firebase Authentication を中心に、Google アカウント連携をサポート予定です。</p>
          </details>
          <details>
            <summary>料金体系はどうなりますか？</summary>
            <p>ベータ版期間中は無料でお使いいただけます。正式リリース後の料金は検討中です。</p>
          </details>
        </div>
      </section>
    </main>

    <footer class="landing__footer">
      <p>© {{ new Date().getFullYear() }} Teamie</p>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  background: var(--surface-elevated);
}

.landing__header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 3rem;
  background: var(--surface-muted);
  border-bottom: 1px solid var(--border);
}

.landing__brand {
  display: flex;
  flex-direction: column;
}

.landing__logo {
  font-weight: 700;
  font-size: 1.5rem;
  color: var(--primary);
}

.landing__tagline {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.landing__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.landing__link {
  color: var(--text);
  text-decoration: none;
  font-weight: 500;
}

.landing__link:hover {
  color: var(--primary);
}

.landing__cta {
  border-radius: 999px;
  padding: 0.5rem 1.25rem;
  font-weight: 600;
  border: 1px solid var(--border);
  text-decoration: none;
  color: var(--primary-strong);
}

.landing__cta--primary {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.landing__main {
  flex: 1;
  padding: 3rem;
}

.landing__footer {
  padding: 1.5rem 3rem;
  text-align: center;
  background: var(--surface-muted);
  border-top: 1px solid var(--border);
  color: var(--text-muted);
}

.landing__cta:hover {
  border-color: var(--primary);
}

.landing__cta--primary:hover {
  background: var(--primary-strong);
  border-color: var(--primary-strong);
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
  transition: box-shadow 150ms ease, transform 150ms ease;
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
  .landing__header,
  .landing__footer {
    padding: 1.25rem 1.5rem;
  }

  .landing__nav {
    width: 100%;
    justify-content: flex-start;
  }

  .hero {
    gap: 2.5rem;
  }

  .landing__links {
    justify-content: center;
  }

  .hero__actions {
    justify-content: center;
  }
}
</style>

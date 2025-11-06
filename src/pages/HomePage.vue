<script setup lang="ts">
import { RouterLink } from 'vue-router'
const features = [
  {
    title: 'タスク管理',
    description: 'チームのタスクを視覚的に整理し、担当者とステータスを素早く把握できます。',
  },
  {
    title: '進捗レポート',
    description: '日次・週次の進捗を自動で集計し、プロジェクトの健康状態を共有できます。',
  },
  {
    title: 'コミュニケーション',
    description: 'コメントやメンション機能で、コンテキストを失わずにやり取りができます。',
  },
]

const workflowSteps = [
  {
    step: '① プロジェクトを作成',
    detail: 'テンプレートからプロジェクトをセットアップ。必要な一覧が最初から揃っています。',
  },
  {
    step: '② タスクを分解',
    detail: 'チームメンバーにタスクを割り当て、期限と優先度を設定します。',
  },
  {
    step: '③ 進捗を共有',
    detail: 'ステータス更新はワンクリック。自動生成レポートで関係者に透明性を提供します。',
  },
]
</script>

<template>
  <section class="hero">
    <div class="hero__content">
      <h1>チームの動きを可視化し、スムーズな連携を。</h1>
      <p>
        Teamie は、少人数チームのための軽量なプロジェクト管理ツールです。
        タスク、進捗、コミュニケーションをひとつにまとめ、日々の連携を滑らかにします。
        ここに書いてあることは全て仮です無視してください。
      </p>
      <div class="hero__actions">
        <button type="button" class="cta-primary">無料で始める</button>
        <RouterLink to="/demo/dashboard" class="cta-secondary">デモを見る</RouterLink>
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
</template>

<style scoped>
.hero {
  display: grid;
  gap: 4rem;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  align-items: center;
  margin-bottom: 4rem;
}

.hero__content {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.hero__content h1 {
  font-size: clamp(2.5rem, 4vw, 3.5rem);
  font-weight: 700;
  color: var(--text-strong);
  line-height: 1.2;
}

.hero__content p {
  margin-top: 1.5rem;
  font-size: 1.05rem;
  color: var(--text-muted);
  line-height: 1.75;
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 2rem;
}

.cta-primary,
.cta-secondary {
  border-radius: 999px;
  padding: 0.85rem 1.8rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.cta-primary {
  background: var(--primary);
  color: var(--surface-elevated);
  box-shadow: 0 10px 25px rgba(79, 124, 130, 0.25);
}

.cta-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(79, 124, 130, 0.35);
}

.cta-secondary {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--primary-strong);
}

.cta-secondary:hover {
  transform: translateY(-1px);
  border-color: var(--primary);
}

.hero__note {
  margin-top: 1.5rem;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.hero__visual {
  display: flex;
  justify-content: center;
}

.dashboard-mock {
  width: min(100%, 420px);
  border-radius: 1.5rem;
  background: var(--surface-elevated);
  box-shadow: 0 25px 50px rgba(11, 46, 51, 0.18);
  overflow: hidden;
  border: 1px solid var(--border-light);
}

.dashboard-mock__header {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--surface-muted);
}

.dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  background: var(--border-light);
}

.dashboard-mock__body {
  display: grid;
  gap: 1rem;
  padding: 1.5rem;
}

.card {
  border-radius: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-strong);
}

.card ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.5rem;
  color: var(--text-muted);
  font-size: 0.95rem;
}

.card--backlog {
  background: var(--surface);
}

.card--progress {
  background: var(--surface-muted);
}

.card--done {
  background: var(--primary);
  color: var(--surface-elevated);
}

.card--done h3,
.card--done ul {
  color: var(--surface-elevated);
}

.section {
  margin-bottom: 4rem;
}

.section h2 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-strong);
  margin-bottom: 2rem;
  text-align: center;
}

.feature-grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.feature-card {
  padding: 1.75rem;
  border-radius: 1.25rem;
  background: var(--surface-elevated);
  border: 1px solid var(--border-light);
  box-shadow: 0 12px 25px rgba(11, 46, 51, 0.12);
}

.feature-card h3 {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text-strong);
}

.feature-card p {
  color: var(--text-muted);
  line-height: 1.7;
}

.workflow-list {
  display: grid;
  gap: 1.5rem;
  list-style: none;
  padding: 0;
  max-width: 720px;
  margin: 0 auto;
}

.workflow-list h3 {
  font-weight: 600;
  color: var(--text-strong);
}

.workflow-list p {
  margin-top: 0.5rem;
  color: var(--text-muted);
}

.faq {
  max-width: 720px;
  margin: 0 auto;
  display: grid;
  gap: 1rem;
}

details {
  border-radius: 1rem;
  padding: 1.25rem 1.5rem;
  background: var(--surface-elevated);
  border: 1px solid var(--border-light);
  cursor: pointer;
}

summary {
  font-weight: 600;
  color: var(--text-strong);
}

details[open] summary {
  margin-bottom: 0.75rem;
}

details p {
  color: var(--text-muted);
  line-height: 1.7;
}

@media (max-width: 768px) {
  .hero {
    gap: 2.5rem;
  }

  .hero__content {
    text-align: center;
  }

  .hero__actions {
    justify-content: center;
  }
}
</style>

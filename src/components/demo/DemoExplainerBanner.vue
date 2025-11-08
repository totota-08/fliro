<template>
  <section class="banner">
    <div class="banner__content">
      <span class="banner__badge">Teamie デモ</span>
      <h2>Teamie デモダッシュボード</h2>
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
  gap: 1.5rem;
  grid-template-columns: 1.15fr 1fr;
  align-items: stretch;
  border-radius: 1.5rem;
  padding: 2rem;
  background: linear-gradient(135deg, rgba(184, 227, 233, 0.55), rgba(245, 252, 255, 0.95));
  color: #0b2e33;
  border: 1px solid rgba(11, 46, 51, 0.12);
  box-shadow: 0 20px 40px rgba(11, 46, 51, 0.12);
}

.banner__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: rgba(11, 46, 51, 0.08);
  color: var(--primary-strong, #0b2e33);
  font-weight: 600;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.banner__content h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.banner__content p {
  margin: 1rem 0 0;
  line-height: 1.8;
  color: var(--text-muted);
}

.banner__highlights {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}

.banner__highlights li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(11, 46, 51, 0.08);
  backdrop-filter: blur(10px);
  font-weight: 600;
}

.banner__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.75rem;
  background: rgba(11, 46, 51, 0.85);
  color: #f5fcff;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

@media (max-width: 960px) {
  .banner {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import BrandLogo from "@/components/common/BrandLogo.vue";
import { ROUTE_NAMES } from "@/constants/routes";
import { useAppMeta } from "@/composables/useAppMeta";
import { APP_CONFIG } from "@/config/appConfig";
import { useScrollAnimation } from "@/composables/useScrollAnimation";
import {
  fetchReleaseNotes,
  type ReleaseNote,
} from "@/services/releaseNotesService";
import { fetchLandingPageStats } from "@/services/statsService";
import { getSampleProjectId } from "@/features/admin/services/appConfigService";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("app.pages.HomePage");
const { appName } = useAppMeta();

// サンプルプロジェクトID（Firestoreから取得、フォールバックはappConfig）
const sampleProjectId = ref(APP_CONFIG.sampleProjectId);

// スクロールアニメーション用のref
const { elementRef: heroRef, isVisible: heroVisible } = useScrollAnimation({
  threshold: 0.1,
});
const { elementRef: featuresRef, isVisible: featuresVisible } =
  useScrollAnimation({ threshold: 0.1 });
const { elementRef: statsRef, isVisible: statsVisible } = useScrollAnimation({
  threshold: 0.2,
});
const { elementRef: pricingRef, isVisible: pricingVisible } =
  useScrollAnimation({ threshold: 0.1 });
const { elementRef: releasesRef, isVisible: releasesVisible } =
  useScrollAnimation({ threshold: 0.1 });
const { elementRef: ctaRef, isVisible: ctaVisible } = useScrollAnimation({
  threshold: 0.2,
});

// カウントアップアニメーション用の状態
const countUpStarted = ref(false);
const isLoadingStats = ref(true);
const stats = ref([
  { label: "完了したタスク", value: 0, target: 0, suffix: "件" },
  { label: "参加チーム", value: 0, target: 0, suffix: "チーム" },
]);

// Firestoreから統計データを取得
async function loadStats() {
  try {
    const data = await fetchLandingPageStats();
    const tasksStat = stats.value.find((s) => s.label === "完了したタスク");
    const projectsStat = stats.value.find((s) => s.label === "参加チーム");
    if (tasksStat) tasksStat.target = data.completedTasks;
    if (projectsStat) projectsStat.target = data.activeProjects;
  } catch (error) {
    logger.error`Failed to fetch landing page stats: ${error}`;
    // フォールバック値を設定
    const tasksStat = stats.value.find((s) => s.label === "完了したタスク");
    const projectsStat = stats.value.find((s) => s.label === "参加チーム");
    if (tasksStat) tasksStat.target = 100;
    if (projectsStat) projectsStat.target = 10;
  } finally {
    isLoadingStats.value = false;
  }
}

// statsが見えたらカウントアップ開始
const startCountUp = () => {
  if (countUpStarted.value || isLoadingStats.value) return;
  countUpStarted.value = true;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (prefersReducedMotion) {
    stats.value.forEach((stat) => {
      stat.value = stat.target;
    });
    return;
  }

  const duration = 2000;
  const startTime = performance.now();

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);

    stats.value.forEach((stat) => {
      stat.value = Math.floor(stat.target * eased);
    });

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      stats.value.forEach((stat) => {
        stat.value = stat.target;
      });
    }
  };

  requestAnimationFrame(animate);
};

// statsVisibleの変化を監視
const checkStatsVisibility = computed(() => {
  if (statsVisible.value && !countUpStarted.value && !isLoadingStats.value) {
    startCountUp();
  }
  return statsVisible.value;
});

// リリースノート（Firestoreから取得、フォールバック用のデフォルト値あり）
const releaseNotes = ref<ReleaseNote[]>([]);
const isLoadingReleases = ref(true);

// デフォルトのリリースノート（Firestore未設定時のフォールバック）
const defaultReleaseNotes: ReleaseNote[] = [
  {
    id: "alpha-0.2",
    version: "alpha-0.2",
    date: "2026年1月",
    isLatest: true,
    changes: [
      { type: "feat", text: "ゲスト閲覧機能をリリース - 外部共有が可能に" },
      {
        type: "feat",
        text: "モバイルUI改善 - スワイプ操作・プルトゥリフレッシュ対応",
      },
      { type: "feat", text: "ダッシュボードカスタマイズ機能" },
    ],
  },
  {
    id: "alpha-0.1",
    version: "alpha-0.1",
    date: "2025年12月",
    isLatest: false,
    changes: [
      { type: "feat", text: "プロジェクトダッシュボードをリリース" },
      {
        type: "feat",
        text: "タスク管理機能（作成・編集・削除・ステータス変更）",
      },
      { type: "feat", text: "リアルタイムチャット機能" },
      { type: "feat", text: "メンバー招待・ロール管理機能" },
      { type: "feat", text: "アクティビティログ機能" },
      { type: "feat", text: "スコア・成績表機能" },
    ],
  },
];

onMounted(async () => {
  // 統計データ、リリースノート、サンプルプロジェクトIDを並行取得
  await Promise.all([
    loadStats(),
    (async () => {
      const notes = await fetchReleaseNotes(10);
      if (notes.length > 0) {
        releaseNotes.value = notes;
      } else {
        // Firestoreにデータがない場合はデフォルト値を使用
        releaseNotes.value = defaultReleaseNotes;
      }
      isLoadingReleases.value = false;
    })(),
    (async () => {
      const projectId = await getSampleProjectId();
      if (projectId) {
        sampleProjectId.value = projectId;
      }
    })(),
  ]);
});

// テンプレートで使用するrefを公開（vue-tscの未使用変数警告を回避）
defineExpose({
  heroRef,
  featuresRef,
  statsRef,
  pricingRef,
  releasesRef,
  ctaRef,
});

// コア機能（大きく表示）
const coreFeatures = [
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
      "スレッド機能、リアクション、メンションを搭載。プロジェクトごとのチャットで効率的にコミュニケーション。",
    icon: "chat",
  },
];

// その他の機能（コンパクトに表示）
const otherFeatures = [
  {
    title: "チーム＆ロール管理",
    description:
      "メンバーの招待、カスタムロールの作成、きめ細かな権限設定でチームを柔軟に管理できます。",
    icon: "team",
  },
  {
    title: "ゲスト閲覧機能",
    description:
      "プロジェクトを外部に共有可能。クライアントやステークホルダーに進捗をリアルタイムで共有できます。",
    icon: "eye",
  },
  {
    title: "モバイル最適化",
    description:
      "スマートフォンでも快適に操作。スワイプ操作やプルトゥリフレッシュで直感的にタスク管理ができます。",
    icon: "mobile",
  },
  {
    title: "通知＆メンション",
    description:
      "タスクの期限や更新、@メンションをリアルタイムで通知。重要な情報を見逃しません。",
    icon: "bell",
  },
  {
    title: "マイタスク",
    description:
      "自分に割り当てられたタスクを一覧で確認。優先度や期限でソートして効率的に作業を進められます。",
    icon: "check-circle",
  },
  {
    title: "アクティビティログ",
    description:
      "プロジェクト内の操作履歴を自動記録。誰が何をしたかを追跡し、透明性のあるチーム運営を実現。",
    icon: "activity",
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
    cta: "まず試す",
    variant: "secondary" as const,
  },
  {
    name: "スタンダード",
    price: "¥1,200",
    unit: "/月",
    highlight: true,
    ribbon: "人気",
    prefix: "フリープランの全機能に加えて：",
    features: [
      "最大15名まで",
      "カスタムロール＆権限管理",
      "アクティビティログ",
      "スコア＆成績表",
    ],
    cta: "始める",
    variant: "primary" as const,
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
    variant: "secondary" as const,
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
          <a href="#features" class="landing__link">機能</a>
          <a href="#pricing" class="landing__link">料金</a>
          <div class="landing__buttons">
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
        </div>
      </nav>
    </header>

    <main>
      <section
        ref="heroRef"
        class="hero"
        id="demo"
        :class="{ 'is-visible': heroVisible }"
      >
        <div class="hero__content">
          <p class="hero__eyebrow animate-fade-up" style="--delay: 0ms">
            管理に追われず、実行に集中したいチームへ
          </p>
          <h1 class="animate-fade-up" style="--delay: 100ms">
            「今やるべきこと」が<br class="hero__br" />一目でわかる
          </h1>
          <p class="animate-fade-up" style="--delay: 200ms">
            毎朝「何から始めればいい？」と迷う時間をゼロに。{{
              appName
            }}はチームの優先順位を明確にし、意思決定と実行を加速します。
          </p>
          <div class="hero__actions animate-fade-up" style="--delay: 300ms">
            <AppButton :to="{ name: ROUTE_NAMES.signup }" variant="primary"
              >無料で始める</AppButton
            >
            <AppButton
              :to="`/projects/${sampleProjectId}/dashboard`"
              variant="secondary"
              >サンプルを見る</AppButton
            >
          </div>
          <p class="hero__note animate-fade-up" style="--delay: 400ms">
            フリープランは永久無料 • 3名まで利用可能
          </p>
        </div>
        <div class="hero__visual animate-fade-up" style="--delay: 200ms">
          <div class="hero-card">
            <header>
              <span class="hero-card__dot hero-card__dot--red" />
              <span class="hero-card__dot hero-card__dot--yellow" />
              <span class="hero-card__dot hero-card__dot--green" />
            </header>
            <div class="hero-card__body hero-card__body--now-first">
              <!-- いまやること（フォーカス） -->
              <div
                class="hero-card__section hero-card__section--now animate-slide-up"
                style="--delay: 400ms"
              >
                <p class="hero-card__label hero-card__label--now">
                  いまやること
                </p>
                <div class="hero-card__focus-task">
                  <span class="hero-card__focus-indicator" />
                  チームダッシュボードの実装
                </div>
              </div>

              <!-- 次にやること -->
              <div
                class="hero-card__section hero-card__section--next animate-slide-up"
                style="--delay: 500ms"
              >
                <p class="hero-card__label hero-card__label--next">
                  次にやること
                </p>
                <ul class="hero-card__next-list">
                  <li>デイリースタンドアップの自動化</li>
                  <li>オンボーディング資料の更新</li>
                </ul>
              </div>

              <!-- 完了 -->
              <div
                class="hero-card__section hero-card__section--done animate-slide-up"
                style="--delay: 600ms"
              >
                <p class="hero-card__label hero-card__label--done">完了</p>
                <ul class="hero-card__done-list">
                  <li>
                    <span class="hero-card__check">✓</span>
                    Firebase 認証のセットアップ
                  </li>
                  <li>
                    <span class="hero-card__check">✓</span>
                    UI コンポーネントの設計
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 統計セクション -->
      <section
        ref="statsRef"
        class="stats"
        :class="{ 'is-visible': checkStatsVisibility }"
      >
        <div class="stats__grid">
          <div
            v-for="(stat, index) in stats"
            :key="stat.label"
            class="stat-card animate-fade-up"
            :style="{ '--delay': `${index * 100}ms` }"
          >
            <span class="stat-card__value"
              >{{ stat.value }}{{ stat.suffix }}</span
            >
            <span class="stat-card__label">{{ stat.label }}</span>
          </div>
        </div>
      </section>

      <section
        ref="featuresRef"
        id="features"
        class="features"
        :class="{ 'is-visible': featuresVisible }"
      >
        <div class="section-heading animate-fade-up" style="--delay: 0ms">
          <p>主な機能</p>
          <h2>チームの生産性を高める機能が揃っています</h2>
        </div>
        <!-- コア機能（大きく表示） -->
        <div class="features__grid features__grid--core">
          <article
            v-for="(card, index) in coreFeatures"
            :key="card.title"
            class="feature-card feature-card--core animate-fade-up"
            :style="{ '--delay': `${index * 100 + 100}ms` }"
          >
            <div class="feature-card__icon feature-card__icon--core">
              <!-- チェックリスト -->
              <svg
                v-if="card.icon === 'board'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 9h.01M15 9h.01M9 15h.01M15 15h.01" />
                <path d="M7 9h2M7 15h2M13 9h2M13 15h2" />
              </svg>
              <!-- ダッシュボード -->
              <svg
                v-else-if="card.icon === 'kanban'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="4" rx="1" />
                <rect x="14" y="10" width="7" height="11" rx="1" />
                <rect x="3" y="13" width="7" height="8" rx="1" />
              </svg>
              <!-- チャット -->
              <svg
                v-else-if="card.icon === 'chat'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                />
                <path d="M8 10h.01M12 10h.01M16 10h.01" />
              </svg>
            </div>
            <h3>{{ card.title }}</h3>
            <p>{{ card.description }}</p>
          </article>
        </div>

        <!-- その他の機能（コンパクトに表示） -->
        <div class="features__grid features__grid--other">
          <article
            v-for="(card, index) in otherFeatures"
            :key="card.title"
            class="feature-card feature-card--compact animate-fade-up"
            :style="{ '--delay': `${index * 50 + 400}ms` }"
          >
            <div class="feature-card__icon">
              <!-- チーム -->
              <svg
                v-if="card.icon === 'team'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <!-- 目 -->
              <svg
                v-else-if="card.icon === 'eye'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <!-- モバイル -->
              <svg
                v-else-if="card.icon === 'mobile'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <path d="M12 18h.01" />
              </svg>
              <!-- ベル -->
              <svg
                v-else-if="card.icon === 'bell'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <!-- チェックサークル -->
              <svg
                v-else-if="card.icon === 'check-circle'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <!-- アクティビティ -->
              <svg
                v-else-if="card.icon === 'activity'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div class="feature-card__text">
              <h3>{{ card.title }}</h3>
              <p>{{ card.description }}</p>
            </div>
          </article>
        </div>
      </section>

      <section
        ref="pricingRef"
        id="pricing"
        class="pricing"
        :class="{ 'is-visible': pricingVisible }"
      >
        <div class="section-heading animate-fade-up" style="--delay: 0ms">
          <p>シンプルな料金プラン</p>
          <h2>チームの規模に合わせて選べるプラン</h2>
        </div>
        <div class="pricing__grid">
          <article
            v-for="(plan, index) in pricingPlans"
            :key="plan.name"
            class="pricing-card animate-fade-up"
            :class="{ 'pricing-card--highlight': plan.highlight }"
            :style="{ '--delay': `${index * 100 + 100}ms` }"
          >
            <div v-if="plan.ribbon" class="pricing-card__ribbon">
              {{ plan.ribbon }}
            </div>
            <h3>{{ plan.name }}</h3>
            <div class="pricing-card__price">
              <span>{{ plan.price }}</span>
              <small>{{ plan.unit }}</small>
            </div>
            <div class="pricing-card__features">
              <p v-if="plan.prefix" class="pricing-card__prefix">
                {{ plan.prefix }}
              </p>
              <ul>
                <li v-for="item in plan.features" :key="item">{{ item }}</li>
              </ul>
            </div>
            <AppButton
              :to="
                plan.price === 'お問い合わせ'
                  ? undefined
                  : { name: ROUTE_NAMES.signup }
              "
              :variant="plan.variant"
              block
            >
              {{ plan.cta }}
            </AppButton>
          </article>
        </div>
      </section>

      <section
        ref="releasesRef"
        id="releases"
        class="releases"
        :class="{ 'is-visible': releasesVisible }"
      >
        <div class="section-heading animate-fade-up" style="--delay: 0ms">
          <p>リリースノート</p>
          <h2>最新のアップデート情報</h2>
        </div>
        <div class="releases__timeline">
          <article
            v-for="(release, index) in releaseNotes"
            :key="release.version"
            class="release-card animate-fade-up"
            :class="{ 'release-card--latest': release.isLatest }"
            :style="{ '--delay': `${index * 150 + 100}ms` }"
          >
            <header class="release-card__header">
              <div class="release-card__version">
                <span class="release-card__tag">{{ release.version }}</span>
                <span v-if="release.isLatest" class="release-card__badge"
                  >最新</span
                >
              </div>
              <time class="release-card__date">{{ release.date }}</time>
            </header>
            <ul class="release-card__changes">
              <li
                v-for="(change, idx) in release.changes"
                :key="idx"
                :class="`release-card__change--${change.type}`"
              >
                <span class="release-card__change-indicator" />
                {{ change.text }}
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section ref="ctaRef" class="cta" :class="{ 'is-visible': ctaVisible }">
        <div class="cta__inner">
          <h2 class="animate-fade-up" style="--delay: 0ms">
            今すぐ{{ appName }}を始めましょう
          </h2>
          <p class="animate-fade-up" style="--delay: 100ms">
            フリープランで今すぐ始められます。
            チームの「今やるべきこと」を明確にし、プロジェクトを前に進めましょう。
          </p>
          <div class="cta__actions animate-fade-up" style="--delay: 200ms">
            <AppButton :to="{ name: ROUTE_NAMES.signup }" variant="primary"
              >無料で始める</AppButton
            >
            <AppButton
              :to="`/projects/${sampleProjectId}/dashboard`"
              variant="secondary"
              >サンプルを見る</AppButton
            >
          </div>
          <p class="cta__note animate-fade-up" style="--delay: 300ms">
            フリープランは永久無料 • 3名まで利用可能
          </p>
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
/* アニメーション定義 */
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* アニメーションユーティリティ */
.animate-fade-up {
  opacity: 0;
}

.animate-slide-up {
  opacity: 0;
}

.is-visible .animate-fade-up {
  animation: fadeUp 0.6s ease-out forwards;
  animation-delay: var(--delay, 0ms);
}

.is-visible .animate-slide-up {
  animation: slideUp 0.5s ease-out forwards;
  animation-delay: var(--delay, 0ms);
}

/* prefers-reduced-motion対応 */
@media (prefers-reduced-motion: reduce) {
  .animate-fade-up,
  .animate-slide-up {
    opacity: 1;
    animation: none !important;
  }
}

.landing {
  min-height: 100vh;
  background: var(--ui-brand-50);
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

.landing__buttons {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
}

.landing__link {
  text-decoration: none;
  color: var(--ui-brand-600);
  font-weight: var(--ui-font-semibold);
  min-height: var(--ui-touch-target-min, 44px);
  display: inline-flex;
  align-items: center;
  padding: var(--ui-space-2, 0.5rem) var(--ui-space-3, 0.75rem);
  border-radius: var(--ui-radius-sm, 0.5rem);
  transition: var(--ui-transition-colors);
}

.landing__link:hover {
  color: var(--ui-brand-900);
  background: var(--ui-brand-100, #e5f6f8);
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

.hero-card__dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: var(--ui-radius-full);
}

.hero-card__dot--red {
  background: #ff5f57;
}

.hero-card__dot--yellow {
  background: #ffbd2e;
}

.hero-card__dot--green {
  background: #28ca41;
}

.hero-card__body {
  padding: var(--ui-space-5) var(--ui-space-6);
  display: grid;
  gap: var(--ui-space-4);
}

/* Now-first レイアウト */
.hero-card__body--now-first {
  gap: var(--ui-space-5);
}

.hero-card__section {
  border-radius: var(--ui-radius-lg);
  transition: var(--ui-transition-all);
}

.hero-card__label {
  margin: 0 0 var(--ui-space-2);
  font-weight: var(--ui-font-semibold);
  font-size: var(--ui-text-sm);
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

/* いまやること - フォーカスエリア */
.hero-card__section--now {
  padding: var(--ui-space-5);
  background: var(--ui-brand-600);
  border-radius: var(--ui-radius-xl);
}

.hero-card__label--now {
  color: var(--ui-brand-200);
  font-size: var(--ui-text-base);
  margin-bottom: var(--ui-space-3);
}

.hero-card__focus-task {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  color: var(--ui-text-inverse);
  font-size: var(--ui-text-lg);
  font-weight: var(--ui-font-semibold);
  padding: var(--ui-space-4);
  background: rgba(255, 255, 255, 0.15);
  border-radius: var(--ui-radius-lg);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.hero-card__focus-indicator {
  width: 10px;
  height: 10px;
  border-radius: var(--ui-radius-full);
  background: var(--ui-warning-500, #f59e0b);
  animation: pulse 2s ease-in-out infinite;
  flex-shrink: 0;
}

/* 次にやること */
.hero-card__section--next {
  padding: var(--ui-space-4);
  background: var(--ui-surface-accent);
}

.hero-card__label--next {
  color: var(--ui-brand-600);
}

.hero-card__next-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.hero-card__next-list li {
  color: var(--ui-brand-600);
  font-size: var(--ui-text-sm);
  padding: var(--ui-space-2) var(--ui-space-3);
  background: var(--ui-surface);
  border-radius: var(--ui-radius-md);
  border: 1px solid var(--ui-border-light);
}

/* 完了 */
.hero-card__section--done {
  padding: var(--ui-space-3) var(--ui-space-4);
  opacity: 0.7;
}

.hero-card__label--done {
  color: var(--ui-brand-400);
  font-size: var(--ui-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hero-card__done-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1);
}

.hero-card__done-list li {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
  color: var(--ui-brand-400);
  font-size: var(--ui-text-xs);
  text-decoration: line-through;
}

.hero-card__check {
  color: var(--ui-success, #16a34a);
  font-weight: var(--ui-font-bold);
  font-size: var(--ui-text-xs);
}

/* Hero break point */
.hero__br {
  display: none;
}

@media (min-width: 769px) {
  .hero__br {
    display: inline;
  }
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

/* 統計セクション */
.stats {
  padding: var(--ui-space-12) var(--ui-space-6);
  background: var(--ui-brand-600);
}

.stats__grid {
  max-width: 1140px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--ui-space-8);
  text-align: center;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.stat-card__value {
  font-size: clamp(2.5rem, 5vw, 3.5rem);
  font-weight: var(--ui-font-bold);
  color: var(--ui-text-inverse);
  line-height: 1;
}

.stat-card__label {
  font-size: var(--ui-text-lg);
  color: var(--ui-brand-200);
}

.features,
.pricing,
.cta {
  padding: var(--ui-space-16) var(--ui-space-6);
  background: var(--ui-surface);
}

.features__grid {
  display: grid;
  gap: var(--ui-space-6);
  max-width: 1140px;
  margin: 0 auto;
}

/* コア機能グリッド */
.features__grid--core {
  grid-template-columns: repeat(3, 1fr);
  margin-bottom: var(--ui-space-8);
}

/* その他機能グリッド */
.features__grid--other {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--ui-space-4);
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

/* コア機能カード（大きく表示） */
.feature-card--core {
  padding: var(--ui-space-8);
  background: var(--ui-surface);
  border-color: var(--ui-brand-400);
}

.feature-card--core h3 {
  font-size: var(--ui-text-xl);
  margin-bottom: var(--ui-space-3);
}

.feature-card--core p {
  font-size: var(--ui-text-base);
  line-height: var(--ui-leading-relaxed);
}

/* コンパクトカード（その他機能） */
.feature-card--compact {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-4);
  padding: var(--ui-space-4);
}

.feature-card--compact:hover {
  transform: translateY(-2px);
  box-shadow: var(--ui-shadow-md);
}

.feature-card--compact h3 {
  font-size: var(--ui-text-base);
  margin-bottom: var(--ui-space-1);
}

.feature-card--compact p {
  font-size: var(--ui-text-sm);
  color: var(--ui-brand-500);
  line-height: var(--ui-leading-normal);
}

.feature-card__text {
  flex: 1;
}

.feature-card__icon {
  width: 3rem;
  height: 3rem;
  border-radius: var(--ui-radius-md);
  background: var(--ui-brand-200);
  margin-bottom: var(--ui-space-4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-2);
  flex-shrink: 0;
}

/* コア機能の大きなアイコン */
.feature-card__icon--core {
  width: 4rem;
  height: 4rem;
  background: var(--ui-brand-100);
}

.feature-card__icon--core svg {
  width: 32px;
  height: 32px;
}

/* コンパクトカードのアイコンはマージンなし */
.feature-card--compact .feature-card__icon {
  margin-bottom: 0;
  width: 2.5rem;
  height: 2.5rem;
}

.feature-card--compact .feature-card__icon svg {
  width: 20px;
  height: 20px;
}

.feature-card__icon svg {
  width: 24px;
  height: 24px;
  color: var(--ui-brand-600);
}

/* レスポンシブ */
@media (max-width: 768px) {
  .features__grid--core {
    grid-template-columns: 1fr;
  }

  .features__grid--other {
    grid-template-columns: 1fr;
  }
}

.pricing {
  background: var(--ui-surface-muted);
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

.pricing-card__features {
  flex: 1;
}

.pricing-card__prefix {
  font-size: var(--ui-text-sm);
  color: var(--ui-brand-500);
  margin: 0 0 var(--ui-space-2);
  font-weight: var(--ui-font-medium);
}

.pricing-card ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.65rem;
  color: var(--ui-brand-600);
}

.releases {
  padding: var(--ui-space-16) var(--ui-space-6);
  background: var(--ui-surface);
}

.releases__timeline {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-6);
}

.release-card {
  background: var(--ui-brand-50);
  border: 1px solid var(--ui-brand-300);
  border-radius: var(--ui-radius-2xl);
  padding: var(--ui-space-6);
  transition: var(--ui-transition-all);
}

.release-card--latest {
  border-color: var(--ui-brand-600);
  box-shadow: var(--ui-shadow-lg);
}

.release-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--ui-space-4);
  flex-wrap: wrap;
  gap: var(--ui-space-2);
}

.release-card__version {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2);
}

.release-card__tag {
  font-size: var(--ui-text-lg);
  font-weight: var(--ui-font-bold);
  color: var(--ui-brand-900);
}

.release-card__badge {
  background: var(--ui-brand-600);
  color: var(--ui-text-inverse);
  padding: var(--ui-space-1) var(--ui-space-3);
  border-radius: var(--ui-radius-full);
  font-size: var(--ui-text-xs);
  font-weight: var(--ui-font-semibold);
}

.release-card__date {
  color: var(--ui-brand-400);
  font-size: var(--ui-text-sm);
}

.release-card__changes {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2);
}

.release-card__changes li {
  display: flex;
  align-items: flex-start;
  gap: var(--ui-space-2);
  color: var(--ui-brand-700);
  line-height: var(--ui-leading-relaxed);
}

.release-card__change-indicator {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: var(--ui-radius-full);
  margin-top: 0.5em;
}

.release-card__change--feat .release-card__change-indicator {
  background: var(--ui-brand-600);
}

.release-card__change--fix .release-card__change-indicator {
  background: var(--ui-warning-500, #f59e0b);
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

.cta__actions {
  display: flex;
  gap: var(--ui-space-4);
  justify-content: center;
  flex-wrap: wrap;
  margin-top: var(--ui-space-2);
}

.cta__note {
  font-size: var(--ui-text-sm);
  color: var(--ui-brand-200);
  opacity: 0.8;
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
  min-height: var(--ui-touch-target-min, 44px);
  display: inline-flex;
  align-items: center;
  padding: var(--ui-space-1, 0.25rem) var(--ui-space-2, 0.5rem);
  margin-left: calc(-1 * var(--ui-space-2, 0.5rem));
  border-radius: var(--ui-radius-sm, 0.5rem);
  transition: var(--ui-transition-colors);
}

.landing__footer-grid a:hover {
  color: var(--ui-text-inverse);
  background: rgba(255, 255, 255, 0.1);
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
    gap: var(--ui-space-3);
  }

  .landing__links {
    justify-content: center;
    width: 100%;
  }

  .landing__buttons :deep(.app-button) {
    padding: var(--ui-space-2) var(--ui-space-4);
    font-size: var(--ui-text-sm);
  }

  .hero {
    padding-top: var(--ui-space-8);
  }

  .hero__actions {
    justify-content: center;
  }

  .hero__actions :deep(.app-button) {
    padding: var(--ui-space-2) var(--ui-space-4);
    font-size: var(--ui-text-sm);
  }

  .landing__footer-grid {
    gap: var(--ui-space-6);
  }
}

/* Touch device feedback */
@media (hover: none) and (pointer: coarse) {
  .landing__link:active,
  .landing__footer-grid a:active {
    transform: scale(0.97);
    transition: transform 0.1s ease;
  }

  .feature-card:hover {
    box-shadow: none;
    transform: none;
  }

  .feature-card:active {
    transform: scale(0.98);
    transition: transform 0.1s ease;
  }
}
</style>

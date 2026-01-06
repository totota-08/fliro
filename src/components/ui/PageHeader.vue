<script setup lang="ts">
/**
 * ページヘッダーコンポーネント
 *
 * パンくずリスト、タイトル、アクションボタンなどを統一されたレイアウトで表示します。
 *
 * @example
 * <PageHeader breadcrumb="プロジェクト > 設定" title="プロジェクト設定">
 *   <template #actions>
 *     <button>保存</button>
 *   </template>
 * </PageHeader>
 */

interface Props {
  /** パンくずリスト（例: "プロジェクト > 設定"） */
  breadcrumb?: string;
  /** ページタイトル */
  title: string;
  /** サブタイトルまたは説明 */
  subtitle?: string;
}

defineProps<Props>();
</script>

<template>
  <header class="page-header">
    <div class="page-header__content">
      <div class="page-header__text">
        <p v-if="breadcrumb" class="page-header__breadcrumb">
          {{ breadcrumb }}
        </p>
        <h1 class="page-header__title">{{ title }}</h1>
        <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="page-header__actions">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<style scoped>
.page-header {
  margin-bottom: var(--section-gap);
}

.page-header__content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--gap-lg);
}

.page-header__text {
  flex: 1;
  min-width: 0;
}

.page-header__breadcrumb {
  margin: 0 0 var(--gap-xs);
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}

.page-header__title {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--brand);
  line-height: var(--line-height-tight);
}

.page-header__subtitle {
  margin: var(--gap-sm) 0 0;
  font-size: var(--font-size-md);
  color: var(--text-muted);
  line-height: var(--line-height-normal);
}

.page-header__actions {
  display: flex;
  gap: var(--gap-sm);
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .page-header__content {
    flex-direction: column;
    align-items: stretch;
  }

  .page-header__actions {
    width: 100%;
  }

  .page-header__title {
    font-size: var(--font-size-xl);
  }
}
</style>

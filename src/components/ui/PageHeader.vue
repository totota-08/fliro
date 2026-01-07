<script setup lang="ts">
/**
 * PageHeader - 統一ページヘッダーコンポーネント
 *
 * パンくずリスト + タイトル + アクション領域を提供
 * すべてのページで同じ見た目・余白・タイポグラフィを保証
 */
import type { RouteLocationRaw } from "vue-router";

export interface BreadcrumbItem {
  label: string;
  to?: RouteLocationRaw;
}

withDefaults(
  defineProps<{
    /** ページタイトル */
    title: string;
    /** サブタイトル（オプション） */
    subtitle?: string;
    /** パンくずリスト */
    breadcrumbs?: BreadcrumbItem[];
  }>(),
  {
    subtitle: undefined,
    breadcrumbs: () => [],
  },
);
</script>

<template>
  <header class="page-header">
    <div class="page-header__content">
      <nav
        v-if="breadcrumbs && breadcrumbs.length > 0"
        class="page-header__breadcrumb"
        aria-label="パンくずリスト"
      >
        <ol class="page-header__breadcrumb-list">
          <li
            v-for="(crumb, index) in breadcrumbs"
            :key="index"
            class="page-header__breadcrumb-item"
          >
            <router-link
              v-if="crumb.to"
              :to="crumb.to"
              class="page-header__breadcrumb-link"
            >
              {{ crumb.label }}
            </router-link>
            <span v-else class="page-header__breadcrumb-text">
              {{ crumb.label }}
            </span>
            <span
              v-if="index < breadcrumbs.length - 1"
              class="page-header__breadcrumb-sep"
              aria-hidden="true"
            >
              /
            </span>
          </li>
        </ol>
      </nav>

      <div class="page-header__title-row">
        <div class="page-header__title-group">
          <h1 class="page-header__title">{{ title }}</h1>
          <p v-if="subtitle" class="page-header__subtitle">
            {{ subtitle }}
          </p>
        </div>

        <div v-if="$slots.actions" class="page-header__actions">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.page-header {
  padding: var(--ui-space-4, 1rem) 0;
}

.page-header__content {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 0.5rem);
}

.page-header__breadcrumb {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.page-header__breadcrumb-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-1, 0.25rem);
  list-style: none;
  margin: 0;
  padding: 0;
}

.page-header__breadcrumb-item {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1, 0.25rem);
}

.page-header__breadcrumb-link {
  color: var(--ui-text-muted, #64748b);
  text-decoration: none;
  transition: var(--ui-transition-colors);
}

.page-header__breadcrumb-link:hover {
  color: var(--ui-brand-600, #4f7c82);
  text-decoration: underline;
}

.page-header__breadcrumb-text {
  color: var(--ui-text, #0b2e33);
}

.page-header__breadcrumb-sep {
  color: var(--ui-text-placeholder, #94a3b8);
  margin: 0 var(--ui-space-1, 0.25rem);
}

.page-header__title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--ui-space-4, 1rem);
  flex-wrap: wrap;
}

.page-header__title-group {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.page-header__title {
  margin: 0;
  font-size: var(--ui-text-xl, 1.25rem);
  font-weight: var(--ui-font-bold, 700);
  color: var(--ui-text-strong, #0f172a);
  line-height: var(--ui-leading-tight, 1.25);
}

.page-header__subtitle {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
}

.page-header__actions {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3, 0.75rem);
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .page-header__title-row {
    flex-direction: column;
    align-items: stretch;
  }

  .page-header__actions {
    justify-content: flex-start;
  }
}
</style>

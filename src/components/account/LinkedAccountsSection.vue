<script setup lang="ts">
/**
 * LinkedAccountsSection.vue - アカウント連携管理セクション
 *
 * Google/GitHubアカウントの連携・解除を行う
 */
import AppButton from "@/components/ui/AppButton.vue";
import { useLinkedAccounts } from "@/composables/useLinkedAccounts";
import { PROVIDER_IDS } from "@/types/auth";

const {
  linkedProviders,
  loading,
  linkingProvider,
  unlinkingProvider,
  error,
  isGoogleLinked,
  isGitHubLinked,
  canUnlink,
  handleLinkProvider,
  handleUnlinkProvider,
} = useLinkedAccounts();

// プロバイダー表示情報
const providerDisplayInfo: Record<
  string,
  { name: string; icon: string; color: string }
> = {
  [PROVIDER_IDS.GOOGLE]: {
    name: "Google",
    icon: "google",
    color: "#4285F4",
  },
  [PROVIDER_IDS.GITHUB]: {
    name: "GitHub",
    icon: "github",
    color: "#24292e",
  },
  [PROVIDER_IDS.PASSWORD]: {
    name: "メール/パスワード",
    icon: "email",
    color: "#64748b",
  },
};

function getProviderInfo(providerId: string) {
  return (
    providerDisplayInfo[providerId] || {
      name: providerId,
      icon: "default",
      color: "#64748b",
    }
  );
}

function confirmUnlink(providerId: string) {
  const info = getProviderInfo(providerId);
  if (confirm(`${info.name}との連携を解除してもよろしいですか？`)) {
    handleUnlinkProvider(providerId);
  }
}
</script>

<template>
  <div class="linked-accounts-section">
    <div class="linked-accounts-section__info">
      <div class="linked-accounts-section__header">
        <h3 class="linked-accounts-section__title">アカウント連携</h3>
      </div>
      <p class="linked-accounts-section__description">
        SNSアカウントを連携すると、そのアカウントでもログインできるようになります。
      </p>

      <!-- 連携済みアカウント一覧 -->
      <div v-if="linkedProviders.length > 0" class="linked-providers">
        <h4 class="linked-providers__title">連携済みアカウント</h4>
        <div
          v-for="provider in linkedProviders"
          :key="provider.providerId"
          class="linked-provider"
        >
          <div class="linked-provider__info">
            <span
              class="linked-provider__icon"
              :data-icon="getProviderInfo(provider.providerId).icon"
            />
            <div class="linked-provider__details">
              <span class="linked-provider__name">
                {{ getProviderInfo(provider.providerId).name }}
              </span>
              <span v-if="provider.email" class="linked-provider__email">
                {{ provider.email }}
              </span>
            </div>
          </div>
          <AppButton
            v-if="provider.providerId !== PROVIDER_IDS.PASSWORD"
            variant="danger"
            size="sm"
            :disabled="!canUnlink || unlinkingProvider === provider.providerId"
            :loading="unlinkingProvider === provider.providerId"
            @click="confirmUnlink(provider.providerId)"
          >
            解除
          </AppButton>
        </div>
      </div>

      <!-- ローディング表示 -->
      <div v-else-if="loading" class="linked-accounts-section__loading">
        読み込み中...
      </div>

      <p v-if="error" class="linked-accounts-section__error">
        {{ error }}
      </p>
    </div>

    <!-- 連携ボタン -->
    <div class="linked-accounts-section__actions">
      <AppButton
        v-if="!isGoogleLinked"
        variant="secondary"
        :loading="linkingProvider === 'google'"
        :disabled="loading || linkingProvider !== null"
        @click="handleLinkProvider('google')"
      >
        <span class="provider-icon" data-icon="google" />
        Googleと連携
      </AppButton>

      <AppButton
        v-if="!isGitHubLinked"
        variant="secondary"
        :loading="linkingProvider === 'github'"
        :disabled="loading || linkingProvider !== null"
        @click="handleLinkProvider('github')"
      >
        <span class="provider-icon" data-icon="github" />
        GitHubと連携
      </AppButton>

      <p
        v-if="isGoogleLinked && isGitHubLinked"
        class="linked-accounts-section__complete"
      >
        すべてのアカウントが連携済みです
      </p>
    </div>
  </div>
</template>

<style scoped>
/* MFAセクションと同様のスタイル */
.linked-accounts-section {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-4, 1rem);
}

.linked-accounts-section__info {
  flex: 1;
}

.linked-accounts-section__header {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  margin-bottom: var(--ui-space-2, 0.5rem);
}

.linked-accounts-section__title {
  margin: 0;
  font-size: var(--ui-text-base, 1rem);
  font-weight: var(--ui-font-semibold, 600);
  color: var(--ui-text-strong, #0f172a);
}

.linked-accounts-section__description {
  margin: 0 0 var(--ui-space-3, 0.75rem);
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  line-height: 1.5;
}

.linked-accounts-section__loading {
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-text-muted, #64748b);
  padding: var(--ui-space-3, 0.75rem);
}

.linked-accounts-section__error {
  margin: var(--ui-space-2, 0.5rem) 0 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-danger, #d64545);
}

.linked-accounts-section__complete {
  margin: 0;
  font-size: var(--ui-text-sm, 0.875rem);
  color: var(--ui-success, #16a34a);
}

.linked-accounts-section__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-space-2, 0.5rem);
}

/* 連携済みプロバイダー一覧 */
.linked-providers {
  margin-top: var(--ui-space-3, 0.75rem);
  padding: var(--ui-space-3, 0.75rem);
  background: var(--ui-surface-secondary, #f8f9fa);
  border-radius: var(--ui-radius-md, 0.75rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
}

.linked-providers__title {
  margin: 0 0 var(--ui-space-2, 0.5rem);
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text-muted, #64748b);
}

.linked-provider {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
  padding: var(--ui-space-2, 0.5rem);
  background: var(--ui-surface, #fff);
  border-radius: var(--ui-radius-sm, 0.5rem);
  border: 1px solid var(--ui-border, rgba(11, 46, 51, 0.12));
}

.linked-provider + .linked-provider {
  margin-top: var(--ui-space-2, 0.5rem);
}

.linked-provider__info {
  display: flex;
  align-items: center;
  gap: var(--ui-space-2, 0.5rem);
}

.linked-provider__icon {
  width: 20px;
  height: 20px;
  background-repeat: no-repeat;
  background-size: contain;
  flex-shrink: 0;
}

/* AuthProviderButtons.vueと同じアイコンスタイル */
.linked-provider__icon[data-icon="google"],
.provider-icon[data-icon="google"] {
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path fill="%234285F4" d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z"/><path fill="%2334A853" d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0010 20z"/><path fill="%23FBBC05" d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z"/><path fill="%23EA4335" d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.19 5.736 7.395 3.977 10 3.977z"/></svg>');
}

.linked-provider__icon[data-icon="github"],
.provider-icon[data-icon="github"] {
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="%230B2E33" viewBox="0 0 24 24"><path d="M12 0a12 12 0 00-3.79 23.4c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.05-1.61-4.05-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.21.09 1.84 1.25 1.84 1.25 1.07 1.84 2.8 1.31 3.48 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.51.12-3.14 0 0 1.01-.32 3.3 1.23a11.37 11.37 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.63.24 2.84.12 3.14.77.84 1.24 1.91 1.24 3.22 0 4.63-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.23v3.31c0 .32.22.69.82.58A12 12 0 0012 0z"/></svg>');
}

.linked-provider__icon[data-icon="email"] {
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="%2364748b"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>');
}

.provider-icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  background-repeat: no-repeat;
  background-size: contain;
  margin-right: var(--ui-space-2, 0.5rem);
  vertical-align: middle;
}

.linked-provider__details {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-1, 0.25rem);
}

.linked-provider__name {
  font-size: var(--ui-text-sm, 0.875rem);
  font-weight: var(--ui-font-medium, 500);
  color: var(--ui-text, #0b2e33);
}

.linked-provider__email {
  font-size: var(--ui-text-xs, 0.75rem);
  color: var(--ui-text-muted, #64748b);
}

/* レスポンシブ */
@media (max-width: 768px) {
  .linked-accounts-section__actions {
    flex-direction: column;
  }

  .linked-provider {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-2, 0.5rem);
  }
}
</style>

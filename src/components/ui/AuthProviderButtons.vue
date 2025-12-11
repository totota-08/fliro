<script setup lang="ts">
import type { SocialProvider } from "@/types/auth";

const props = defineProps<{
  providers: { id: SocialProvider; label: string; icon?: string }[];
  loading?: SocialProvider | null;
}>();

const emit = defineEmits<{
  (e: "select", provider: SocialProvider): void;
}>();
</script>

<template>
  <div class="provider-buttons">
    <button
      v-for="provider in props.providers"
      :key="provider.id"
      type="button"
      class="provider-buttons__button"
      :disabled="
        props.loading !== null &&
        props.loading !== undefined &&
        props.loading !== provider.id
      "
      @click="emit('select', provider.id)"
    >
      <span
        v-if="provider.icon"
        class="provider-buttons__icon"
        :data-icon="provider.icon"
      />
      {{
        props.loading === provider.id
          ? `${provider.label}中...`
          : provider.label
      }}
    </button>
  </div>
</template>

<style scoped>
.provider-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.provider-buttons__button {
  border-radius: 0.9rem;
  border: 2px solid #93b1b5;
  padding: 0.85rem 1rem;
  background: transparent;
  font-weight: 600;
  color: #0b2e33;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: background 150ms ease;
}

.provider-buttons__button:hover:not(:disabled) {
  background: #b8e3e9;
}

.provider-buttons__button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.provider-buttons__icon {
  width: 18px;
  height: 18px;
  background-repeat: no-repeat;
  background-size: contain;
  display: inline-flex;
}

.provider-buttons__icon[data-icon="google"] {
  background-image: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 20 20\"><path fill=\"%234285F4\" d=\"M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z\"/><path fill=\"%2334A853\" d=\"M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0010 20z\"/><path fill=\"%23FBBC05\" d=\"M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z\"/><path fill=\"%23EA4335\" d=\"M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.19 5.736 7.395 3.977 10 3.977z\"/></svg>');
}

.provider-buttons__icon[data-icon="github"] {
  background-image: url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"18\" height=\"18\" fill=\"%230B2E33\" viewBox=\"0 0 24 24\"><path d=\"M12 0a12 12 0 00-3.79 23.4c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.05-1.61-4.05-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.21.09 1.84 1.25 1.84 1.25 1.07 1.84 2.8 1.31 3.48 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.51.12-3.14 0 0 1.01-.32 3.3 1.23a11.37 11.37 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.63.24 2.84.12 3.14.77.84 1.24 1.91 1.24 3.22 0 4.63-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.23v3.31c0 .32.22.69.82.58A12 12 0 0012 0z\"/></svg>');
}
</style>

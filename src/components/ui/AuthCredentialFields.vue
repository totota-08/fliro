<script setup lang="ts">
import AuthFormField from "@/components/ui/AuthFormField.vue";
import { computed } from "vue";

type AuthVariant = "invite" | "signup";
type AuthMode = "signup" | "login";

const props = withDefaults(
  defineProps<{
    variant?: AuthVariant;
    mode?: AuthMode;
    showModeToggle?: boolean;
    showConfirm?: boolean;
    email: string;
    password: string;
    confirm?: string;
    emailPlaceholder?: string;
    passwordPlaceholder?: string;
    confirmPlaceholder?: string;
    passwordHint?: string;
  }>(),
  {
    variant: "invite",
    mode: "signup",
    showModeToggle: false,
    showConfirm: false,
    confirm: "",
    emailPlaceholder: "you@example.com",
    passwordPlaceholder: "6文字以上",
    confirmPlaceholder: "もう一度入力",
    passwordHint: "",
  },
);

const emit = defineEmits<{
  (e: "update:mode", value: AuthMode): void;
  (e: "update:email", value: string): void;
  (e: "update:password", value: string): void;
  (e: "update:confirm", value: string): void;
}>();

const modeModel = computed<AuthMode>({
  get: () => props.mode,
  set: (value) => emit("update:mode", value),
});

const emailModel = computed({
  get: () => props.email,
  set: (value) => emit("update:email", value),
});

const passwordModel = computed({
  get: () => props.password,
  set: (value) => emit("update:password", value),
});

const confirmModel = computed({
  get: () => props.confirm ?? "",
  set: (value) => emit("update:confirm", value),
});
</script>

<template>
  <template v-if="variant === 'invite'">
    <div v-if="showModeToggle" class="auth-toggle">
      <button
        type="button"
        :class="{ 'is-active': modeModel === 'signup' }"
        @click="modeModel = 'signup'"
      >
        新規登録
      </button>
      <button
        type="button"
        :class="{ 'is-active': modeModel === 'login' }"
        @click="modeModel = 'login'"
      >
        ログイン
      </button>
    </div>

    <AuthFormField
      v-model="emailModel"
      label="メールアドレス"
      type="email"
      :placeholder="emailPlaceholder"
      required
    />

    <AuthFormField
      v-model="passwordModel"
      label="パスワード"
      type="password"
      :placeholder="passwordPlaceholder"
      :hint="passwordHint || undefined"
      required
    />

    <AuthFormField
      v-if="showConfirm"
      v-model="confirmModel"
      label="パスワード確認"
      type="password"
      :placeholder="confirmPlaceholder"
      required
    />
  </template>

  <template v-else>
    <AuthFormField
      v-model="emailModel"
      label="メールアドレス"
      type="email"
      :placeholder="emailPlaceholder"
      required
    />
    <AuthFormField
      v-model="passwordModel"
      label="パスワード"
      type="password"
      :placeholder="passwordPlaceholder"
      :hint="passwordHint"
      required
    />
    <AuthFormField
      v-if="showConfirm"
      v-model="confirmModel"
      label="パスワード確認"
      type="password"
      :placeholder="confirmPlaceholder"
      required
    />
  </template>
</template>

<style scoped>
.auth-toggle {
  display: inline-flex;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.auth-toggle button {
  border: 1px solid #93b1b5;
  background: #fff;
  border-radius: 0.75rem;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  color: #4f7c82;
  font-weight: 600;
}

.auth-toggle button.is-active {
  background: rgba(79, 124, 130, 0.16);
  border-color: #4f7c82;
}
</style>

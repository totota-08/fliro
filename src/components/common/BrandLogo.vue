<script setup lang="ts">
// BrandLogo.vue
// アプリアイコン(SVG)をコンポーネント化 - V3×V4 hybrid design
// propsでサイズやクラスを受け取れるようにする（classは自動継承）
// デフォルトサイズは指定せず、親からCSSで制御することを推奨するが、
// 明示的なwidth/heightがない場合はSVGのviewBoxが基準になる。
</script>

<template>
  <svg
    viewBox="0 0 512 512"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- Background with rounded corners -->
    <rect width="512" height="512" rx="119" fill="#4f7c82" />
    <!-- V3×V4 hybrid: flowing S-curve + monoline weight -->
    <!-- Stem: signature S-curve -->
    <path
      d="M311 94 C277 94, 243 119, 226 162 C209 213, 192 273, 175 324 C166 350, 149 384, 115 401"
      stroke="#ffffff"
      stroke-width="21.3"
      stroke-linecap="round"
      fill="none"
    />
    <!-- Crossbar: sweeps across with flick -->
    <path
      d="M119 230 C170 213, 239 205, 316 201 C341 198, 358 201, 367 209"
      stroke="#ffffff"
      stroke-width="21.3"
      stroke-linecap="round"
      fill="none"
    />
  </svg>
</template>

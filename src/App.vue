<script setup lang="ts">
import { RouterView } from 'vue-router'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <component :is="route.meta.layout === 'full' ? Component : DefaultLayout">
      <component v-if="route.meta.layout !== 'full'" :is="Component" />
    </component>
  </RouterView>
</template>

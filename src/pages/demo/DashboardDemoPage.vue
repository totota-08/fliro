<script setup lang="ts">
import { onMounted, ref } from 'vue'
import DashboardSidebar from '@/components/demo/DashboardSidebar.vue'
import DashboardSummaryCards from '@/components/demo/DashboardSummaryCards.vue'
import DashboardTaskBoard from '@/components/demo/DashboardTaskBoard.vue'
import TeamChatPreview from '@/components/demo/TeamChatPreview.vue'
import DemoExplainerBanner from '@/components/demo/DemoExplainerBanner.vue'

const isSidebarOpen = ref(true)

const closeSidebar = () => {
  isSidebarOpen.value = false
}

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

onMounted(() => {
  if (window.matchMedia('(max-width: 1200px)').matches) {
    isSidebarOpen.value = false
  }
})
</script>

<template>
  <div :class="['demo', { 'demo--sidebar-collapsed': !isSidebarOpen }]">
    <DashboardSidebar :open="isSidebarOpen" @close="closeSidebar" />
    <div v-if="isSidebarOpen" class="demo__overlay" @click="closeSidebar" />

    <div class="demo__main">
      <header class="demo__topbar">
        <div class="demo__topbar-left">
          <button type="button" class="demo__menu-button" @click="toggleSidebar">
            <span class="sr-only">サイドバーを切り替え</span>
            <svg
              v-if="!isSidebarOpen"
              aria-hidden="true"
              class="demo__menu-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg
              v-else
              aria-hidden="true"
              class="demo__menu-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6l-12 12" />
            </svg>
          </button>
          <div>
            <p class="demo__breadcrumb">デモ体験 &gt; ダッシュボード</p>
            <h1 class="demo__heading">Webサイトリニューアル</h1>
          </div>
        </div>
        <div class="demo__toolbar">
          <button type="button">共有</button>
          <button type="button" class="is-primary">エクスポート</button>
        </div>
      </header>

      <div class="demo__content">
        <DemoExplainerBanner />

        <div class="demo__grid">
          <section class="demo__primary">
            <DashboardSummaryCards />
            <DashboardTaskBoard />
          </section>

          <aside class="demo__secondary">
            <TeamChatPreview />

            <section class="demo__tips">
              <h3>Tips</h3>
              <ul>
                <li>タスクカードをドラッグすると、列をまたいでステータスを更新できます。</li>
                <li>チャットのメッセージにはタスクとリンクしたチェックリストを挿入可能です。</li>
                <li>ダッシュボードを共有すると、ステークホルダー向けの簡易ビューが自動生成されます。</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '@/pages/demo/styles/demo-shell.css';
</style>

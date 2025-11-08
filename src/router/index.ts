import type { Component } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

type ComponentModule = { default: Component }
const componentModules = {
  ...import.meta.glob<ComponentModule>('@/pages/**/*.vue', { eager: true }),
  ...import.meta.glob<ComponentModule>('@/components/**/*.vue', { eager: true }),
} satisfies Record<string, ComponentModule>

const getComponent = (fileName: string): Component => {
  for (const [path, module] of Object.entries(componentModules)) {
    if (path.endsWith(fileName)) {
      return module.default
    }
  }

  throw new Error(`Component "${fileName}" was not found in the registered directories.`)
}

const HomePage = getComponent('HomePage.vue')
const DashboardDemoPage = getComponent('DashboardDemoPage.vue')
const MyTasksPage = getComponent('MyTasksPage.vue')
const TeamPage = getComponent('TeamPage.vue')
const NotFoundErrorPage = getComponent('404.vue')

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
    },
    {
      path: '/demo/dashboard',
      name: 'demo.dashboard',
      component: DashboardDemoPage,
      meta: { layout: 'full', section: 'dashboard' },
    },
    {
      path: '/demo/tasks',
      name: 'demo.tasks',
      component: MyTasksPage,
      meta: { layout: 'full', section: 'tasks' },
    },
    {
      path: '/demo/team',
      name: 'demo.team',
      component: TeamPage,
      meta: { layout: 'full', section: 'team' },
    },
    {
      path: '/:notFound(.*)',
      name: 'error.404',
      component: NotFoundErrorPage,
    },
  ],
})

export default router

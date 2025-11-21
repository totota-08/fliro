import type { RouteLocationRaw } from 'vue-router'

export type DashboardNavKey = 'dashboard' | 'tasks' | 'team' | 'members' | 'settings'

export type DashboardNavItem = {
  key: DashboardNavKey
  label: string
  to?: RouteLocationRaw
  icon: DashboardNavKey
  disabled?: boolean
  tooltip?: string
}

export type DashboardProjectItem = {
  key: string
  label: string
  accent?: 'primary' | 'secondary' | 'accent'
  to?: RouteLocationRaw
}

export type DashboardProfileInfo = {
  name: string
  email: string
  avatar?: string
}

import { appName, appVersion } from '@/constants/appMeta'

export function useAppMeta() {
  return { appName, appVersion }
}

import { initAuthListener } from '@/store/auth'
import { createApp } from 'vue'
import App from './App.vue'
import './assets/reset.css'
import './assets/style.css'
import { appName, appVersion } from '@/constants/appMeta'
import router from './router'

import { initLogger } from '@/utils/logger'

import { getLogger } from '@logtape/logtape'

const logger = getLogger('app.main')

const app = createApp(App)

if (typeof document !== 'undefined') {
  document.title = appVersion ? `${appName} v${appVersion}` : appName
}

initAuthListener()
  .catch((error) => {
    logger.error`Failed to initialize Firebase auth: ${error}`
  })
  .finally(async () => {
    await initLogger()
    app.use(router).mount('#app')
  })

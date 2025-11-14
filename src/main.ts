import { createApp } from 'vue'
import './assets/reset.css'
import './assets/style.css'
import App from './App.vue'
import router from './router'
import { initAuthListener } from '@/store/auth'

const app = createApp(App)

initAuthListener()
  .catch((error) => {
    console.error('Failed to initialize Firebase auth', error)
  })
  .finally(() => {
    app.use(router).mount('#app')
  })

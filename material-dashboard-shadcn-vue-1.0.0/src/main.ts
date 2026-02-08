import { createApp } from 'vue'
import './assets/index.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

if (import.meta.env.DEV) {
  app.config.devtools = true
}

app.use(router)
app.mount('#app')

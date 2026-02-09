import { createApp } from 'vue'
import './assets/index.css'
import App from './App.vue'
import router from './router'
import { useAuth } from './composables/useAuth'

const app = createApp(App)

const isLocalhostHost = () => {
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

if (import.meta.env.DEV && isLocalhostHost()) {
  app.config.devtools = true
  import('virtual:vue-devtools-path:overlay.js')
} else {
  app.config.devtools = false
}

useAuth().initFromStorage()

app.use(router)
app.mount('#app')

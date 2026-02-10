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
  // keep explicit branch for future local-dev hooks
}

useAuth().initFromStorage()

app.use(router)
app.mount('#app')

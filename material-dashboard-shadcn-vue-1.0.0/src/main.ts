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

const allowDevtools = import.meta.env.DEV && isLocalhostHost()

if (import.meta.env.DEV) {
  // Disable Vue Devtools on network IP access.
  ;(app.config as { devtools?: boolean }).devtools = allowDevtools
}

if (import.meta.env.DEV && !allowDevtools) {
  const style = document.createElement('style')
  style.textContent = `
    #vue-devtools-container,
    .vue-devtools__anchor {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
  `
  document.head.appendChild(style)
}

useAuth().initFromStorage()

app.use(router)
app.mount('#app')

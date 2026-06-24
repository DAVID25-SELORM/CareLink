import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'
import { initSentry } from './services/sentry'
import { startAutoSync } from './services/syncEngine'

/**
 * CareLink Hospital Management System
 * Author: David Gabion Selorm
 * Email: gabiondavidselorm@gmail.com
 */

// Initialize Sentry error monitoring (optional - requires VITE_SENTRY_DSN in .env)
initSentry()

// Start offline-first auto-sync engine (syncs every 5 minutes + on reconnect)
startAutoSync(5 * 60 * 1000)

// Register the PWA service worker once in production.
if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onRegisterError() {
      // SW registration failed; the app still works without it.
    },
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

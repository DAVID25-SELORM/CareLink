import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initSentry } from './services/sentry'

/**
 * CareLink Hospital Management System
 * Author: David Gabion Selorm
 * Email: gabiondavidselorm@gmail.com
 */

// Initialize Sentry error monitoring (optional - requires VITE_SENTRY_DSN in .env)
initSentry()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

import * as Sentry from '@sentry/react'
import { BrowserTracing } from '@sentry/tracing'

/**
 * Sentry Error Monitoring Integration
 * Tracks errors, performance, and user sessions
 * Author: David Gabion Selorm
 * 
 * Setup Instructions:
 * 1. Install Sentry: npm install @sentry/react @sentry/tracing
 * 2. Create a free Sentry account at sentry.io
 * 3. Create a new project for React
 * 4. Copy your DSN from Project Settings > Client Keys (DSN)
 * 5. Add to .env file: VITE_SENTRY_DSN=your_dsn_here
 * 6. Set VITE_SENTRY_ENVIRONMENT=development or production
 */

export const initSentry = () => {
  const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN
  const ENVIRONMENT = import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development'
  
  // Only initialize Sentry if DSN is configured
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured. Error monitoring is disabled.')
    console.warn('To enable: Add VITE_SENTRY_DSN to your .env file')
    return false
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENVIRONMENT,
      integrations: [
        new BrowserTracing(),
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      
      // Performance Monitoring
      tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
      
      // Session Replay sampling
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      
      // Filter out sensitive data
      beforeSend(event, hint) {
        // Remove passwords and tokens from error data
        if (event.request) {
          if (event.request.data) {
            delete event.request.data.password
            delete event.request.data.token
          }
          if (event.request.headers) {
            delete event.request.headers.Authorization
          }
        }
        
        return event
      },
      
      // Ignore certain errors
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
        'Network request failed',
      ],
    })

    console.log(`✅ Sentry initialized for ${ENVIRONMENT} environment`)
    return true
  } catch (error) {
    console.error('Failed to initialize Sentry:', error)
    return false
  }
}

// Helper to set user context for error tracking
export const setSentryUser = (user) => {
  if (!user) {
    Sentry.setUser(null)
    return
  }

  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.user_metadata?.full_name || user.email,
  })
}

// Helper to track custom events
export const trackEvent = (eventName, data = {}) => {
  Sentry.addBreadcrumb({
    category: 'user-action',
    message: eventName,
    level: 'info',
    data,
  })
}

// Helper to manually capture errors
export const captureError = (error, context = {}) => {
  Sentry.captureException(error, {
    contexts: {
      custom: context,
    },
  })
}

// React Error Boundary wrapper
export const SentryErrorBoundary = Sentry.ErrorBoundary

# Sentry Error Monitoring Setup Guide

## Installation

```bash
npm install @sentry/react @sentry/tracing
```

## Configuration

1. **Create a Sentry account**: Go to [sentry.io](https://sentry.io) and sign up (free tier available)

2. **Create a new project**:
   - Click "Create Project"
   - Select "React" as the platform
   - Name it "CareLink HMS"

3. **Get your DSN**:
   - After creating the project, copy the DSN from Project Settings > Client Keys (DSN)
   - It looks like: `https://xxxxxxxxxxxxx@oXXXXXXX.ingest.sentry.io/XXXXXXX`

4. **Add to environment variables**:

Create or update `.env` file in project root:

```env
VITE_SENTRY_DSN=your_sentry_dsn_here
VITE_SENTRY_ENVIRONMENT=development
```

For production deployment (Vercel, Netlify, etc.):
```env
VITE_SENTRY_DSN=your_sentry_dsn_here
VITE_SENTRY_ENVIRONMENT=production
```

5. **Sentry is already integrated** in the app! The setup is in:
   - `/src/services/sentry.js` - Sentry configuration
   - `/src/main.jsx` - Initialization call
   - `/src/hooks/useAuth.jsx` - User tracking

## Features Enabled

✅ **Error Tracking**: Automatic capture of JavaScript errors
✅ **Performance Monitoring**: Track slow page loads and API calls  
✅ **Session Replay**: Record user sessions when errors occur
✅ **User Context**: Errors linked to specific users
✅ **Breadcrumbs**: Track user actions before errors
✅ **Source Maps**: See original code in error stack traces

## Usage Examples

### Manual Error Capture
```javascript
import { captureError } from '../services/sentry'

try {
  // risky operation
} catch (error) {
  captureError(error, { 
    context: 'prescription_submission',
    patientId: patient.id 
  })
}
```

### Track Custom Events
```javascript
import { trackEvent } from '../services/sentry'

trackEvent('prescription_created', {
  patientId: patient.id,
  drugCount: items.length
})
```

## Dashboard

View errors, performance, and replays at:
- **Dashboard**: https://sentry.io/organizations/your-org/issues/
- **Performance**: https://sentry.io/organizations/your-org/performance/
- **Replays**: https://sentry.io/organizations/your-org/replays/

## Cost

- **Free Tier**: 5,000 errors/month, 50 replays/month
- **Upgrade**: Only if you exceed free limits

## Privacy & Security

- Passwords and auth tokens are automatically filtered out
- Patient data is logged only as IDs (no PII in errors)
- Session replays mask sensitive text by default

## Testing

To test Sentry is working:

```javascript
// Add this temporarily to any component
throw new Error('Test Sentry Error')
```

Check your Sentry dashboard - error should appear within seconds.

---

**Author**: David Gabion Selorm
**Date**: April 4, 2026

# GitHub Actions CI/CD Setup Guide

## Overview
This CI/CD pipeline automates testing, building, and deployment for CareLink HMS.

## Pipeline Stages

### 1. **Lint & Code Quality**
- Runs ESLint on all code
- Checks for console.log statements
- Ensures code quality standards

### 2. **Build**
- Installs dependencies
- Builds production bundle with Vite
- Uploads build artifacts
- Verifies build output

### 3. **Security Scan**
- Runs npm audit for vulnerabilities
- Checks for potential sensitive data leaks
- Ensures dependencies are secure

### 4. **Deploy to Staging** (develop branch)
- Auto-deploys to Vercel staging environment
- Preview changes before production

### 5. **Deploy to Production** (main (branch)
- Auto-deploys to Vercel production
- Only triggers on push to main branch

### 6. **Health Check**
- Verifies production site is accessible
- Checks HTTP response status

## Setup Instructions

### 1. GitHub Repository Setup

Push your code to GitHub:
```bash
git init
git add .
git commit -m "Initial commit with CI/CD pipeline"
git branch -M main
git remote add origin https://github.com/yourusername/carelink-hms.git
git push -u origin main
```

### 2. Create Develop Branch
```bash
git checkout -b develop
git push -u origin develop
```

### 3. Vercel Setup

1. **Sign up at vercel.com** (free tier available)
2. **Import your GitHub repository**
3. **Configure environment variables** in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SENTRY_DSN` (optional)
   - `VITE_SENTRY_ENVIRONMENT`

4. **Get Vercel credentials**:
   - Go to Account Settings > Tokens
   - Create new token, copy it
   - Go to your project Settings > General
   - Copy Project ID and Team/Org ID

### 4. Add GitHub Secrets

Go to your GitHub repository > Settings > Secrets and variables > Actions

Add these secrets:

| Secret Name | Value | Where to Find |
|------------|-------|---------------|
| `VERCEL_TOKEN` | Your token | Vercel Account Settings > Tokens |
| `VERCEL_ORG_ID` | Your org ID | Vercel Project Settings > General |
| `VERCEL_PROJECT_ID` | Your project ID | Vercel Project Settings > General |
| `VITE_SUPABASE_URL` | Your Supabase URL | Supabase Project Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Your anon key | Supabase Project Settings > API |

### 5. Workflow Triggers

The pipeline runs when:
- **Push to main**: Full pipeline + production deployment
- **Push to develop**: Full pipeline + staging deployment
- **Pull request**: Lint, build, and security checks only
- **Manual trigger**: Run workflow manually from Actions tab

## Branch Strategy

```
main (production)
  ↑
develop (staging)
  ↑
feature/* (development)
```

### Workflow:
1. Create feature branch: `git checkout -b feature/new-feature develop`
2. Make changes and commit
3. Push: `git push origin feature/new-feature`
4. Create Pull Request to `develop`
5. After approval, merge to `develop` → auto-deploys to staging
6. Test on staging
7. Merge `develop` to `main` → auto-deploys to production

## Monitoring Deployments

### GitHub Actions Dashboard
- Go to repository > Actions tab
- View all workflow runs
- Check logs for each job
- Re-run failed jobs

### Vercel Dashboard
- See all deployments
- View deployment logs
- Rollback if needed
- Check analytics

## Cost

- **GitHub Actions**: 2,000 minutes/month free
- **Vercel**: Unlimited deployments on free tier
- **Total**: $0/month for typical usage

## Troubleshooting

### Build Fails
```bash
# Test build locally
npm run build

# Check for errors in console
npm run lint
```

### Deployment Fails
- Check Vercel logs in dashboard
- Verify environment variables are set
- Check GitHub secrets are correct

### Health Check Fails
- Wait 1-2 minutes for deployment to fully propagate
- Check Vercel deployment status
- Verify site is accessible manually

## Advanced Features (Optional)

### Add Test Suite
Update `.github/workflows/ci-cd.yml`:
```yaml
- name: Run tests
  run: npm test
```

### Add Lighthouse CI
For performance monitoring:
```yaml
- name: Lighthouse CI
  uses: treosh/lighthouse-ci-action@v9
  with:
    urls: https://carelink-hms.vercel.app
```

### Slack Notifications
Get notified on deployment:
```yaml
- name: Slack Notification
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

**Author**: David Gabion Selorm  
**Date**: April 4, 2026

FROM node:22-alpine
WORKDIR /app
COPY worker/onboarding-worker.mjs ./onboarding-worker.mjs
COPY worker/preflight.mjs ./preflight.mjs
COPY worker/recovery.mjs ./recovery.mjs
COPY worker/providers ./providers
ENV NODE_ENV=production
CMD ["node", "onboarding-worker.mjs"]

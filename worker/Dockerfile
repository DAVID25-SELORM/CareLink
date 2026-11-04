FROM node:22-alpine
WORKDIR /app
COPY worker/onboarding-worker.mjs ./onboarding-worker.mjs
ENV NODE_ENV=production
CMD ["node", "onboarding-worker.mjs"]

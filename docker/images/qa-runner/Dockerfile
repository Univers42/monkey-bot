FROM node:22-bookworm AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM mcr.microsoft.com/playwright:v1.53.2-noble AS runtime
WORKDIR /app
RUN corepack enable

ENV NODE_ENV=production
ENV PLAYWRIGHT_DOCKER=1
ENV ARTIFACTS_DIR=/app/artifacts
ENV REPORTS_DIR=/app/reports

COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./
COPY browser.ts cli.ts core.ts reporters.ts ./
COPY projects ./projects
COPY docker/images/qa-runner/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
  && mkdir -p /app/artifacts /app/reports \
  && chown -R pwuser:pwuser /app

USER pwuser
ENTRYPOINT ["/entrypoint.sh"]

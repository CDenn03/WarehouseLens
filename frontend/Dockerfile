# ---- Stage 1: install dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app

# Enable corepack so pnpm is available at the version pinned in package.json
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Install production + dev deps (needed for build)
RUN pnpm install --frozen-lockfile

# ---- Stage 2: build ----
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---- Stage 3: runtime ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

USER nextjs
EXPOSE 3000

CMD ["pnpm", "start"]

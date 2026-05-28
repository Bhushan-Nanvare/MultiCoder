# syntax=docker/dockerfile:1.6

# --- Builder ---
FROM node:20-alpine AS builder
WORKDIR /app

# Prisma's query engine needs OpenSSL to generate and run.
RUN apk add --no-cache openssl

# Install full deps (incl. devDeps for tsc + prisma CLI) deterministically.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# Generate Prisma client + compile TypeScript to dist/.
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

# --- Runtime ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Prisma's query engine needs OpenSSL at runtime too.
RUN apk add --no-cache openssl

# Production deps only — keeps the image small (~150 MB vs ~400 MB).
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --no-audit --no-fund \
  && npm cache clean --force

# Bring the generated Prisma client over from the builder so we don't need
# to ship the CLI (devDep) in the runtime image.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/dist ./dist

# Drop root. /app needs to be writable for prisma engines + tmp.
RUN chown -R node:node /app
USER node

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --spider http://localhost:${PORT:-8080}/health || exit 1

CMD ["node", "dist/index.js"]

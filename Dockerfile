# Multi-stage Dockerfile for X Monitor Node.js app
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .
RUN npm run build

# Production image
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    NITTER_SESSIONS_PATH=/nitter-sessions/sessions.jsonl

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root app user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps --no-audit --no-fund

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./server.ts

# Ensure data directory exists and is owned by appuser
RUN mkdir -p /data /nitter-sessions && chown -R appuser:appgroup /data /nitter-sessions /app

USER appuser

EXPOSE 3000

VOLUME ["/data"]

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "--import", "tsx", "server.ts"]

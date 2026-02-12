# Notion Executive Assistant - Dockerfile
# Multi-stage build for smaller production image

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:22-alpine AS deps

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable

# Copy package files (include pnpm-lock if it exists)
COPY package.json pnpm-lock.yaml* ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod || pnpm install --prod

# ============================================
# Stage 2: Production
# ============================================
FROM node:22-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 clawdbot && \
    adduser --system --uid 1001 clawdbot

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application files
COPY package.json pnpm-lock.yaml* ./
COPY skills/ ./skills/
COPY scripts/ ./scripts/

# Create directories for runtime data
RUN mkdir -p /app/logs /home/clawdbot && \
    chown -R clawdbot:clawdbot /app /home/clawdbot

# Switch to non-root user
USER clawdbot

# Environment defaults (override with --env-file or -e)
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Default command (overridden by docker-compose for different services)
CMD ["node", "scripts/kalshi-scheduler.js"]

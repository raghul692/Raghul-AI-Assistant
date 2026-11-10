# Raghul AI — Production Multi-Stage Container Image
FROM node:20-bookworm-slim AS base

WORKDIR /app

# Install native compilation dependencies for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Ensure data directories exist and set appropriate permissions
RUN mkdir -p data/generated/documents data/generated/research_reports \
    && chown -R node:node /app

USER node

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Docker Healthcheck targeting the internal health API
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "--dns-result-order=ipv4first", "server.js"]

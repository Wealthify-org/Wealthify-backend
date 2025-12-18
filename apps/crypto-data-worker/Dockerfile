# ==========================================
# Stage 1: Dependencies
# ==========================================
FROM node:20-alpine AS dependencies

WORKDIR /app

COPY package*.json ./
RUN npm ci

# ==========================================
# Stage 2: Build
# ==========================================
FROM node:20-alpine AS build

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Build the crypto-data-worker service
RUN npx nest build crypto-data-worker

# Build worker threads
RUN npm run build:workers

# ==========================================
# Stage 3: Production (with Puppeteer dependencies)
# ==========================================
FROM node:20-alpine AS production

WORKDIR /app

# Install Chromium and dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    udev \
    dumb-init

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/nest-cli.json ./nest-cli.json

# Create storage directory for logos
RUN mkdir -p /app/storage/logos/crypto

ENV NODE_ENV=production

# Crypto worker might expose HTTP endpoint if configured
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD pgrep -f "node.*crypto-data-worker" > /dev/null || exit 1

# Use dumb-init to handle signals properly (important for Puppeteer)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/apps/crypto-data-worker/main.js"]

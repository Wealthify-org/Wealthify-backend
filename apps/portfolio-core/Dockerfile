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

# Build the portfolio-core service
RUN npx nest build portfolio-core

# ==========================================
# Stage 3: Production
# ==========================================
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/nest-cli.json ./nest-cli.json

ENV NODE_ENV=production

# Portfolio service runs on RabbitMQ (no HTTP port)

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD pgrep -f "node.*portfolio-core" > /dev/null || exit 1

CMD ["node", "dist/apps/portfolio-core/main.js"]

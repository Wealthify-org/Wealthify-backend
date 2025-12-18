# ==========================================
# Stage 1: Dependencies
# ==========================================
FROM node:20-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# ==========================================
# Stage 2: Build
# ==========================================
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the api-gateway application
RUN npx nest build api-gateway

# Build worker threads if needed
RUN npm run build:workers || true

# ==========================================
# Stage 3: Production
# ==========================================
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from build stage
COPY --from=build /app/dist ./dist

# Copy necessary config files
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/nest-cli.json ./nest-cli.json

# Create storage directory for logos
RUN mkdir -p /app/storage/logos/crypto

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/apps/api-gateway/main.js"]

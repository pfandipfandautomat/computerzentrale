# Stage 1: Install ALL dependencies (frontend + backend + dev)
FROM node:20-alpine AS deps

# Build tools for better-sqlite3 native addon
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files + lock file for deterministic installs
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Deterministic install from lock file (~30% faster than npm install)
RUN npm ci

# Stage 2: Build frontend and backend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy hoisted node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source code
COPY . .

# Build frontend (vite) and backend (tsc)
RUN npm run build -w frontend && npm run build -w backend

# Stage 3: Production-only backend dependencies
FROM node:20-alpine AS prod-deps

# Build tools for better-sqlite3 native addon
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Replicate workspace structure so lock file resolves correctly
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN mkdir -p frontend && echo '{"name":"computerzentrale-frontend","private":true}' > frontend/package.json

# Install only production dependencies
RUN npm ci --omit=dev

# Stage 4: Minimal runtime image
FROM node:20-alpine AS runner

# Only the C++ runtime lib needed by better-sqlite3 native addon
RUN apk add --no-cache libstdc++

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy production node_modules (hoisted at root)
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy compiled backend
COPY --from=builder /app/backend/dist ./dist

# Copy drizzle migrations
COPY --from=builder /app/backend/drizzle ./drizzle

# Copy compiled frontend (served by backend)
COPY --from=builder /app/frontend/dist ./public

# Copy and prepare entrypoint
COPY backend/scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["./docker-entrypoint.sh"]

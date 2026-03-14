# Stage 1: Dependencies
FROM node:20-alpine AS deps

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ 

WORKDIR /app

# Copy package files
COPY package.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install all dependencies (generates fresh lock file)
RUN npm install

# Stage 2: Builder
FROM node:20-alpine AS builder

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy dependencies from deps stage (hoisted to root)
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Build backend
WORKDIR /app/backend
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Copy package files for production install
COPY backend/package.json ./package.json

# Install production dependencies only
RUN npm install --omit=dev

# Copy backend build
COPY --from=builder /app/backend/dist ./dist

# Copy drizzle migrations
COPY --from=builder /app/backend/drizzle ./drizzle

# Copy frontend build to be served by backend
COPY --from=builder /app/frontend/dist ./public

# Copy entrypoint script
COPY backend/scripts/docker-entrypoint.sh ./docker-entrypoint.sh

# Make entrypoint script executable
RUN chmod +x ./docker-entrypoint.sh

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start the application
CMD ["./docker-entrypoint.sh"]

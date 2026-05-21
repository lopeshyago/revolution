# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install all dependencies (including devDependencies required for bundling)
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build Vite client assets & bundle the server CJS entry point with esbuild
RUN npm run build

# Stage 2: Production base runner
FROM node:20-alpine AS runner

WORKDIR /app

# Set environment context
ENV NODE_ENV=production
ENV PORT=3000

# Copy package files to install production dependencies
COPY package*.json ./

# Install ONLY production dependencies to keep the image lightweight
RUN npm ci --omit=dev

# Copy compiled frontend assets & bundled backend from the builder stage
COPY --from=builder /app/dist ./dist

# Expose port 3000 as configured in the server
EXPOSE 3000

# Run the compiled commonJS production bundle
CMD ["node", "dist/server.cjs"]

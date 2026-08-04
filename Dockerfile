# Stage 1: Build application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package metadata and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code and run production build
COPY . .
RUN npm run build

# Stage 2: Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package metadata and install runtime production dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy built application and backend bundle from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.cjs"]

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy codebase and generate Prisma Client
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Copy built code and node_modules from builder
COPY --from=builder /app ./

# Expose Next.js port
EXPOSE 3000

ENV NODE_ENV=production

# By default, runs the Web App. Override CMD to "npm run worker" for the BullMQ Worker.
CMD ["npm", "run", "start"]

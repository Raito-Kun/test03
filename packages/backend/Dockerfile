# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY packages/backend/package*.json ./packages/backend/
COPY packages/shared ./packages/shared
COPY packages/backend/tsconfig.json ./packages/backend/
COPY tsconfig.base.json ./
COPY packages/backend/prisma ./packages/backend/prisma
COPY packages/backend/src ./packages/backend/src
WORKDIR /app/packages/backend
RUN npm ci --ignore-scripts
RUN npx prisma generate
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/backend/package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/backend/prisma ./prisma
RUN mkdir -p logs
EXPOSE 4000
USER node
CMD ["node", "dist/index.js"]

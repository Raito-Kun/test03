# Production build (monorepo root context)
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

RUN npm install --ignore-scripts

# Compile shared .ts in-place
WORKDIR /app/packages/shared
RUN npx tsc --rootDir src --outDir src --declaration false --declarationMap false --sourceMap false 2>/dev/null; exit 0

# Build backend
WORKDIR /app/packages/backend
RUN npx prisma generate --schema=prisma/schema.prisma
RUN npx tsc --skipLibCheck

# Cleanup dev files
RUN rm -rf src tsconfig.json
RUN mkdir -p logs && chown node:node logs

ENV NODE_ENV=production
EXPOSE 4000
USER node
CMD ["node", "dist/index.js"]

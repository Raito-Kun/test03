# Stage 1: Build (from monorepo root context)
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace config
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/frontend ./packages/frontend

# Install all workspace deps (workspace symlinks needed for @crm/shared)
RUN npm install

# Build frontend (VITE_ vars must be available at build time)
ARG VITE_SIP_WSS_URL
ARG VITE_SIP_DOMAIN
ARG VITE_SIP_PASSWORD
WORKDIR /app/packages/frontend
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html
COPY --from=builder /app/packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

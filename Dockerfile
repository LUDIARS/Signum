# Multi-stage build — Node API only. The SPA is built separately and
# served by nginx in production (see frontend/Dockerfile pattern).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY migrations ./migrations

EXPOSE 3200
CMD ["node", "dist/index.js"]

# ገብቷል / Smart Verify API. Built on the server by deploy/docker-compose.yml.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# OpenSSL for Prisma; certificates for calling the banks over HTTPS.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# Dev packages stay: the Prisma CLI applies migrations at start.
RUN npm ci --include=dev
COPY . .
RUN npx prisma generate && npm run build && mkdir -p .cache && chown -R node:node /app
USER node
EXPOSE 3000
# Apply new migrations, then start. A failed migration stops the start (nothing half-applied runs).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]

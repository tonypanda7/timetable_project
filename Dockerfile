# Use official Node image
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next.js standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public || true
# Ensure database and uploads directory exist and are writable
RUN mkdir -p /app/uploads && chown -R node:node /app && chmod -R 775 /app
USER node
EXPOSE 3000
CMD ["node", "server.js"]

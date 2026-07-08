# =============================================================================
#  Backend — Smart Ticketing & Support Assistant
#  Build multi-étapes : compilation TypeScript puis image de production légère.
# =============================================================================

# ── Étape 1 : dépendances + build ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build

# ── Étape 2 : image de production ───────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY prisma.config.ts ./

EXPOSE 4000

CMD ["node", "dist/server.js"]

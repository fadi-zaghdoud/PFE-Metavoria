# =============================================================================
#  Frontend — Smart Ticketing & Support Assistant
#  Build multi-étapes : bundle Vite puis service statique via nginx.
# =============================================================================

# ── Étape 1 : build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Étape 2 : image de production (nginx) ───────────────────────────────────
FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

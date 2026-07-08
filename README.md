# Smart Ticketing & Support Assistant

Application web de gestion intelligente de tickets support, assistée par IA.
Projet de Fin d'Études (PFE) — Metavoria.

## Stack technique

| Couche | Technologies |
|---|---|
| Frontend | React 19 + TypeScript + TailwindCSS 4 + Vite, React Router, Zustand |
| Backend | Node.js + Express 5 + TypeScript, architecture en couches (routes → controllers → services → repositories) |
| Base de données | PostgreSQL 17 + extension **pgvector** (recherche vectorielle, module IA à venir) |
| ORM | Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Auth | JWT + bcrypt, RBAC (Employé / Technicien / Administrateur) |
| Conteneurisation | Docker + Docker Compose |

## Structure du repo

```
.
├── backend/            # API Express + TypeScript
│   ├── prisma/          # Schéma Prisma + migrations
│   └── src/
│       ├── config/       # Variables d'env, client Prisma
│       ├── middlewares/  # Auth JWT, RBAC, gestion d'erreurs
│       ├── controllers/  # Contrôleurs HTTP
│       ├── services/     # Logique métier
│       ├── repositories/ # Accès aux données (Prisma)
│       ├── routes/       # Définition des routes
│       ├── validators/   # Schémas de validation Zod
│       └── generated/    # Client Prisma généré (non versionné)
├── frontend/            # React + TypeScript + Tailwind
│   └── src/
│       ├── pages/         # Connexion, Inscription, Tableau de bord
│       ├── components/    # Layout, composants partagés
│       ├── routes/        # Garde de routes protégées
│       ├── store/         # État global (Zustand)
│       ├── features/auth/ # Appels API liés à l'authentification
│       └── lib/           # Client HTTP générique
└── docker-compose.yml
```

## Prérequis

- Node.js ≥ 20
- Docker Desktop (avec Docker Compose)

## Démarrage rapide avec Docker (recommandé)

```bash
cp .env.example .env
docker compose up -d --build
```

- Frontend : http://localhost:5173
- API backend : http://localhost:4000/api/health
- PostgreSQL : localhost:5432

Les migrations Prisma sont appliquées automatiquement au démarrage du conteneur `backend`.

Pour arrêter la stack :

```bash
docker compose down
```

Pour tout arrêter et supprimer les données de la base :

```bash
docker compose down -v
```

## Développement local (hors Docker)

### 1. Base de données

Démarre uniquement PostgreSQL/pgvector via Docker :

```bash
cp .env.example .env
docker compose up -d postgres
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev   # applique les migrations (déjà fait si tu as suivi ci-dessus)
npm run dev               # démarre sur http://localhost:4000
```

Scripts utiles :

| Commande | Description |
|---|---|
| `npm run dev` | Démarre le serveur en mode watch (tsx) |
| `npm run build` | Génère le client Prisma puis compile en TypeScript |
| `npm run typecheck` | Vérifie les types sans compiler |
| `npm run lint` / `lint:fix` | Vérifie / corrige le style de code (ESLint) |
| `npm run prisma:studio` | Ouvre Prisma Studio (interface de la base de données) |
| `npm run prisma:migrate` | Crée et applique une nouvelle migration |

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev   # démarre sur http://localhost:5173
```

Le serveur de dev Vite proxifie automatiquement les appels `/api` vers `http://localhost:4000` (voir `frontend/vite.config.ts`), donc backend et frontend communiquent sans configuration CORS supplémentaire.

## Modèle de données

Entités principales (voir `backend/prisma/schema.prisma`) : `Utilisateur`, `Ticket`, `Categorie`, `Commentaire`, `PieceJointe`, `Notification`, `SuggestionIA` (schéma prévu, logique IA à implémenter en phase 5 du projet).

La colonne `Ticket.embedding` (type `vector(1536)`, extension pgvector) est déjà en place pour la recherche de similarité par RAG, mais n'est pas encore alimentée — cela fait partie du module IA à venir.

## Authentification & rôles

- `POST /api/auth/inscription` — création de compte (rôle Employé par défaut)
- `POST /api/auth/connexion` — connexion, retourne un JWT
- `GET /api/auth/moi` — profil de l'utilisateur authentifié (nécessite `Authorization: Bearer <token>`)

Le contrôle d'accès par rôle (RBAC) se fait via le middleware `requireRole(...roles)` (voir `backend/src/middlewares/auth.middleware.ts` et l'exemple `backend/src/routes/admin.routes.ts`).

## État d'avancement

Cette première itération couvre :

- ✅ Authentification JWT complète (inscription, connexion, RBAC)
- ✅ Schéma de base de données pour toutes les entités du MCD
- ✅ Frontend avec routing protégé et tableau de bord adapté au rôle
- ✅ Conteneurisation Docker complète et validée

À venir (itérations suivantes, voir le cahier des charges) :

- Gestion complète du cycle de vie des tickets (création, affectation, statuts, commentaires)
- Module IA : classification automatique, priorisation, suggestions RAG
- Tableau de bord analytique et rapports
- Notifications, intégrations Slack/Teams

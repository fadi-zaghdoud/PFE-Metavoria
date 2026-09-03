-- Active: 1783546015353@@127.0.0.1@5432@postgres
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
- **Ollama** installé sur la machine (le service IA s'y adresse par défaut ; voir
  « LLM local » plus bas pour la variante 100 % conteneurisée)
- ~8 Go d'espace disque pour les modèles (4,3 Go d'embeddings + le LLM)

## Démarrage rapide avec Docker (recommandé)

```bash
cp .env.example .env
```

Renseigne ensuite dans `.env` : `JWT_SECRET` (≥ 32 caractères aléatoires) et, si tu veux
les pièces jointes, les trois clés `CLOUDINARY_*`. Puis :

```bash
docker compose up -d --build
```

- Frontend : http://localhost:5173
- API backend : http://localhost:4000/api
- Service IA (FastAPI) : http://localhost:8000/sante
- PostgreSQL : localhost:5432

**Au premier démarrage**, le service one-shot `ml-prefetch` télécharge les modèles
Hugging Face (`bge-m3` + `bge-reranker-v2-m3`, **~4,3 Go**) dans le volume `hf-cache`,
puis sort. Les démarrages suivants le retrouvent en cache : la pile remonte en ~15 s.
C'est le **seul** moment où un accès réseau est attendu — ensuite le service IA charge
ses modèles hors-ligne.

Les migrations Prisma sont appliquées automatiquement au démarrage du conteneur `backend`.

### LLM local (Ollama)

Le service IA utilise un LLM local pour la génération RAG (`/suggest`) et les résumés.
Deux configurations, au choix :

**A. Ollama sur la machine hôte** (défaut) — réutilise les modèles déjà installés :

```bash
ollama pull qwen2.5:14b
ollama pull qwen2.5:7b     # repli
```

**B. Ollama conteneurisé** (déploiement sur un serveur sans Ollama installé) :

```bash
# dans .env :  ML_OLLAMA_HOST=http://ollama:11434
docker compose --profile ollama up -d ollama
docker compose --profile ollama exec ollama ollama pull qwen2.5:14b
docker compose --profile ollama exec ollama ollama pull qwen2.5:7b
```

> Le service `ollama` est volontairement **sans port publié**. Publier `11434` alors
> qu'un Ollama natif écoute déjà dessus ne produit aucune erreur Docker : la liaison
> est silencieusement masquée, et le service IA se retrouve à interroger un conteneur
> vide (`404 model not found`) pendant qu'un `curl localhost:11434` paraît normal.
> Seul le service IA a besoin d'Ollama, et il l'atteint par le réseau interne.

### Arrêt

```bash
docker compose down       # arrête la pile (données et modèles conservés)
docker compose down -v    # + supprime la base ET le cache des modèles (4,3 Go à retélécharger)
```

### Ports déjà occupés

Si un backend ou un frontend tourne déjà en natif, décale les ports publiés :

```bash
BACKEND_PORT=4001 FRONTEND_PORT=5174 docker compose up -d
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
- `GET /api/auth/moi` · `PATCH /api/auth/moi` · `PATCH /api/auth/moi/mot-de-passe` — profil de l'utilisateur authentifié (`Authorization: Bearer <token>`)
- `GET /api/utilisateurs` · `PATCH /api/utilisateurs/:id/role` · `PATCH /api/utilisateurs/:id/statut` — gestion des comptes (Administrateur uniquement)

Invitation d'un collaborateur par un administrateur (compte créé **sans mot de passe**, statut « En attente ») :

- `POST /api/utilisateurs/inviter` — crée le compte et envoie un lien d'activation par e-mail (token hashé SHA-256 en base, valable **72 h**)
- `POST /api/utilisateurs/:id/renvoyer-invitation` — regénère un lien (l'ancien est immédiatement invalidé)
- `GET /api/auth/invitation/:token` — valide un lien avant d'afficher le formulaire (page publique `/activer-compte`)
- `POST /api/auth/activer-compte` — l'invité choisit son mot de passe, le token est consommé, connexion automatique

Un compte « En attente » ne peut ni se connecter ni demander de réinitialisation tant qu'il n'est pas activé.

Réinitialisation de mot de passe par **code OTP à 6 chiffres** (3 étapes) :

1. `POST /api/auth/mot-de-passe-oublie` — envoie un code par e-mail si le compte existe (validité 10 min, renvoi possible après 60 s)
2. `POST /api/auth/verifier-code` — vérifie le code (5 tentatives max, invalidé au-delà)
3. `POST /api/auth/reinitialiser-mot-de-passe` — définit le nouveau mot de passe et consomme le code (usage unique)

Sécurité : mots de passe bcrypt (cost 12) avec politique de complexité (8+ caractères, majuscule, minuscule, chiffre), codes OTP stockés hashés (SHA-256), **rate limiting** par IP sur toutes les routes sensibles, protection anti-timing sur la connexion, validation Zod systématique côté backend. Le contrôle d'accès par rôle (RBAC) se fait via le middleware `requireRole(...roles)` (`backend/src/middlewares/auth.middleware.ts`).

## État d'avancement

Couvert à ce stade :

- ✅ Authentification JWT complète (inscription, connexion, RBAC, rate limiting)
- ✅ Réinitialisation de mot de passe par code OTP + gestion du profil
- ✅ Gestion des utilisateurs par l'administrateur (rôles, activation/désactivation)
- ✅ Design system frontend (sidebar, palette ⌘K, toasts, composants réutilisables)
- ✅ Schéma de base de données pour toutes les entités du MCD
- ✅ Conteneurisation Docker complète et validée — **y compris le service IA Python**
  (image dédiée, modèles en volume, fonctionnement hors-ligne, préchauffage au démarrage)

À venir (itérations suivantes, voir le cahier des charges) :

- Gestion complète du cycle de vie des tickets (création, affectation, statuts, commentaires)
- Module IA : classification automatique, priorisation, suggestions RAG
- Tableau de bord analytique et rapports
- Notifications, intégrations Slack/Teams

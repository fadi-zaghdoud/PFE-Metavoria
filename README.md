-- Active: 1783546015353@@127.0.0.1@5432@postgres
# Smart Ticketing & Support Assistant

Application web de gestion intelligente de tickets support, assistée par IA.
Projet de Fin d'Études (PFE) — Metavoria.

## Stack technique

| Couche | Technologies |
|---|---|
| Frontend | React 19 + TypeScript + TailwindCSS 4 + Vite, React Router, Zustand |
| Backend | Node.js + Express 5 + TypeScript, architecture en couches (routes → controllers → services → repositories) |
| Base de données | PostgreSQL 17 + extension **pgvector** (recherche vectorielle : embeddings 1024d, index HNSW) |
| ORM | Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Auth | JWT + bcrypt, RBAC (Employé / Technicien / Administrateur) |
| Module IA | Python + FastAPI ; `bge-m3` (embeddings, auto-hébergé), `bge-reranker-v2-m3`, scikit-learn (classification), Tesseract (OCR `fra`) |
| LLM local | Ollama + `qwen2.5:7b` (défaut) / `qwen2.5:14b` — aucun appel d'API externe |
| Conteneurisation | Docker + Docker Compose (pile autonome : 7 services, dont 2 provisionneurs one-shot) |

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
├── ml/                  # Module IA (Python) — service FastAPI + harnais
│   ├── smart_ticketing_ml/
│   │   ├── service/       # API FastAPI, embeddings, reranker, OCR, provisionnement
│   │   ├── retrieval/     # Recherche hybride (pgvector + full-text), RAG
│   │   ├── training/      # Classifieur figé (embeddings + LogReg)
│   │   ├── flywheel/      # Réentraînement et garde de déploiement
│   │   ├── eval/          # Harnais d'évaluation et métriques
│   │   └── priority/      # Scorecard de priorité (glass-box)
│   ├── artifacts/         # Classifieur versionné ; le reste est régénérable
│   ├── gold/              # Jeu de test scellé
│   └── requirements.lock  # Versions figées (voir ml/README.md)
├── docker-compose.yml       # Pile complète
└── docker-compose.gpu.yml   # Surcouche GPU optionnelle
```

## Prérequis

- **Docker Desktop ou Docker Engine**, avec Docker Compose. C'est le **seul**
  prérequis de la pile : ni Node, ni Python, ni Ollama à installer sur le serveur.
- **~35 Go d'espace disque** : 17 Go de modèles (13 Go de LLM + 4,3 Go
  d'embeddings), ~11 Go d'images, le reste pour la base et la marge.
- Une connexion réseau **au premier démarrage uniquement** (voir plus bas).
- Node.js ≥ 20 seulement pour le développement hors Docker.

## Déploiement — procédure complète

### 1. Configuration

```bash
git clone <dépôt> && cd PFE-Metavoria
cp .env.example .env
```

Trois blocs à renseigner dans `.env` :

| Variable | Obligatoire | Rôle |
|---|---|---|
| `JWT_SECRET` | **oui** | ≥ 32 caractères aléatoires. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | fortement conseillé | créent le premier administrateur (voir garde-fous ci-dessous) |
| `CLOUDINARY_*` | si pièces jointes | sans elles l'application démarre, mais l'upload est désactivé — donc pas d'OCR |
| `SMTP_*` | si e-mails | réinitialisation de mot de passe |

**Les trois garde-fous de l'amorçage administrateur**, à connaître avant de
remplir ces variables :

1. **Aucun identifiant par défaut** n'est livré avec le produit. Variables vides
   = aucun compte créé.
2. **Amorçage, pas réinitialisation** : dès qu'un administrateur existe en base,
   ces variables n'ont plus **aucun** effet. Elles ne permettent donc pas de
   reprendre la main sur une instance en service.
3. **12 caractères minimum**, sinon le démarrage échoue explicitement.

### 2. Démarrage

```bash
docker compose up -d --build
```

C'est tout. La pile est **autonome** : elle télécharge et vérifie elle-même ses
modèles, applique ses migrations et sème sa base.

### 3. Ce qui se passe au premier démarrage

| Étape | Durée indicative |
|---|---|
| Construction des images (backend, frontend, service IA) | ~5 min |
| `ollama-prefetch` — télécharge `qwen2.5:7b` puis `qwen2.5:14b` (13 Go), **puis vérifie** | ~65 min |
| `ml-prefetch` — télécharge `bge-m3` + `bge-reranker-v2-m3` (4,3 Go), **puis vérifie** | ~80 min (en parallèle) |
| `backend` — migrations Prisma, puis seed (5 catégories + administrateur) | ~10 s |
| `ml` — préchauffage des trois modèles | ~15 s |

**Comptez ~80 minutes au total**, dominées par les 17 Go de modèles et donc
dépendantes de la bande passante. **Les démarrages suivants prennent ~30 s** :
tout est en volume et plus rien n'est téléchargé.

Les deux services de provisionnement ne se contentent pas de télécharger, ils
**vérifient** — chargement réel des modèles, génération de contrôle. Un cache
corrompu échoue donc au démarrage de la pile, pas au premier appel d'une
démonstration. Ils sortent ensuite et le service IA ne démarre qu'après eux.

### 4. Vérifier que le déploiement est sain

```bash
# 1. Les cinq services, dont trois avec healthcheck
docker compose ps

# 2. Provisionnement : les deux one-shots doivent être sortis en code 0
docker compose logs ollama-prefetch ml-prefetch | tail -20

# 3. Service IA : les trois modèles doivent être chargés (préchauffage)
curl -s http://localhost:8000/sante
#    -> "modele_charge": true pour embedding, reranker ET classifieur
#    -> "tesseract_disponible": true, "langue": "fra"

# 4. Base semée : les 5 catégories du CDC
docker compose exec postgres psql -U postgres -d smart_ticketing -c "select nom from categories;"

# 5. Classification de bout en bout
curl -s -X POST http://localhost:8000/classify -H 'Content-Type: application/json'   -d '{"titre":"Connexion VPN impossible","description":"Le certificat du client VPN est refuse."}'
#    -> {"categorie":"Réseau", ...}

# 6. Application
curl -s -o /dev/null -w '%{http_code}
' http://localhost:5173/        # 200
curl -s -o /dev/null -w '%{http_code}
' http://localhost:5173/api/tickets  # 401 sans jeton
```

Adresses par défaut :

- Frontend : http://localhost:5173
- API backend : http://localhost:4000/api
- Service IA (FastAPI) : http://localhost:8000/sante
- PostgreSQL : localhost:5432

### 5. LLM local — configuration par défaut et variante

Le service IA utilise un LLM local pour la génération RAG (`/suggest`) et les
résumés du fil (`/summarize`).

**Par défaut : Ollama conteneurisé.** Rien à installer, rien à configurer — le
service `ollama` démarre avec la pile et `ollama-prefetch` y provisionne les
modèles. C'est la configuration de **livraison** : elle fonctionne sur un serveur
nu, y compris sous Linux.

Le modèle par défaut est **`qwen2.5:7b`**, retenu sur mesures (voir le journal
technique, Phase 7) : il tient le budget de latence **partout**, GPU ou non, et
sa qualité s'est révélée au niveau du 14b sur les deux tâches du produit — qui
sont de la synthèse cadrée, le RAG faisant le travail de recherche. Le `14b`
reste provisionné comme option.

> Le service `ollama` est volontairement **sans port publié**. Publier `11434`
> alors qu'un Ollama natif écouterait déjà dessus ne produit **aucune erreur
> Docker** : la liaison est silencieusement masquée par le processus natif, et le
> service IA se retrouve à interroger un conteneur vide (`404 model not found`)
> pendant qu'un `curl localhost:11434` paraît parfaitement normal. Seul le
> service IA a besoin d'Ollama, et il l'atteint par le réseau interne.

**Variante de développement — Ollama de la machine.** Si Ollama est déjà installé
avec ses modèles, on évite de retélécharger 13 Go :

```bash
# dans .env
ML_OLLAMA_HOST=http://host.docker.internal:11434
```

⚠️ **À ne pas utiliser en livraison** : `host.docker.internal` ne résout pas sur
un serveur Linux sans `extra_hosts: host-gateway`. La pile échouerait précisément
là où elle est censée être déployée.

### 6. Accélération GPU (optionnelle)

Sur une machine dotée d'un GPU NVIDIA et du NVIDIA Container Toolkit :

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

Fichier **séparé** à dessein : un bloc `deploy.resources.devices` ne se dégrade
pas sur une machine sans GPU — il **empêche le conteneur de démarrer**. Le compose
de base reste donc portable, le GPU est un accélérateur, pas un prérequis.

### 7. Arrêt et remise à zéro

```bash
docker compose down       # arrête la pile ; base et modèles CONSERVÉS
docker compose down -v    # + supprime la base ET les 17 Go de modèles
```

### 8. Ports déjà occupés

Si un service tourne déjà en natif sur les ports par défaut :

```bash
POSTGRES_PORT=5433 BACKEND_PORT=4001 FRONTEND_PORT=5174 ML_PORT=8001   docker compose up -d
```

> Une seule instance de la pile peut tourner à la fois sur une machine : les noms
> de conteneurs sont fixés dans le compose (`container_name`). `[dette connue]`

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

**Livré :**

- ✅ Authentification JWT (inscription, connexion, RBAC, jetons courts + refresh rotatif, rate limiting)
- ✅ Réinitialisation de mot de passe par code OTP, gestion du profil, invitation et activation de compte
- ✅ Administration des utilisateurs (rôles, activation/désactivation) et des **catégories**
- ✅ Cycle de vie complet des tickets : création, affectation, prise en charge, résolution,
  satisfaction, clôture, recatégorisation, commentaires, historique d'événements, notifications
- ✅ **Pièces jointes** (PDF/PNG/JPG, ≤ 10 Mo) avec **OCR local** (Tesseract, pack `fra`)
- ✅ **Module IA complet** : classification automatique de catégorie, priorisation par scorecard
  glass-box, suggestion de solution par **RAG** (recherche hybride pgvector + full-text, reranker,
  génération citée avec abstention), résumé de fil — le tout **100 % local**, sans appel d'API externe
- ✅ **Flywheel** : capture des labels validés, réentraînement supervisé et garde de déploiement
  qui refuse un modèle non meilleur sur le jeu réel
- ✅ Design system frontend (sidebar, palette ⌘K, toasts, composants réutilisables)
- ✅ **Conteneurisation Docker autonome et prouvée sur serveur nu** : 7 services, provisionnement
  vérifié des modèles, fonctionnement hors-ligne après le premier démarrage

**À venir** (voir le cahier des charges) :

- Tableau de bord analytique approfondi et rapports exportables
- Intégrations externes (Slack / Teams)
- Documentation d'API (Swagger)

## Documentation

- [`ml/README.md`](ml/README.md) — module IA : contenu de l'image, montages, fonctionnement
  hors-ligne, préchauffage, jalons J1→J9
- [`docs/journal-technique.md`](docs/journal-technique.md) — journal des décisions techniques,
  mesures et arbitrages, phase par phase
- [`docs/epic-4-module-ia-conception.md`](docs/epic-4-module-ia-conception.md) — document de
  conception du module IA

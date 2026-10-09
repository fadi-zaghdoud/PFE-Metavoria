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
| Module IA | Python + FastAPI ; `bge-m3` (embeddings, auto-hébergé), scikit-learn (classification), Tesseract (OCR `fra`) ; `bge-reranker-v2-m3` livré, hors du chemin par défaut |
| LLM local | Ollama + `qwen2.5:7b` (défaut) / `qwen2.5:14b` — aucun appel d'API externe |
| Conteneurisation | Docker + Docker Compose (pile autonome : 7 services, dont 2 provisionneurs one-shot) |
| Intégration continue | GitHub Actions — typage, lint et tests à chaque push et pull request vers `main` |

## Structure du repo

```
.
├── .github/workflows/   # Intégration continue (GitHub Actions)
├── backend/            # API Express + TypeScript
│   ├── prisma/          # Schéma, migrations, chargeur du corpus synthétique
│   └── src/
│       ├── config/       # Variables d'env, Prisma, SMTP, Cloudinary, registre des paramètres
│       ├── middlewares/  # Auth JWT, RBAC, limitation de débit, upload, contexte de requête, erreurs
│       ├── controllers/  # Contrôleurs HTTP
│       ├── services/     # Logique métier : tickets, affectation, absences, audit, IA…
│       ├── repositories/ # Accès aux données (Prisma)
│       ├── routes/       # Définition des routes
│       ├── validators/   # Schémas de validation Zod
│       ├── utils/        # Flux SSE, contexte asynchrone, cookies, erreurs
│       └── generated/    # Client Prisma généré (non versionné)
│                         # Tests : fichiers *.test.ts placés à côté du code testé
├── frontend/            # React + TypeScript + Tailwind
│   └── src/
│       ├── pages/         # 15 écrans : authentification, tickets, tableau de bord, administration
│       ├── features/      # Appels API et composants par domaine (tickets, statistiques, administration…)
│       ├── components/    # Layout (sidebar, barre supérieure, palette ⌘K) et composants UI partagés
│       ├── routes/        # Gardes de routes (authentification, rôle)
│       ├── store/         # État global (Zustand)
│       ├── types/         # Types partagés
│       └── lib/           # Client HTTP, utilitaires
├── ml/                  # Module IA (Python) — service FastAPI + harnais
│   ├── smart_ticketing_ml/
│   │   ├── service/       # API FastAPI, embeddings, reranker, OCR, provisionnement
│   │   ├── retrieval/     # Recherche hybride (pgvector + full-text), RAG
│   │   ├── training/      # Classifieur figé (embeddings + LogReg)
│   │   ├── flywheel/      # Réentraînement et garde de déploiement
│   │   ├── priority/      # Scorecard de priorité (glass-box)
│   │   ├── eval/          # Harnais d'évaluation et métriques
│   │   └── data/          # Génération du corpus, ingestion des jeux réels et du gold set
│   ├── tests/             # Tests pytest (suite rapide hors ligne + tests `slow`)
│   ├── artifacts/         # Versionnés : classifieur, corpus de démonstration, train_v2 ; le reste est régénérable
│   ├── gold/              # Jeu de test scellé
│   ├── real/              # Données réelles relues (lot du flywheel, jeu Kaggle)
│   └── requirements.lock  # Versions figées (voir ml/README.md)
├── docs/                # Plan de travail ESPRIT, journal technique, conception du module IA
├── docker-compose.yml       # Pile complète
└── docker-compose.gpu.yml   # Surcouche GPU optionnelle
```

## Prérequis

- **Docker Desktop ou Docker Engine**, avec Docker Compose. C'est le **seul**
  prérequis de la pile : ni Node, ni Python, ni Ollama à installer sur le serveur.
- **~35 Go d'espace disque** : 17 Go de modèles (13 Go de LLM + 4,3 Go
  d'embeddings), ~11 Go d'images, le reste pour la base et la marge.
- Une connexion réseau **au premier démarrage** pour télécharger les modèles (voir plus
  bas) ; ensuite, la pile et le **module IA** fonctionnent hors-ligne. **Exception** : les
  pièces jointes (et donc l'OCR, qui ne lit que les fichiers envoyés), les photos de
  profil et les e-mails exigent en permanence l'accès à **Cloudinary** et au **serveur
  SMTP**.
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
| `JWT_SECRET` | **oui** | ≥ 32 caractères aléatoires. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` — la valeur d'exemple est volontairement refusée au démarrage |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | fortement conseillé | créent le premier administrateur (voir garde-fous ci-dessous) |
| `CLOUDINARY_*` | si pièces jointes | service en ligne, accès Internet requis. Sans ces clés, l'application démarre, mais l'upload est désactivé — donc pas d'OCR — et les photos de profil aussi |
| `SMTP_*` | si e-mails | invitations, réinitialisation de mot de passe, notifications. Laissés vides, liens et codes s'écrivent dans `docker compose logs backend` |

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
| `ml` — préchauffage de deux modèles, bge-m3 et le classifieur (le reranker se charge au premier usage) | ~5 s |

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

# 3. Service IA : deux modèles préchauffés
curl -s http://localhost:8000/sante
#    -> "modele_charge": true pour embedding ET classifieur
#    -> "modele_charge": false pour le reranker : c'est NORMAL. Il est hors du chemin
#       par défaut et se charge au premier usage (porte d'abstention, voir ml/README.md)
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

### 6. Accélération GPU — **configuration de démonstration**

Sur une machine dotée d'un GPU NVIDIA et du NVIDIA Container Toolkit :

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

**C'est la commande à utiliser pour une démonstration ou une soutenance.** Le
compose de base, lui, reste le défaut **portable** : c'est la voie de livraison,
qui doit fonctionner sur un serveur nu.

Fichier **séparé** à dessein : un bloc `deploy.resources.devices` ne se dégrade
pas sur une machine sans GPU — il **empêche le conteneur de démarrer**. Le compose
de base reste donc portable, le GPU est un accélérateur, pas un prérequis.

**Ce que la surcouche change, mesuré** (RTX 3050 Ti Laptop 4 Go, `qwen2.5:7b`,
mêmes 6 tickets, même ordre — cf. journal technique) :

| | CPU seul | Avec la surcouche |
| --- | --- | --- |
| `POST /suggest`, médiane | **23,9 s** | **8,5 s** |
| Traitement de l'invite (509 jetons) | 18,9 ms/jeton | **1,4 ms/jeton** |
| Génération | 138 ms/jeton | **92 ms/jeton** |

Le GPU ne reçoit que **12 couches sur 29** (`55%/45% CPU/GPU`, ~2,3 Go de VRAM
occupés sur 4) : 4 Go ne suffisent pas à loger les ~5 Go du modèle. Le gain vient
donc surtout du **traitement de l'invite**, parallélisable ; la génération, limitée
par la bande passante mémoire, ne gagne que ~1,5×.

> ⚠️ Ce gain est **propre à cette machine**. Il ne se transpose pas à un serveur de
> livraison sans GPU, où les latences CPU ci-dessus restent la référence.

Le service `ml` **n'a pas accès au GPU** (la surcouche ne vise que `ollama`) :
bge-m3 et le classifieur restent sur CPU et ne disputent pas les 4 Go.

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

## Données de démonstration

Une installation neuve démarre **sans aucun ticket**. Pour retrouver le produit tel qu'il
est présenté — tableau de bord rempli, suggestions de solution, réentraînement —, un corpus
de démonstration se charge en deux commandes. Il n'est **jamais** chargé automatiquement :
une installation réelle n'a aucun ticket synthétique.

### Origine des données

Metavoria n'avait **aucun historique de tickets** : c'est précisément le problème que le
projet résout. Le module IA a donc démarré sur un corpus d'amorçage **généré**.

| Fichier versionné | Contenu |
|---|---|
| `ml/artifacts/corpus/corpus_train_20260714T161302Z.jsonl` | 852 tickets **générés** par `qwen2.5:14b` (graine 42, invite `j1-v2`) ; manifeste à côté |
| `ml/artifacts/flywheel/train_v2_20260819T154457Z.jsonl` | Jeu d'entraînement du réentraînement : les 852 tickets + 50 tickets relus du jeu public ci-dessous |

Leurs empreintes SHA-256 sont celles consignées dans `ml/real/lot_v2/train_v2_manifest.json`.

**Crédit.** Les 50 tickets relus, et le jeu `ml/real/real_train_kaggle.jsonl` dont ils sont
tirés, proviennent du **« Customer IT Support - Ticket Dataset »** de **Tobias Bueck**,
publié sur Kaggle sous licence **Attribution 4.0 International (CC BY 4.0)** :
<https://www.kaggle.com/datasets/tobiasbueck/multilingual-customer-support-tickets>.
Ils ont été filtrés (français, files IT) et étiquetés pour ce projet.

**Aucune donnée réelle ni personnelle** :

- le jeu Kaggle est **anonymisé à la source** : noms, e-mails et sociétés y sont remplacés
  par des gabarits (`<name>`, `<email>`, `<company>`) ;
- le corpus généré ne contient ni e-mail ni téléphone. Six noms de personnes y figurent,
  dans cinq tickets (« le comptable M. Ben Ammar », « Mme Ayari »…) : **inventés par le
  modèle de langage, ils sont fictifs**.

### Charger les données

La pile doit être démarrée (`docker compose up -d`), migrations et seed faits. Ensuite :

```bash
docker compose run --rm demo-donnees                                        # 852 tickets (~10 s)
docker compose run --rm ml python -m smart_ticketing_ml.service.backfill    # leurs embeddings (~100 s sur CPU)
```

| Attendu | Valeur |
|---|---|
| Tickets chargés | 852, numérotés **#9 à #860** |
| Résolutions liées (base de connaissances du RAG) | 723 |
| Évaluations de satisfaction | 178 |
| Comptes créés | 3 techniciens, 31 demandeurs (un par service) — **sans mot de passe** |
| Embeddings | 852 (`BAAI/bge-m3`) |

À savoir :

- **Les numéros sont fixes.** Le corpus commence à #9 pour reproduire la base où la
  démonstration a été préparée (le corpus y avait été chargé après 8 tickets d'essai) :
  les tickets cités ci-dessous gardent leur numéro. Un rechargement redonne les mêmes
  numéros, et un ticket créé ensuite dans l'application reçoit un numéro au-delà de #860,
  sans collision (la séquence est recalée et ne recule jamais).
- **Le chargeur refuse** si un ticket réel occupe déjà la plage #9 à #860 — et il refuse
  **avant** toute suppression.
- **Tout rechargement efface les embeddings** : il supprime puis recrée les tickets
  synthétiques. **Relancez toujours le backfill ensuite**, sinon le RAG n'a plus de base
  de connaissances.
- **Les dates sont relatives au chargement** : tickets étalés sur les 90 jours précédents.
  Les durées (résolution, satisfaction) sont identiques d'un chargement à l'autre ; les
  dates absolues, non.

### Se connecter

- **Administrateur** : celui créé par `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- **Technicien** : aucun mot de passe n'est livré par défaut. Invitez un compte depuis
  **Administration → Utilisateurs**. Sans SMTP configuré, le lien d'activation s'affiche
  dans `docker compose logs backend` ; ouvrez-le pour choisir le mot de passe.

### Ce que l'on voit

**Tableau de bord** (administrateur), corpus seul : 852 tickets, 129 ouverts, 464 résolus,
259 clôturés, résolution moyenne de 48,1 h, satisfaction de 3,9 sur 178 évaluations, et
trois techniciens chargés de 25 à 27 tickets.

Le **délai de 1re prise en charge reste vide** sur une base reconstruite : il se calcule
sur les événements de prise en charge, et le chargeur n'en crée aucun — les tickets du
corpus naissent directement dans leur statut final. Il se remplit dès qu'un technicien
prend un ticket en charge dans l'application.

**Suggestions de solution** — chaque cas ci-dessous donne la **même décision et les mêmes
sources sur 5 appels consécutifs** (mesuré le 06/10/2026 sur une base reconstruite, `qwen2.5:7b`
avec la surcouche GPU, base de connaissances de 723 documents) :

| Ticket | Titre | Catégorie | Statut chargé | Sources citées |
|---|---|---|---|---|
| **#108** | Elévation droits admin | Accès | En cours | #70, #691, #760 |
| **#151** | Station d'accueil ne charge pas le portable | Matériel | Nouveau | #28, #678 |
| **#282** | Provisionnement VPN pour prestataire | Accès | Nouveau | #38, #124, #644 |
| **#323** | DNS ne résout plus les adresses internes | Réseau | Nouveau | #606 |
| *(réserve)* **#330** | Besoin logiciel notes | Autre | En cours | #75, #209 |

Pour #330, la base où la démonstration a été préparée cite **#209 seul**. L'écart est
constaté, pas expliqué : les deux bases ne retiennent pas les mêmes trois tickets pour la
génération ([#65, #209, #240] contre [#209, #65, #75]).

Une suggestion se demande sur un ticket **en cours**, par le technicien assigné ou un
administrateur. #108 et #330 le sont dès le chargement : bouton **« Suggérer une
résolution »**. Pour #151, #282 et #323 : **« Assigner un technicien »** (un compte
invité), puis, connecté avec ce compte, **« Prendre en charge »**.

**Abstention** — le système dit qu'aucun ticket passé ne couvre le problème plutôt que
d'inventer. Deux saisies la produisent de façon stable (5/5, sur la base reconstruite comme
sur la base de démonstration d'origine). **Saisissez-les exactement**, champ par champ,
dans **Tickets → Nouveau ticket** :

| Champ | Cas 1 | Cas 2 |
|---|---|---|
| Titre | `Ampoule grillée dans le couloir` | `Fuite d'eau dans les toilettes du rez-de-chaussée` |
| Description | `Ampoule grillée dans le couloir` | `Fuite d'eau dans les toilettes du rez-de-chaussée` |
| Catégorie, priorité, pièces jointes | laissées vides | laissées vides |

- La description **n'est pas vide** : elle reprend le titre mot pour mot. Elle est
  obligatoire (10 caractères au moins).
- Accents tapés au clavier (`é` précomposé, U+00E9) ; dans le cas 2, **apostrophe droite**
  `'` (U+0027) — pas l'apostrophe typographique `’` d'un copier-coller depuis un traitement
  de texte.
- Condition : la **porte d'abstention** (Administration → Paramètres) reste **désactivée**,
  son réglage par défaut. Porte ouverte, la requête envoyée au service IA n'est plus celle
  qui a été testée.
- Puis assignez le ticket, prenez-le en charge et demandez la suggestion, comme ci-dessus.

Ce que l'interface envoie au service IA a été vérifié : le titre et la description
enregistrés, sans ajout (ni catégorie, ni texte de pièce jointe), et `seuil: null`. La
validation du serveur ne modifie pas ces saisies.

> **Limite à connaître** : sur 6 saisies hors périmètre essayées, **2 s'abstiennent**
> (ci-dessus) et **4 reçoivent une suggestion citée mais hors sujet** (climatisation,
> machine à café, place de parking, chaise de bureau). La garde du RAG vérifie que les
> tickets cités existent, pas qu'ils sont pertinents — limite consignée au journal
> technique. L'abstention n'est donc pas une garantie.
>
> Les cas « Écran Dell qui clignote » et « Fuite d'eau dans les sanitaires », retenus
> auparavant, sont **retirés** : leurs textes d'origine n'avaient pas été conservés, et les
> saisies reconstituées ne s'abstiennent plus.

**Réentraînement** : **Administration → Modèle IA → Réentraîner** (environ 4 min sur CPU).
Sur une base reconstruite, aucun ticket réel n'apporte de label : le candidat est entraîné
sur `train_v2` seul. Mesure du 06/10/2026 : macro-F1 réel 0,4212 contre 0,438 pour le modèle
actif, verdict **NUL** — et **« Déployer le candidat » est refusé**, la garde jouant son
rôle.

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
cp .env.example .env     # puis remplace JWT_SECRET (voir ci-dessous)
npm install
npx prisma migrate dev   # applique les migrations (déjà fait si tu as suivi ci-dessus)
npm run dev               # démarre sur http://localhost:4000
```

La valeur d'exemple de `JWT_SECRET` est **volontairement refusée** : le serveur ne démarre
pas tant qu'elle n'est pas remplacée par au moins 32 caractères aléatoires
(`openssl rand -hex 48`). Les champs SMTP et Cloudinary peuvent rester vides : les e-mails
s'écrivent alors dans la console du serveur, et l'envoi de pièces jointes est désactivé.

Scripts utiles :

| Commande | Description |
|---|---|
| `npm run dev` | Démarre le serveur en mode watch (tsx) |
| `npm run build` | Génère le client Prisma puis compile en TypeScript |
| `npm run typecheck` | Vérifie les types sans compiler |
| `npm run lint` / `lint:fix` | Vérifie / corrige le style de code (ESLint) |
| `npm test` | Lance les tests unitaires (voir « Lancer les tests ») |
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

## Lancer les tests

Ce sont les commandes de l'intégration continue (`.github/workflows/ci.yml`), rejouées à
chaque push et à chaque pull request vers `main`. Aucune ne demande de base de données,
de modèle lourd ni de Docker.

### Backend — typage, lint, tests unitaires

```bash
cd backend
npm ci
npx prisma generate   # le client Prisma est généré, pas versionné
npm run typecheck
npm run lint
npm test              # node:test, fichiers src/**/*.test.ts
```

- **Node ≥ 21** pour `npm test` : le motif `src/**/*.test.ts` est développé par Node
  lui-même. La CI utilise Node 22.
- **`DATABASE_URL` et `JWT_SECRET` doivent être définis**, bien qu'aucun test n'ouvre de
  connexion : `config/env.ts` valide l'environnement au chargement. Avec un
  `backend/.env` rempli, il n'y a rien à faire ; sinon, des valeurs factices suffisent,
  comme en CI :

```bash
DATABASE_URL=postgresql://ci:ci@localhost:5432/ci \
JWT_SECRET=ci-factice-aucun-secret-ci-factice-aucun-secret \
npm test
```

### Module IA — pytest

```bash
cd ml
pip install -r requirements.lock   # Python 3.12, PyTorch en build CPU
python -m pytest -m "not slow"     # suite rapide, 100 % hors ligne
```

- **`python -m pytest`, pas `pytest`** : le paquet `smart_ticketing_ml` n'est pas
  installé, et `python -m` place `ml/` dans le chemin d'import.
- Les tests marqués `slow` (`python -m pytest -m slow`) chargent bge-m3 ou Tesseract, et
  se désactivent proprement si la dépendance manque.
- Dans la pile Docker : `docker compose run --rm ml pytest -m "not slow" -p no:cacheprovider`.

### Frontend — lint, build, garde-fous du thème

```bash
cd frontend
npm ci
npm run lint                  # oxlint
npm run build                 # tsc -b, puis vite build
npm run verifier:couleurs     # aucune couleur réservée au thème clair, aucun dégradé ni verre
npm run verifier:contrastes   # contrastes WCAG des jetons et des graphiques, deux thèmes
```

- **`verifier:couleurs`** refuse toute classe Tailwind qui ne vaut que pour le thème
  clair (nuances neutres `slate-*`, `gray-*`…, blanc ou noir pleins, fonds pâles `-50` à
  `-200`, textes `-600` et plus…) sans son pendant `dark:` sur la même ligne. Les écrans
  passent par les jetons sémantiques d'`src/index.css` (`surface`, `texte`, `bordure`,
  `marque`, états…), redéfinis pour le thème sombre. `exportRapport.ts` en est exclu :
  les exports PDF et Excel restent clairs, quel que soit le thème de l'interface. Il
  refuse aussi tout **dégradé, effet de verre, flou ou lueur** (`bg-gradient-*`,
  `*-gradient()`, `backdrop-*`, `blur-*`, `shadow-glow`, `glass`), dans les composants et
  la feuille de style : l'interface est plate.
- **`verifier:contrastes`** calcule, à partir d'`index.css` et de la palette Tailwind, le
  contraste de chaque couple texte/fond des jetons, dans les deux thèmes : 4,5:1 pour le
  texte, 3:1 pour les icônes d'état. Il contrôle aussi les **graphiques** : chaque marque à
  3:1 sur la carte, les teintes voisines de l'anneau des catégories séparées en vision
  normale et sous daltonisme, la rampe des priorités monotone. Il échoue si un contrôle
  passe sous son seuil.
- **`node scripts/prouver-classes-seulement.mjs <révision> <fichier.tsx>`** prouve qu'un
  fichier ne diffère d'une révision que par des classes CSS : les deux arbres syntaxiques
  sont comparés, seules les chaînes faites entièrement de classes sont neutralisées
  (ex. `v1.0 src/pages/CreateTicketPage.tsx`).

## Modèle de données

Entités principales (voir `backend/prisma/schema.prisma`) : `Utilisateur`, `Ticket`, `Categorie`, `Commentaire`, `PieceJointe`, `Notification`, `SuggestionIA`, `EvenementTicket`, `RefreshToken`, ainsi que `Parametre`, `TechnicienCategorie` et `Absence` (affectation automatique, §6.2) et `JournalAudit` (traçabilité, §7).

La colonne `Ticket.embedding` (type `vector(1024)`, extension pgvector — dimension du modèle bge-m3) est alimentée par le module IA et indexée en HNSW cosinus. La colonne générée `Ticket.recherche_texte` (`tsvector`, index GIN) porte l'arm lexical de la recherche hybride. Ces deux index sont créés en **SQL brut** dans les migrations : Prisma ne sait pas les exprimer, donc **toute migration générée doit être relue avant application** (voir le journal technique, Chantier 1).

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

## Affectation des tickets

Les tickets peuvent être attribués aux techniciens **manuellement** ou **automatiquement**,
selon la charge de travail et la spécialité (CDC §6.2). L'affectation manuelle reste
disponible **dans les deux modes** : un administrateur peut toujours corriger.

### Régler le mode — Administration → Paramètres

Deux modes, réservés à l'administrateur :

| Mode | Comportement |
| --- | --- |
| **Manuel** *(défaut)* | Les nouveaux tickets restent non assignés. L'administrateur affecte lui-même. |
| **Automatique** | Chaque nouveau ticket est assigné selon la charge et la spécialité, en excluant les techniciens absents. |

Le réglage est **persistant** : il survit au redémarrage de la pile. Un administrateur peut
donc passer en automatique avant une absence prolongée et revenir en manuel à son retour.

> **Basculer en automatique n'affecte que les tickets créés ensuite.** Les tickets déjà en
> attente d'affectation restent non assignés — l'écran l'indique et propose le lien vers la
> file à traiter à la main.

### Définir les spécialités — Administration → Utilisateurs

La colonne **Spécialités** de chaque technicien ouvre une liste de cases à cocher : les
catégories qu'il traite en priorité. Un technicien peut en couvrir plusieurs.

Sans aucune spécialité, un technicien reste candidat aux **affectations de repli** — il
n'est simplement prioritaire sur aucune catégorie.

### Saisir une absence — Administration → Absences

Le tableau liste les absences (technicien, période, durée, motif, statut, qui l'a saisie) et
se filtre sur **En cours / À venir / Passées / Toutes**.

- Les **dates sont incluses** des deux côtés : une absence du 10 au 20 couvre le 20 en entier.
- Motifs : **Congé, Maladie, Formation, Autre**, plus un commentaire libre facultatif.
- Une absence **passée** peut être saisie après coup (cas fréquent : « il était malade lundi,
  on l'apprend mardi »).
- **Deux absences ne peuvent pas se chevaucher** pour un même technicien : la saisie est
  refusée et le message indique les dates de l'absence en conflit. Des périodes contiguës
  (10–15 puis 16–20) restent acceptées.

Une absence **n'affecte que l'affectation automatique**. C'est un mécanisme distinct de la
désactivation d'un compte, qui coupe la connexion et vise un départ :

- le technicien absent **garde son accès complet** à l'application ;
- ses **tickets déjà assignés ne bougent pas** ;
- il **redevient disponible tout seul** à la date de fin, sans intervention.

L'absence en cours est rappelée par une pastille **Absent** dans la liste des utilisateurs,
par une mention « absent jusqu'au … » dans le sélecteur de technicien d'un ticket, et par
une puce sur le graphique de charge du tableau de bord. Le **motif** n'est visible que sur
la page Absences : le graphique de charge est consultable par tous les techniciens, et un
arrêt maladie est une donnée de santé.

### Comment le technicien est choisi

En mode automatique, à la création d'un ticket :

1. **Catégorie retenue** — celle choisie par le demandeur si elle existe ; sinon celle
   suggérée par l'IA, à condition que sa confiance atteigne le seuil ; sinon aucune.
2. **Candidats** — les techniciens **actifs** et **non absents ce jour**.
3. **Spécialité** — si la catégorie est connue et couverte, seuls ces spécialistes sont
   retenus. La spécialité est une contrainte de compétence : un spécialiste chargé passe
   avant un généraliste disponible.
4. **Départage** — le moins chargé (tickets ouverts) ; à égalité, celui servi le moins
   récemment ; à égalité encore, le plus petit identifiant.

Le ticket passe alors **En attente**, le technicien est notifié, et l'historique du ticket
porte un événement « a assigné automatiquement le ticket à … » attribué à **Système**.

**Si aucune affectation n'est possible** — aucun technicien actif, tous absents, ou une
erreur technique — **le ticket est simplement créé sans être assigné**. La création d'un
ticket n'échoue jamais à cause de l'affectation automatique.

**Repli sur la charge seule** quand la catégorie n'est pas exploitable : module IA
indisponible, confiance insuffisante, ou aucun spécialiste disponible pour cette catégorie.

### Points d'entrée API

- `GET /api/parametres` · `PATCH /api/parametres` — lecture et réglage du mode (Administrateur)
- `GET /api/absences` · `POST /api/absences` · `PATCH /api/absences/:id` ·
  `DELETE /api/absences/:id` — gestion des absences (Administrateur)
- `PUT /api/utilisateurs/:id/specialites` — définit les catégories couvertes par un
  technicien (Administrateur ; la liste envoyée **remplace** l'existante)

### Seuils de confiance IA — réglables (§6.5)

Depuis **Administration → Paramètres**, deux réglages distincts :

| Réglage | Effet | Défaut |
|---|---|---|
| **Seuil d'affichage** | sous ce seuil, la catégorie suggérée est grisée et marquée « à préciser ». **N'affecte que l'affichage.** | 0,5 |
| **Porte d'abstention** | le système s'abstient **avant de générer** quand aucun ticket passé n'est assez proche. | désactivée |

Les deux sont bornés et revalidés côté serveur, et chaque modification est inscrite au
**journal d'audit** (auteur, ancienne valeur, nouvelle valeur).

**Découplage à connaître** : l'**affectation automatique** conserve son propre seuil, fixé à
0,5 dans le code (`SEUIL_CONFIANCE_AFFECTATION`). Abaisser le seuil d'affichage ne fera donc
pas affecter davantage de tickets. Rendre cette clé réglable est une perspective identifiée.

**Coût d'ouverture de la porte** : le cross-encoder est chargé au premier usage — environ
3,5 s une fois, puis +2,4 Gio sur le service IA **jusqu'à son prochain redémarrage**. Le
chargement a lieu hors du temps de réponse (la suggestion est générée en asynchrone).

Aucune valeur n'est recommandée pour la porte : le projet n'a pas de calibration
transférable (cf. journal technique, J5).

## Journal d'audit

Les actions sensibles de l'application sont **enregistrées en base**, consultables depuis
**Administration → Journal d'audit** (CDC §7 — Traçabilité).

> Avant ce chantier, la journalisation n'écrivait qu'en console. Comme chaque
> reconstruction d'image recrée le conteneur et emporte ses journaux, il ne restait en
> pratique que quelques heures d'historique. Les entrées sont désormais durables.

### Ce qui est tracé

| Domaine | Actions |
| --- | --- |
| **Authentification** | Connexion, **échec de connexion**, déconnexion, activation de compte, réinitialisation de mot de passe |
| **Comptes** | Invitation, renvoi d'invitation, changement de **rôle**, activation / désactivation, spécialités |
| **Tickets** | Création, affectation (manuelle et automatique), prise en charge, changement de statut / priorité / catégorie, évaluation, pièce jointe, demandes d'IA |
| **Catégories** | Création, renommage, suppression |
| **Absences** | Création, modification, suppression |
| **Paramètres** | Changement du mode d'affectation et des seuils de confiance IA (affichage, porte d'abstention) |
| **Module IA** | Lancement d'un réentraînement, déploiement d'un modèle |

Chaque entrée porte : l'**action**, l'**acteur**, la **cible**, le **résultat**
(succès / échec), l'**adresse IP**, le **navigateur**, l'**horodatage** et un détail
propre à l'action.

### Consulter le journal

Filtres combinables : **action**, **acteur**, **période**, **résultat**. Les 100 dernières
entrées s'affichent, un bouton **Charger plus** remonte le temps.

**Cliquez une ligne** pour ouvrir son détail complet : le contexte y est écrit en français
— « Priorité : Moyenne → Haute », « Motif : Mot de passe incorrect » — et le navigateur
complet y figure.

### Trois natures d'acteur, à ne pas confondre

| Mention | Signification |
| --- | --- |
| **Compte confirmé** | L'action vient d'un compte authentifié. |
| **Système** | Décidée par l'application, sans intervention humaine (affectation automatique, purge). Aucune adresse IP n'y est associée : il n'y en a pas à enregistrer. |
| **Non authentifié** | Identité **présentée** lors d'une tentative, **jamais vérifiée** — typiquement un échec de connexion sur un e-mail inconnu. Le nom affiché n'est pas une identité confirmée. |

De même, une adresse IP absente est toujours **expliquée** : « action du système » n'est pas
la même chose que « repris de l'historique — contexte non enregistré à l'époque ».

### Les échecs de connexion

Les tentatives refusées sont enregistrées avec l'**e-mail saisi**, l'**adresse IP** et le
**motif précis** — compte inexistant, mot de passe incorrect, compte désactivé, compte non
activé. Cinq refus consécutifs depuis une même adresse deviennent lisibles d'un filtre.

> Les réponses de l'API, elles, **ne changent pas** : « compte inexistant » et « mot de
> passe incorrect » renvoient exactement le même message, pour ne pas révéler quels e-mails
> possèdent un compte. La distinction n'existe **que dans le journal** : l'administrateur
> la voit, un attaquant non.

### Données personnelles et conservation

Le journal contient des **adresses IP** et des identifiants de comptes, qui sont des
données à caractère personnel.

| | |
| --- | --- |
| **Finalité** | Sécurité et redevabilité : détecter les accès anormaux, et pouvoir répondre à « qui a fait cette modification, et quand ». **Pas** un outil de mesure de l'activité des employés. |
| **Accès** | **Administrateur uniquement.** Les autres rôles reçoivent un refus (403). |
| **Conservation** | **12 mois.** Les entrées plus anciennes sont supprimées automatiquement. |
| **Purge** | Exécutée **au démarrage de l'API**, et tracée elle-même. |

> **Limite connue** : le projet n'embarque pas de planificateur de tâches. La purge n'a
> lieu qu'au démarrage — une instance qui tournerait plus de douze mois sans redémarrer
> conserverait des entrées au-delà de la durée annoncée. En pratique la pile redémarre à
> chaque déploiement.

#### Photos de profil

La **photo de profil** est une donnée personnelle d'une autre nature que le journal, et
suit des règles distinctes.

| | |
| --- | --- |
| **Caractère** | **Facultative.** Sans photo, l'interface affiche les initiales sur un fond coloré — aucun compte n'est incomplet pour autant. |
| **Maîtrise** | **Self-service exclusif.** Chaque utilisateur ajoute, remplace ou retire **sa propre** photo depuis sa page profil. Un administrateur ne peut pas modifier celle d'un autre compte. |
| **Stockage** | Cloudinary, recadrée en 256×256 **au moment de l'envoi** — l'original lourd n'est jamais conservé. |
| **Diffusion** | **URL directe à identifiant aléatoire**, sans proxy (voir l'avertissement ci-dessous). |
| **Suppression** | Immédiate sur demande de l'utilisateur. Le fichier précédent est **détruit du stockage** à chaque remplacement comme au retrait — rien ne s'accumule. |
| **Journal d'audit** | **Volontairement absent.** Le journal vise les actions d'administration et de sécurité ; y verser les changements d'avatar diluerait ce signal. |

> **À savoir, et assumé** : contrairement aux **pièces jointes**, qui transitent par le
> backend et restent illisibles sans authentification, les photos de profil sont servies
> **directement** par le stockage. La protection tient à l'identifiant aléatoire de l'URL :
> elle n'est pas devinable, mais **une URL divulguée reste lisible sans session**. Ce choix
> évite un aller-retour backend par avatar sur chaque liste de tickets.

### Reprise de l'historique

Les **51 événements de tickets antérieurs** à la mise en service du journal y ont été
importés : il couvre donc l'historique réel du projet. Ces lignes sont signalées
« repris de l'historique » et **sans adresse IP** — ce contexte n'était pas enregistré à
l'époque, et n'a pas été inventé.

De même, **4 affectations anciennes ne sont rattachables à aucun compte** : elles
n'enregistraient que le *nom* du technicien, et ce nom désigne plusieurs comptes.
L'écran l'annonce. Le nom reste lisible dans l'historique du ticket ; seul le lien vers un
compte manque. Les affectations enregistrées depuis sont, elles, rattachées.

### Point d'entrée API

- `GET /api/audit` — consultation filtrée et paginée (Administrateur)

### Perspectives non livrées

Pagination infinie · export CSV / PDF · recherche plein-texte · filtre par objet visé ·
alertes automatiques sur échecs répétés · durée de conservation réglable depuis l'interface.

## État d'avancement

**Livré :**

- ✅ Authentification JWT (inscription, connexion, RBAC, jetons courts + refresh rotatif, rate limiting)
- ✅ Réinitialisation de mot de passe par code OTP, gestion du profil (**photo de profil** comprise), invitation et activation de compte
- ✅ Administration des utilisateurs (rôles, activation/désactivation) et des **catégories**
- ✅ Cycle de vie complet des tickets : création, affectation, prise en charge, résolution,
  satisfaction, clôture, recatégorisation, commentaires, historique d'événements, notifications ;
  liste paginée avec recherche côté serveur (titre, description, catégorie, demandeur, numéro)
- ✅ **Tableau de bord et rapports** (§6.4) : tickets à affecter, ouverts et résolus, temps
  moyen de résolution, délai de 1re prise en charge avec son effectif, satisfaction,
  répartitions par statut, priorité, catégorie et technicien ; filtres par période,
  technicien, catégorie et service ; export PDF et Excel
- ✅ **Affectation automatique** (§6.2) : interrupteur manuel/automatique persistant,
  spécialités technicien ↔ catégorie, **gestion des absences** (congé, maladie, formation)
  excluant les techniciens indisponibles, choix par charge et spécialité
- ✅ **Journal d'audit** (§7) : actions sensibles persistées en base (authentification,
  comptes, tickets, catégories, absences, paramètres, module IA), **échecs de connexion
  tracés avec leur motif**, consultation filtrable réservée à l'administrateur,
  conservation 12 mois
- ✅ **Pièces jointes** (PDF/PNG/JPG, ≤ 10 Mo), stockées sur **Cloudinary**, avec **OCR
  local** (Tesseract, pack `fra`) sur les fichiers envoyés
- ✅ **Module IA complet** : classification automatique de catégorie, priorisation par scorecard
  glass-box, suggestion de solution par **RAG** (recherche hybride pgvector + full-text fusionnée
  par RRF, génération citée avec abstention), résumé de fil — le tout **100 % local**, sans appel
  d'API externe. Le reranker `bge-reranker-v2-m3` est livré mais **hors du chemin par défaut** :
  il n'intervient que si un administrateur ouvre la porte d'abstention (§6.5)
- ✅ **Flywheel** : capture des labels validés, réentraînement supervisé et garde de déploiement
  qui refuse un modèle non meilleur sur le jeu réel
- ✅ Design system frontend (sidebar, palette ⌘K, toasts, composants réutilisables)
- ✅ **Thème clair et thème sombre** sur tous les écrans : préférence du système par
  défaut, bascule à trois états (système, clair, sombre) mémorisée dans le navigateur,
  contrastes vérifiés dans les deux thèmes ; les exports PDF et Excel restent clairs
- ✅ **Conteneurisation Docker autonome et prouvée sur serveur nu** : 7 services, provisionnement
  vérifié des modèles. Après le premier démarrage, le **module IA** fonctionne hors-ligne ; les
  pièces jointes, l'OCR, les photos de profil et les e-mails exigent Cloudinary et le SMTP
- ✅ **Données de démonstration** chargeables depuis un clone propre (profil `demo`) : 852 tickets
  synthétiques aux numéros fixes, base de connaissances du RAG, réentraînement — voir
  « Données de démonstration »
- ✅ **Intégration continue** (GitHub Actions) : typage, lint et tests du backend, suite rapide
  pytest du module IA, lint, build et garde-fous du thème du frontend, rejoués à chaque
  push et pull request vers `main`

**Non retenu au périmètre** — écarté par écrit, annexe B du
[plan de travail](docs/plan-de-travail-esprit.md) :

- Intégration avec Slack et Microsoft Teams (CDC §3.2 objectif 6, §6.5)
- Documentation de l'API au format Swagger / OpenAPI (CDC §8)

## Documentation

- [`ml/README.md`](ml/README.md) — module IA : contenu de l'image, montages, fonctionnement
  hors-ligne, préchauffage, jalons J1→J9
- [`docs/journal-technique.md`](docs/journal-technique.md) — journal des décisions techniques,
  mesures et arbitrages, phase par phase
- [`docs/epic-4-module-ia-conception.md`](docs/epic-4-module-ia-conception.md) — document de
  conception du module IA
- [`docs/plan-de-travail-esprit.md`](docs/plan-de-travail-esprit.md) — plan de travail déposé
  à l'école, avec la table des preuves (annexe A) et les éléments écartés (annexe B)

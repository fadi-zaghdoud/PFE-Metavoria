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

### Limite connue

Le **seuil de confiance** (0,5) utilisé pour retenir une catégorie suggérée est fixé dans le
code et **n'est pas encore réglable** depuis l'interface. La table de paramètres est prête à
l'accueillir (CDC §6.5).

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
| **Paramètres** | Changement du mode d'affectation |
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
  satisfaction, clôture, recatégorisation, commentaires, historique d'événements, notifications
- ✅ **Affectation automatique** (§6.2) : interrupteur manuel/automatique persistant,
  spécialités technicien ↔ catégorie, **gestion des absences** (congé, maladie, formation)
  excluant les techniciens indisponibles, choix par charge et spécialité
- ✅ **Journal d'audit** (§7) : actions sensibles persistées en base (authentification,
  comptes, tickets, catégories, absences, paramètres, module IA), **échecs de connexion
  tracés avec leur motif**, consultation filtrable réservée à l'administrateur,
  conservation 12 mois
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

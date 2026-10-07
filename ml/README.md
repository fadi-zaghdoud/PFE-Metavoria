# Module IA — Smart Ticketing (Epic 4)

Pipeline IA **100 % local, open-source, sans coût API** (conforme CDC §10).
Le module IA ne fait sortir aucune donnée de la machine (confidentialité). Cette garantie
vaut pour lui seul : à l'échelle de l'application, les pièces jointes et les photos de
profil sont stockées sur Cloudinary, et les e-mails passent par un serveur SMTP (voir le
README racine).

## Stack

- **LLM** : Ollama + `qwen2.5:7b` par défaut, dans la pile Docker comme hors conteneur
  (retenu sur mesures en Phase 7). `qwen2.5:14b` reste provisionné : il a généré le corpus
  J1, et reste le défaut des outils d'évaluation (juge LLM, foil de priorité) pour que
  leurs mesures consignées restent rejouables.
- **Embeddings** : `bge-m3` (1024d) — microservice FastAPI (J4)
- **Classification** : embeddings + LogisticRegression **non calibrée** (J5 — la
  calibration, apprise sur un dev synthétique, dégradait le réel ; elle reste au harnais)
- **Recherche** : hybride pgvector + full-text Postgres, fusion RRF (J6)
- **Reranker** : `bge-reranker-v2-m3` (J6), **hors du chemin par défaut**. L'ordre des
  suggestions est celui de la fusion RRF ; le reranker n'est sollicité que par
  `POST /rerank`, le harnais d'évaluation, et la porte d'abstention réglable (§6.5) quand
  un administrateur l'ouvre.

## Contrainte transversale — catégories dynamiques

Les catégories ne sont **jamais** codées en dur. Elles viennent toujours de la
table `categories` (gérée par l'Administration §6.5), lue via `db.py`. Le
générateur, l'entraînement (J5) et le flywheel (J9) s'appuient sur cette liste.

## Prérequis

Les commandes ci-dessous ne concernent que le travail **hors conteneur** (jalons,
harnais d'évaluation, notebooks). Pour simplement faire tourner le service,
`docker compose up -d` suffit — voir « Exécution en conteneur » plus bas.

```bash
# 1. Infrastructure (depuis la racine du repo). `docker compose up -d` provisionne
#    automatiquement les modèles LLM (ollama-prefetch) et sème les 5 catégories du
#    CDC au démarrage du backend — il n'y a plus d'étape manuelle.
docker compose up -d postgres ollama backend

# 2. Environnement Python local
cd ml && cp .env.example .env
python -m venv .venv && . .venv/Scripts/activate   # (Windows) ; Linux : source .venv/bin/activate
pip install -e .
```

> En local hors Docker, pointe `OLLAMA_HOST` sur le serveur que tu utilises :
> `http://localhost:11434` pour un Ollama natif, ou le port publié si tu en
> exposes un. Le conteneur `ollama` de la pile n'expose **délibérément aucun
> port** (voir le README racine).

## J1 — Génération du corpus synthétique

```bash
# Plan seul (lit les catégories en base, aucun appel LLM) :
python -m smart_ticketing_ml.data.generate_corpus --n 900 --dry-run

# Génération réelle :
python -m smart_ticketing_ml.data.generate_corpus --n 900 --out artifacts/corpus
```

Sortie : `artifacts/corpus/corpus_train_<horodatage>.jsonl` + `manifest_<horodatage>.json`
(distributions, modèle, seed, version de prompt — reproductibilité).

**Répartition** : ~85 % résolus (base RAG) / ~15 % ouverts (backlog de démo).
Chaque ticket porte sa `resolution` dans le JSONL ; le chargeur
(`backend/src/chargerCorpusDemo.ts`, `npm run db:load-corpus`) ne la lie **pas** en
base pour les tickets ouverts (fermables à la demande en démo).

## J4 — Microservice d'embeddings (`bge-m3`, 1024d)

Le modèle d'embeddings est **auto-hébergé** (thèse §1/§3 : pas un simple appel
d'API). Une seule implémentation d'embedding (`service/embedder.py`), deux points
d'entrée : le service HTTP et le backfill batch. Vecteurs **L2-normalisés** →
similarité **cosinus** (index HNSW `vector_cosine_ops`).

```bash
# Deps du service (torch, sentence-transformers, fastapi) — séparées de J1/J2 :
cd ml && pip install -e ".[service]"

# 1) Migration base (depuis backend/) : vector(1024) + colonne embedding_modele + index HNSW
cd backend && npx prisma migrate deploy

# 2) Backfill des embeddings de tous les tickets (idempotent)
cd ml && python -m smart_ticketing_ml.service.backfill          # --dry-run pour compter sans écrire

# 3) Service HTTP (appelé par le backend Node aux jalons suivants)
cd ml && uvicorn smart_ticketing_ml.service.app:app --host 127.0.0.1 --port 8000
#   GET  /sante            -> état + modèle + device
#   POST /embed  {"textes": ["..."]} -> {modele, dimension, vecteurs}
```

Backfill **idempotent** : ne (ré)encode que les tickets à `embedding IS NULL` ou
dont `embedding_modele` diffère du modèle courant (un changement de modèle relance
tout). Chaque run écrit un manifeste (`artifacts/embeddings/backfill_<horodatage>.json`
— provenance, comptes, débit, latence unitaire).

## Exécution en conteneur (déploiement, §7)

Le service est dockerisé (`ml/Dockerfile`) et câblé au compose de la racine. Depuis
la racine du dépôt :

```bash
docker compose up -d --build ml     # + postgres et le préchargement des modèles
curl http://localhost:8000/sante
```

Les tâches hors-ligne s'exécutent dans la même image :

```bash
docker compose run --rm ml python -m smart_ticketing_ml.service.backfill
docker compose run --rm ml pytest -m "not slow" -p no:cacheprovider
```

### Ce que l'image contient, et pourquoi

- **`requirements.lock` (55 paquets épinglés)** plutôt que les bornes `>=` du
  `pyproject.toml`. Raison dure : le classifieur figé J5 est sérialisé avec
  **scikit-learn 1.4.0** ; une résolution libre installerait 1.7.x et le dépicklage
  échouerait — `/classify` répondrait 503. Le lock reproduit aussi l'environnement des
  mesures J5/J6/J7. **Monter scikit-learn impose de RÉENTRAÎNER le modèle, pas seulement
  de rebâtir l'image.** Un garde-fou dans le `Dockerfile` fait échouer le build si
  `sklearn != 1.4.0`, si `torch` n'est pas la build `+cpu`, ou si le pack Tesseract
  `fra` manque.
- **torch en build CPU** (`--index-url .../whl/cpu`) : évite ~3 Go de wheels `nvidia-*`
  inutiles, le service tournant en CPU (`EMBED_DEVICE`/`RERANK_DEVICE`).
- **Tesseract + pack `fra`** : binaire système requis par l'OCR (J8bis).
- **Utilisateur non-root** ; `/app` reste la propriété de root — le service ne peut pas
  réécrire son propre code. Seul `artifacts/` lui appartient, parce que `/reentrainer`
  y écrit ses candidats.

### Montages

| Chemin conteneur | Source | Rôle |
|---|---|---|
| `/app/artifacts` | bind-mount `./ml/artifacts` | classifieur figé J5, lots du flywheel, candidats de réentraînement — **inspectables côté hôte** |
| `/cache/huggingface` | volume `hf-cache` | `bge-m3` + `bge-reranker-v2-m3` (~4,3 Go), peuplés une fois par `ml-prefetch` |

`artifacts/` est un **bind-mount** et non un volume : le modèle servi vient directement
du dépôt, et un candidat produit par `/reentrainer` apparaît immédiatement dans
`ml/artifacts/models/candidates/` — la transparence attendue au mémoire.

### Fonctionnement hors-ligne

Une fois `hf-cache` peuplé, le service charge ses modèles **sans aucun accès réseau**
(vérifié le 03/09/2026 sur la suite complète d'alors : `56 passed` avec `--network none`). Cela suppose
`config.source_modele`, qui passe au chargeur le **dossier du cache** plutôt que
l'identifiant du Hub : `transformers` 4.40.2 (`utils/hub.py`, `has_file`) émet sinon un
`requests.head` brut vers huggingface.co — appel qui ignore `HF_HUB_OFFLINE`, dont
l'échec DNS n'est pas rattrapé, et qui rendait le chargement impossible sans réseau
alors que tous les poids étaient en cache. L'identifiant `BAAI/bge-m3` reste la
**provenance** enregistrée en base (`tickets.embedding_modele`).

Ce fonctionnement hors-ligne est celui du **module IA**. À l'échelle de l'application, les
pièces jointes — et donc l'OCR, qui ne lit que les fichiers envoyés —, les photos de
profil et les e-mails exigent l'accès à Cloudinary et au serveur SMTP.

### Préchauffage

`IA_WARMUP=true` (posé par le compose) charge **deux** modèles au démarrage, en tâche de
fond : bge-m3 puis le classifieur — le chemin de la classification. `/sante` et l'écoute
HTTP restent disponibles immédiatement. Sans lui, le premier `/classify` dépasserait le
budget de 4 s du backend, et le premier ticket créé perdrait son enrichissement IA.

Le **reranker n'est pas préchauffé** : `/sante` le montre donc à `"modele_charge": false`,
et c'est l'état normal. Il est hors du chemin par défaut, et le préchauffer immobilisait
~2,3 Go pour un modèle qui ne s'exécutait pas. Il se charge au premier usage — environ
3,5 s, hors du temps de réponse puisque la suggestion est générée en asynchrone.

Le tout premier `/suggest` après un redémarrage du service reste plus lent que les
suivants : excédent mesuré de +7,6 s (GPU) à +17,5 s (CPU), payé une fois par
redémarrage, sans effet en exploitation. **Sa cause n'est pas établie**, et le préchauffage
n'y change rien — voir le journal technique, « Le surcoût du premier appel —
reproductible, non attribué ».

## Limites (à documenter au rapport)

- **Pas d'historique réel** chez Metavoria (confirmé par l'encadrant) : tout
  repose sur le corpus synthétique → section « Limites et validité des résultats ».
- **Arabizi hors périmètre** : FR + termes techniques EN uniquement.
- Le **gold set de test** (J2) est relu à la main et **étanche** (jamais à
  l'entraînement).

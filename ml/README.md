# Module IA — Smart Ticketing (Epic 4)

Pipeline IA **100 % local, open-source, sans coût API** (conforme CDC §10).
Aucune donnée ne sort de la machine (confidentialité).

## Stack

- **LLM** : Ollama + `qwen2.5:14b` (Q4), fallback `qwen2.5:7b`
- **Embeddings** : `bge-m3` (1024d) — microservice FastAPI (J4)
- **Reranker** : `bge-reranker-v2-m3` (J6)
- **Classification** : embeddings + LogisticRegression + calibration (J5)
- **Recherche** : hybride pgvector + full-text Postgres, fusion RRF (J6)

## Contrainte transversale — catégories dynamiques

Les catégories ne sont **jamais** codées en dur. Elles viennent toujours de la
table `categories` (gérée par l'Administration §6.5), lue via `db.py`. Le
générateur, l'entraînement (J5) et le flywheel (J9) s'appuient sur cette liste.

## Prérequis

```bash
# 1. Base + Ollama (depuis la racine du repo)
docker compose up -d postgres ollama
cd backend && npm run db:seed   # seede les 5 catégories du CDC

# 2. Modèle LLM (une fois, ~9 Go)
docker exec smart-ticketing-ollama ollama pull qwen2.5:14b
docker exec smart-ticketing-ollama ollama pull qwen2.5:7b   # fallback

# 3. Environnement Python
cd ml && cp .env.example .env
python -m venv .venv && . .venv/Scripts/activate   # (Windows) ; Linux : source .venv/bin/activate
pip install -e .
```

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
Chaque ticket porte sa `resolution` dans le JSONL ; le loader (à venir) ne la
liera **pas** en base pour les tickets ouverts (fermables à la demande en démo).

## Limites (à documenter au rapport)

- **Pas d'historique réel** chez Metavoria (confirmé par l'encadrant) : tout
  repose sur le corpus synthétique → section « Limites et validité des résultats ».
- **Arabizi hors périmètre** : FR + termes techniques EN uniquement.
- Le **gold set de test** (J2) est relu à la main et **étanche** (jamais à
  l'entraînement).

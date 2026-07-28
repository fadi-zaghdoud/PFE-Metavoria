"""
Configuration du service d'embeddings — lue depuis l'environnement.

Tout est local (aucun appel externe). Les valeurs par défaut suffisent en dév ;
elles sont surchargeables via `.env` (voir `ml/.env.example`).
"""

from __future__ import annotations

import os

# Modèle d'embeddings retenu (conception §7/§13). Identifiant Hugging Face canonique
# — stocké tel quel dans `tickets.embedding_modele` pour la reproductibilité.
MODELE_EMBEDDING = os.environ.get("EMBED_MODELE", "BAAI/bge-m3")

# Dimension de sortie de bge-m3 (tête dense). Doit correspondre à la colonne
# `vector(1024)` en base — vérifié à l'exécution (voir embedder.charger_modele).
DIMENSION = 1024

# Device d'inférence. `cpu` par défaut : le backfill (861 tickets) tient en quelques
# minutes et évite tout risque de VRAM (RTX 3050 Ti = 4 Go). Passer `cuda` en prod
# si l'embed à la volée devient trop lent en CPU (cf. mesure de latence au journal J4).
DEVICE = os.environ.get("EMBED_DEVICE", "cpu")

# Taille de lot pour l'encodage (compromis débit / mémoire).
TAILLE_LOT = int(os.environ.get("EMBED_TAILLE_LOT", "32"))

# Reranker cross-encoder (J6 — étape de reranking de la recherche hybride).
# `bge-reranker-v2-m3` : même famille que bge-m3, multilingue, adapté FR + termes EN.
MODELE_RERANKER = os.environ.get("RERANK_MODELE", "BAAI/bge-reranker-v2-m3")
# torch est CPU-only ici (cf. J6) → reranker sur CPU. Un GPU/torch-CUDA ramènerait
# ~368 ms/paire à ~30-50 ms et lèverait la contrainte de profondeur (perspective).
RERANK_DEVICE = os.environ.get("RERANK_DEVICE", "cpu")
# Longueur max de la paire (requête+doc). Nos tickets ≈ 18 mots médian (J1) → 512 est
# probablement du gaspillage ; 256 halve la latence. Défaut prudent 512 tant que
# l'égalité de qualité 256 vs 512 n'est pas confirmée par l'ablation J6a.
RERANK_MAX_LENGTH = int(os.environ.get("RERANK_MAX_LENGTH", "512"))
# Taille de lot pour le scoring des paires.
RERANK_TAILLE_LOT = int(os.environ.get("RERANK_TAILLE_LOT", "32"))

# Classifieur de catégorie figé (J5, LogReg non calibrée). Défaut : le dernier
# `artifacts/models/classifier_*.joblib` (résolu dans `predictors`) — surchargez
# pour épingler une version précise. Absent → `/classify` répond 503 (Node dégrade).
CLASSIFIER_PATH = os.environ.get("CLASSIFIER_PATH")

# Adresse d'écoute du service FastAPI.
HOTE = os.environ.get("EMBED_HOTE", "127.0.0.1")
PORT = int(os.environ.get("EMBED_PORT", "8000"))

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

# Adresse d'écoute du service FastAPI.
HOTE = os.environ.get("EMBED_HOTE", "127.0.0.1")
PORT = int(os.environ.get("EMBED_PORT", "8000"))

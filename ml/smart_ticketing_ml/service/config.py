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

# ─────────────────────────────────────────────────────────────────────────────
# J8bis Lot B — OCR des pièces jointes (Tesseract + pdfplumber). Local, zéro coût.
# ─────────────────────────────────────────────────────────────────────────────
def _tesseract_defaut() -> str | None:
    """Chemin du binaire Tesseract si absent du PATH (install dév Windows UB Mannheim).
    Sur le PATH (prod Docker) → None : on laisse pytesseract le résoudre."""
    import os as _os
    import shutil as _shutil

    if _shutil.which("tesseract"):
        return None
    for c in (r"C:\Program Files\Tesseract-OCR\tesseract.exe",
              r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"):
        if _os.path.exists(c):
            return c
    return None


# Binaire Tesseract : override explicite, sinon auto-détection. `None` = sur le PATH.
TESSERACT_CMD = os.environ.get("TESSERACT_CMD") or _tesseract_defaut()
# Langue OCR — pack Tesseract `fra` requis (FR + termes techniques EN, comme les embeddings).
OCR_LANGUE = os.environ.get("OCR_LANGUE", "fra")
# Résolution de rasterisation d'un PDF scanné avant OCR (300 dpi = standard qualité OCR).
OCR_DPI = int(os.environ.get("OCR_DPI", "300"))
# Seuil anti-bruit ÉTAGE MOT : on écarte tout mot dont la confiance Tesseract < ce seuil.
OCR_SEUIL_MOT = float(os.environ.get("OCR_SEUIL_MOT", "40"))
# Seuil anti-bruit ÉTAGE DOCUMENT : `fiable=False` si la confiance moyenne des mots
# retenus est sous ce seuil (Node ne stockera pas un OCR douteux dans texte_extrait).
OCR_SEUIL_DOC = float(os.environ.get("OCR_SEUIL_DOC", "55"))
# …et `fiable=False` s'il reste moins de ce nombre de mots lisibles.
OCR_MIN_MOTS = int(os.environ.get("OCR_MIN_MOTS", "3"))
# Un PDF est réputé « à couche texte » (pas d'OCR) si l'extraction directe rend au
# moins ce nombre de caractères non blancs ; en dessous → PDF scanné → OCR.
PDF_MIN_CHARS_TEXTE = int(os.environ.get("PDF_MIN_CHARS_TEXTE", "20"))
# Garde-fou de taille (Node valide déjà ≤10 Mo à l'upload ; défense en profondeur).
EXTRACT_TAILLE_MAX_MO = int(os.environ.get("EXTRACT_TAILLE_MAX_MO", "10"))

# ─────────────────────────────────────────────────────────────────────────────
# Dockerisation (§7) — préchauffage au démarrage du service.
# ─────────────────────────────────────────────────────────────────────────────
# Les modèles sont chargés PARESSEUSEMENT (embedder/reranker/predictors). En
# conteneur, le premier `/classify` paierait donc ~30 s de chargement de bge-m3,
# très au-delà du budget de 4 s du backend (IA_TIMEOUT_MS) : le tout premier
# ticket créé après un `docker compose up` perdrait son enrichissement IA.
# `IA_WARMUP=true` (posé par le compose) charge le chemin de classification en
# tâche de fond dès le démarrage.
# Défaut FALSE, délibérément : la suite de tests instancie `TestClient(app)` SANS
# `with` — donc sans lifespan — mais un défaut à `true` rendrait tout futur
# `with TestClient(app)` dépendant d'un modèle de 2,3 Go, et la suite « offline »
# ne le serait plus.
WARMUP = os.environ.get("IA_WARMUP", "false").strip().lower() in ("1", "true", "oui")


# ─────────────────────────────────────────────────────────────────────────────
# Dockerisation (§7) — chargement des modèles SANS appel réseau.
# ─────────────────────────────────────────────────────────────────────────────
def source_modele(repo: str) -> str:
    """Chemin LOCAL du modèle s'il est en cache, sinon l'identifiant du Hub.

    POURQUOI. `transformers.utils.hub.has_file` (4.40.2) émet un `requests.head()`
    BRUT vers huggingface.co pour tester la présence de `model.safetensors`. Cet
    appel ignore `HF_HUB_OFFLINE` et `TRANSFORMERS_OFFLINE` (il ne passe pas par
    `hf_hub_download`), et son échec DNS n'est pas rattrapé — le `head()` est HORS
    du `try`, contrairement à ce que promet sa propre docstring. Sans réseau, le
    chargement de bge-m3 casse donc, alors que TOUS ses poids sont en cache.
    Compléter le cache n'y changerait rien : `BAAI/bge-m3` ne publie AUCUN
    safetensors (404 sur le Hub) — le sondage est structurellement sans réponse.

    COMMENT. `has_file` court-circuite le réseau quand on lui passe un RÉPERTOIRE :
        if os.path.isdir(path_or_repo): return os.path.isfile(...)
    On résout donc le dossier du cache local et on le passe au chargeur.

    L'identifiant (`BAAI/bge-m3`) reste la PROVENANCE enregistrée en base
    (`tickets.embedding_modele`) : il n'est pas remplacé, seulement contourné au
    moment du chargement. Modèle absent du cache (premier démarrage sans
    préchargement) : on rend l'identifiant et le Hub prend le relais normalement.
    """
    try:
        from huggingface_hub import snapshot_download

        return snapshot_download(repo, local_files_only=True)
    except Exception:  # pas en cache -> comportement d'origine (téléchargement)
        return repo

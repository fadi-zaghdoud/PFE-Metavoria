"""
Reranker cross-encoder `bge-reranker-v2-m3` (J6) — chargement paresseux + scoring.

Source unique de vérité pour le reranking : le service HTTP (`/rerank`) comme le
harnais d'évaluation (`retrieval.hybrid`) importent `scorer` d'ici — même modèle,
un seul chargement.

Contrairement à l'embedder (qui encode requête et document séparément, puis
compare les vecteurs), un cross-encoder lit la **paire (requête, document)
conjointement** → bien plus précis, au prix de la latence : ~368 ms/paire mesuré
sur CPU (torch 2.2 CPU-only, cf. dimensionnement J6). Les scores sortent en
`(0,1)` (sigmoïde du logit) et **ne sont pas calibrés** — le seuil calibré /
l'abstention sont un travail du J6b.
"""

from __future__ import annotations

import threading

from . import config

# Chargement paresseux et thread-safe : le modèle (~2,3 Go) n'est chargé qu'au
# premier scoring, une seule fois, même sous requêtes concurrentes.
_modele = None
_verrou = threading.Lock()


def charger_modele():
    """Charge (une fois) le CrossEncoder bge-reranker-v2-m3 (max_length figée au chargement)."""
    global _modele
    if _modele is not None:
        return _modele
    with _verrou:
        if _modele is not None:  # un autre thread a pu charger entre-temps
            return _modele
        try:
            from sentence_transformers import CrossEncoder
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "Paquet `sentence-transformers` manquant : pip install -e ml[service]"
            ) from exc

        _modele = CrossEncoder(
            config.MODELE_RERANKER,
            device=config.RERANK_DEVICE,
            max_length=config.RERANK_MAX_LENGTH,
        )
        return _modele


def modele_charge() -> bool:
    """Vrai si le reranker est déjà en mémoire (utile pour /sante)."""
    return _modele is not None


def scorer(requete: str, documents: list[str]) -> list[float]:
    """Score de pertinence (requête, document) pour chaque document.

    Plus haut = plus pertinent. Scores en `(0,1)`, **non calibrés**.
    """
    if not documents:
        return []
    modele = charger_modele()
    scores = modele.predict(
        [[requete, d] for d in documents],
        batch_size=config.RERANK_TAILLE_LOT,
        show_progress_bar=False,
    )
    return [float(s) for s in scores]


def classer(requete: str, documents: list[str]) -> list[tuple[int, float]]:
    """`(index, score)` triés par score décroissant — l'index renvoie au `documents` d'entrée."""
    return sorted(enumerate(scorer(requete, documents)), key=lambda x: x[1], reverse=True)

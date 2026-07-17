"""
Pipeline d'embeddings `bge-m3` — chargement paresseux + encodage normalisé.

Source unique de vérité pour la production de vecteurs : le service HTTP (`/embed`)
comme le backfill batch importent `embed_textes` d'ici. Les vecteurs sont
**L2-normalisés** → la similarité cosinus (index HNSW `vector_cosine_ops`) est la
métrique naturelle.
"""

from __future__ import annotations

import threading
import time

from . import config

# Chargement paresseux et thread-safe : le modèle (~2,3 Go) n'est chargé qu'au
# premier embed, une seule fois, même sous requêtes concurrentes.
_modele = None
_verrou = threading.Lock()


def charger_modele():
    """Charge (une fois) le SentenceTransformer bge-m3 et vérifie sa dimension."""
    global _modele
    if _modele is not None:
        return _modele
    with _verrou:
        if _modele is not None:  # un autre thread a pu charger entre-temps
            return _modele
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "Paquet `sentence-transformers` manquant : "
                "pip install -e ml[service]"
            ) from exc

        modele = SentenceTransformer(config.MODELE_EMBEDDING, device=config.DEVICE)
        dim = modele.get_sentence_embedding_dimension()
        if dim != config.DIMENSION:
            raise RuntimeError(
                f"Dimension inattendue pour {config.MODELE_EMBEDDING} : "
                f"{dim} (colonne base = vector({config.DIMENSION}))."
            )
        _modele = modele
        return _modele


def modele_charge() -> bool:
    """Vrai si le modèle est déjà en mémoire (utile pour /sante)."""
    return _modele is not None


def embed_textes(textes: list[str]) -> list[list[float]]:
    """
    Encode une liste de textes en vecteurs 1024d **L2-normalisés**.

    Renvoie une liste de listes de flottants (sérialisable JSON / prête pour pgvector).
    """
    if not textes:
        return []
    modele = charger_modele()
    vecteurs = modele.encode(
        textes,
        batch_size=config.TAILLE_LOT,
        normalize_embeddings=True,  # -> cosinus == produit scalaire
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    return vecteurs.tolist()


def mesurer_latence_unitaire(texte: str = "Impossible de me connecter au VPN depuis ce matin.") -> float:
    """
    Latence d'un embed **unitaire** (modèle déjà chaud), en millisecondes.

    Sert la section « dimensionnement production » du rapport (budget CDC < 5 s/ticket).
    """
    charger_modele()  # exclut le temps de chargement de la mesure
    debut = time.perf_counter()
    embed_textes([texte])
    return (time.perf_counter() - debut) * 1000.0

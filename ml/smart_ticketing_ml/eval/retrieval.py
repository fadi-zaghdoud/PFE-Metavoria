"""
J6 (STUB) — Métriques de retrieval pour le RAG.

Volontairement non implémenté au J3 : fixer la forme du harnais maintenant évite
de le restructurer au J6. À implémenter quand la recherche hybride (pgvector +
full-text, RRF) + reranker existeront.

Évaluées sur des paires (requête = titre+description d'un ticket, ticket(s)
pertinent(s) = résolution(s) attendue(s)). Cf. conception §10.
"""

from __future__ import annotations

_MSG = "Métrique de retrieval prévue au J6 (RAG hybride + reranker) — non implémentée au J3."


def recall_at_k(pertinents: list[list[str]], retrouves: list[list[str]], k: int) -> float:
    """Part des requêtes dont un document pertinent apparaît dans le top-k."""
    raise NotImplementedError(_MSG)


def mrr(pertinents: list[list[str]], retrouves: list[list[str]]) -> float:
    """Mean Reciprocal Rank : 1/rang du premier document pertinent, moyenné."""
    raise NotImplementedError(_MSG)


def ndcg_at_k(pertinents: list[list[str]], retrouves: list[list[str]], k: int) -> float:
    """Normalized Discounted Cumulative Gain @k."""
    raise NotImplementedError(_MSG)

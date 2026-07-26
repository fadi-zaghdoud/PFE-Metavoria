"""
J6b — Orchestration de la suggestion RAG (glass-box, validation humaine en aval).

Chaîne : **RRF (ordre)** → **porte d'abstention** (score cross-encoder du top-1, si un seuil
est réglé) → **génération citée**. Deux décisions structurantes (cf. journal J6) :

- **Ordre = RRF** (il transfère au réel), **jamais le rerank** (son ordre fin nuit au réel).
- **Seuil neutre par défaut** (`None`) : aucun seuil figé — le synthétique ne transfère pas
  (J5) → on montre tout, le réglage attend le flywheel. Quand un seuil est fourni, la porte
  s'active ; sous le seuil → abstention (« aucune suggestion fiable »).

Si la génération ne cite aucune source valide (les tickets retrouvés ne couvrent pas le
problème) → **abstention** (« aucune suggestion pertinente ») plutôt qu'une réponse inventée.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import psycopg

from . import config, generation, hybrid


@dataclass
class Suggestion:
    abstenu: bool
    texte: str = ""
    sources: list[int] = field(default_factory=list)
    confiance: float | None = None      # score de porte (top-1) si un seuil est réglé
    message: str = ""                   # motif d'abstention, le cas échéant
    latence_ms: float | None = None


def suggerer(
    cur: psycopg.Cursor,
    requete: str,
    seuil: float | None = config.SEUIL_ABSTENTION_DEFAUT,
    k: int = config.K_SUGGESTION,
) -> Suggestion:
    """Produit une suggestion citée pour `requete`, ou une abstention motivée."""
    t0 = time.perf_counter()

    docs = hybrid.retrieve(cur, requete, "rrf")[:k]  # ORDRE = RRF
    if not docs:
        return Suggestion(True, message="Aucun ticket similaire trouvé.",
                          latence_ms=(time.perf_counter() - t0) * 1000)

    confiance: float | None = None
    if seuil is not None:  # porte d'abstention active seulement si un seuil est réglé
        confiance = hybrid.score_abstention(requete, docs)  # rerank top-1 : SCORE, pas l'ordre
        if confiance < seuil:
            return Suggestion(True, confiance=confiance,
                              message="Aucune suggestion fiable (confiance sous le seuil).",
                              latence_ms=(time.perf_counter() - t0) * 1000)

    texte, sources = generation.generer(requete, docs)
    latence = (time.perf_counter() - t0) * 1000
    if not sources:  # rien d'ancré → on n'invente pas
        return Suggestion(True, confiance=confiance,
                          message="Aucune suggestion pertinente (les tickets retrouvés ne "
                                  "couvrent pas le problème).", latence_ms=latence)
    return Suggestion(False, texte=texte, sources=sources, confiance=confiance, latence_ms=latence)

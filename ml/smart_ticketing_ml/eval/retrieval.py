"""
J6 — Métriques de retrieval pour le RAG (implémentées ; le stub J3 est levé).

Pertinence **gradée** (0/1/2) jugée par LLM local validé (cf. `judge.py`,
`judge_validation.py`). Évaluation par **pooling façon TREC** : le pool jugé = union
des top-k des variantes comparées ; tout doc hors pool est traité comme grade 0. On ne
publie que des métriques **@≤POOL_DEPTH** → aucun doc contribuant à une métrique n'est
non-jugé.

Contrat : `pertinence` = {doc_id -> grade 0/1/2} pour une requête ; `classement` =
liste ordonnée de doc_id renvoyée par une variante. Fonctions pures (aucune I/O).

Conventions pré-enregistrées :
- **binaire** (Recall/Precision/MRR) : pertinent = grade ≥ `seuil` (défaut 1 ; variante
  stricte `seuil=2` reportée en second).
- **nDCG** : gains = grade (linéaire, 0/1/2) ; iDCG = tri décroissant des grades du pool.
- Une requête sans aucun pertinent dans le pool est **exclue** des moyennes (NaN) et
  comptée à part (couverture) — sinon on récompenserait/pénaliserait un cas indéfini.
"""

from __future__ import annotations

import math
from statistics import mean

_MSG_VIDE = float("nan")


def _pertinents(pertinence: dict, seuil: int) -> set:
    return {d for d, g in pertinence.items() if g >= seuil}


def recall_at_k(pertinence: dict, classement: list, k: int, seuil: int = 1) -> float:
    """Part des documents pertinents (du pool) présents dans le top-k. NaN si aucun pertinent."""
    pertinents = _pertinents(pertinence, seuil)
    if not pertinents:
        return _MSG_VIDE
    topk = set(classement[:k])
    return len(pertinents & topk) / len(pertinents)


def precision_at_k(pertinence: dict, classement: list, k: int, seuil: int = 1) -> float:
    """Part du top-k qui est pertinent (dénominateur = k, convention standard)."""
    topk = classement[:k]
    if not topk:
        return 0.0
    return sum(1 for d in topk if pertinence.get(d, 0) >= seuil) / k


def reciprocal_rank(pertinence: dict, classement: list, seuil: int = 1) -> float:
    """1/rang du premier document pertinent (0 si aucun). NaN si aucun pertinent au pool."""
    if not _pertinents(pertinence, seuil):
        return _MSG_VIDE
    for i, d in enumerate(classement, start=1):
        if pertinence.get(d, 0) >= seuil:
            return 1.0 / i
    return 0.0


def _dcg(gains: list[float]) -> float:
    return sum(g / math.log2(i + 1) for i, g in enumerate(gains, start=1))


def ndcg_at_k(pertinence: dict, classement: list, k: int) -> float:
    """nDCG@k gradé (gains = grade). NaN si le pool n'a aucun grade > 0."""
    ideal = sorted(pertinence.values(), reverse=True)[:k]
    idcg = _dcg([float(g) for g in ideal])
    if idcg == 0:
        return _MSG_VIDE
    gains = [float(pertinence.get(d, 0)) for d in classement[:k]]
    return _dcg(gains) / idcg


# ── Agrégation multi-requêtes ────────────────────────────────────────────────

def _moyenne_definie(valeurs: list[float]) -> tuple[float, int]:
    """Moyenne en ignorant les NaN (requêtes sans pertinent au pool). Renvoie (moyenne, n_définis)."""
    definis = [v for v in valeurs if not math.isnan(v)]
    return (mean(definis) if definis else _MSG_VIDE, len(definis))


def agreger(
    pertinences: list[dict],
    classements: list[list],
    ks: tuple[int, ...] = (1, 3, 5),
    seuil: int = 1,
) -> dict:
    """Agrège les métriques sur un ensemble de requêtes (une entrée par requête).

    `pertinences[i]` = {doc_id -> grade} du pool de la requête i ; `classements[i]` = le
    classement de la variante évaluée pour la requête i. Renvoie recall@k, precision@k,
    nDCG@k (moyennes sur les requêtes à pertinent défini), MRR, et la couverture.
    """
    n = len(pertinences)
    res: dict[str, float] = {}
    for k in ks:
        res[f"recall@{k}"], n_def = _moyenne_definie(
            [recall_at_k(p, c, k, seuil) for p, c in zip(pertinences, classements)])
        res[f"precision@{k}"], _ = _moyenne_definie(
            [precision_at_k(p, c, k, seuil) for p, c in zip(pertinences, classements)])
        res[f"ndcg@{k}"], _ = _moyenne_definie(
            [ndcg_at_k(p, c, k) for p, c in zip(pertinences, classements)])
    res["mrr"], n_def = _moyenne_definie(
        [reciprocal_rank(p, c, seuil) for p, c in zip(pertinences, classements)])
    res["n_requetes"] = n
    res["n_avec_pertinent"] = n_def        # couverture : requêtes ayant ≥1 pertinent au pool
    res["seuil"] = seuil
    return res

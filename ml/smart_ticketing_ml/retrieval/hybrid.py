"""
J6 — Recherche hybride : dense (pgvector) + lexical (full-text Postgres), fusion RRF,
puis reranking cross-encoder. Les 3 arms sont exposés SÉPARÉMENT (`dense`, `lexical`,
`rrf`) — plus `rrf_rerank` — pour mesurer la contribution de chaque composant.

KB indexable = `synthetique AND statut ∈ {RESOLU,CLOTURE}` (723 docs). Le drapeau
`synthetique` exclut proprement les 9 bruits de dev (dont 7 résolus). Chaque doc porte
sa **résolution** (Commentaire lié). Unité requête = titre+description (cohérente avec
les embeddings J4) ; unité document rerankée/jugée = titre+description+résolution.

Décisions (pré-enregistrées, cf. journal J6) : RRF k=60, 50/50 non pondéré ; retrieval
en Python (le harnais lit la base directement) ; reranker importé en direct (même
implémentation que `/rerank`), pas d'appel HTTP à l'éval.
"""

from __future__ import annotations

from dataclasses import dataclass

import psycopg

from ..db import database_url
from ..eval.dataset import SIM_WARN, _jaccard, _norm, _tokens
from ..service import embedder, reranker
from ..service.backfill import _vecteur_en_litteral
from . import config

# Filtre du corpus indexable, factorisé (réutilisé par chaque arm).
_FILTRE_KB = "t.synthetique AND t.statut = ANY(%s)"


@dataclass
class DocKB:
    """Un document de la base de connaissances RAG, avec le score de l'arm courant."""
    id: int
    titre: str
    description: str
    resolution: str
    categorie: str | None
    score: float  # sens dépend de l'arm : sim cosinus / ts_rank / score RRF / score reranker

    @property
    def texte_doc(self) -> str:
        """Unité rerankée / jugée : problème + résolution (§7 — la solution vit dans la résolution)."""
        return f"{self.titre}\n{self.description}\n{self.resolution}"


# ── Arms de recherche ────────────────────────────────────────────────────────

def _arm_dense(cur: psycopg.Cursor, vec_litteral: str, k: int) -> list[tuple[int, float]]:
    """Top-k dense (cosinus pgvector, index HNSW). Renvoie (id, similarité)."""
    cur.execute(
        f"""
        SELECT t.id, 1 - (t.embedding <=> %s::vector) AS sim
        FROM tickets t
        WHERE {_FILTRE_KB} AND t.embedding IS NOT NULL
        ORDER BY t.embedding <=> %s::vector
        LIMIT %s
        """,
        (vec_litteral, list(config.STATUTS_KB), vec_litteral, k),
    )
    return [(r[0], float(r[1])) for r in cur.fetchall()]


def _arm_lexical(cur: psycopg.Cursor, texte: str, k: int) -> list[tuple[int, float]]:
    """Top-k lexical (full-text, index GIN). Requête = OR des lexèmes (recall façon BM25),
    même stemming `french` que la colonne générée. Renvoie (id, ts_rank_cd)."""
    cur.execute(
        f"""
        WITH q AS (
          SELECT to_tsquery('french',
                   array_to_string(tsvector_to_array(to_tsvector('french', %s)), ' | ')) AS query
        )
        SELECT t.id, ts_rank_cd(t.recherche_texte, q.query) AS rang
        FROM tickets t, q
        WHERE {_FILTRE_KB} AND t.recherche_texte @@ q.query
        ORDER BY rang DESC
        LIMIT %s
        """,
        (texte, list(config.STATUTS_KB), k),
    )
    return [(r[0], float(r[1])) for r in cur.fetchall()]


def rrf_fusion(classements: list[list[int]], k: int = config.RRF_K) -> dict[int, float]:
    """Reciprocal Rank Fusion (Cormack 2009), 50/50 non pondéré : chaque liste contribue
    1/(k + rang). Renvoie {id -> score RRF}."""
    scores: dict[int, float] = {}
    for classement in classements:
        for rang, doc_id in enumerate(classement, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rang)
    return scores


# ── Chargement des documents ─────────────────────────────────────────────────

def _charger_docs(cur: psycopg.Cursor, ids: list[int]) -> dict[int, tuple[str, str, str, str | None]]:
    """Pour un ensemble d'ids KB : (titre, description, résolution liée, catégorie)."""
    if not ids:
        return {}
    cur.execute(
        """
        SELECT t.id, t.titre, t.description,
               (SELECT contenu FROM commentaires WHERE ticket_id = t.id ORDER BY id LIMIT 1) AS resolution,
               c.nom AS categorie
        FROM tickets t
        LEFT JOIN categories c ON c.id = t.categorie_id
        WHERE t.id = ANY(%s)
        """,
        (ids,),
    )
    return {r[0]: (r[1], r[2], r[3] or "", r[4]) for r in cur.fetchall()}


def _en_docs(cur: psycopg.Cursor, ids_scores: list[tuple[int, float]]) -> list[DocKB]:
    """Assemble des DocKB en préservant l'ordre de `ids_scores`."""
    details = _charger_docs(cur, [i for i, _ in ids_scores])
    docs: list[DocKB] = []
    for doc_id, score in ids_scores:
        if doc_id not in details:  # sécurité : un id disparu entre deux requêtes
            continue
        titre, description, resolution, categorie = details[doc_id]
        docs.append(DocKB(doc_id, titre, description, resolution, categorie, score))
    return docs


# ── Point d'entrée ───────────────────────────────────────────────────────────

VARIANTES = ("dense", "lexical", "rrf", "rrf_rerank")


def retrieve(cur: psycopg.Cursor, requete: str, variante: str) -> list[DocKB]:
    """Retourne les documents KB classés pour une variante.

    - `dense` / `lexical` : l'arm seul, trié par son score.
    - `rrf` : fusion RRF des deux arms → top `K_CANDIDATS`.
    - `rrf_rerank` : `rrf` puis reranking cross-encoder (réordonne les candidats).
    """
    if variante not in VARIANTES:
        raise ValueError(f"Variante inconnue : {variante!r} (attendu {VARIANTES}).")

    if variante == "lexical":
        return _en_docs(cur, _arm_lexical(cur, requete, config.K_LEXICAL))

    # dense, rrf et rrf_rerank ont tous besoin de l'embedding de la requête.
    vec = _vecteur_en_litteral(embedder.embed_textes([requete])[0])
    dense = _arm_dense(cur, vec, config.K_DENSE)
    if variante == "dense":
        return _en_docs(cur, dense)

    lexical = _arm_lexical(cur, requete, config.K_LEXICAL)
    fusion = rrf_fusion([[i for i, _ in dense], [i for i, _ in lexical]])
    candidats = sorted(fusion.items(), key=lambda x: x[1], reverse=True)[: config.K_CANDIDATS]
    docs = _en_docs(cur, candidats)
    if variante == "rrf":
        return docs

    # rrf_rerank : score cross-encoder sur (requête, doc) puis tri décroissant.
    scores = reranker.scorer(requete, [d.texte_doc for d in docs])
    for d, s in zip(docs, scores):
        d.score = s
    docs.sort(key=lambda d: d.score, reverse=True)
    return docs


# ── Garde anti-fuite (intégrité retrieval) ───────────────────────────────────

def garde_anti_fuite(
    requete_titre: str, requete_description: str, docs: list[DocKB], sim_warn: float = SIM_WARN
) -> tuple[list[int], list[tuple[int, float]]]:
    """Vérifie qu'aucun document retrouvé n'est la requête elle-même (fuite triviale).

    Réutilise les helpers d'étanchéité du harnais (une seule implémentation de Jaccard).
    Renvoie (fuites_exactes, proches) : exact = description normalisée identique (à FAIL
    dur côté appelant) ; proche = Jaccard(titre+desc) ≥ `sim_warn` (avertissement).
    """
    q_desc = _norm(requete_description)
    q_tok = _tokens(f"{requete_titre} {requete_description}")
    exacts: list[int] = []
    proches: list[tuple[int, float]] = []
    for d in docs:
        if q_desc and _norm(d.description) == q_desc:
            exacts.append(d.id)
        s = _jaccard(q_tok, _tokens(f"{d.titre} {d.description}"))
        if s >= sim_warn and s < 1.0:
            proches.append((d.id, round(s, 3)))
    return exacts, proches


def score_abstention(requete: str, docs: list[DocKB]) -> float:
    """Score de confiance de la suggestion = pertinence cross-encoder du **meilleur candidat**.

    Découplage (décision J6b) : le reranker ne sert QU'À **scorer la porte oui/non**
    d'abstention, **pas à réordonner** l'affichage. L'ordre reste RRF (il transfère au
    réel) ; l'ordre fin du rerank nuit au réel — mais un score grossier pertinent/pas
    reste utile comme confiance. Coût = 1 seule paire rerankée (top-1) → dans le budget.
    Score en (0,1), NON calibré (le seuil attend un dev réel, cf. journal / posture J5).
    """
    if not docs:
        return 0.0
    return reranker.scorer(requete, [docs[0].texte_doc])[0]


def connexion() -> psycopg.Connection:
    """Connexion à la base (les appelants gèrent le contexte `with`)."""
    return psycopg.connect(database_url())

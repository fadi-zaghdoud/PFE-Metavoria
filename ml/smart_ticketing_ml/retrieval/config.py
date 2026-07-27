"""
J6 — Paramètres de la recherche hybride. Valeurs **pré-enregistrées** (avant résultats),
**non réglées** sur le gold (anti-contamination — cf. journal J6).
"""

from __future__ import annotations

# Filtre du corpus indexable (KB RAG). Le drapeau `synthetique` exclut proprement les
# 9 tickets de bruit de dev — dont **7 sont RESOLU/CLOTURE**, qu'un filtre statut SEUL
# aurait injectés dans la KB. Résultat : 723 docs, chacun avec sa résolution liée.
STATUTS_KB: tuple[str, ...] = ("RESOLU", "CLOTURE")

# Arms de recherche (top-K de chaque arm, avant fusion).
K_DENSE = 20        # dense : pgvector cosinus (bge-m3, 1024d), index HNSW
K_LEXICAL = 20      # lexical : full-text Postgres (OR des lexèmes), index GIN, ts_rank_cd

# Fusion RRF — Reciprocal Rank Fusion (Cormack, Clarke & Büttcher, 2009).
# k=60 = constante standard de la littérature. Fusion 50/50 **non pondérée** : régler le
# poids dense/lexical sur le gold synthétique le contaminerait ET ajouterait un cas de
# « réglé sur synthétique → ne transfère pas » (justif. écrite au journal J6).
RRF_K = 60
K_CANDIDATS = 20    # candidats gardés après fusion RRF (= entrée du reranker)

# Suggestions finales renvoyées après reranking.
TOP_FINAL = 5

# ── J6b — suggestion RAG (décision + génération) ─────────────────────────────
# Le rerank NE réordonne PAS l'affichage par défaut. L'ablation J6a mesure un effet
# FAIBLE et AMBIGU (gain marginal ~+0,01 nDCG/Recall, même sur réel ; perte MRR réel
# −0,060) : décision motivée par un rapport bénéfice/coût défavorable — gain minuscule
# vs coût latence ~8 s/requête (dépasse le budget CDC < 5 s sur requête longue) — et
# NON par « le rerank nuit ». L'ORDRE reste RRF ; le rerank ne sert qu'au SCORE de la
# porte d'abstention (top-1). Réactivable en paramètre (reranker réentraîné, flywheel J9).
RERANK_ACTIF_DEFAUT = False

# Seuil d'abstention NEUTRE par défaut (= None) : aucune valeur figée. Un seuil réglé sur le
# synthétique ne transfère pas (prouvé J5) → on livre le mécanisme + la courbe couverture/précision,
# le réglage attend un dev réel (flywheel). Exposé comme paramètre admin (§6.5).
SEUIL_ABSTENTION_DEFAUT: float | None = None

# Nombre de tickets fournis à la génération (sources citables #id).
K_SUGGESTION = 3

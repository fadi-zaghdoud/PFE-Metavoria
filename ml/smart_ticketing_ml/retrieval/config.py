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
# PAS DE DRAPEAU DE RERANK ICI, et c'est délibéré. Une constante `RERANK_ACTIF_DEFAUT
# = False` a vécu ici de J6 (631c36c) au 19/09/2026 : elle n'était LUE PAR AUCUNE
# LIGNE DE CODE, tout en se donnant, au journal comme dans les rapports d'ablation,
# pour la décision de production. Elle laissait croire à un interrupteur là où il n'y
# en avait pas. Retirée plutôt que corrigée : un drapeau qui ne commande rien est pire
# qu'une absence de drapeau.
#
# L'ÉTAT RÉEL. Le reranker n'est pas câblé dans la chaîne de suggestion :
#   - l'ORDRE d'affichage est `"rrf"`, écrit en dur dans `suggestion.py` ;
#   - le SCORE de la porte d'abstention n'est calculé que si un seuil est fourni
#     (`if seuil is not None`), or `SEUIL_ABSTENTION_DEFAUT` vaut `None` ci-dessous et
#     rien ne le règle — ni variable d'environnement, ni paramètre admin (le registre
#     backend ignore encore `SEUIL_CONFIANCE_IA`, §6.5).
# Le reranker ne s'exécute donc que via `POST /rerank` et le harnais d'évaluation
# (variante `rrf_rerank`). Le recâbler suppose de MODIFIER `suggestion.py`.
#
# POURQUOI on ne l'a pas câblé. L'ablation J6a (7cae733) mesure un effet FAIBLE et
# AMBIGU : gain marginal ~+0,01 nDCG/Recall (même sur réel) mais perte MRR réel
# −0,060, sur un échantillon réel utile de n=25 seulement. En face, un coût mesuré
# (19/09/2026) de 6,86 s par requête à K=20 — au-delà du budget CDC de 5 s. Rapport
# bénéfice/coût défavorable entre DEUX GRANDEURS MESURÉES — et NON « le rerank nuit ».
#
# NUANCE À NE PAS PERDRE : ce coût ne condamne que le RÉORDONNANCEMENT. La porte
# d'abstention ne rerank qu'une paire (top-1) : 0,379 s mesurés, négligeables devant
# les 11-33 s d'un /suggest. Si la porte reste fermée, ce n'est pas la latence — c'est
# l'absence de seuil calibré (posture J5 : aucun seuil figé sur du synthétique).

# Seuil d'abstention NEUTRE par défaut (= None) : aucune valeur figée. Un seuil réglé sur le
# synthétique ne transfère pas (prouvé J5) → on livre le mécanisme + la courbe couverture/précision,
# le réglage attend un dev réel (flywheel). Exposé comme paramètre admin (§6.5).
SEUIL_ABSTENTION_DEFAUT: float | None = None

# Nombre de tickets fournis à la génération (sources citables #id).
K_SUGGESTION = 3

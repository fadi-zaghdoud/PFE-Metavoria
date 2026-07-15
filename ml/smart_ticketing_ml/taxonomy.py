"""
Taxonomie du module IA — priorités (fixes) et *hints* de distribution/priorité
par catégorie.

⚠️ Les CATÉGORIES ne sont PAS définies ici : elles viennent toujours de la base
(`db.fetch_categories`). Ce fichier ne contient que des **indices optionnels
indexés par nom** : ils s'appliquent si la catégorie existe en base, sinon on
retombe sur des valeurs par défaut. Une catégorie ajoutée par l'admin (§6.5)
fonctionne donc sans modifier ce fichier.

La priorité est définie de façon **opérationnelle** (glass-box) avant tout
scoring — la priorité n'a pas de vérité terrain objective, on fige des critères
explicites pour rendre les labels reproductibles (réutilisés au J7).
"""

from __future__ import annotations

# ─────────────────────────────────────────────────────────────────────────────
# Priorités — labels fixes (enum Prisma) + critères opérationnels
# ─────────────────────────────────────────────────────────────────────────────

PRIORITY_LABELS: list[str] = ["FAIBLE", "MOYENNE", "HAUTE", "CRITIQUE"]

PRIORITY_DEFINITIONS: dict[str, str] = {
    "CRITIQUE": (
        "Service critique à l'arrêt ou production impactée ; plusieurs "
        "utilisateurs / une équipe / un site bloqués ; risque de perte de "
        "données. Ex. : serveur down, panne réseau généralisée, ERP inaccessible."
    ),
    "HAUTE": (
        "Un utilisateur totalement bloqué sur une tâche essentielle, ou "
        "dégradation majeure sans contournement. Ex. : PC ne démarre plus, "
        "compte verrouillé avant une échéance, application métier qui plante."
    ),
    "MOYENNE": (
        "Gêne réelle mais contournement possible ; impact limité à un "
        "utilisateur, non urgent. Ex. : imprimante d'étage HS, lenteurs, "
        "mise à jour à planifier."
    ),
    "FAIBLE": (
        "Demande mineure, cosmétique, question ou amélioration ; aucun blocage. "
        "Ex. : logiciel optionnel, question d'utilisation, coquille de libellé."
    ),
}

# ─────────────────────────────────────────────────────────────────────────────
# Statuts du corpus — répartition réaliste (≈ 85% résolus / 15% ouverts).
#   • Résolus (RESOLU/CLOTURE) → base de connaissances RAG.
#   • Ouverts (NOUVEAU/EN_COURS/EN_ATTENTE) → backlog de démo (dashboard/file).
# Motifs : (1) le classifieur (J5) prédit sur des tickets ENTRANTS — un corpus
# 100% résolu l'entraînerait sur une distribution absente à la prédiction ;
# (2) sans tickets ouverts, la démo/soutenance est vide.
# ⚠️ CHAQUE ticket est généré AVEC sa résolution (stockée au JSONL). Pour les
# tickets ouverts, le loader ne la LIERA PAS en base → ils restent « ouverts »
# et peuvent être fermés à la demande pendant la démo.
# ─────────────────────────────────────────────────────────────────────────────

STATUS_WEIGHTS: dict[str, float] = {
    "RESOLU": 0.55,
    "CLOTURE": 0.30,     # → ≈ 85% résolus
    "NOUVEAU": 0.06,
    "EN_COURS": 0.05,
    "EN_ATTENTE": 0.04,  # → ≈ 15% ouverts
}
RESOLVED_STATUSES: frozenset[str] = frozenset({"RESOLU", "CLOTURE"})
OPEN_STATUSES: frozenset[str] = frozenset({"NOUVEAU", "EN_COURS", "EN_ATTENTE"})

# ─────────────────────────────────────────────────────────────────────────────
# Hints par nom de catégorie (optionnels)
# ─────────────────────────────────────────────────────────────────────────────

# Poids relatifs → distribution déséquilibrée réaliste (matériel/logiciel
# dominent). Toute catégorie absente de ce dict reçoit DEFAULT_CATEGORY_WEIGHT.
CATEGORY_WEIGHT_HINTS: dict[str, float] = {
    "Logiciel": 0.30,
    "Matériel": 0.25,
    "Réseau": 0.20,
    "Accès": 0.15,
    "Autre": 0.10,
}
DEFAULT_CATEGORY_WEIGHT: float = 0.12

# A priori de priorité par catégorie. Défaut pour catégorie inconnue = prior
# neutre légèrement penché vers MOYENNE.
PRIORITY_PRIORS: dict[str, dict[str, float]] = {
    "Réseau": {"FAIBLE": 0.10, "MOYENNE": 0.30, "HAUTE": 0.35, "CRITIQUE": 0.25},
    "Accès": {"FAIBLE": 0.15, "MOYENNE": 0.35, "HAUTE": 0.35, "CRITIQUE": 0.15},
    "Matériel": {"FAIBLE": 0.20, "MOYENNE": 0.45, "HAUTE": 0.25, "CRITIQUE": 0.10},
    "Logiciel": {"FAIBLE": 0.25, "MOYENNE": 0.45, "HAUTE": 0.22, "CRITIQUE": 0.08},
    "Autre": {"FAIBLE": 0.55, "MOYENNE": 0.35, "HAUTE": 0.08, "CRITIQUE": 0.02},
}
DEFAULT_PRIORITY_PRIOR: dict[str, float] = {
    "FAIBLE": 0.25,
    "MOYENNE": 0.40,
    "HAUTE": 0.25,
    "CRITIQUE": 0.10,
}


def category_weights(noms: list[str]) -> dict[str, float]:
    """Distribution normalisée sur les catégories réellement en base."""
    bruts = {n: CATEGORY_WEIGHT_HINTS.get(n, DEFAULT_CATEGORY_WEIGHT) for n in noms}
    total = sum(bruts.values()) or 1.0
    return {n: p / total for n, p in bruts.items()}


def priority_prior(nom: str) -> dict[str, float]:
    return PRIORITY_PRIORS.get(nom, DEFAULT_PRIORITY_PRIOR)

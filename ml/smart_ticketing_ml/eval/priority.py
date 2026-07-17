"""
J7 (STUB) — Métriques de priorisation.

Volontairement non implémenté au J3. La priorité n'a **pas de vérité terrain
objective** (les humains ne s'accordent pas) → on l'évalue en **kappa pondéré**
sur des buckets ordinaux (FAIBLE < MOYENNE < HAUTE < CRITIQUE) et en **accuracy
à ±1 cran**, pas en exact-match. Cf. conception §6 et §10.

Le gold set porte déjà la priorité relue à la main (utilisable comme référence),
et J2 a montré un signal exploitable : le générateur sous-évaluait l'urgence
(31 corrections à la hausse sur 42).
"""

from __future__ import annotations

ORDRE_PRIORITE = ["FAIBLE", "MOYENNE", "HAUTE", "CRITIQUE"]

_MSG = "Métrique de priorisation prévue au J7 (scorecard glass-box) — non implémentée au J3."


def kappa_pondere(y_true: list[str], y_pred: list[str]) -> float:
    """Cohen's kappa à pondération quadratique sur les buckets ordinaux."""
    raise NotImplementedError(_MSG)


def accuracy_a_un_pres(y_true: list[str], y_pred: list[str]) -> float:
    """Part des prédictions à moins d'un cran de la priorité de référence."""
    raise NotImplementedError(_MSG)

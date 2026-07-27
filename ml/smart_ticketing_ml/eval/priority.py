"""
J7 — Métriques de priorisation (fonctions pures, aucune I/O).

La priorité n'a **pas de vérité terrain objective** (les humains ne s'accordent pas)
et elle est **ordinale** (FAIBLE < MOYENNE < HAUTE < CRITIQUE). On mesure donc :

  - **κ pondéré quadratique** (métrique de tête) : accord avec les labels relus à la
    main de Fedi, en pénalisant un écart de 2 crans bien plus qu'un écart de 1. Ce
    n'est PAS de l'accuracy — un κ modéré est un résultat honnête sur une tâche
    subjective, pas un échec.
  - **accuracy à ±1 cran** : tolérance ordinale (prédire HAUTE pour un vrai CRITIQUE
    est « presque juste »).
  - exact-match + **matrice de confusion 4×4**, à titre descriptif.

Limite assumée (au rapport) : un **seul annotateur** (Fedi) → κ = accord-avec-Fedi,
pas un accord inter-annotateurs. Pas de vérité objective, seulement une référence
relue et cohérente.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from sklearn.metrics import cohen_kappa_score, confusion_matrix

from ..taxonomy import PRIORITY_LABELS

ORDRE_PRIORITE: list[str] = list(PRIORITY_LABELS)  # ["FAIBLE","MOYENNE","HAUTE","CRITIQUE"]
_RANG: dict[str, int] = {lab: i for i, lab in enumerate(ORDRE_PRIORITE)}


def _rangs(y: list[str]) -> list[int]:
    return [_RANG[v] for v in y]


def kappa_pondere(y_true: list[str], y_pred: list[str]) -> float:
    """Cohen's kappa à pondération quadratique sur les buckets ordinaux.

    Renvoie 0.0 dans le cas dégénéré (un prédicteur constant n'a aucune variance →
    κ indéfini) : c'est bien le plancher attendu pour la baseline « classe unique ».
    """
    yt, yp = _rangs(y_true), _rangs(y_pred)
    etiquettes = list(range(len(ORDRE_PRIORITE)))
    k = cohen_kappa_score(yt, yp, labels=etiquettes, weights="quadratic")
    return 0.0 if math.isnan(k) else float(k)  # NaN (prédicteur constant) → plancher 0.0


def accuracy_a_un_pres(y_true: list[str], y_pred: list[str]) -> float:
    """Part des prédictions à ≤ 1 cran de la priorité de référence."""
    if not y_true:
        return 0.0
    yt, yp = _rangs(y_true), _rangs(y_pred)
    return sum(abs(a - b) <= 1 for a, b in zip(yt, yp)) / len(yt)


def accuracy_exacte(y_true: list[str], y_pred: list[str]) -> float:
    if not y_true:
        return 0.0
    return sum(a == b for a, b in zip(y_true, y_pred)) / len(y_true)


@dataclass
class MetriquePriorite:
    kappa_w: float
    acc_pm1: float
    acc_exacte: float
    labels: list[str]
    matrice: list[list[int]] = field(default_factory=list)  # lignes vérité, colonnes prédit

    def to_dict(self) -> dict:
        return {
            "kappa_w": round(self.kappa_w, 4),
            "acc_pm1": round(self.acc_pm1, 4),
            "acc_exacte": round(self.acc_exacte, 4),
            "labels": self.labels,
            "matrice": self.matrice,
        }


def evaluer_priorite(y_true: list[str], y_pred: list[str]) -> MetriquePriorite:
    matrice = confusion_matrix(y_true, y_pred, labels=ORDRE_PRIORITE).tolist()
    return MetriquePriorite(
        kappa_w=kappa_pondere(y_true, y_pred),
        acc_pm1=accuracy_a_un_pres(y_true, y_pred),
        acc_exacte=accuracy_exacte(y_true, y_pred),
        labels=list(ORDRE_PRIORITE),
        matrice=matrice,
    )

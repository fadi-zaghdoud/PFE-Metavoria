"""
J3 — Métriques de classification.

**macro-F1** (et non l'accuracy) est la métrique de tête : le corpus est
**déséquilibré** (Logiciel/Matériel dominent, `Autre` rare) et l'accuracy y
récompenserait un modèle qui ignore les classes rares. On expose aussi P/R/F1
par classe et la matrice de confusion.

Fonctions pures (aucune I/O) — la sérialisation et les figures vivent dans `report`.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
)


@dataclass
class ResultatMetrique:
    macro_f1: float
    accuracy: float
    labels: list[str]
    par_classe: dict[str, dict[str, float]] = field(default_factory=dict)
    matrice: list[list[int]] = field(default_factory=list)  # lignes = vérité, colonnes = prédit

    def to_dict(self) -> dict:
        return {
            "macro_f1": round(self.macro_f1, 4),
            "accuracy": round(self.accuracy, 4),
            "labels": self.labels,
            "par_classe": self.par_classe,
            "matrice": self.matrice,
        }


def evaluer(y_true: list[str], y_pred: list[str], labels: list[str]) -> ResultatMetrique:
    """Calcule macro-F1, P/R/F1 par classe et la matrice de confusion.

    `labels` fixe l'ordre des classes (matrice + tableau) — dérivé des données,
    jamais codé en dur (catégories dynamiques).
    """
    macro = f1_score(y_true, y_pred, labels=labels, average="macro", zero_division=0)
    acc = accuracy_score(y_true, y_pred)

    p, r, f, support = precision_recall_fscore_support(
        y_true, y_pred, labels=labels, zero_division=0
    )
    par_classe = {
        lab: {
            "precision": round(float(p[i]), 4),
            "recall": round(float(r[i]), 4),
            "f1": round(float(f[i]), 4),
            "support": int(support[i]),
        }
        for i, lab in enumerate(labels)
    }

    matrice = confusion_matrix(y_true, y_pred, labels=labels).tolist()

    return ResultatMetrique(
        macro_f1=float(macro),
        accuracy=float(acc),
        labels=labels,
        par_classe=par_classe,
        matrice=matrice,
    )

"""
J3 — Métriques de classification. J5 — métriques de **calibration** (ECE + fiabilité).

**macro-F1** (et non l'accuracy) est la métrique de tête : le corpus est
**déséquilibré** (Logiciel/Matériel dominent, `Autre` rare) et l'accuracy y
récompenserait un modèle qui ignore les classes rares. On expose aussi P/R/F1
par classe et la matrice de confusion.

**Calibration (J5)** : l'ECE (Expected Calibration Error) sur la confiance top-1
mesure l'écart entre confiance annoncée et justesse observée — « 0,8 » doit valoir
« juste ~80 % du temps ». La fiabilité (couples confiance moyenne / justesse par
bin) alimente le *reliability diagram*. Résultat central J5 : une calibration
apprise sur du synthétique **ne transfère pas** au réel — ces fonctions le prouvent.

Fonctions pures (aucune I/O) — la sérialisation et les figures vivent dans `report`.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
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


# ── Calibration (J5) ────────────────────────────────────────────────────────
# La confiance top-1 d'une prédiction = probabilité de la classe prédite. Une
# confiance *calibrée* colle à la justesse empirique ; l'ECE en mesure l'écart.


def confiances_correct(
    proba: list[list[float]], classes: list[str], y_true: list[str]
) -> tuple["np.ndarray", "np.ndarray"]:
    """À partir d'une matrice de probabilités (n×classes), renvoie la **confiance
    top-1** de chaque exemple et un vecteur booléen **prédiction correcte**.

    `classes` donne l'ordre des colonnes de `proba` (= `estimateur.classes_`).
    """
    P = np.asarray(proba, dtype=float)
    cls = np.asarray(classes)
    conf = P.max(axis=1)
    pred = cls[P.argmax(axis=1)]
    correct = (pred == np.asarray(y_true)).astype(float)
    return conf, correct


def courbe_fiabilite(
    conf: "np.ndarray", correct: "np.ndarray", n_bins: int = 10
) -> tuple[list[float], list[float], list[int]]:
    """Découpe les confiances en `n_bins` intervalles égaux et renvoie, par bin
    **non vide** : (confiance moyenne, justesse empirique, effectif). C'est la
    matière du *reliability diagram* — un modèle parfait a confiance == justesse.
    """
    conf = np.asarray(conf, dtype=float)
    correct = np.asarray(correct, dtype=float)
    bords = np.linspace(0.0, 1.0, n_bins + 1)
    conf_moy: list[float] = []
    acc_moy: list[float] = []
    effectifs: list[int] = []
    for i in range(n_bins):
        lo, hi = bords[i], bords[i + 1]
        masque = (conf > lo) & (conf <= hi) if i > 0 else (conf >= lo) & (conf <= hi)
        if not masque.any():
            continue
        conf_moy.append(float(conf[masque].mean()))
        acc_moy.append(float(correct[masque].mean()))
        effectifs.append(int(masque.sum()))
    return conf_moy, acc_moy, effectifs


def ece(conf: "np.ndarray", correct: "np.ndarray", n_bins: int = 10) -> float:
    """Expected Calibration Error : moyenne pondérée (par effectif de bin) de
    |justesse − confiance|. 0 = parfaitement calibré ; plus haut = pire.

    Note : sur de petits jeux (n=46 réel), l'ECE est **bruité** — à lire comme
    une tendance, cohérente avec le reliability diagram, pas au millième près.
    """
    conf_moy, acc_moy, effectifs = courbe_fiabilite(conf, correct, n_bins)
    n = sum(effectifs)
    if n == 0:
        return 0.0
    return float(
        sum(w * abs(a - c) for c, a, w in zip(conf_moy, acc_moy, effectifs)) / n
    )

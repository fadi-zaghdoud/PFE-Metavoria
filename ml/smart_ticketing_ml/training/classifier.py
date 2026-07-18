"""
J5 — Classifieur de production : embeddings `bge-m3` → Régression Logistique.

**Décision de gel (séance J5)** : le modèle servi est la LogReg **NON calibrée**.
La calibration (Platt / isotonique) apprise sur un dev *synthétique* **dégrade**
l'ECE sur le réel (0,054 → 0,282) — elle ne transfère pas. La machinerie de
calibration reste dans le harnais (`eval.metrics`) et le script d'entraînement
comme **preuve** de ce non-transfert, jamais dans le modèle servi. Voir le fil
rouge synthétique→réel au journal (J5).

Ce classifieur :
  - respecte le Protocol `Classifieur` du harnais (`fit`/`predict` sur du texte),
    donc il se compare aux baselines J3 sans toucher à l'orchestrateur ;
  - expose `predict_proba` (pour l'ECE / le reliability diagram) ;
  - offre une **abstention à seuil paramétrable** (`predict_avec_abstention`) —
    exigence CDC §6.5, mais **le seuil n'est PAS figé** : réglé sur un dev
    synthétique il ne produit **aucune abstention utile** sur le réel (dev trop
    facile). Son réglage attend un dev **réel** (flywheel J9).

Sérialisation : on ne persiste que la LogReg + l'identifiant du modèle
d'embeddings (reproductibilité, comme `tickets.embedding_modele` en J4). Les
vecteurs sont reproduits au chargement par le même embedder auto-hébergé.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression

from ..service import config
from ..service.embedder import embed_textes

SEED = 42  # aligné sur le corpus (J1) et les baselines (J3)
ABSTENTION = "abstention"  # étiquette sentinelle : confiance top-1 sous le seuil


class EmbeddingLogReg:
    """Embeddings bge-m3 (1024d, L2-normalisés) → Régression Logistique multiclasse.

    Deux niveaux d'API :
      - **texte** (`fit`/`predict`/`predict_proba`) — conforme au Protocol du harnais,
        embarque l'embedding ;
      - **vecteurs** (`*_vectors`) — quand les embeddings sont déjà calculés (cache),
        pour ne pas ré-encoder à chaque essai.
    """

    nom = "LogReg (embeddings bge-m3)"

    def __init__(self, embed_fn=embed_textes, C: float = 1.0, class_weight=None) -> None:
        self._embed = embed_fn
        self._clf = LogisticRegression(
            max_iter=2000, C=C, class_weight=class_weight, random_state=SEED
        )
        self.embedding_modele = config.MODELE_EMBEDDING

    # --- niveau texte (Protocol Classifieur) ---
    def fit(self, textes: list[str], labels: list[str]) -> "EmbeddingLogReg":
        return self.fit_vectors(self._vecteurs(textes), labels)

    def predict(self, textes: list[str]) -> list[str]:
        return self.predict_vectors(self._vecteurs(textes))

    def predict_proba(self, textes: list[str]) -> np.ndarray:
        return self.predict_proba_vectors(self._vecteurs(textes))

    # --- niveau vecteurs (embeddings déjà disponibles) ---
    def fit_vectors(self, X, labels: list[str]) -> "EmbeddingLogReg":
        self._clf.fit(np.asarray(X, dtype=np.float32), list(labels))
        return self

    def predict_vectors(self, X) -> list[str]:
        return list(self._clf.predict(np.asarray(X, dtype=np.float32)))

    def predict_proba_vectors(self, X) -> np.ndarray:
        return self._clf.predict_proba(np.asarray(X, dtype=np.float32))

    @property
    def classes_(self) -> list[str]:
        return list(self._clf.classes_)

    @property
    def estimateur(self) -> LogisticRegression:
        """LogReg sous-jacente — pour brancher la calibration (preuve, hors prod)."""
        return self._clf

    def _vecteurs(self, textes: list[str]) -> np.ndarray:
        return np.asarray(self._embed(list(textes)), dtype=np.float32)

    # --- abstention à seuil paramétrable (NON figé, cf. docstring module) ---
    def predict_avec_abstention(
        self, textes: list[str], seuil: float
    ) -> tuple[list[str], np.ndarray]:
        return abstention(self.predict_proba(textes), self.classes_, seuil)

    # --- sérialisation ---
    def save(self, path: str | Path) -> None:
        import joblib

        joblib.dump(
            {
                "clf": self._clf,
                "embedding_modele": self.embedding_modele,
                "classes": self.classes_,
                "seed": SEED,
            },
            path,
        )

    @classmethod
    def load(cls, path: str | Path, embed_fn=embed_textes) -> "EmbeddingLogReg":
        import joblib

        blob = joblib.load(path)
        obj = cls(embed_fn=embed_fn)
        obj._clf = blob["clf"]
        obj.embedding_modele = blob["embedding_modele"]
        return obj


def abstention(
    proba, classes: list[str], seuil: float
) -> tuple[list[str], np.ndarray]:
    """Politique d'abstention : confiance top-1 < `seuil` → `ABSTENTION`, sinon argmax.

    Renvoie (labels, confiances). On **n'écrase pas** la classe `autre` : abstenir
    est distinct de prédire `autre` — mieux vaut router vers l'humain (§8) que
    forcer/polluer le fourre-tout. Le seuil est un paramètre admin (§6.5).
    """
    P = np.asarray(proba, dtype=float)
    cls = np.asarray(classes)
    conf = P.max(axis=1)
    pred = cls[P.argmax(axis=1)]
    labels = [p if c >= seuil else ABSTENTION for p, c in zip(pred, conf)]
    return labels, conf


def couverture_precision(
    proba, classes: list[str], y_true: list[str], seuil: float
) -> tuple[float, float]:
    """Point de fonctionnement de l'abstention : (**couverture**, **précision sur le
    couvert**). La couverture = part des tickets au-dessus du seuil (prédits) ; la
    précision = justesse parmi ceux-là. NaN de précision si couverture nulle.
    """
    labels, conf = abstention(proba, classes, seuil)
    P = np.asarray(proba, dtype=float)
    cls = np.asarray(classes)
    pred = cls[P.argmax(axis=1)]
    couvert = conf >= seuil
    n = int(couvert.sum())
    if n == 0:
        return 0.0, float("nan")
    precision = float((pred[couvert] == np.asarray(y_true)[couvert]).mean())
    return n / len(y_true), precision

"""
J3 — Baselines de classification SANS modèle appris.

L'échelle de baselines (conception §5) situe tout modèle futur :
  1. **Classe majoritaire** — le plancher. Un modèle qui ne le bat pas est inutile.
  2. **TF-IDF + SVM linéaire** — baseline lexicale forte, sans embeddings.
  (3. embeddings + LogReg → J5 ; 4. Claude few-shot → plafond démarrage à froid.)

Toutes les baselines exposent la même interface `Classifieur` : le modèle appris
du J5 s'y branchera sans toucher au harnais.
"""

from __future__ import annotations

from collections import Counter
from typing import Protocol, runtime_checkable

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

SEED = 42  # reproductibilité (aligné sur le seed du corpus, J1)


@runtime_checkable
class Classifieur(Protocol):
    nom: str

    def fit(self, textes: list[str], labels: list[str]) -> "Classifieur": ...
    def predict(self, textes: list[str]) -> list[str]: ...


class Majoritaire:
    """Prédit toujours la classe la plus fréquente du train (plancher macro-F1)."""

    nom = "Classe majoritaire"

    def __init__(self) -> None:
        self._label: str | None = None

    def fit(self, textes: list[str], labels: list[str]) -> "Majoritaire":
        self._label = Counter(labels).most_common(1)[0][0]
        return self

    def predict(self, textes: list[str]) -> list[str]:
        assert self._label is not None, "Majoritaire.predict avant fit."
        return [self._label] * len(textes)


class TfidfSvm:
    """TF-IDF (mots, 1–2-grammes, FR+EN technique) → SVM linéaire.

    Pas de stop-words FR : dans une DSI le vocabulaire technique porte le signal
    et les listes de stop-words FR standard suppriment des tokens utiles.
    """

    nom = "TF-IDF + SVM linéaire"

    def __init__(self) -> None:
        self._pipe = Pipeline([
            ("tfidf", TfidfVectorizer(
                lowercase=True,
                ngram_range=(1, 2),
                min_df=2,
                sublinear_tf=True,
            )),
            ("svm", LinearSVC(random_state=SEED, dual=True)),  # dual explicite (vocab > n_échantillons)
        ])

    def fit(self, textes: list[str], labels: list[str]) -> "TfidfSvm":
        self._pipe.fit(textes, labels)
        return self

    def predict(self, textes: list[str]) -> list[str]:
        return list(self._pipe.predict(textes))


def baselines_defaut() -> list[Classifieur]:
    """L'ensemble de baselines J3, dans l'ordre de l'échelle."""
    return [Majoritaire(), TfidfSvm()]

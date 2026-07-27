"""
J7 — Priorisation glass-box (scorecard additif explicable).

La priorité est une **règle explicite déterministe**, pas un modèle appris : chaque
poids vient d'une justification métier (voir `lexicon.py`), aucun n'est optimisé sur
le gold (qui reste un TEST pur). C'est ce qui distingue le scorecard d'un classifieur
déguisé — et ce qui permet de tester, dans le fil rouge du projet, si une règle
explicite **transfère** du synthétique au réel là où l'apprentissage échoue (J3/J5).

Sous-modules :
  - `lexicon`   : la config GELÉE (poids, mots-clés, seuils, SLA) + sa justification.
  - `scorecard` : le moteur additif pur (déterministe, sans I/O) → décision + décomposition.
"""

from .scorecard import Contribution, Decision, Scorecard

__all__ = ["Scorecard", "Decision", "Contribution"]

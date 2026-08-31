"""
Harnais d'évaluation du module IA (J3).

Règle non négociable (conception §12) : le harnais arrive AVANT tout modèle appris.
Tout ce qui suit (J5 classification, J6 RAG, J7 priorité) se mesure avec.

Sous-modules :
  - `dataset`   : chargement gold/train + contrôle d'étanchéité train/gold.
  - `metrics`   : macro-F1, P/R par classe, matrice de confusion.
  - `baselines` : modèles SANS apprentissage (majoritaire, TF-IDF+SVM).
  - `retrieval` : stub J6 (Recall@k / MRR / nDCG@k).
  - `priority`  : stub J7 (kappa pondéré / accuracy ±1).
  - `report`    : CLI d'orchestration → rapport Markdown + JSON + figures.
"""

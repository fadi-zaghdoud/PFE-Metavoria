# J6a — Validation humaine du juge de pertinence

- **Paires** : 25 (construction équilibrée 8/9/8, niveaux attendus par rang/catégorie, non montrés à la notation).
- **κ_w quadratique** : **0.9543** (seuil pré-enregistré 0.6) → VALIDÉ (κ_w ≥ 0.60) → juge utilisé pour les métriques de retrieval
- κ binaire : 1.0 · accord exact : 0.92 · accord binarisé : 1.0

| n | niveau attendu | note humaine | note juge |
|---|---|---|---|
| 1 | L1 | 2 | 2 |
| 2 | L2 | 2 | 2 |
| 3 | L2 | 2 | 2 |
| 4 | L1 | 2 | 2 |
| 5 | L2 | 2 | 2 |
| 6 | L2 | 2 | 2 |
| 7 | L0 | 0 | 0 |
| 8 | L0 | 0 | 0 |
| 9 | L0 | 0 | 0 |
| 10 | L1 | 2 | 2 |
| 11 | L0 | 0 | 0 |
| 12 | L0 | 0 | 0 |
| 13 | L1 | 2 | 2 |
| 14 | L2 | 0 | 0 |
| 15 | L2 | 1 | 1 |
| 16 | L1 | 2 | 2 |
| 17 | L2 | 2 | 2 |
| 18 | L1 | 1 | 1 |
| 19 | L1 | 0 | 0 |
| 20 | L1 | 2 | 1 |
| 21 | L0 | 0 | 0 |
| 22 | L1 | 2 | 1 |
| 23 | L0 | 0 | 0 |
| 24 | L0 | 0 | 0 |
| 25 | L2 | 2 | 2 |

> Limite (échantillonnage) : distribution humaine {0: 10, 1: 2, 2: 13} — seulement **2 grade-1** → le κ mesure surtout la distinction **pertinent / non-pertinent** (κ binaire = 1.0, accord binarisé = 1.0) ; la nuance grade-1 est **peu échantillonnée**. Les 2 seuls désaccords sont des 1-vs-2 sur des quasi-doublons (le juge est légèrement plus conservateur que l'humain).

> Limite (portée) : κ validé sur requêtes **internes courtes** (gold). L'extrapolation aux requêtes-emails longues suppose une capacité de jugement stable, non re-vérifiée formellement ; garde-fou = quelques paires externes relues pendant le run complet.

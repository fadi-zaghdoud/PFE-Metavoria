# Flywheel C1 — Courbe d'apprentissage (macro-F1 réel vs #labels réels)

_Généré le 2026-08-21T20:18:51Z. Embeddings : `BAAI/bge-m3`._

## Protocole

- **Base synthétique FIXE** : 852 exemples (identique à tous les points → seuls les labels réels varient ; règle le confond de B).
- **Test GELÉ** : gold 102 + externe réel 46 (métrique de tête = macro-F1 sur l'externe réel).
- **Lissage** : 5 tirages/k pour k∈{10,20,30,40} → moyenne + bande min/max ; k=0 et k=50 déterministes.
- **Porte d'étanchéité re-jouée** (fail dur) sur chaque sous-ensemble avant entraînement.

## Règle d'interprétation PRÉ-ENREGISTRÉE

`Δ pente > 0.05 solide / 0.02..0.05 ambigu / |Δ|<0.02 plat / <−0.02 descendant` — fixée AVANT de voir les chiffres.

## Résultats

| k labels | seeds | macro-F1 réel (moy) | min–max | hors-AWS (moy) | synth (moy) | Jaccard max |
|---:|---:|---:|:---:|---:|---:|---:|
| 0 | 1 | **0.4554** | 0.4554–0.4554 | 0.4443 | 0.9438 | 0.0 |
| 10 | 5 | **0.4863** | 0.4548–0.5179 | 0.4692 | 0.9438 | 0.373 |
| 20 | 5 | **0.4888** | 0.409–0.5357 | 0.4737 | 0.9438 | 0.44 |
| 30 | 5 | **0.4593** | 0.4–0.5373 | 0.4701 | 0.9438 | 0.44 |
| 40 | 5 | **0.436** | 0.4196–0.4605 | 0.4592 | 0.9438 | 0.44 |
| 50 | 1 | **0.4212** | 0.4212–0.4212 | 0.4553 | 0.9438 | 0.44 |

_Référence (hors courbe) — modèle actif J5 `classifier_20260718T204355Z.joblib` (base 724 synth) : macro-F1 réel **0.438**, hors-AWS 0.426._

## Verdict

- Pente k=0 → k=50 (test complet) : **Δ = -0.0342** → **DESCENDANT (<−0.02)**.
- Diagnostic hors-AWS : Δ = +0.0110 sur le test privé des 8 items AWS/cloud.

## Diagnostic hors-AWS — items retirés (étiquetés, PAS le résultat de tête)

Mots-clés fixes : `\b(aws|ec2|s3|rds|lambda|cloud|azure|gcp|kubernetes|k8s|docker|serverless)\b`. diagnostic ÉTIQUETÉ — isole l'effet du plafond d'étiquetage AWS, PAS le résultat de tête.

| catégorie gold | titre |
|:--|:--|
| Accès | Problèmes d'authentification AWS |
| Réseau | Support urgent requis pour la configuration AWS |
| Accès | Dépannage de l'instance AWS |
| Logiciel | Demande d'amélioration de la scalabilité et de l'efficacité de l'infrastructure AWS |
| Accès | Problème de connectivité AWS urgent |
| Logiciel | Demande de modification de la configuration AWS |
| Réseau | Urgent : Erreur inattendue dans le déploiement du service de gestion AWS |
| Logiciel | Assistance immédiate requise |

> Ces 8 items « AWS/cloud » portent des labels gold **incohérents** entre eux (Accès / Réseau / Logiciel pour un sujet quasi identique). Ce bruit d'étiquetage du TEST plafonne mécaniquement tout gain mesurable — la courbe complète le reflète honnêtement ; la courbe diagnostique l'isole sans le contourner.

---
_Provenance : `train_v2_20260819T154457Z.jsonl` (sha256 `d5d275e6ded40aaa…`)._
# Flywheel D1.3 — Réconciliation relecture à l'aveugle vs auto-label

- **Date** : 2026-08-19T15:41:02Z  |  **n** : 50 tickets relus à l'aveugle
- **Taux de désaccord (relu ≠ auto)** : **16/50 = 32%**
- **Justesse de l'auto-mapper sur cet échantillon propre** : **68%** (réf. J5+ spot-check r2 ≈ 87 %)

## Distribution des catégories RELUES (jugement humain)

| Catégorie | n |
|---|---|
| Réseau | 11 |
| Logiciel | 20 |
| Matériel | 15 |
| Accès | 2 |
| Autre | 2 |

## Matrice auto → relu (ligne = auto-label, colonne = relu)

| auto \\ relu | Réseau | Logiciel | Matériel | Accès | Autre |
|---|---|---|---|---|---|
| **Réseau** | 8 | 7 | 1 | 0 | 1 |
| **Logiciel** | 0 | 13 | 1 | 2 | 1 |
| **Matériel** | 3 | 0 | 13 | 0 | 0 |
| **Accès** | 0 | 0 | 0 | 0 | 0 |
| **Autre** | 0 | 0 | 0 | 0 | 0 |

## Désaccords (auto → relu)

| id | auto | relu | titre |
|---|---|---|---|
| kag-0010 | Réseau | Logiciel | (sans titre) |
| kag-0011 | Logiciel | Matériel | Problèmes avec le MacBook Air M1 qui plante |
| kag-0018 | Réseau | Logiciel | (sans titre) |
| kag-0024 | Réseau | Autre | Assistance nécessaire pour la facturation AWS |
| kag-0034 | Matériel | Réseau | Problème de priorité moyenne avec la connectivité sans fil |
| kag-0049 | Réseau | Logiciel | Demande de modifications pour l'amélioration de la stratégie |
| kag-0058 | Réseau | Matériel | Assistance immédiate nécessaire pour résoudre la panne du se |
| kag-0062 | Réseau | Logiciel | Problème de déploiement AWS Cloud de haute priorité |
| kag-0069 | Logiciel | Accès | Impossible d'accéder à l'email Outlook dans Office 365 |
| kag-0077 | Logiciel | Accès | Problème d'accès au tableau de bord Jira Software |
| kag-0101 | Matériel | Réseau | Problème d'impression sans fil |
| kag-0114 | Matériel | Réseau | Difficultés de connexion |
| kag-0119 | Réseau | Logiciel | Assistance Urgente Requise : Optimisation AWS |
| kag-0149 | Réseau | Logiciel | Piques des coûts d'instances AWS |
| kag-0200 | Logiciel | Autre | Demande de support |
| kag-0230 | Réseau | Logiciel | Changement de configuration AWS urgent |

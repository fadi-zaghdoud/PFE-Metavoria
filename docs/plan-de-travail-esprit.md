# Plan de Travail — dépôt sur la plateforme ESPRIT

> Contenu prêt à copier-coller dans le formulaire ESPRIT, dans l'ordre des champs.
> Les textes encadrés sont à coller tels quels : ni markdown, ni nom de fichier, ni
> référence de commit. Les preuves sont en annexe, pour le rapport et la soutenance.
>
> Vérifié contre le code du dépôt le 12/09/2026 (branche `audit-et-HR`, qui contient
> `main` plus les chantiers 1 et 2). Annexes mises à jour le 06/10/2026 sur `main`, pour
> les faits devenus périmés : tests, état des branches, intégration continue. Le diagramme
> de Gantt est hors périmètre de ce document.

---

## 1. Titre Projet

```
Conception et développement d'une application web de gestion des tickets de support informatique assistée par l'intelligence artificielle
```

---

## 2. Description Project

**878 caractères**

```
Ce projet, réalisé au sein de Metavoria, consiste à concevoir et développer une application web de gestion des tickets de support informatique, enrichie par un module d'intelligence artificielle. L'application centralise les demandes des employés et en assure le suivi de bout en bout : création, assignation, traitement et clôture. Le module IA est exécuté localement, sans recours à une API cloud : ce choix répond à la priorité donnée par le cahier des charges aux technologies open source, et garantit que les données de l'entreprise ne quittent pas son infrastructure. Il classe automatiquement chaque ticket, suggère sa priorité, propose des solutions issues des tickets déjà résolus (RAG), résume les échanges et extrait le texte des pièces jointes (OCR). L'IA joue un rôle d'assistant : ses suggestions sont explicables et restent soumises à la validation du technicien.
```

### Version courte

**250 caractères**

```
Application web de gestion des tickets de support informatique réalisée pour Metavoria, enrichie d'un module d'intelligence artificielle exécuté localement : classification, priorisation, suggestion de solutions issues de l'historique, résumé et OCR.
```

---

## 3. Problématique Projet

**952 caractères**

```
Chez Metavoria, les demandes de support informatique arrivent par e-mail, par messagerie instantanée ou par téléphone, de manière peu structurée. Cette dispersion prive l'équipe IT de toute traçabilité centralisée des demandes et de leur historique, rend les temps de réponse et de résolution difficiles à mesurer et à améliorer, et laisse la répartition des tickets entre techniciens manuelle et peu optimisée. Le pilotage de l'activité souffre de l'absence d'indicateurs de performance. Enfin, les solutions apportées à des problèmes récurrents ne sont pas capitalisées : la connaissance acquise se perd. Comment centraliser et structurer le traitement des demandes de support, tout en s'appuyant sur l'intelligence artificielle pour accélérer le tri, la priorisation et la résolution des tickets et pour capitaliser les solutions passées, sans retirer au technicien la décision finale ni exposer les données de l'entreprise à des services externes ?
```

Chaque constat provient du §2 du cahier des charges (canaux dispersés, traçabilité,
mesure, répartition, pilotage, capitalisation), dans cet ordre. La contrainte finale
sur les services externes découle du §10 (open source, confidentialité).

---

## 4. Fonctionnalités / Tâches

Quatorze entrées. Libellé ≤ 60 caractères, description ≤ 300 caractères.

### 1. Authentification, rôles et sécurité des accès

*libellé 45 — description 265*

```
Authentification, rôles et sécurité des accès
```

```
Inscription, connexion et gestion du profil, avec trois rôles aux droits distincts : employé, technicien et administrateur. Réinitialisation du mot de passe par code à usage unique, invitation de nouveaux comptes par lien sécurisé et sessions à jetons courts (JWT).
```

### 2. Gestion du cycle de vie des tickets

*libellé 35 — description 287*

```
Gestion du cycle de vie des tickets
```

```
Création d'un ticket, affectation, prise en charge, résolution et clôture, avec fil de discussion entre le demandeur et le technicien, historique des changements et évaluation de la satisfaction. La liste se parcourt par recherche plein texte et filtres de statut, priorité et catégorie.
```

### 3. Affectation automatique et gestion des absences

*libellé 47 — description 245*

```
Affectation automatique et gestion des absences
```

```
Chaque nouveau ticket est attribué au technicien disponible le plus adapté, selon sa spécialité et sa charge en cours ; congés, arrêts maladie et formations l'excluent du choix. L'administrateur conserve la main et peut réaffecter à tout moment.
```

### 4. Notifications temps réel et par e-mail

*libellé 38 — description 177*

```
Notifications temps réel et par e-mail
```

```
Le demandeur et le technicien sont prévenus des changements de statut et des nouveaux commentaires, directement dans l'application sans rechargement de page (SSE) et par e-mail.
```

### 5. Classification et priorisation automatiques des tickets

*libellé 55 — description 227*

```
Classification et priorisation automatiques des tickets
```

```
À la création, le ticket est rattaché automatiquement à une catégorie et se voit proposer un niveau de priorité à partir de sa description. Le niveau de confiance est affiché, et le technicien peut corriger l'une comme l'autre.
```

### 6. Suggestion de solutions à partir de l'historique

*libellé 48 — description 246*

```
Suggestion de solutions à partir de l'historique
```

```
Sur un ticket en cours, le technicien peut demander une proposition de solution construite à partir des tickets déjà résolus les plus proches (RAG). Les tickets sources sont cités, et le système s'abstient lorsqu'aucun cas pertinent n'est trouvé.
```

### 7. Résumé automatique du fil de discussion

*libellé 39 — description 167*

```
Résumé automatique du fil de discussion
```

```
Sur un échange long, le technicien peut demander un résumé du fil de discussion, généré localement, afin de reprendre un ticket sans relire l'intégralité des messages.
```

### 8. Analyse des pièces jointes par OCR

*libellé 34 — description 215*

```
Analyse des pièces jointes par OCR
```

```
Les captures d'écran et les documents PDF joints à un ticket sont analysés pour en extraire le texte (OCR). Ce texte enrichit la description et affine la catégorie proposée par le module d'intelligence artificielle.
```

### 9. Amélioration continue du modèle de classification

*libellé 49 — description 244*

```
Amélioration continue du modèle de classification
```

```
Chaque correction de catégorie faite par un technicien devient un exemple d'apprentissage. L'administrateur peut relancer un entraînement et suivre le gain obtenu ; un nouveau modèle n'est mis en service que s'il améliore les résultats mesurés.
```

### 10. Tableau de bord et rapports exportables

*libellé 39 — description 248*

```
Tableau de bord et rapports exportables
```

```
Indicateurs de pilotage : tickets ouverts et résolus, temps moyen de résolution, délai de prise en charge, satisfaction, répartitions par catégorie, priorité et technicien. Filtres par période, technicien, catégorie et service, export PDF et Excel.
```

### 11. Administration de la plateforme

*libellé 31 — description 248*

```
Administration de la plateforme
```

```
Gestion des comptes et des rôles, des catégories de tickets, des spécialités et des absences des techniciens, du mode d'affectation et du module d'intelligence artificielle, dont les seuils de confiance au-delà desquels une suggestion est proposée.
```

### 12. Journal d'audit des actions sensibles

*libellé 37 — description 250*

```
Journal d'audit des actions sensibles
```

```
Les actions sensibles (connexions, gestion des comptes, affectations, changements de statut, paramétrage) sont enregistrées avec leur auteur, leur cible et leur résultat. L'administrateur les consulte et les filtre ; elles sont conservées douze mois.
```

### 13. Tests, qualité et intégration continue

*libellé 38 — description 234*

```
Tests, qualité et intégration continue
```

```
Tests unitaires couvrant les règles métier du serveur et les contrats du service d'intelligence artificielle, exécutables sans base de données ni modèle lourd, et rejoués automatiquement à chaque modification du code (GitHub Actions).
```

### 14. Conteneurisation et déploiement

*libellé 31 — description 210*

```
Conteneurisation et déploiement
```

```
L'ensemble de la solution (interface, serveur, base de données, service d'intelligence artificielle et modèles) se déploie par conteneurs Docker et fonctionne sans connexion Internet après le premier démarrage.
```

---

## 5. Technologies — version rédigée

Pour le rapport, ou pour un champ de saisie libre. **776 caractères.**

```
Frontend : React 19, TypeScript, Vite, Tailwind CSS, Zustand, React Router, jsPDF et write-excel-file pour les exports PDF et Excel, nginx pour la diffusion de l'interface.

Backend : Node.js, Express 5, TypeScript, Prisma 7 (ORM), Zod, JSON Web Token, hachage bcrypt (bcryptjs), Helmet, express-rate-limit, Nodemailer, Multer et Cloudinary.

Base de données : PostgreSQL 17 avec l'extension pgvector pour la recherche vectorielle (index HNSW) et la recherche plein texte native.

Intelligence artificielle : Python, FastAPI et Uvicorn ; scikit-learn ; sentence-transformers pour les embeddings BGE-M3 et le reranker BGE-Reranker-v2-M3 ; Ollama pour la génération de texte avec le modèle qwen2.5:7b ; Tesseract, pdfplumber et Pillow pour l'OCR.

Outils et déploiement : Docker et Docker Compose, Git et GitHub, GitHub Actions, pytest et le runtime de test intégré de Node.js.
```

Génération et embeddings ne doivent pas être fusionnés : Ollama sert le modèle de
génération `qwen2.5:7b` ; les embeddings BGE-M3 sont servis par `sentence-transformers`.

---

## 6. Technologies — à saisir une par une

Noms courts, groupés par couche, du plus structurant au plus secondaire.
**`*`** = peu susceptible de figurer dans une liste déroulante générique : prévoir une
saisie libre, ou renoncer à l'entrée si le formulaire ne l'accepte pas.

TypeScript apparaît dans deux couches ; il ne se saisit qu'une fois.

**Frontend**

```
React
TypeScript
Tailwind CSS
Vite
React Router *
Zustand *
nginx
jsPDF *
write-excel-file *
```

**Backend**

```
Node.js
Express
TypeScript
JWT
bcrypt
Prisma *
Zod *
Helmet *
express-rate-limit *
Multer *
Nodemailer *
Cloudinary *
```

**Base de données**

```
PostgreSQL
pgvector *
```

**Intelligence artificielle**

```
Python
FastAPI
scikit-learn
Ollama *
sentence-transformers *
BGE-M3 *
qwen2.5 *
Tesseract OCR *
BGE-Reranker-v2-M3 *
Uvicorn *
pdfplumber *
Pillow *
```

**Outils et déploiement**

```
Docker
Docker Compose
Git
GitHub
GitHub Actions
pytest *
node:test *
```

---

# Annexe A — Table des preuves

Chaque fonctionnalité inscrite au plan, avec ce qui la prouve dans le dépôt.

| # | Fonctionnalité | Preuves dans le code | Commits |
|---|---|---|---|
| 1 | Authentification, rôles et sécurité | `backend/src/routes/auth.routes.ts`, `services/auth.service.ts`, `middlewares/auth.middleware.ts` (`requireAuth` / `requireRole`), `middlewares/rateLimit.middleware.ts`, `repositories/refreshToken.repository.ts`, `enum Role` et `model RefreshToken` du schéma Prisma ; pages `LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `ActivateAccountPage`, `ProfilePage`, `routes/RequireRole.tsx` | `eb9f958`, `8a1f751`, `7522a56` (PR #4), `7000cac` (durcissement) |
| 2 | Cycle de vie des tickets | `backend/src/routes/tickets.routes.ts` (une action nommée par transition), `services/ticket.service.ts`, `repositories/ticket.repository.ts`, `validators/ticket.validator.ts` (recherche `q` + filtres), modèles `Ticket`, `Commentaire`, `EvenementTicket` ; pages `TicketsListPage`, `CreateTicketPage`, `TicketDetailPage` | `0ba0f97`, `3524d50`, `19d74b4` (PR #5) |
| 3 | Affectation automatique et absences | `services/affectation.regle.ts`, `services/absence.disponibilite.ts`, `services/absence.service.ts`, `repositories/affectation.repository.ts`, `config/parametres.registre.ts`, modèles `Parametre`, `TechnicienCategorie`, `Absence`, migration `20260909120000` ; pages `AbsencesPage`, `ParametresPage` | `837d74b`, `4ebddb5`, `e6d8621`, `000a935`, `066063e`, `9098df0`, `2bff403`, `3332478`, `a83e9d9` |
| 4 | Notifications temps réel et e-mail | `utils/sseHub.ts`, `services/notification.service.ts`, `services/email.service.ts`, `routes/notifications.routes.ts` (`GET /flux`), `model Notification`, `frontend/src/features/notifications/` | `0ba0f97`, `3524d50` |
| 5 | Classification et priorisation | `ml/smart_ticketing_ml/service/app.py` (`/classify`, `/priority`), `training/classifier.py`, `priority/scorecard.py`, `priority/lexicon.py`, `service/predictors.py` ; `backend/src/services/ia.service.ts` (`classerEtPrioriser`, `enrichirTicket`), `model SuggestionIA` | `82c9814` (J5), `0822272` (J7), `d10ba96` (Greffe 1) |
| 6 | Suggestion de solutions (RAG) | `retrieval/hybrid.py` (pgvector + full-text fusionnés par RRF), `retrieval/generation.py` (citation et abstention), `retrieval/suggestion.py`, `service/reranker.py` ; migrations `20260717183932` (vector 1024 + HNSW) et `20260720225847` (full-text) ; `POST /tickets/:id/suggestion`, `PanneauSuggestionRAG` | `631c36c` (J6), `7cae733` (ablation), `bfabef1` (Greffe 2), `1db5a2d` et `82d3e80` (base de connaissances réelle) |
| 7 | Résumé du fil | `ml/smart_ticketing_ml/summarize.py`, `/summarize` ; `POST /tickets/:id/resume` (asynchrone, ≥ 2 messages), `EncartResumeFil` | `c66486a` (J8) |
| 8 | Pièces jointes et OCR | `service/ocr.py` (Tesseract pack `fra` + pdfplumber), `/extract` ; `middlewares/upload.middleware.ts` (PDF/PNG/JPEG ≤ 10 Mo), `POST /tickets/:id/pieces-jointes`, téléchargement proxifié, re-classification après OCR | `3ecf054` (Lot A), `e8afa52`, `31fa502`, `a5bf2a0` (Lot B) |
| 9 | Amélioration continue du modèle | `ml/smart_ticketing_ml/flywheel/` (`construire_train_v2`, `exporter_lot`, `reentrainer`, `courbe_apprentissage`, `reconcilier_relecture`), `/reentrainer`, `/reentrainer/etat`, `/deployer` ; `routes/ia.routes.ts` (réservé administrateur), `FlywheelPage.tsx` | `2df6407` (A), `69132d0` (D1), `e6a83f3` (B), `d8c35b4` (C1), `230fce1` (C2) |
| 10 | Tableau de bord et rapports | `GET /tickets/statistiques`, `services/ticket.service.ts` (fonction `statistiques`), `features/statistiques/TableauDeBord.tsx`, `features/statistiques/exportRapport.ts` (jsPDF + write-excel-file) | `942a0e3` (Epic 3), `525af6d` (PR #7) |
| 11 | Administration de la plateforme | `routes/utilisateurs.routes.ts`, `routes/categories.routes.ts`, `routes/parametres.routes.ts`, `services/categorie.statut.ts` ; pages `UsersManagementPage`, `CategoriesManagementPage`, `AbsencesPage`, `ParametresPage`, `FlywheelPage` | `e65b3fb`, `eeae756`, `2946efa`, `3332478` |
| 12 | Journal d'audit | `model JournalAudit`, `services/audit.service.ts`, `repositories/audit.repository.ts`, `routes/audit.routes.ts`, `utils/contexteRequete.ts` (AsyncLocalStorage), `middlewares/contexte.middleware.ts` ; `JournalAuditPage.tsx`, `features/administration/PanneauAudit.tsx` ; migrations `20260910120000` et `20260910180000` | `2be7c32`, `a0615e3`, `03a04ef`, `216c664`, `b425f62`, `12f03f2`, `2c2a780`, `629b471` |
| 13 | Tests, qualité et intégration continue | 6 fichiers `backend/src/**/*.test.ts` (runtime `node:test`, fonctions pures), 118 cas ; 8 fichiers `ml/tests/*.py`, 64 cas pytest (62 hors ligne, 2 lents nécessitant bge-m3 ou Tesseract) ; `.github/workflows/ci.yml` (GitHub Actions), qui rejoue typage, lint et tests à chaque push et pull request vers `main` | `eef813c` (tests du module IA), tests livrés avec les chantiers 1 et 2, `51b7dd0` et `dd8465c` (CI, PR #14) |
| 14 | Conteneurisation et déploiement | `docker-compose.yml` (7 services : postgres, ollama, ollama-prefetch, backend, ml, ml-prefetch, frontend), `docker-compose.gpu.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `ml/Dockerfile`, `ml/requirements.lock`, `frontend/nginx.conf` | `de15d5a`, `3caa303`, `4a17600`, `6b4a1cd`, `f77f964` (PR #10) |

## État des branches au 06/10/2026

`main` porte l'ensemble des fonctionnalités du plan : epics 1 à 4, conteneurisation,
affectation automatique et journal d'audit (PR #11), seuils de confiance IA (PR #13),
intégration continue (PR #14) et passe d'interface (PR #15).

Au 12/09/2026, date de la vérification initiale, les fonctionnalités 3 et 12 vivaient
encore sur `audit-et-HR`, 17 commits non fusionnés. La branche a été **fusionnée dans
`main` le 20/09/2026** (PR #11).

---

# Annexe B — Éléments écartés

## Hors du plan de travail : non livrés et non prévus

| Élément | Référence au cahier des charges | Raison |
|---|---|---|
| Intégration avec Slack et Microsoft Teams (notification et création rapide de tickets) | §3.2 objectif 6, §6.5 | Aucune trace dans le code : ni dépendance, ni route, ni configuration. Non retenue au périmètre. |
| Documentation de l'API au format Swagger / OpenAPI | §8 (outils annexes) | Aucune dépendance ni annotation dans le code. Non retenue au périmètre. |

Ces deux lignes alimentent la section « perspectives » du rapport.

## Inscrits au plan, livrés après la vérification initiale

Au 12/09/2026, ces deux éléments figuraient au présent dans les textes du formulaire, qui
est un document prévisionnel, sans que rien ne les prouve dans le dépôt. Tous deux sont
désormais livrés.

| Élément | Entrée concernée | État réel |
|---|---|---|
| ~~Seuils de confiance IA réglables par l'administrateur (§6.5)~~ — **livré le 24/09/2026** | 11 — Administration de la plateforme | Deux clés au registre : seuil d'**affichage** de la catégorie suggérée (défaut 0,5) et **porte d'abstention** du RAG (désactivée par défaut, bornes 0,05–0,95). Bornées et revalidées côté serveur, journalisées à l'audit. Le seuil de l'**affectation automatique** reste en dur — découplage assumé, énoncé dans l'aide de l'écran. |
| ~~Intégration continue (§8)~~ — **livrée le 06/10/2026** (PR #14) | 13 — Tests, qualité et intégration continue | Workflow GitHub Actions (`.github/workflows/ci.yml`), déclenché à chaque push et pull request vers `main`, sans base de données ni modèle lourd : un job backend (typage, lint, 118 tests `node:test`) et un job module IA (suite rapide pytest, 62 tests). **Limites** : le frontend n'est pas dans la CI, et le cycle de vie des tickets comme l'authentification n'ont pas de test unitaire — la formule « règles métier du serveur » de l'entrée 13 est plus large que ce qui est couvert. |

## Écartés en cours de projet, avec leur raison

| Élément | Raison |
|---|---|
| Champs canal, SLA, tags et sentiment présents sur les maquettes | Abandonnés en Epic 2 : absents du modèle de données, sans besoin exprimé. |
| Reranker par cross-encoder dans la chaîne RAG | Livré et fonctionnel, mais **hors du chemin par défaut** : non câblé dans la chaîne de suggestion, il ne s'exécute que via `POST /rerank`, le harnais d'évaluation, et — depuis le 24/09/2026 — la **porte d'abstention réglable** (§6.5), qui le sollicite pour le **score** du meilleur candidat. Le **réordonnancement**, lui, reste hors du chemin : l'ordre d'affichage est `"rrf"`, écrit en dur. L'ablation mesurée a montré un effet **faible et ambigu** : **nDCG@5 +0,01** et Recall@5 +0,02, mais **MRR −0,06 sur le jeu réel**, dont l'échantillon utile n'est que de **n=25** requêtes (21 des 46 n'ont aucun analogue dans la base de connaissances). Coût mesuré en regard : **6,86 s** par requête à chaud (20 documents, `max_length=512`), au-delà du budget de 5 s. Décision de rapport bénéfice/coût **entre deux grandeurs mesurées**, pas un échec technique. |
| Adaptation de domaine du classifieur par ajout de tickets réels à l'entraînement | Expérience menée, résultat négatif, conservée comme telle au journal technique. |

## Un point de rigueur pour la soutenance

La priorisation est décrite au présent, sans affirmation de performance : c'est
volontaire. La mesure du jalon J7 a **réfuté** l'hypothèse de départ selon laquelle des
règles explicites feraient mieux qu'un modèle appris (κ pondéré de 0,158 pour la
scorecard contre 0,784 pour le modèle de langage, sur le jeu réel). La scorecard reste
en service pour son explicabilité. Ne pas présenter cette brique comme performante ;
la présenter comme explicable, et assumer l'arbitrage.

Même prudence sur le reranker, pour une raison différente. Le journal technique inscrit
un **dimensionnement de production** (`K=10`, `max_length=256`, mesuré à 4,08 s contre
10,6 s à `K=20`) qui **n'a jamais été appliqué aux défauts livrés** : le code tourne avec
`K_CANDIDATS = 20` et `max_length = 512`, ce que `/sante` confirme à l'exécution. L'écart
est sans effet tant que le composant reste hors du chemin, mais il est **signalé et non
corrigé**. Ne pas présenter le reranker comme « dimensionné pour la production » : le
dimensionnement a été *mesuré*, pas *appliqué*.

Second point, sur le coût de ce même reranker. Le chiffre longtemps cité (~8 s/requête)
venait de la prose du journal, sans artefact. Il a été **mesuré le 19/09/2026** :
**6,86 s** à chaud sur 20 documents réels au `max_length=512` livré, soit 343 ms par
paire. L'argument de latence tient donc — 6,86 s dépasse le budget de 5 s du cahier des
charges — mais il ne vaut **que pour le réordonnancement**. La porte d'abstention, qui ne
rerank qu'une paire, coûterait **0,379 s**. Ce n'est donc pas la latence qui la tient
fermée, c'est l'absence de seuil calibré : une distinction à tenir si le jury demande
pourquoi le composant n'est pas branché.

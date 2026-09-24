# Journal technique — PFE Smart Ticketing & Support Assistant (Metavoria)

> **But** : matière première du rapport de PFE et de la soutenance. Une entrée par
> jalon / décision, organisée selon les phases du cahier des charges (CDC §12).
>
> **Ce que le jury cherche** : « pourquoi X et pas Y ? ». Chaque décision note donc
> ses **alternatives écartées** et leur justification.

## Conventions de lecture

- `[reconstitué depuis Git]` — fait établi à partir de l'historique Git / des issues /
  PRs / du code. C'est le **QUOI**, pas le **POURQUOI**.
- `[À COMPLÉTER PAR FEDI]` — ce que Git **ne peut pas prouver** : motivations réelles,
  alternatives réellement envisagées, difficultés vécues, conseils de l'encadrant.
  **Ne jamais inventer** de justification rétroactive ici — un jury sent une raison
  reconstruite, et c'est pire que rien.
- Entrées **J1 et suivantes du module IA** : établies en séance, remplies complètement.

**Règle permanente** : ce journal est mis à jour à **chaque jalon terminé**, sans
demande explicite.

---

# Phase 1 — Cadrage (Mars 2026 au CDC)

### Étude de l'existant, analyse des besoins, validation du CDC, étude technologique
- **Date réelle** : `[À COMPLÉTER PAR FEDI]` (le dépôt Git démarre au 08/07/2026 ;
  la phase de cadrage la précède et n'a pas de trace versionnée).
- **Ce qui a été fait** : le cahier des charges est présent au dépôt
  (`Cahier_des_charges_Smart_Ticketing_1.pdf`). `[reconstitué depuis Git]`
- **Décisions / alternatives écartées / justification** : `[À COMPLÉTER PAR FEDI]`
- **Problèmes rencontrés** : `[À COMPLÉTER PAR FEDI]`
- **Conseils de l'encadrant (Mohamed Amine Laribi)** : `[À COMPLÉTER PAR FEDI]`
- **Enseignements / limites** : `[À COMPLÉTER PAR FEDI]`

---

# Phase 2 — Conception

### Choix de la stack technique
- **Ce qui a été retenu** `[reconstitué depuis Git — versions lues dans les `package.json` / `docker-compose.yml` / `schema.prisma`]` :
  - **Frontend** : React 19 + TypeScript, TailwindCSS 4, Vite 8, **Zustand 5** (état).
  - **Backend** : Node.js + **Express 5**, **Prisma 7** (ORM).
  - **Base de données** : **PostgreSQL 17** avec l'extension **pgvector** (image
    `pgvector/pgvector:pg17`) — vectoriel prévu dès l'origine pour la phase IA.
  - **Auth** : **JWT** (`jsonwebtoken`) + **bcrypt** (`BCRYPT_SALT_ROUNDS=12`).
  - **Conteneurisation** : **Docker / Docker Compose** (postgres, backend, frontend
    servi par nginx).
  - **Validation** : **Zod** ; **e-mails** : nodemailer ; **sécurité HTTP** : helmet,
    express-rate-limit.
- **Pourquoi cette stack plutôt qu'une autre ?** `[À COMPLÉTER PAR FEDI]`
  > Pistes que le rapport devra trancher : React vs Angular/Vue ; Zustand vs Redux ;
  > Express vs NestJS ; Prisma vs TypeORM/SQL brut ; PostgreSQL vs MySQL. Le CDC §8
  > les proposait « à titre indicatif » — la justification du choix final t'appartient.
- **Alternatives réellement écartées** : `[À COMPLÉTER PAR FEDI]`
- **Note factuelle défendable** : le choix `pgvector` **dès l'initialisation** évite
  une migration d'infrastructure à la phase IA (l'extension vectorielle est
  disponible sans changer d'image). `[reconstitué depuis Git — commentaire du docker-compose.yml]`

### Stratégie Git
- **Ce qui a été fait** `[reconstitué depuis Git]` : GitHub Flow simplifié — une
  **issue « epic » par module**, une **branche par epic** créée depuis l'issue
  (`1-epic-1-…`, `2-epic-2-…`, `6-epic-3-…`, `8-epic-4-…`), **PR mergée dans `main`**
  à chaque livraison (PR #4, #5, #7). `main` = base d'intégration.
- **Pourquoi ce workflow ?** `[À COMPLÉTER PAR FEDI]`

### Modélisation UML (cas d'utilisation, séquence, classes) et MCD
- **Ce que Git prouve** : le **modèle de données** existe sous forme de schéma Prisma
  (`backend/prisma/schema.prisma`) — entités en français fidèles au MCD (Utilisateur,
  Ticket, Categorie, Commentaire, PieceJointe, Notification, EvenementTicket,
  SuggestionIA, RefreshToken). `[reconstitué depuis Git]`
- **Diagrammes UML (use case / séquence / classes)** : **aucun fichier UML n'est
  versionné** dans le dépôt (recherche `uml/diagram/puml/drawio` : rien). Les
  diagrammes, s'ils existent, sont hors dépôt. `[À COMPLÉTER PAR FEDI]`
- **Maquettes UI/UX** : `[À COMPLÉTER PAR FEDI]` (pas d'artefact de maquette versionné).

---

# Phase 3 — Développement Backend

### Epic 1 — Gestion des utilisateurs & authentification (Issue #1, PR #4)
- **Date** : 10/07/2026 (PR #4 mergée le 10/07, issue #1 fermée le 10/07). `[reconstitué depuis Git]`
- **Ce qui a été fait** `[reconstitué depuis Git + notes de séance]` : authentification
  complète (JWT + bcrypt), gestion des rôles (Employé / Technicien / Administrateur,
  RBAC), gestion des profils, réinitialisation de mot de passe par **code OTP** (haché,
  temps constant), **invitation d'un utilisateur par token sécurisé à usage unique**
  (hash SHA-256, lien valable 72 h).
- **Décision notable — invitation par token** `[reconstitué]` : un administrateur
  invite ; le compte reste « en attente » (mot de passe null) jusqu'à activation via
  le lien.
- **Pourquoi JWT+bcrypt / OTP / invitation par token vs alternatives** : `[À COMPLÉTER PAR FEDI]`
  > (Ex. session serveur vs JWT ; e-mail de lien vs OTP ; création directe vs invitation.)
- **Problèmes rencontrés** : `[À COMPLÉTER PAR FEDI]`
- **Enseignements / limites** : `[À COMPLÉTER PAR FEDI]`

### Epic 2 — Gestion des tickets (Issue #2, PR #5)
- **Date** : 11/07/2026 (PR #5 mergée le 11/07). `[reconstitué depuis Git]`
- **Ce qui a été fait** `[reconstitué depuis Git + notes de séance]` : CRUD tickets +
  cycle de statut (transitions validées serveur), **affectation manuelle** (admin
  assigne / technicien s'attribue, auto-passage NOUVEAU→EN_COURS à la 1ʳᵉ prise en
  charge), fil de commentaires, **notifications in-app temps réel via SSE** + e-mail
  best-effort, **évaluation de satisfaction** à la clôture (note + commentaire + date,
  modifiable), **historique des changements** (modèle `EvenementTicket`), seed des
  5 catégories, journalisation d'audit.
- **Décisions de périmètre — reportées, validées avec l'utilisateur** `[reconstitué depuis notes de séance]` :
  - Affectation **automatique** par charge/catégorie → repoussée en Phase 5 (avec la
    priorisation IA).
  - **Pièces jointes** (upload/stockage) → lot ultérieur (bouton retiré de l'UI).
  - **CRUD admin des catégories** (§6.5) → avec le module Administration.
  - Champs canal / SLA / tags / sentiment des maquettes → abandonnés (absents du modèle).
- **Décision technique — SSE pour le temps réel** `[reconstitué]` : auth par token en
  query (EventSource ne peut pas envoyer d'en-tête), location nginx dédiée sans
  buffering. **Alternative écartée (WebSocket) et justification** : `[À COMPLÉTER PAR FEDI]`
- **Problèmes rencontrés** : `[À COMPLÉTER PAR FEDI]`
- **Enseignements / limites** : `[À COMPLÉTER PAR FEDI]`

### Durcissement sécurité (commit « Sécurité : durcissement et sessions à jetons courts »)
- **Date** : 11–14/07/2026. `[reconstitué depuis Git]`
- **Ce qui a été fait** `[reconstitué depuis Git + notes de séance — revue de sécurité complète]` :
  révocation quasi-immédiate (rôle + compte actif revérifiés à chaque requête),
  **access token JWT court (15 min) + refresh token rotatif opaque** (haché, cookie
  httpOnly SameSite=Lax, détection de réutilisation → révocation de la famille),
  gardes anti auto-rétrogradation / protection du dernier admin, échappement HTML des
  e-mails, JWT épinglé HS256, limite de payload, politique de mot de passe (min 10 +
  refus des mots de passe compromis), helmet verrouillé (CSP stricte, HSTS), redaction
  des secrets dans les logs, **anti-énumération** du flux « mot de passe oublié »
  (réponse 200 générique).
- **Backlog restant (infra, pas code)** `[reconstitué]` : rate-limit en mémoire →
  Redis si multi-instance ; terminaison HTTPS nginx ; user PostgreSQL à privilèges réduits.
- **Pourquoi ce niveau de durcissement / alternatives** : `[À COMPLÉTER PAR FEDI]`
  > (Ex. refresh tokens rotatifs vs JWT longue durée — la justification « réduction de
  > la fenêtre d'exposition » est standard, mais formule-la avec ton propre raisonnement.)

---

# Phase 4 — Développement Frontend

### Frontend Epic 1 — Design system & parcours d'authentification (PR #4)
- **Date** : 10/07/2026. `[reconstitué depuis Git]`
- **Ce qui a été fait** : design system, refonte des écrans, parcours auth complet.
- **Décisions / alternatives / difficultés** : `[À COMPLÉTER PAR FEDI]`

### Frontend Epic 2 — Écrans tickets (PR #5)
- **Date** : 11/07/2026. `[reconstitué depuis Git]`
- **Ce qui a été fait** : écrans tickets connectés à l'API, notifications, satisfaction.
- **Décisions / alternatives / difficultés** : `[À COMPLÉTER PAR FEDI]`

### Refonte frontend « Premium » (PR #7)
- **Date** : 14/07/2026. `[reconstitué depuis Git]`
- **Ce qui a été fait** : refonte du design system (« Premium »).
- **Pourquoi une refonte ? Qu'est-ce qui n'allait pas avant ?** : `[À COMPLÉTER PAR FEDI]`

---

# Phase 5 — Module IA (Epic 4, Issue #8)

> Phase en cours. Conception détaillée : `docs/epic-4-module-ia-conception.md`.
> Ordre des jalons (non négociable) : J1 corpus → J2 gold set → J3 harnais d'éval +
> baselines → J4 microservice embeddings → J5 classification + calibration → J6 RAG
> hybride + reranker → J7 priorité scorecard → J8 confiance + abstention + résumé →
> **J8bis pièces jointes (extraction/OCR)** → J9 flywheel.

### Conception du module IA (document de conception)
- **Date** : 14/07/2026. `[établi en séance]`
- **Thèse retenue** : un seul pipeline d'embeddings sert classification ET recherche ;
  le LLM est *professeur / extracteur de features*, pas décideur ; décisions glass-box
  et calibrées ; la validation du technicien alimente un **data flywheel**.
- **Contrainte transversale — catégories dynamiques** : les catégories ne sont jamais
  codées en dur ; elles viennent toujours de la table `categories` (gérées par
  l'Administration §6.5). Conséquence : le générateur et l'entraînement lisent la liste
  en base ; l'ajout/suppression d'une catégorie périmera le modèle → abstention en
  attendant le réentraînement (mécanisme = le flywheel J9).

### J1 — Génération du corpus synthétique
- **Date** : 14/07/2026. `[établi en séance]`

- **Contexte / ce qui a été fait** : Metavoria **ne dispose d'aucun historique réel de
  tickets** (confirmé par l'encadrant). Tout le module IA repose donc sur un **corpus
  synthétique** généré par LLM local. Générateur Python livré (`ml/smart_ticketing_ml/`)
  qui lit les catégories en base, échantillonne des spécifications, génère via Ollama
  en sortie structurée (JSON schema), et écrit un JSONL versionné + un manifeste.
  **Génération complète effectuée (run nocturne 14→15/07/2026) : 852/900 tickets
  produits, qwen2.5:14b** (`corpus_train_20260714T161302Z.jsonl`).

- **Décisions + alternatives écartées + justification** :
  1. **LLM local (Ollama) vs API cloud (Claude/OpenAI)** → **local retenu**.
     Justification : **confidentialité** (aucune donnée Metavoria ne sort de la
     machine), **coût opérationnel nul**, **conformité CDC §10** (« outils open-source
     ou offre gratuite »). Alternative écartée : API cloud — meilleure qualité brute
     mais coût récurrent, dépendance réseau et sortie de données.
  2. **qwen2.5:14b vs qwen2.5:7b** → **14B retenu** malgré la lenteur.
     Justification : comparaison sur **6 specs identiques (seed 42)** — le **7B écrase
     toutes les descriptions en télégramme**, y compris celles censées être
     « détaillées » (ex. « Erreur runtime », « Nouveau collaborateur »), ce qui **perd
     l'axe de variété** nécessaire pour entraîner le classifieur (J5) à gérer la
     diversité réelle. Le 14B respecte la complétude demandée (contexte + codes
     d'erreur). Sur les résolutions, les deux se valent (léger avantage détail au 14B,
     léger avantage justesse ponctuelle au 7B). **7B conservé comme fallback.**
  3. **Répartition des statuts 85 % résolus / 15 % ouverts** (au lieu de 100 % résolus).
     Justification : (a) le classifieur (J5) prédit sur des tickets **entrants** — un
     corpus 100 % résolu l'entraînerait sur une distribution absente à la prédiction ;
     (b) sans tickets ouverts, la **démo/soutenance est vide** (dashboard et file
     vides). Les 15 % ouverts sont **générés AVEC leur résolution** (stockée au JSONL,
     `resolution_a_lier=false`) mais **non liée en base** → ils restent « ouverts » et
     sont **fermables à la demande** pendant la démo. Alternative écartée : 100 %
     résolus (plus simple, mais irréaliste et démo vide).
  4. **Échantillonnage par quotas vs tirage aléatoire pur** → **quotas retenus**.
     Justification : le tirage aléatoire fait dériver les petits échantillons (un
     tirage de 6 était tombé à 100 % résolu par malchance) ; les quotas (arrondi au
     plus fort reste) donnent une **répartition exacte à tout n** — fiabilise les
     échantillons de comparaison et le **futur gold set (J2)**.
  5. **Découplage statut / génération** : le statut n'est **pas** transmis au modèle ;
     chaque ticket est généré comme un cas *résolu* (donc toujours une résolution),
     puis le statut réel (ouvert/résolu) est **estampillé côté client** depuis le quota.
     Alternative écartée : passer le statut au modèle — provoquait des résolutions vides
     sur les tickets « ouverts » (voir Problèmes).

- **Mesures et chiffres** :
  - **Matériel** : RTX 3050 Ti Laptop, **4 Go de VRAM** vs qwen2.5:14b (~10 Go) →
    **offloading partiel : 23 % GPU / 77 % CPU**, **GPU-Util ≈ 6 %** (le GPU attend le
    CPU — couches séquentielles). Débit soutenu ≈ **70 tickets/h** → **900 tickets ≈ 13 h**.
  - Mesures ponctuelles en séance : lot de 6 tickets en **235 s** (14B) vs **85 s** (7B)
    → le 7B est ≈ **2,7× plus rapide** sur ce matériel.
  - **Distribution planifiée (n=900, seed 42)** : catégories déséquilibrées —
    Logiciel 30 % / Matériel 25 % / Réseau 20 % / Accès 15 % / Autre 10 % ; statuts
    RESOLU 55 % + CLOTURE 30 % = **85 %** résolus, NOUVEAU/EN_COURS/EN_ATTENTE = **15 %** ;
    complétude **indigente 30 %** (tickets « une ligne, aucun symptôme »).
  - **Résultats de la génération complète (852 tickets réels)** :
    - **0 résolution vide**, **100 % 14B** (aucun fallback), **100 %** des résolutions au
      format Cause/Action/Vérification.
    - **99 % de descriptions uniques** (849/852) — quasi zéro doublon ; longueur des
      descriptions **3 → 18 (médiane) → 70 mots** (l'axe de variété est bien préservé,
      contrairement au 7B) ; résolutions médiane 31 mots.
    - Statuts effectifs : **84,9 % résolus / 15,1 % ouverts** (723/129) ; catégories
      Logiciel 29,6 % / Matériel 25,5 % / Réseau 20,4 % / Accès 14,7 % / Autre 9,9 %
      (la répartition tient malgré les lots sautés).

- **Problèmes rencontrés + solutions** :
  1. **Résolutions vides sur les tickets ouverts** : le modèle interprétait « statut
     ouvert » comme « pas encore résolu » et laissait la résolution vide. **Solution** :
     découplage statut / génération (le modèle génère toujours un cas résolu ; le statut
     est estampillé après). → 0 résolution vide ensuite.
  2. **Backslash de chemins Windows corrompus** dans le JSON (`%appdata%\Roaming` →
     séquence d'échappement cassée). **Solution** : consigne au modèle d'utiliser des
     slashes « / » et jamais de backslash.
  3. **Incohérences techniques des résolutions** (7B : un *runtime error* applicatif
     « corrigé » par un driver graphique). **Solution** : consigne de cohérence
     technique + format imposé **Cause / Action / Vérification** + exemple de référence
     (« Cause : saturation du pool DHCP sur le VLAN 20. Action : étendu la plage à /23,
     redémarré dhcpd. Vérification : connectivité OK sur 3 postes »). Nette amélioration.
  4. **Robustesse d'un run de ~13 h** : le code initial n'écrivait le JSONL qu'à la fin
     (tout perdu en cas de crash). **Solution** : **écriture incrémentale flushée par
     lot** → un crash à H+8 conserve H+8 de travail.
  5. **8 lots sur 150 sautés** (échecs transitoires du 14B : timeout/JSON invalide) →
     **852/900 produits (~5,3 % de perte)**. Non bloquant (852 est dans la fourchette
     visée 800-1000) et **non dégradé** (fallback 7B désactivé → corpus pur 14B). Piste
     d'amélioration : une **relance automatique** du lot avant abandon.
  6. **Backslash résiduel** : 8 tickets (0,9 %) contiennent encore un backslash malgré
     la consigne — mais le **JSON reste valide** (échappement correct), donc cosmétique ;
     le loader pourra normaliser en « / » si besoin.

- **Enseignements / limites** :
  - **Dimensionnement production** : un LLM 14B exige **≥ 12 Go de VRAM** pour un
    offloading complet. En deçà, le calcul hybride CPU/GPU dégrade le débit d'un
    **facteur ≈ 5**. → à réutiliser dans la section « Dimensionnement / passage à
    l'échelle » du rapport.
  - **Limite majeure à documenter** : **absence de données réelles** chez Metavoria
    (confirmée par l'encadrant) → tout repose sur le corpus synthétique. À traiter
    explicitement en section « **Limites et validité des résultats** » du rapport (le
    corpus synthétique valide la *chaîne* et les *mécanismes*, pas la performance sur
    données de production).
  - **Arabizi hors périmètre** : registre FR + termes techniques EN uniquement (limite
    assumée).
  - **Partie B réalisée (chargement en base)** : migration Prisma `synthetique`
    (`20260715105910_ajout_ticket_synthetique`) + loader `backend/prisma/loadSyntheticCorpus.ts`
    (`npm run db:load-corpus`, idempotent). **852 tickets chargés**, marqués
    `synthetique=true` (exclus des KPI réels §6.4) ; 723 résolutions liées en
    `Commentaire`, 129 tickets ouverts sans résolution liée (backlog de démo, fermables
    à la demande). Enrichissements pour une démo crédible : **3 techniciens** (charge par
    technicien), **31 demandeurs par service** (répartition par service), **dates étalées
    sur ~90 j** + dateCloture (temps moyen de résolution), **178 évaluations de
    satisfaction**. → le tableau de bord (§6.4) est alimenté.

### J2 — Gold set de test (scellé)
- **Date** : 15/07/2026 (candidats) → **17/07/2026 (scellement)**. `[établi en séance]`
- **Statut** : **scellé.** Relecture manuelle de Fedi faite (`gold_final.xlsx`),
  ingérée → `ml/gold/gold.jsonl` **versionné** (102 tickets). **Jamais utilisé à
  l'entraînement.**
- **Contexte** : le gold set valide le module IA sur des tickets **non vus**. Exigences :
  **étanche** (disjoint du corpus d'entraînement) et **relu à la main**.
- **Décision + alternative écartée + justification** :
  - **Modèle des candidats : qwen2.5:7b** (≠ le 14B de l'entraînement). Justification :
    réduit le **biais « même générateur »** — si train et test venaient du même modèle,
    on mesurerait surtout la capacité du système à reproduire son propre générateur.
    **Nuance importante** : 7B et 14B restent la **même famille Qwen** → biais **réduit,
    pas éliminé**. Le **vrai garant de qualité, c'est la relecture manuelle de Fedi**.
    Alternative écartée : 14B (même qualité que le train mais **même distribution** →
    biais same-generator plus fort).
  - **Anti-fuite en deux contrôles** : (1) **dédup exacte** — tout candidat dont la
    description normalisée existe déjà dans le train est **écarté** ; (2) **chevauchement
    sémantique de surface** — Jaccard (mots de titre+description) avec le ticket
    d'entraînement le plus proche, **signalé** (pas supprimé) dans le CSV, seuil d'alerte
    0,6, tri décroissant → les quasi-copies remontent en tête pour la relecture.
- **Mesures et chiffres** : **119 candidats retenus** (7B, seed 2026 ; ~30 perdus sur
  150 = lots 7B en échec, sans conséquence pour un gold set). **1 écarté** en dédup
  exacte (chevauchement quasi nul avec le train, comme attendu). **13 signalés
  « quasi-copie »** (Jaccard ≥ 0,6 vs train). **4 descriptions suspectes** (défaut 7B :
  le profil du demandeur remplace le symptôme, ex. « RH/gestionnaire paie. ») → colonne
  `desc_suspecte` du CSV pour les repérer/écarter en relecture.
- **Enseignement** : le 7B est nettement plus fragile que le 14B (descriptions
  dégénérées, métadonnées inventées type « Last Boot ») — acceptable ici car la
  relecture humaine filtre, et cela **conforte le choix du 14B pour l'entraînement**.
- **Limite (à documenter au rapport)** : gold set **synthétique** faute de données
  réelles ; il valide la généralisation *dans* la distribution synthétique, pas la
  performance sur données de production.
- **Scellement (17/07/2026)** — ingestion de la feuille relue (`gold_final.xlsx`)
  par `ml/smart_ticketing_ml/data/ingest_gold.py` (lecture openpyxl ; ne garde que
  les lignes validées « O » ; applique les corrections `catégorie/priorité` quand
  renseignées, sinon le label généré). Résultats :
  - **102 tickets retenus sur 119** (17 écartés en relecture).
  - **42 corrections de priorité, 5 de catégorie** (mesurées sur le fichier ; ma
    dictée initiale « 33 / 3 » était erronée → **le fichier fait foi**).
  - **Répartition** : Logiciel 32 / Matériel 25 / Réseau 22 / Accès 18 / Autre 5.
  - **Résolutions intégrales** : la colonne « Résolution (extrait) » du xlsx est
    tronquée à l'affichage (« … ») ; la résolution **complète** est **récupérée
    depuis `gold_candidates_*.jsonl`** par jointure exacte titre+description
    (102/102 appariés) → aucun extrait amputé n'est scellé.
  - Sortie : `ml/gold/gold.jsonl` + `ml/gold/gold_manifest.json` (provenance,
    comptes, SHA-256 pour la reproductibilité).
- **Enseignement** : le générateur **sous-évaluait plutôt l'urgence** — sur les
  42 corrections de priorité (~41 % des tickets), **31 relèvent** la priorité contre
  **11 qui l'abaissent** (≈ 3 sur 4 vers le haut). À réutiliser au J7 (priorisation)
  comme signal que les *a priori* de priorité par catégorie étaient trop prudents.
- **Limite (à documenter au rapport)** : catégorie **Autre sous-représentée (n=5)**
  → macro-F1 fragile sur cette classe ; renforce la logique d'**abstention** sur le
  fourre-tout `autre` (§5 de la conception) plutôt que de forcer une prédiction.

### Jeu de validation externe (tickets réels — Kaggle, CC BY 4.0)
- **Date** : 17/07/2026. `[établi en séance]`
- **Attribution / licence** : **Kaggle « Customer IT Support Ticket Dataset »**
  (Tobias Bueck), **CC BY 4.0**. **46 tickets FR** sélectionnés puis **ré-étiquetés
  à la main** dans notre taxonomie (catégorie + priorité).
- **Motif** : jusqu'ici tout est **synthétique** (limite majeure du projet). Un
  jeu de **vrais e-mails de support** apporte la **validation externe** qui manquait
  — le test le plus honnête du module IA, sur du langage humain réel.
- **Décisions de scellement + justification** :
  1. **`text` de prédiction = Sujet + Corps, JAMAIS la réponse de l'agent.** La
     réponse n'existe pas au moment de la prédiction en production ; l'inclure serait
     une **fuite**. Elle est conservée à part (`reponse_agent`) pour valider le RAG
     au **J6** (paires problème→réponse).
  2. **Périmètre = lignes validées « O » ET sujet non vide (46).** 4 tickets « O »
     sans sujet (corps seul) sont écartés du périmètre relu ; 1 ligne non tranchée
     ignorée. Étiquette d'or = correction si renseignée, sinon la valeur du dataset.
  3. **Jamais utilisé à l'entraînement** (drapeau `reel=true`, `synthetique=false`).
- **Mesures et chiffres** : **46 tickets**. **26 corrections de priorité (57 %)** —
  dont **24 à la hausse / 2 à la baisse** → **le dataset source sous-évaluait
  l'urgence** (même tendance que le corpus synthétique en J2, sur des données
  indépendantes : le signal se confirme). **10 corrections de catégorie.**
  Répartition : **Logiciel 21 / Réseau 10 / Matériel 8 / Accès 5 / Autre 2**.
- **Limites (à documenter au rapport)** : (a) **biais produit grand public** — le
  dataset vient d'un support client généraliste, pas d'une DSI interne, donc le
  vocabulaire (noms de produits, ton) diffère du cas Metavoria ; (b) **`Autre` n=2**
  → non significatif ; (c) **n=46** → tendances **indicatives**, pas de conclusion
  statistique par classe. Sortie : `ml/gold/validation_externe.jsonl` + manifeste.

### J3 — Harnais d'évaluation + baselines (le comparatif synthétique → réel)
- **Date** : 17/07/2026. `[établi en séance]`
- **Règle respectée** : le harnais arrive **AVANT tout modèle appris** (conception
  §12). Il charge le train, **vérifie l'étanchéité**, entraîne chaque baseline une
  fois, puis l'évalue sur **deux jeux** — gold synthétique (102) et validation
  externe réelle (46) — et produit un **rapport versionné** (Markdown + JSON +
  matrices de confusion) sous `ml/eval/reports/j3/`. Baselines J3 (sans modèle
  appris) : **classe majoritaire** (plancher) et **TF-IDF + SVM linéaire**.

- **RÉSULTAT CENTRAL (le chiffre clé du projet)** : macro-F1 du **TF-IDF + SVM**
  = **0,944 sur le gold synthétique → 0,388 sur le réel externe**, soit une **chute
  de 0,556**. **Étanchéité** : **0 chevauchement, même approximatif**, entre le train
  et le jeu réel → les données réelles sont **vraiment indépendantes** (la chute
  n'est pas un artefact de fuite).

- **Enseignement principal** : le **0,944 mesurait la séparabilité lexicale
  artificielle** du corpus synthétique — chaque catégorie ayant été générée depuis un
  prompt distinct, le vocabulaire est quasi disjoint et un simple TF-IDF « résout »
  la tâche. Sur du **vrai langage humain** (« MacBook Air », « Jira », « PostgreSQL »,
  tournures polies, e-mails longs), un TF-IDF **entraîné sur le synthétique ne
  transfère pas**. → la performance synthétique est un **plafond trompeur**.

- **Détail méthodologique fort** : sur le réel, l'**accuracy du SVM (0,391) passe
  SOUS le plancher majoritaire (0,457)** — le modèle « savant » fait **pire que
  “toujours Logiciel”** en accuracy ; il ne surnage en macro-F1 (0,388 vs 0,125) que
  parce qu'il répartit sur les classes. → justifie **macro-F1 comme métrique de tête**
  et la **méfiance envers l'accuracy** sur données déséquilibrées.

- **Par classe (réel)** : **Réseau tient** (F1 0,667 — vocabulaire technique stable :
  VPN, routeur, Cisco), **Logiciel s'effondre** (rappel 0,333), **`Autre` = bruit**
  (n=2, précision 0,056). Le modèle synthétique ne connaît pas les entités réelles.

- **Nouvelle cible pour J5** : non plus « **battre 0,944 sur le synthétique** »
  (facile et **trompeur**) mais **RÉDUIRE l'écart synthétique → réel** via les
  **embeddings `bge-m3` sémantiques** (multilingues) plutôt que lexicaux. Le harnais
  mesure désormais exactement cet écart — chaque modèle suivant s'y compare.

- **Limite** : **n=46** → significativité **par classe limitée**, tendances
  **indicatives** et non des conclusions statistiques. Mais la **direction** (chute
  massive synthétique→réel) est robuste et suffit à cadrer la suite.

- **Livrables** : `ml/smart_ticketing_ml/eval/` (dataset + étanchéité, metrics,
  baselines, report ; **stubs `retrieval.py` J6 et `priority.py` J7** pour figer la
  forme du harnais). Rapport de référence daté versionné (preuve de progression pour
  le rapport, la soutenance et le flywheel J9) ; les runs quotidiens vont dans
  `artifacts/eval/` (gitignored, régénérable).

### J4 — Microservice d'embeddings (`bge-m3`, 1024d) + migration `vector(1024)` + index HNSW
- **Date** : 17/07/2026. `[établi en séance]`

- **Contexte / ce qui a été fait** : première brique du microservice Python (§3.1) —
  un service **FastAPI** qui **charge et sert lui-même** `bge-m3` (tête dense, 1024d),
  primitive `/embed` + `/sante`. La colonne `Ticket.embedding` (placeholder
  `vector(1536)`) est migrée en **`vector(1024)`**, une colonne `embedding_modele`
  est ajoutée (reproductibilité), et un **index HNSW cosinus** est créé. Les **861
  tickets** en base sont **embeddés** (backfill idempotent). Livrables :
  `ml/smart_ticketing_ml/service/` (`embedder.py`, `app.py`, `backfill.py`), migration
  Prisma `20260717183932_ajout_embedding_1024_hnsw`.

- **Décisions + alternatives écartées + justification** :
  1. **Modèle auto-hébergé (FastAPI + sentence-transformers) vs délégation à Ollama**
     → **auto-hébergé retenu**. Justification : c'est le **cœur de la thèse directrice**
     (§1/§3) — servir soi-même le modèle d'embeddings **démontre la maîtrise ML**.
     Ollama sait servir `bge-m3`, mais déléguer réduirait l'embedding à un simple
     appel d'API et contredirait la frontière de service. Le coût (dépendance `torch`)
     est négligeable face à cet argument.
  2. **`bge-m3` (1024d) vs OpenAI/1536d (le placeholder)** → **bge-m3**. Multilingue,
     **meilleur sur le français**, open-source, hybride dense+sparse (seule la tête
     **dense** est utilisée ici ; la sparse est réservée à la recherche hybride J6).
     Le `1536` du schéma était un **placeholder** → aligné sur la vraie dimension du
     modèle (Flag #4 de la conception).
  3. **Métrique cosinus (`vector_cosine_ops`)** → vecteurs **L2-normalisés** à
     l'encodage (`normalize_embeddings=True`), donc cosinus = produit scalaire ;
     métrique naturelle pour `bge-m3` et cohérente avec la recherche dense (§7).
  4. **DROP+ADD de la colonne vs `ALTER TYPE`** → **recréation**. pgvector ne permet
     pas de changer la dimension d'une colonne `vector` en place ; **0/861 ligne
     peuplée** au moment de la migration → aucune donnée perdue.
  5. **Index HNSW aux paramètres explicites** (`m=16, ef_construction=64`, = défauts) :
     écrits en clair pour **documenter le choix** et préparer l'échelle.
     - `m` = nombre de liens par nœud dans le graphe : plus haut → **meilleur rappel**,
       plus de **mémoire** et construction plus lente.
     - `ef_construction` = taille de la liste de candidats à la **construction** : plus
       haut → index de **meilleure qualité/rappel**, construction plus lente.
     - Le rappel **à la requête** se règle après coup via `hnsw.ef_search` (défaut 40),
       **sans reconstruire** l'index. Sur 861 vecteurs les défauts suffisent largement.
     - **Alternative écartée : IVFFlat** — exige un jeu déjà peuplé pour l'entraînement
       des listes et se re-tune mal quand le corpus grandit ; HNSW n'a pas ce prérequis.
  6. **Backfill : script Python en écriture directe pgvector vs passage par l'API Node**
     → **script direct**. J4 est un travail **batch hors ligne** ; l'intégration Node
     (embed à la création d'un ticket) n'a de sens qu'à **J5** (quand le classifieur
     consomme les embeddings) → l'inclure empièterait sur J5. Le service HTTP et le
     backfill partagent **une seule implémentation d'embedding** (`embedder.embed_textes`).
  7. **Unité encodée = titre + description** — même unité que la **requête RAG** (§7,
     côté requête) et que le `text` des jeux d'éval J2/J3 → cohérence de bout en bout.

- **Mesures et chiffres** :
  - **Backfill** : **861/861** tickets peuplés en **94,3 s** (**9,1 tickets/s**), CPU.
    (852 synthétiques + **9 tickets de test** de dev Epic 1/2, ids 1-8 et 861 — « Test
    SSE temps reel », « test de prob »… : bruit de dev, `synthetique=false` ; embeddés
    par complétude, leur exclusion éventuelle du RAG est un point **J6**.)
  - **Latence d'un embed unitaire (CPU, modèle chaud) ≈ 107–118 ms** → **très en-deçà
    du budget CDC < 5 s/ticket**. Chiffre à réutiliser en section « dimensionnement
    production » : l'embed à la volée est viable en CPU ; bascule GPU seulement si un
    besoin de débit massif apparaît.
  - **Vérification HNSW (EXPLAIN ANALYZE)** — requête de similarité
    (`ORDER BY embedding <=> sonde LIMIT 5`) : plan =
    `Index Scan using tickets_embedding_hnsw_idx` (**pas de seq scan**),
    `Order By: (embedding <=> …::vector)`, **Execution Time 1,06 ms**. L'index est
    effectivement emprunté malgré la petite taille de table.

- **Problèmes rencontrés + solutions** :
  1. **Enfer de dépendances `transformers`** : `pip install "sentence-transformers>=2.7"`
     a tiré `transformers 5.14` / `sentence-transformers 5.6`, **incompatibles avec
     `torch 2.2.0`** (`NameError: name 'torch' is not defined` à l'import). **Solution** :
     **épingler** des versions compatibles torch 2.2 — `sentence-transformers==2.7.0`,
     `transformers==4.40.2`, `tokenizers==0.19.1`, `huggingface-hub==0.23.5`.
     Enseignement pour la repro : **figer** ces versions (fait dans `pyproject.toml`).
  2. **Warning symlink Windows** au 1ᵉʳ téléchargement HF (Developer Mode non activé) :
     **bénin** — HF copie les poids au lieu de les lier, sans impact fonctionnel.
  3. **Changement de type sur colonne `Unsupported`** : `prisma migrate dev` ne détecte
     pas le passage `vector(1536)→1024` (type opaque pour Prisma) ni l'index HNSW.
     **Solution** : migration en `--create-only` puis **SQL édité à la main** (DROP+ADD
     + `CREATE INDEX … USING hnsw …`) — pattern documenté §4.1 de la conception.

- **Enseignements / limites** :
  - **Auto-héberger le modèle a un coût d'intégration** (torch, ~2,3 Go de poids, enfer
    de versions) mais reste **conforme CDC §10** (open-source, hors-ligne, aucune donnée
    sortante) et **défendable** au jury (vraie ingénierie ML, pas un appel d'API).
  - Le **backfill est idempotent** : ne (ré)encode que `embedding IS NULL` ou
    `embedding_modele` ≠ modèle courant → un **changement de modèle relance tout**
    proprement (utile au flywheel J9 et à toute évolution d'embeddings).
  - **Reproductibilité** : chaque run écrit un manifeste
    (`artifacts/embeddings/backfill_<horodatage>.json` — modèle, device, comptes, débit,
    latence). Les poids et versions de libs sont figés.

- **À anticiper (J6) — choix conscient, pas dette cachée** : le service utilise
  **`SentenceTransformer` (tête dense uniquement)**. Pour J4 (dense seul) c'est
  parfait, mais la **recherche hybride J6 (§7)** combine dense + un signal lexical.
  Deux options à trancher en J6 :
  1. **Full-text Postgres (BM25-like)** pour le lexical — c'est déjà la voie prévue au
     §7 (« pgvector dense + full-text Postgres, fusion RRF ») ; **aucun changement
     d'embedder** requis, le sparse vit dans Postgres.
  2. **Passer à `FlagEmbedding`** — seule lib qui **expose la sortie sparse de bge-m3**
     (lexical weights natifs du modèle), au prix d'une dépendance plus lourde et d'un
     stockage/scoring sparse dédié.
  → **Décision reportée à J6.** L'option 1 (full-text Postgres) est la voie par défaut
  de la conception ; l'option 2 n'est à retenir que si le sparse natif de bge-m3
  surpasse nettement BM25 sur notre mélange FR + termes techniques EN.

### J5 — Classification par embeddings + Régression Logistique + calibration
- **Date** : 18/07/2026. `[établi en séance]`

- **Contexte / ce qui a été fait** : le 3ᵉ barreau de l'échelle de baselines (§5) —
  embeddings `bge-m3` (réutilisés du J4, tête dense 1024d) → **Régression Logistique**.
  Exploration d'abord en notebook (`ml/notebooks/j5_classification.ipynb` : comparatif,
  matrices de confusion, reliability diagram), **puis code figé** dans
  `ml/smart_ticketing_ml/training/` (`classifier.py` = `EmbeddingLogReg` conforme au
  Protocol du harnais + save/load joblib + abstention ; `train_classifier.py` = gel +
  rapport). Le harnais J3 est **réutilisé** et **étendu** (ECE + fiabilité dans
  `eval/metrics.py`, `plot_reliability` dans `eval/report.py`). Rapport de référence
  versionné `ml/eval/reports/j5/` ; modèle figé + manifeste sous `artifacts/models/`.

- **Cible J5 (rappel, fixée en J3)** : **non pas** battre le 0,944 synthétique (facile et
  trompeur) mais **réduire l'écart synthétique → réel** (réf. TF-IDF+SVM = **0,556**),
  prioritairement en **remontant le réel** grâce au sémantique multilingue.

- **RÉSULTAT CENTRAL — le fil rouge : la limite synthétique→réel se propage à TROIS
  niveaux.**
  1. **Classification** (déjà vu J3) : 0,944 → 0,388.
  2. **Calibration** (nouveau) : **calibrer sur un dev synthétique dégrade l'ECE réel**
     (non calibré **0,054** → Platt **0,282** → isotonique **0,495**), alors même que
     l'ECE *synthétique* s'améliore (0,257 → 0,069 → 0,057). La variante **non calibrée
     est la mieux calibrée sur le vrai**.
  3. **Abstention** (nouveau) : un seuil réglé sur le dev synthétique (précision cible
     0,80) **descend au plancher** (le dev est trop facile, précision ~0,96) → **~0
     abstention utile** sur le réel (couverture 87 % à précision 52 %).
  → **Enseignement central du projet** : le corpus synthétique est un **plafond
  trompeur à tous les niveaux** ; seul le **flywheel sur données réelles (J9)** peut
  combler l'écart. C'est une planche de soutenance, **pas un échec**.

- **Décisions + alternatives écartées + justification** :
  1. **Modèle de production = LogReg-embeddings NON calibrée** vs version calibrée
     (Platt/isotonique) → **non calibrée retenue**. Figer une variante calibrée
     reviendrait à **choisir sciemment un modèle moins bien calibré sur le vrai**
     (ECE réel 0,282 vs 0,054) — absurde. **Mais** toute la machinerie de calibration
     (Platt, isotonique, ECE, reliability) est **conservée dans le harnais comme
     PREUVE** du non-transfert. La vraie calibration attend un dev réel (J9). La lettre
     de la conception §8 (Platt/isotonique) est ainsi **respectée dans la méthode**,
     mais la *décision de gel* suit la mesure, pas le plan.
  2. **Abstention : mécanisme codé, seuil paramétrable NON figé** vs seuil en dur.
     Le mécanisme (proba max < seuil → abstention) est une **exigence CDC §6.5** → le
     code existe, exposé comme **paramètre admin**. Mais figer une valeur serait
     malhonnête (elle vient d'un dev synthétique inopérant sur le réel) → **non figé**,
     réglage renvoyé au J9 (dev réel). Livrable : la **courbe couverture/précision**.
  3. **Règle d'or méthodologique — split dev depuis le train** vs réglage sur le gold.
     La calibration et le seuil sont réglés sur un **dev stratifié ~15 % découpé du
     train** (724 train' / 128 dev) ; le **gold (102) et l'externe (46) restent du TEST
     PUR**, jamais touchés. Régler sur le gold le disqualifierait comme test vierge et
     gonflerait les scores — **on ne mesure jamais sur ce qui a servi à régler**.
  4. **LogReg vs SVM sur embeddings** : le contrôle SVM-embeddings (macro-F1 réel
     **0,428**) vs LogReg-embeddings (**0,438**) montre que **le gain vient des
     embeddings, pas du choix de tête** — et LogReg offre en plus `predict_proba`
     (indispensable à la calibration et à l'abstention), d'où son choix (§5).
  5. **Baseline Claude few-shot (§5 barreau 4) reportée** à un mini-jalon séparé →
     préserve la cohérence **local-first** (aucun appel API, aucune donnée sortante) et
     garde J5 net.

- **Mesures et chiffres** :
  - **Écart réduit** : TF-IDF+SVM 0,556 → **LogReg-embeddings 0,506** ; surtout
    **l'accuracy réelle passe de 0,391 à 0,500** (le TF-IDF faisait *pire* que le
    plancher majoritaire 0,457 ; le sémantique **repasse au-dessus**).
  - **Par classe (réel)** : Logiciel se redresse (rappel 0,333 → **0,381**, précision
    0,889), Matériel/Réseau solides (F1 ~**0,63**), Accès/Autre restent faibles (n=5/2).
  - Split : 724 train' / 128 dev ; embeddings en cache `.npy` (réutilisés entre notebook
    et script) ; latence négligeable (LogReg sur 1024d).

- **Problèmes rencontrés + solutions** :
  1. **Le kernel Jupyter ne trouvait pas le package** (`smart_ticketing_ml`) : lancé
     depuis `notebooks/`, la racine `ml/` n'était pas sur `sys.path`. **Solution** :
     la 1ʳᵉ cellule localise la racine `ml/` et l'ajoute à `sys.path` (marche que l'on
     lance depuis `ml/` ou `ml/notebooks/`).
  2. **Isotonique dégénère** (macro-F1 synth 0,897, ECE réel 0,495) : trop peu de points
     par classe au dev (~128 répartis sur 5 classes, Autre ~13) → sur-ajustement de la
     courbe isotonique. Confirme que Platt (paramétrique) est plus robuste en petit
     régime — **et surtout que ni l'un ni l'autre ne transfère au réel**.

- **Enseignements / limites** :
  - **La calibration est une mesure, pas un pansement** : sans données réelles, on ne
    peut pas calibrer honnêtement ; on peut seulement **prouver** que le synthétique n'y
    suffit pas. Cadre exactement le rôle du flywheel (J9).
  - **n=46 réel** → tendances **indicatives** (ECE bruité par bin), mais la **direction**
    (non-transfert à trois niveaux) est robuste et concordante entre classification,
    calibration et abstention.
  - **Livrables** : `training/` (classifieur + gel), harnais étendu (ECE/fiabilité),
    rapport `ml/eval/reports/j5/`, modèle+manifeste (`artifacts/`, gitignored,
    régénérable), notebook d'exploration.

### J5+ — Adaptation de domaine : ajouter du réel à l'entraînement (tentative, négatif)
- **Date** : 18-19/07/2026. `[établi en séance]`

- **Contexte / hypothèse** : le J5 laisse un écart synthétique→réel de 0,506.
  Piste la plus prometteuse pour le combler : **injecter de vrais tickets à
  l'entraînement** (adaptation de domaine). Le dataset Kaggle contient **476 FR**,
  dont **291 en queues IT** (Technical + Product + IT Support) ; les **46** du test
  externe en proviennent. On ajoute **~242 AUTRES** au train et on mesure sur les
  **mêmes 46 intouchés**. Deux axes : **AXE1** (synth + réel), **AXE2** (réglages
  `class_weight`/`C` sélectionnés sur le **dev synthétique**).

- **Règle d'interprétation — PRÉ-ENREGISTRÉE (avant de voir les résultats)**, pour
  éviter toute rationalisation *a posteriori* : gain macro-F1 réel vs référence
  (0,438) **> +0,05** → effet solide → AXE1 en production + section « adaptation de
  domaine » ; **+0,02..+0,05** → ambigu (bruit d'étiquetage plausible) → perspective,
  production inchangée ; **< +0,02 ou négatif** → pas d'effet exploitable → J5 conservé.

- **RÉSULTAT — négatif et net** : AXE1 **−0,043**, AXE2 **−0,041**, AXE1+2 **−0,043**
  (réel 0,438 → 0,395). Verdict : **< +0,02 → J5 conservé**, production **inchangée**.

- **1. Le verdict est nuancé — non pas « l'adaptation échoue » mais « non testable
  ici »** : les 242 réels sont **le même domaine** que les 46 du test → en données
  **propres**, en ajouter **devrait aider**. Ça **nuit** (−0,043) → le **bruit
  d'étiquetage** de l'auto-mapping (~13-27 %) **domine** l'effet de domaine.
  L'hypothèse d'adaptation n'est donc **pas réfutée**, elle est **non testable avec
  cet étiquetage auto** ; seule une **relecture manuelle** des 242 pourrait trancher.

- **2. L'enseignement transposable** : **la qualité de l'étiquetage prime sur la
  proximité du domaine.** 242 tickets du **bon** domaine mais **mal étiquetés** font
  plus de mal que de bien → **mieux vaut peu de données propres que beaucoup de
  bruitées.** (À réutiliser pour justifier le flywheel J9, dont les étiquettes sont
  **validées par le technicien** — propres par construction.)

- **3. Le fil rouge synthétique→réel atteint QUATRE niveaux** — quatre démonstrations
  **indépendantes et mesurées** que le corpus synthétique **échoue** à :
  1. **mesurer la performance réelle** — J3 : macro-F1 **0,944 → 0,388** ;
  2. **calibrer la confiance** — J5 : calibrer sur synthétique porte l'ECE réel de
     **0,054 → 0,282** ;
  3. **régler l'abstention** — J5 : un seuil réglé sur le dev synthétique donne
     **~0 abstention utile** sur le réel ;
  4. **sélectionner les hyperparamètres** — J5+ : le dev **saturé (0,970-0,991)**
     choisit `class_weight=balanced` / `C=1.0`, qui **dégradent le réel (−0,041)**.
  → **Enseignement central du projet, désormais étayé quatre fois** : le synthétique
  valide la *chaîne* et les *mécanismes*, jamais la *performance de production* ; seul
  le flywheel sur données réelles (J9) peut combler l'écart.

- **Décisions + méthode (défendables)** :
  1. **Étanchéité renforcée — Jaccard ≥ 0,5** (vs 0,6 standard du harnais).
     Justification : train et test viennent du **même CSV** → c'est le scénario le
     plus risqué pour une fuite ; l'asymétrie des coûts (perdre quelques tickets
     d'entraînement ≪ conclure un gain sur de la contamination) impose la prudence.
     Contrôles : exact **et** approximatif, dédup interne, **fail dur** si un exact
     subsiste. Mesuré : sur 291, **exclus 46 exact** (= exactement le test → preuve),
     3 approx, 0 dédup → **242 retenus**, 0 résiduel.
  2. **Étiquetage automatique d'abord (spot-check avant de payer la relecture)**.
     Mapping tags Kaggle + **lexique d'entités produits** + mots-clés → 5 catégories.
     **Deux itérations**, contrôlées sur échantillons **disjoints** (le seul contrôle
     honnête) : **r1 = 53 % strict / 70 % défendable** → corrections → **r2 = 73 % /
     87 %**. Corrections apportées : (a) **lexique d'entités** (Jira/Zoom→Logiciel,
     MacBook/Dell/Surface/Epson→Matériel, Cisco/AWS→Réseau) pesant autant qu'un tag —
     règle le fourre-tout `Autre` sur titres courts ; (b) **veto visioconférence** :
     `Login Issue`/`Account Assistance` ne déclenchent plus `Accès` sur du Zoom/Teams
     (connectivité) ; (c) **Hardware Failure > Software Bug** (écran tactile → Matériel).
  3. **Une seule itération de mapping** (convenu) : au-delà, on ajusterait les règles
     en regardant les mêmes cas → sur-ajustement du contrôle.
- **Erreur résiduelle identifiée (non corrigée, assumée)** : les tags `Account*`
  (`Account Security`/`Account Assistance`) **sur-déclenchent `Accès`** sur des tickets
  **cloud / facturation / vagues** (3 des 4 fautes du r2). Corrigeable (contexte
  cloud/billing → dévaloriser ces tags), mais **non corrigée** (itération unique).
- **Limites (à documenter au rapport)** : (a) le négatif vaut **pour cet étiquetage
  auto** — il ne dit pas que l'adaptation de domaine échoue, mais que **des étiquettes
  bruitées nuisent** ; (b) **n=46** au test → tendance indicative.
- **Perspective explicite (non réalisée, priorisée après J6-J9)** : **relecture
  manuelle des 242** (coût estimé **~3-4 h**) pour trancher l'hypothèse d'adaptation
  de domaine sur des étiquettes propres. Non faite ici : la priorité va au RAG (J6) et
  aux jalons suivants ; le flywheel (J9) apportera de toute façon des étiquettes
  **validées par le technicien**, ce qui est la voie durable pour combler l'écart.
- **Livrables** : `data/ingest_kaggle_train.py` (ingestion + étanchéité + auto-map),
  `training/experiment_domain_adaptation.py` (4 configs, grille dev, règle pré-enregistrée),
  `ml/real/real_train_kaggle.jsonl` (+ manifeste, spot-checks r1/r2 versionnés),
  rapport `ml/eval/reports/j5_adaptation/`. **Production reste le modèle J5** (non calibré).

### J6 — RAG : recherche hybride + reranker + juge de pertinence validé
- **Date** : 20–26/07/2026. `[établi en séance]`

- **Contexte / ce qui a été fait** : le 4ᵉ barreau (§7) — recherche **hybride** (dense
  pgvector + full-text Postgres, fusion RRF) + **reranker** cross-encoder
  `bge-reranker-v2-m3`, sur la base des tickets résolus. Livrables : migration full-text
  (`20260720225847_ajout_fulltext_tickets` : colonne `tsvector` **générée STORED** +
  index GIN), service `/rerank`, module `retrieval/` (dense/lexical/rrf/rrf_rerank +
  garde anti-fuite), harnais retrieval (Recall@k/MRR/nDCG gradées), **juge de pertinence
  LLM** validé humainement, et **J6b** (génération citée + abstention).

- **Décisions + alternatives + justification** :
  1. **Filtre du corpus indexable = `synthetique AND statut ∈ {RESOLU,CLOTURE}`** (723 docs).
     *Finding de rigueur* : **7 des 9 tickets de bruit de dev sont RESOLU/CLOTURE** → un
     filtre statut SEUL les aurait injectés dans la KB ; c'est le **drapeau `synthetique`**
     qui rend l'exclusion propre.
  2. **Lexical = full-text Postgres** (vs sparse natif bge-m3/FlagEmbedding) → défaut
     conception, aucune dépendance lourde, évite un re-enfer de versions (J4). *Finding* :
     `websearch_to_tsquery` fait du **AND** (0 résultat sur requête multi-mots) → passage à
     une **requête OR des lexèmes** (recall façon BM25, même stemming `french` que la colonne
     générée). GIN emprunté (Bitmap Index Scan, ~3 ms, pas de seq scan).
  3. **RRF 50/50, k=60, NON pondéré** (Cormack 2009). Anti-contamination : régler le poids
     dense/lexical sur le gold le contaminerait ET ajouterait un cas « réglé sur synthétique
     → ne transfère pas ». **3 systèmes rapportés séparément** (dense/lexical/RRF) pour montrer
     la contribution de chaque composant.
  4. **Reranker — découplage ORDRE / SCORE** : le rerank **ne réordonne PAS** l'affichage par
     défaut (`RERANK_ACTIF_DEFAUT=False`) ; il ne sert qu'à **scorer la porte d'abstention**
     (top-1). Réactivable en paramètre (reranker réentraîné au flywheel). Motif mesuré à
     l'ablation (voir « en cours ») : l'ordre fin du rerank aide le synthétique mais nuit au
     réel — à confirmer sur le tableau final.

     > ⚠️ **RECTIFIÉ LE 19/09/2026.** Le découplage ORDRE/SCORE décrit ici était l'**intention**
     > de conception ; il n'a jamais été le comportement livré. Deux erreurs dans ce point.
     > **(a)** `RERANK_ACTIF_DEFAUT` n'était **lue par aucune ligne de code** — une constante
     > morte présentée comme la décision de production. Supprimée le 19/09/2026, remplacée par
     > un commentaire qui décrit l'état réel. **(b)** « Il ne sert qu'à scorer la porte
     > d'abstention » : en pratique il ne sert à **rien** dans l'application, la porte étant
     > fermée par `SEUIL_ABSTENTION_DEFAUT = None` — que rien ne règle, ni variable
     > d'environnement, ni paramètre admin (le registre backend ignore encore
     > `SEUIL_CONFIANCE_IA`, §6.5). Vérifié à l'exécution : `confiance = None` sur 3 puis 6
     > appels `/suggest`. Le reranker ne s'exécute que via `POST /rerank` et le harnais
     > d'évaluation. **Le recâbler suppose de modifier `suggestion.py`**, pas de régler un
     > paramètre. Cf. la section « Correctif — le reranker retiré du préchauffage ».
     >
     > 🔁 **CADUQUE DEPUIS LE 24/09/2026.** La porte est devenue **réglable** (§6.5) : un
     > administrateur l'ouvre depuis l'écran Paramètres, Node transmet le seuil dans la
     > charge utile de `/suggest`, et le reranker s'exécute alors — **pour le SCORE du
     > top-1 seulement**. L'ORDRE d'affichage reste `"rrf"` en dur : le réordonnancement,
     > lui, exige toujours de modifier `suggestion.py`. Cf. « Seuils de confiance IA
     > réglables » en fin de journal.

- **Mesures — dimensionnement production (reranker)** : leçon « **mesurer deux fois,
  système au repos** ». Une 1ʳᵉ mesure donnait **17 s** à K=10/max_length 256 → **artefact**
  (contention CPU juste après chargement du modèle) ; deux runs propres concordent :
  **K=10 @ 256 = 4,08 s** (min 4,05 / max 4,28, **stable**) — **sous le budget CDC < 5 s**,
  même sur requête longue. K=20 @ 256 = 10,6 s ; **max_length 512** = ~2-3× plus lent **et
  instable** (pic 31 s) → **256 retenu**. ≈ **410 ms/paire** sur ce CPU (**torch 2.2 CPU-only** ;
  perspective : GPU/torch-CUDA ≈ 30-50 ms/paire, écarté — rouvrirait l'enfer de versions J4).
  **Décision NFR** : `K_prod=10`, `max_length=256`, rerank **off par défaut** (RRF seul immédiat).

- **Juge de pertinence — validé humainement (le verrou avant les métriques)** :
  - Corpus **sans structure de récurrence** (99 % descriptions uniques) → aucune vérité-terrain
    de pertinence naturelle → on juge la pertinence gradée (0/1/2) par **LLM local**
    (`qwen2.5:14b`, température 0, sortie structurée), **validé contre 25 jugements humains**
    (sinon circulaire, §10).
  - **Protocole défendable** : notation **aveugle** (κ honnête), **rubrique identique mot pour
    mot** juge/humain (source unique `RUBRIQUE` + exemple d'ancrage grade-1), **25 paires
    construites depuis le retrieval** (rang/catégorie), **anti-circularité** (le niveau attendu
    ne vient jamais de la note du juge). Construction **équilibrée 8/9/8** — L1 tiré au **rang
    intermédiaire du dense** (un 1ᵉʳ essai « même catégorie au hasard » donnait surtout des 0 :
    corrigé **avant** collecte des labels humains).
  - **Résultat** : **κ_w quadratique = 0,954** (« quasi-parfait » Landis-Koch ; seuil
    pré-enregistré 0,60) → **juge VALIDÉ**. κ non pondéré 0,866 ; **23/25** accords exacts ;
    **2 désaccords**, tous deux d'un cran (humain 2 / juge 1) sur des **quasi-doublons**,
    **aucun désaccord franc 2↔0** (juge légèrement plus conservateur = biais sûr).
  - **Limite honnête** : distribution humaine {0:10, 1:2, 2:13} — **grade-1 peu échantillonné**
    → le κ valide surtout **pertinent / non-pertinent** (κ binaire = 1,000, ce qui importe pour
    le RAG) ; la nuance intermédiaire est moins testée. Validé sur requêtes **internes courtes** ;
    extrapolation aux e-mails longs supposée (garde-fou : relire des paires externes pendant le
    run). Rapport versionné `ml/eval/reports/j6/judge_validation.{md,json}`.

- **J6b — génération citée + abstention (mécanisme, validé à l'exécution)** :
  - **Génération** : `qwen2.5:14b` local (local-first, CDC §10) synthétise une résolution
    **ancrée** dans les tickets retrouvés, avec **citation des #id** ; **contrôle
    anti-hallucination** (ne garde que les #id réellement fournis).
  - **Abstention** : mécanisme codé, **seuil NEUTRE par défaut (`None`)** → montre tout, aucun
    silence arbitraire ; **cohérence J5** (aucun seuil figé sur synthétique, réglage = flywheel).
    Deux chemins : (a) confiance < seuil (inactif tant que seuil=null) ; (b) **grounding** — si
    la génération ne cite aucune source valide → « aucune suggestion pertinente » **plutôt
    qu'inventer**.
  - **Démo (3 requêtes externes réelles)** : **imprimante HP** (stries) → **abstention** ;
    **écran Dell** (clignotement) → **abstention** ; **Wi-Fi MacBook** → **suggestion citée**
    `[#753, #239]`. Les deux abstentions viennent de la **porte de grounding** (le RRF a bien
    retrouvé des tickets, mais le générateur a refusé de citer/inventer) — **comportement de
    sécurité central** : suggère quand il sait, se tait quand il ne sait pas. Latence génération
    ~15-30 s (14B local) → **suggestion à calculer en asynchrone** (hors chemin synchrone < 5 s).

- **J6a — Ablation retrieval (CLÔTURE, 28/07/2026)** : le tableau final, mesuré sur la
  pertinence gradée jugée par LLM (1486 jugements en cache, juge validé κ_w 0,954) via
  `eval/run_retrieval.py` (classements re-calculés puis **cachés** → régénération instantanée).
  **Qualité de la mesure** : couverture du pool top-5 **gold 100 % / réel 98,5 %**, **0 fuite
  exacte** → fiable. *Caveat réel* : seules **25/46** requêtes réelles ont un doc pertinent
  dans la KB synthétique (21 sans analogue → territoire d'abstention J6b) → n=25, indicatif.

  | Variante | nDCG@5 gold | nDCG@5 **réel** | R@5 réel | MRR réel |
  |---|---|---|---|---|
  | dense | 0,953 | **0,518** | 0,520 | 0,589 |
  | lexical | 0,885 | **0,196** | 0,177 | 0,277 |
  | rrf | 0,940 | **0,478** | 0,512 | **0,615** |
  | rrf_rerank | 0,951 | **0,487** | 0,534 | 0,555 |

  - **Effet rerank FAIBLE et AMBIGU** (Δ = rrf_rerank − rrf) : gain marginal sur nDCG/Recall
    (**même réel** : +0,009 nDCG, +0,023 Recall) mais **perte sur MRR réel (−0,060)**. Pas de
    « nuit clairement ». → **Décision `RERANK_ACTIF_DEFAUT=False` motivée non par « le rerank
    nuit » mais par un rapport bénéfice/coût défavorable** : gain minuscule (~0,01) vs coût
    latence élevé (~8 s/requête, dépasse le budget CDC sur requête longue). Le rerank reste
    disponible pour le **score d'abstention** (top-1). **Corrige l'hypothèse J6a antérieure
    (« rerank nuit sur réel »)**, qui était basée sur moins de données (commentaire
    `retrieval/config.py` mis à jour en conséquence).

    > ⚠️ **RECTIFIÉ LE 19/09/2026.** Le raisonnement bénéfice/coût reste valable et les chiffres
    > d'ablation sont intacts ; c'est sa **traduction en code** qui n'a jamais eu lieu. La
    > « décision `RERANK_ACTIF_DEFAUT=False` » portait sur une constante que personne ne lisait,
    > et « le rerank reste disponible pour le score d'abstention » décrit une porte qu'aucune
    > configuration n'ouvre. Formulation exacte à retenir pour le rapport : **le reranker est
    > livré et fonctionnel, mais hors du chemin par défaut** — non câblé dans la chaîne de
    > suggestion. Deux nuances à ne pas perdre en soutenance : l'échantillon réel utile de
    > l'ablation est **n=25**, pas 46 (21 requêtes sans analogue dans la KB) ; et le coût
    > « ~8 s/requête » était de la prose, sans artefact — **mesuré depuis** à **6,86 s** à
    > chaud (K=20, `max_length=512`, 20 documents réels), cf. « Le coût du reranker, enfin
    > mesuré ». L'ordre de grandeur était bon ; le chiffre exact ne l'était pas.
  - **Ce que l'ablation confirme fortement, c'est le fil rouge** (sémantique vs surface,
    cf. J7) : le **lexical (surface) s'effondre sur le réel** (nDCG@5 **0,885 → 0,196**,
    MRR 0,277) tandis que le **dense (sémantique) porte le réel** (0,518). La **fusion RRF**
    ≈ dense sur gold, un peu sous dense en nDCG réel (le lexical mort le dilue) mais **meilleur
    MRR réel** (0,615) → robustesse du 1er hit à coût nDCG minime. Le **synthétique reste un
    plancher trompeur** (nDCG gold ~0,94 pour tous, réel bien plus bas).
  - **J6c** : courbe **couverture/précision** de l'abstention (gold + externe) livrée comme
    **artefact** (compromis montré sans figer de seuil ; opérationnel = flywheel).

- **J6 CLOS** (28/07/2026) : retrieval hybride + reranker + juge validé + génération citée/
  abstention (J6b) + **ablation mesurée (J6a)** + courbe d'abstention (J6c). Livrable
  d'ablation : `eval/run_retrieval.py`, rapport versionné `ml/eval/reports/j6/retrieval_ablation.*`.

### J7 — Priorisation : scorecard glass-box vs LLM (le fil rouge se NUANCE)
- **Date** : 27/07/2026. `[établi en séance]`

- **Contexte / ce qui a été fait** : 5ᵉ barreau (§6) — priorité en **scorecard additif
  explicable** (`ml/smart_ticketing_ml/priority/` : `lexicon.py` config gelée +
  `scorecard.py` moteur pur), livré comme composant de production, et **mesuré contre
  un foil LLM boîte-noire**. Harnais J7 (`eval/priority.py` = κ pondéré + accuracy ±1 ;
  `eval/priority_llm.py` = prédicteur few-shot local ; `eval/run_priority.py` =
  orchestrateur + rapport). **Quatre prédicteurs** comparés sur **deux jeux** (gold
  synthétique 102 · externe réel 46), métrique de tête **κ pondéré quadratique** (accord
  ordinal avec les labels relus main de Fedi). Rapport versionné `ml/eval/reports/j7/`.

- **RÉSULTAT CENTRAL — mon hypothèse est RÉFUTÉE, et c'est le résultat le plus
  précieux du jalon.** Tableau κ pondéré (gold synthétique → externe réel) :
  | Prédicteur | gold | réel | écart |
  |---|---|---|---|
  | Classe majoritaire (MOYENNE, plancher) | 0,000 | 0,000 | +0,000 |
  | Priorité-source (label amont brut) | 0,604 | 0,612 | −0,008 |
  | **Scorecard glass-box (surface littérale)** | **0,226** | **0,158** | +0,068 |
  | **LLM few-shot (sémantique, qwen2.5:14b)** | **0,456** | **0,784** | **−0,329** |
  L'hypothèse pré-enregistrée « **les règles explicites transfèrent mieux que
  l'apprentissage** » est **fausse pour la priorité** : en niveau absolu sur le réel, le
  LLM (0,784) **écrase** le scorecard (0,158). Le LLM est même **meilleur sur le réel que
  sur le synthétique** (acc±1 = **1,000**, **0 désaccord ≥ 2 crans**, distribution prédite
  collée à la vérité → vérifié non-artefact).

- **Le fil rouge s'AFFINE — le clivage du transfert n'est pas appris/explicite mais
  SÉMANTIQUE/SUPERFICIEL.** Ce qui saisit le **sens contextuel** transfère (retrieval
  `bge-m3` J6 ; LLM de priorité) ; ce qui traite la **surface** échoue (classification sur
  vocabulaire synthétique J3/J5 ; scorecard sur mots-clés **littéraux**). Nuance de
  rigueur : sur l'axe de l'**écart**, le scorecard explicite **ne s'effondre pas** (+0,068,
  vs classifieur *appris* de J3 : +0,556) — il est **uniformément faible**. Ce qui est
  réfuté, c'est « explicite = *compétitif* sur le réel ».

- **Le synthétique est un proxy NON FIABLE — il trompe dans les DEUX sens.** « Le
  synthétique cache la difficulté » vaut pour le **scorecard** (0,226 > 0,158) mais
  **s'inverse pour le LLM** (0,456 < 0,784 : le réel lui est *plus facile*, emails riches
  en contexte vs tickets synthétiques one-liners ambigus). Le synthétique ne prédit donc
  pas la performance réelle **ni à la hausse ni à la baisse** — raffinement du fil rouge
  (jusqu'ici il n'était vu que comme *plafond* trompeur).

- **Mode d'échec du scorecard (mesuré, pas supposé)** : **sous-prédiction** dominante —
  **24/46** vrais HAUTE/CRITIQUE tombent en MOYENNE car la gravité réelle s'exprime **par
  le contexte** (« écran qui affecte gravement l'utilisabilité », « authentification AWS »)
  sans mes mots-clés littéraux → base seule. Effet secondaire : déclenchement **fortuit**
  (un mot-clé présent dans le boilerplate d'un email ≠ le problème). **Pas** de
  sur-prédiction sur « urgent » : ce piège (tout email poli dit « urgent ») a été
  **pré-empté par conception** — urgence auto-déclarée pondérée +0,5 seulement.

- **Décisions + alternatives écartées + justification** :
  1. **Scorecard glass-box en production vs LLM-décideur** → **glass-box conservé**.
     Le technicien voit **pourquoi** (décomposition facteur par facteur, §6.5) et peut
     **corriger** — valeur produit. Le LLM, plus juste, est **opaque**. **Arbitrage
     transparence vs robustesse** = planche de soutenance de premier ordre. Le LLM est
     gardé comme **foil de mesure**, pas mis en production décisionnelle.
  2. **Poids/seuils posés A PRIORI, jamais optimisés sur le test** (`lexicon.py` gelé,
     en-tête daté). Chaque poids = justification **métier** (impact large → fort ; urgence
     auto-déclarée → faible car sur-utilisée ; etc.). **Catégorie = mapping bon-sens IT
     indépendant** (pas les priors liés à la génération synthétique → évite un confond
     same-origin). **Seuils ronds** (1,0 / 2,5 / 4,0) par répartition IT attendue.
     Alternative écartée : caler poids/seuils sur des quantiles du gold → **optimisation
     sur le test**, refusée (6ᵉ fois que le piège se présente dans le projet).
  3. **Analyse de sensibilité ±1 sur les seuils** (artefact de robustesse) : **aucun
     décalage ne sauve** le scorecard (meilleur = −1,0 → 0,289, loin du LLM) → l'échec
     n'est **pas** un artefact de seuil.
  4. **Plafonnement par famille explicable** (urgence [−1, +4], impact [0, +3]) : borne le
     score sans masquer la décomposition (« CRITIQUE (plafonné) car … »).
  5. **Catégorie VRAIE en entrée** (pas la prédite J5) → isole la logique de priorité de
     l'erreur du classifieur.
  6. **Foil LLM local-first** (qwen2.5:14b, temp 0, sortie structurée, caché/reprenable) —
     cohérent CDC §10, aucun appel externe. **4 exemples few-shot ÉCRITS À LA MAIN** (pas
     du train, ni du gold, ni des 46 externes ; étanchéité vérifiée), ancrés sur la
     **source unique** `taxonomy.PRIORITY_DEFINITIONS` (mêmes critères que la relecture
     du gold et que le scorecard).

- **Décision de production** : **scorecard conservé** (explicabilité), **NON réparé** — le
  réparer reviendrait à optimiser sur le test. Poids/seuils exposables en **paramètres
  admin** (§6.5) ; le **réglage sur données réelles est délégué au flywheel J9** (mêmes
  posture qu'en J5 pour la calibration/abstention).

- **Enseignements / limites** :
  - **n=46** au réel → tendances **indicatives**, pas de conclusion statistique par classe.
  - **Rubrique partagée** : le LLM et Fedi appliquent les **mêmes** `PRIORITY_DEFINITIONS`
    → l'accord élevé (0,784) est **en partie attendu** (légitime, cf. validation du juge
    J6 ; **non circulaire** : Fedi n'a jamais vu les sorties du LLM).
  - **Valeur soutenance** : le contraste **glass-box transparent mais fragile** vs **LLM
    opaque mais robuste** est une planche de premier ordre, et le fil rouge affiné
    (sémantique vs surface) unifie J3, J5, J6 et J7.
  - **Livrables** : `priority/` (scorecard + config gelée), harnais J7 (`eval/priority.py`,
    `priority_llm.py`, `run_priority.py`), rapport de référence `ml/eval/reports/j7/`
    (4 prédicteurs × 2 jeux, matrices, sensibilité, décompositions, démo SLA).

### J7b (préparation de l'intégration IA) — Alignement du workflow métier du ticket
- **Date** : 28/07/2026. `[établi en séance]`
- **Contexte** : bascule du module IA (labo `ml/`) vers son **intégration dans l'application**.
  Avant de brancher l'IA, le workflow du ticket est **aligné sur le processus métier cible**
  — l'IA se greffera sur ces étapes (classification/priorité à la création, RAG au traitement,
  validation technicien → flywheel à la résolution).
- **Inventaire préalable (état des lieux, mesuré)** : à ce stade, **aucun pont IA** n'existait
  — le microservice FastAPI n'exposait que `/embed`, `/rerank`, `/sante` ; les modules
  classification / priorité / RAG vivaient comme **librairies** appelées par les harnais d'éval,
  **jamais servies en HTTP ni appelées par Node** (le RAG `suggerer` prend même un
  `psycopg.Cursor` en argument) ; la table `SuggestionIA` (au schéma) restait **inutilisée** ;
  l'UI n'affichait qu'un **placeholder** « Assistant IA — Phase 5 ». Aucun `SERVICE_IA_URL`,
  aucune route `/ia`, le service `ml/` **absent du docker-compose**.
- **Workflow cible (décidé en séance, machine à états LINÉAIRE)** :
  `NOUVEAU ──assignation(admin)──▶ EN_ATTENTE ──prise en charge(tech. assigné)──▶ EN_COURS
  ──résolution(tech. assigné)──▶ RESOLU ──validation(demandeur) | clôture(admin)──▶ CLOTURE`
- **Écarts corrigés par rapport au code Epic 2** :
  1. L'assignation par l'admin pose **EN_ATTENTE** (auparavant : passage direct EN_COURS).
     Réassignation → repasse EN_ATTENTE ; désassignation → repasse NOUVEAU.
  2. Nouvelle action **« prendre en charge »** (technicien assigné) : EN_ATTENTE→EN_COURS,
     **distincte** de l'assignation. L'auto-assignation par le technicien est **retirée**
     (désormais l'admin assigne).
  3. **CLOTURE découplée de la résolution** : le technicien pose RESOLU ; la CLOTURE est un
     acte séparé — validation du demandeur **ou** clôture directe de l'admin (client absent).
     Un **technicien seul ne clôture pas**.
  4. Nouvelle action **« corriger la catégorie »** (technicien assigné ou admin, hors CLOTURE) :
     trace un événement `CHANGEMENT_CATEGORIE` (ancienne→nouvelle) → **socle du flywheel J9**
     (capture « l'IA suggérait X, l'humain a choisi Y »).
- **Permissions cibles** (contrôle en couche service) : créer = employé (devient demandeur) ;
  assigner = admin seul ; prendre / résoudre = technicien assigné seul ; valider→CLOTURE =
  demandeur seul ; clôturer directement = admin seul ; corriger catégorie = technicien assigné
  ou admin ; commenter = demandeur / technicien assigné / admin (supervision).
- **Décisions notables + justification (formulées en séance)** :
  1. **Graphe linéaire strict** (retrait des sauts type NOUVEAU→RESOLU et de toute réouverture).
     **CLOTURE terminal** → **limite assumée : un problème récurrent donne lieu à un NOUVEAU
     ticket** (simplicité de raisonnement, pas de retour arrière dans le cycle).
  2. **Note de satisfaction verrouillée après CLOTURE** → intégrité des données (une évaluation
     ne se réécrit pas après archivage).
  3. **Actions nommées par intention** plutôt qu'un endpoint générique `PATCH /statut` : chaque
     arête a un acteur et des effets de bord propres ; le endpoint générique laissait un
     technicien poser CLOTURE (contournement des droits) → **retiré**.
  4. **3 rôles conservés** : le « client » = l'EMPLOYE demandeur (pas de 4ᵉ rôle).
- **Réalisation** :
  - **Backend** : machine à états resserrée (`TRANSITIONS_STATUT` linéaire + garde
    `verifierTransition`) + prédicats de permission atomiques
    (`estAdmin` / `estTechnicienAssigne` / `estDemandeur`) ; actions `prendreEnCharge` /
    `resoudre` / `cloturer` / `changerCategorie` ; `affecter` réécrit (admin seul, →EN_ATTENTE,
    réassign→EN_ATTENTE, désassign→NOUVEAU) ; `evaluerSatisfaction` verrouillé après clôture ;
    endpoints `POST /:id/prise-en-charge|resolution|cloture`, `PATCH /:id/categorie` ;
    `PATCH /:id/statut` **retiré** ; nouveaux événements `PRISE_EN_CHARGE` / `CHANGEMENT_CATEGORIE`.
    **Zéro migration** (enums, colonne `categorieId` et type `EvenementTicket` string déjà présents).
  - **Statistiques** : le « délai de prise en charge » se calcule désormais sur l'événement
    `PRISE_EN_CHARGE` (et non plus `AFFECTATION`).
  - **Frontend** : action principale **contextuelle** (rôle × statut) dans l'en-tête ; statut en
    **lecture seule** (piloté par les actions) ; sélecteur de catégorie éditable (recatégorisation) ;
    bloc satisfaction « Valider et clôturer » sans édition post-clôture ; auto-attribution
    technicien retirée ; fil d'historique enrichi des deux nouveaux événements.
- **Vérification** : type-check backend + frontend au vert ; **parcours bout-en-bout**
  (NOUVEAU → EN_ATTENTE → EN_COURS → RESOLU → CLOTURE) validé manuellement en séance.
- **Limites / à compléter** : `[À COMPLÉTER PAR FEDI]` — justification métier fine du choix
  « workflow linéaire strict » vs. graphe flexible (au-delà de la simplicité de raisonnement) ;
  opportunité d'une réouverture encadrée si l'exploitation en fait apparaître le besoin.
- **Suite (greffe IA sur ce socle)** : classification + priorité à la création (NOUVEAU),
  suggestion RAG au traitement (EN_COURS), capture de la validation technicien → flywheel (RESOLU).

### Greffe 1 (intégration IA) — Classification + priorité à la création
- **Date** : 28/07/2026. `[établi en séance]`
- **Contexte** : première greffe de l'IA **dans l'application** (le module `ml/` cesse
  d'être un labo). Point d'accroche = l'étape **NOUVEAU** (création) : à la création,
  l'IA **suggère** une catégorie et une priorité, visibles immédiatement sur le détail
  du ticket (effet synchrone démontrable).
- **Posture structurante — SUGGÈRE, pas impose** : l'IA écrit des lignes `SuggestionIA` ;
  le technicien valide/corrige (via `changerCategorie`/`changerPriorite`). Ce n'est pas
  cosmétique : le **flywheel J9 repose sur la comparaison « IA a suggéré X / humain a
  choisi Y »** — imposer la catégorie supprimerait la suggestion à comparer, donc le
  signal, donc J9. « Suggère » est **indispensable au mécanisme**, pas un choix de style.
- **Architecture — frontière de service** : le microservice Python reçoit du **TEXTE**,
  renvoie du **JSON**, ne touche **jamais** la base. Deux endpoints ajoutés :
  - `POST /classify` (titre, description) → catégorie top-1 + confiance + probabilités
    par classe + **embedding 1024d** (renvoyé pour que **Node** le persiste — le service
    reste sans DB). **Pas d'abstention appliquée** (seuil non figé, posture J5) ; modèle
    figé absent → 503.
  - `POST /priority` (titre, description, catégorie) → décision **scorecard glass-box**
    (niveau + score + décomposition + explication). `age=0` à la création → pas de terme
    d'ancienneté.
  - *Correction de rigueur (trouvée en séance)* : le classifieur sort des noms
    **accentués** (« Réseau »…) ; la scorecard indexe `BASE_CATEGORIE` sur ces **mêmes**
    noms → base correcte (Réseau = 1.5) vérifiée de bout en bout sur HTTP. Un décalage
    d'accent aurait silencieusement fait retomber **chaque** priorité sur la base par défaut.
- **Pont Node → Python** (`ia.service.ts`) : client HTTP avec **AbortController**
  (timeout `IA_TIMEOUT_MS`, défaut 4 s) ; `enrichirTicket` **best-effort** — ne rejette
  **jamais** (même patron que `notification.service`). Inséré dans `creer()` : **ticket
  committé d'abord**, puis enrichissement **non bloquant**, puis refetch.
- **Ordre synchrone** : classify → **Node écrit l'embedding** (`$executeRaw`,
  `'[…]'::vector` — Prisma ne sait pas écrire le type `Unsupported`) → résolution
  nom→`categorieId` (catégories **dynamiques** ; label absent = modèle périmé →
  abstention) → `SuggestionIA(CLASSIFICATION)` → priority (avec la catégorie,
  **dépendance J7**) → `SuggestionIA(PRIORISATION)`.
- **Dégradation gracieuse par étage (le point critique)** : le ticket **se crée
  toujours**. Service down/timeout ou `/classify` KO → 0 suggestion, priorité **sautée**
  (« le couple catégorie+priorité, ou rien »). Nom introuvable → abstention. Écriture
  embedding KO → log + on continue (rattrapable par `backfill.py`). `/priority` KO → la
  CLASSIFICATION reste persistée. Filet global : `enrichirTicket` enveloppé try/catch.
  Un service **arrêté** échoue **immédiatement** (connexion refusée) → la création
  n'attend pas le timeout ; celui-ci ne joue que si le service **pend**.
- **Migration `SuggestionIA`** (`20260728090000_ajout_details_suggestion_ia`, appliquée
  par `migrate deploy`, **non destructive**) : `scoreConfiance` rendu **nullable** (la
  scorecard déterministe n'a **pas** de probabilité → on n'en **fabrique pas** une fausse)
  + colonne **`details Json?`** (foyer de la décomposition glass-box §6.5 et des
  probabilités par classe — sans quoi l'explicabilité serait perdue).
  - CLASSIFICATION : `contenu`=nom catégorie ; `scoreConfiance`=proba top-1 ;
    `details`={categorieId, probabilites, modeleEmbedding}.
  - PRIORISATION : `contenu`=niveau ; `scoreConfiance`=**null** ; `details`=décomposition
    complète (niveau, score, explication, contributions, plafonnements).
- **Affichage minimal** (détail ticket) : panneau « Assistant IA » réel (remplace le
  placeholder « Phase 5 ») — catégorie suggérée + **confiance affichée telle quelle**
  (glass-box : l'IA dit honnêtement son incertitude) + priorité + décomposition
  « … car : production +2 · Réseau +1.5 » + mention « suggestions non contraignantes,
  à valider ou corriger ».
- **Vérification bout-en-bout (à l'écran, en séance)** : création d'un ticket VPN → le
  panneau affiche **Réseau (confiance 63 %)** + **Critique** avec la décomposition
  complète (« CRITIQUE (plafonné) car : production +2 · en production +2 · tout le
  service +2 · Réseau +1.5 · bloqué +1 »). Serving prouvé en réel (import sans cycle,
  `/classify` + `/priority` sur HTTP), pont type-check OK, dégradation raisonnée par étage.
- **Dimensionnement production** :
  - **Warm-up** : bge-m3 (~2,3 Go) + classifieur se chargent **paresseusement au 1ᵉʳ
    `/classify`** → première requête lente (**30-60 s à froid** ; mesuré **8 s** en séance,
    poids déjà en cache disque). **Consigne soutenance** : **préchauffer** le service au
    démarrage (un `/classify` à vide) pour que le premier ticket présenté au jury soit
    instantané.
  - **À chaud** : embed CPU ~100-400 ms (cf. J4) + scorecard ~ms + 2 écritures DB →
    **bien sous le budget CDC < 5 s**. Le timeout `IA_TIMEOUT_MS` borne le pire cas ; un
    service arrêté échoue immédiatement (pas d'attente de 4 s).
- **Limites / à compléter** :
  - **Confiance modeste** sur texte réel court (63 % ici ; ~0,35-0,44 sur d'autres essais)
    — **attendu** : le classifieur est entraîné sur le synthétique (fil rouge J3/J5). La
    confiance affichée est **honnête**, pas un défaut ; le seuil d'abstention reste **non
    figé** (J9, dev réel).
  - **Dockerisation du microservice reportée** à la phase DevOps (Dockerfile lourd :
    torch + modèle ~2,3 Go + artefact `classifier_*.joblib` gitignored à monter/produire).
    En dev : `uvicorn` lancé à part. `docker-compose` a `ollama` mais pas encore le
    service FastAPI. `[À COMPLÉTER PAR FEDI : Dockerfile service IA — torch + modèles
    (stratégie artefact `.joblib`) + **Tesseract OCR** (conteneur Linux :
    `apt-get install tesseract-ocr tesseract-ocr-fra`, J8bis) ; à traiter d'un bloc en
    phase DevOps]`
- **Suite** : **Greffe 2** — suggestion RAG **asynchrone** à l'étape EN_COURS (génération
  15-30 s, hors chemin synchrone) ; **Greffe 3** — capture de la validation technicien →
  flywheel (triplet `SuggestionIA` + événement `CHANGEMENT_CATEGORIE`/`CHANGEMENT_PRIORITE`
  + `valideeParTechnicien`).
- **Livrables** : `service/predictors.py`, `service/app.py` (`/classify`, `/priority`,
  `/sante` enrichi), `service/config.py` (`CLASSIFIER_PATH`), migration
  `…_ajout_details_suggestion_ia`, `services/ia.service.ts`, `config/env.ts`
  (`SERVICE_IA_URL`/`IA_TIMEOUT_MS`/`IA_ACTIVE`), `repositories/categorie.repository.ts`
  (`findByNom`), include détail étendu (`suggestionsIA`), panneau UI (`TicketDetailPage.tsx`),
  types front (`SuggestionIA`, `DetailPrioriteIA`).

### Greffe 2 (intégration IA) — Suggestion RAG asynchrone (étape EN_COURS)
- **Date** : 28-29/07/2026. `[établi en séance]`
- **Contexte** : deuxième greffe — productiser le RAG **J6** (recherche hybride RRF +
  génération citée + abstention) dans l'application, à l'étape **EN_COURS** (le technicien
  traite le ticket). L'IA **suggère** une résolution ancrée sur des tickets passés résolus ;
  le technicien valide/écarte.
- **Architecture — un `/suggest` qui LIT la KB (raffinement de frontière)** : contrairement
  à `/classify` et `/priority` (Greffe 1, sans DB), le RAG **doit lire** la base (chercher
  dans les tickets résolus). Décision assumée : **le service RAG LIT la KB (recherche), il
  n'ÉCRIT jamais** — Node reste seul écrivain. Inhérent au RAG, pas une entorse. Le endpoint
  réutilise `hybrid.connexion()` + `suggestion.suggerer` (code J6, un seul appelant : safe à
  enrichir → ajout des `similaires` sans retrieval en double).
- **L'ASYNC (le point structurant)** : la génération prend **15-30 s** (Ollama qwen2.5:14b)
  → **jamais dans le chemin de réponse HTTP**.
  - Migration `SuggestionIA.statut` (défaut `PRETE` ; les suggestions synchrones de Greffe 1
    restent PRETE). Pour la SOLUTION : **EN_COURS → PRETE/ECHEC**.
  - Flux : `POST /tickets/:id/suggestion` → crée la ligne SOLUTION EN_COURS + **répond 202
    immédiat** ; puis `void genererSuggestion(...)` **fire-and-forget** (non attendu) appelle
    `/suggest` (timeout dédié `IA_SUGGESTION_TIMEOUT_MS`=60 s, distinct des 4 s de Greffe 1)
    et met la ligne à PRETE (texte + sources + similaires) ou ECHEC. **Le clic (~ms) et la
    génération (30 s) ne se confondent jamais.**
  - **UI = polling** (choix : simple, pas de SSE) : tant que la ligne SOLUTION est EN_COURS,
    la page refetch toutes les ~3,5 s ; dès PRETE/ECHEC, **arrêt** (dépendance = la primitive
    `statut`, pas de boucle infinie).
- **Déclencheur** : **bouton « Suggérer »** (à la demande, pas d'auto sur EN_COURS → pas de
  RAG gaspillé). Réservé au **technicien assigné ou admin**, **ticket EN_COURS uniquement**.
- **KB = synthétique (723 résolus)** pour l'instant ; les vrais tickets résolus n'y entrent
  pas encore (filtre `synthetique AND RESOLU/CLOTURE`) → **Greffe 3** (récolte des résolutions
  validées).

- **LES 4 COMPORTEMENTS OBSERVÉS À L'ÉCRAN (documentés sans maquillage)** :
  1. **Pertinent** (ticket VPN #866) : suggestion **actionnable**, sources = **vrais** tickets
     VPN de la KB. Cas nominal.
  2. **Bruit léger du retrieval filtré par le LLM** (Imprimante #868) : le retrieval remonte
     un **voisin bruité** (#837, non pertinent), mais le **LLM ne le cite pas** → solution
     correcte. Illustration directe de l'**architecture à deux étages** (voir enseignement).
  3. **Sur-connexion de surface — abstention NON déclenchée** (Réservation salle #867) :
     requête **hors domaine** (réserver une salle ≠ problème IT). Le retrieval remonte des
     tickets « **port réseau salle réunion** » (#327/#375) par recouvrement de **surface**
     (« salle de réunion »), et le LLM **rationalise** en réinterprétant « confirmer la
     disponibilité » en « vérifier la connectivité réseau ». **Grounding OK** (sources réelles
     citées, pas d'hallucination au sens strict), mais **pertinence spurious**. **Cas-limite
     ASSUMÉ** (cf. décision seuil). NB : une requête voisine avec « …commander un plateau
     repas » abstenait bien (étape 1) → **l'abstention est sensible à la formulation, pas une
     garantie dure**.
  4. **Échec** (service Python coupé) : ligne → **ECHEC**, UI « Suggestion indisponible +
     Réessayer ». Dégradation propre, ticket intact.

- **Enseignement architectural — RAG à DEUX ÉTAGES** : **retrieval = RAPPEL** (large, peut
  sur-générer des voisins bruités ou topiquement adjacents — cf. #837, #327/#375) ;
  **LLM = PRÉCISION de synthèse** (filtre le bruit, ne cite que le pertinent — cf. #868). Les
  cas #868 (filtre le bruit) et #867 (ne filtre PAS la sur-connexion de surface) **délimitent
  ensemble** ce que le LLM sait faire (écarter un voisin franchement hors-sujet) et ne sait
  pas faire (résister à un recouvrement de surface qui lui offre un pont plausible). C'est le
  **fil rouge sémantique vs surface** dans une nouvelle forme.

- **Décision — seuil d'abstention à `None` (non figé)** : le levier qui attraperait #867 est
  le **seuil de la porte reranker (top-1)**. Il est **délibérément à `None`**. Le régler sur
  du synthétique reproduirait exactement le piège prouvé en J5/J6 (« réglé sur synthétique →
  ne transfère pas »). **On ne le tune pas** ; son réglage attend un **dev réel = flywheel
  J9**. Ne pas « réparer » #867 est la décision **rigoureuse**, pas de la paresse.

- **Le garde-fou = SUGGÈRE + validation humaine** : la posture (l'IA suggère, le technicien
  valide, mention « à valider par le technicien ») est **exactement** ce qui neutralise #867 —
  un technicien écarte la suggestion d'un coup d'œil. Le cas #867 est la **démonstration
  vivante** de pourquoi glass-box + human-in-the-loop sont nécessaires (planche de soutenance).

- **Dimensionnement** : latence **26 s à chaud / 52 s à froid** (chargement bge-m3 + RRF +
  génération) → confirme l'**async obligatoire**. **Warm-up** identique à Greffe 1 : pré-chauffer
  le service (un `/suggest` à vide) avant la démo. Dépendances runtime : **Ollama qwen2.5:14b**
  (génération) + **`DATABASE_URL`** (lecture KB).

- **Limites (à documenter au rapport)** : (a) KB **synthétique** (réel = Greffe 3) ;
  (b) **abstention sensible à la formulation**, pas une garantie — le seuil calibré (qui
  durcirait la porte) attend le flywheel ; (c) **mono-instance** : le fire-and-forget suffit
  en dev/démo ; une vraie file de jobs serait un sujet de **passage à l'échelle** (une ligne
  SOLUTION laissée EN_COURS par un redémarrage Node est réinitialisée au re-clic).

- **Livrables** : `retrieval/suggestion.py` (+`similaires`), `service/app.py` (`/suggest`),
  migration `…_ajout_statut_suggestion_ia`, `ia.service.ts` (`demarrerSuggestion` +
  `genererSuggestion` fire-and-forget + timeout paramétré), `ticket.service.ts`
  (`demanderSuggestion`), controller + route `POST /:id/suggestion` (202), `ticketsApi.ts`,
  panneau RAG + polling (`TicketDetailPage.tsx`), types front (`SuggestionIA.statut`,
  `DetailSolutionIA`).

- **Suite** : **J8** — résumé automatique (CDC §6.3) ; puis **J8bis** OCR (encadrant) ;
  **Greffe 3** flywheel (récolte KB réelle + capture validation).

### J8 — Résumé automatique du fil (async)
- **Date** : 29-30/07/2026. `[établi en séance]`
- **Contexte** : exigence **CDC §6.3**. Objectif : un technicien qui reprend un ticket au
  **fil long** sait « où on en est » sans tout relire. **Ce qu'on résume = le FIL**
  (description + commentaires) — un ticket n'est « long » que par son échange ; la
  description seule est souvent déjà courte. Le résumé de clôture (KPI) = bonus secondaire,
  hors du cœur de J8.
- **Méthode — MESURER avant de trancher sync/async** : chronométré un vrai résumé
  (qwen2.5:14b, température 0) → **55 s à froid / 21 s à chaud** (fils de 6/5 messages). Les
  deux ≫ 8 s → **décision : ASYNC**. La mesure valide **deux choses d'un coup** : la latence
  (async obligatoire) ET la qualité (les 2 résumés produits étaient déjà fidèles, zéro
  invention → le prompt était bon avant même de coder l'UI).
- **Réutilisation intégrale du socle Greffe 2** : même patron async — `SuggestionIA` type
  **`RESUME`**, `statut` EN_COURS→PRETE/ECHEC, `demarrerResume`/`genererResume`
  **fire-and-forget**, **202 immédiat**, polling. **ZÉRO migration** (type `RESUME` + champ
  `statut` déjà en place depuis Greffe 2).
- **Serving `/summarize`** (texte in, JSON out, **SANS DB**) : contrairement au RAG (qui lit
  la KB), le résumé n'a **aucune** lecture base — seulement `titre + description + messages[]`
  → génération Ollama. Module `summarize.py` (prompt + `resumer`).
- **Prompt anti-hallucination (LE point critique)** : le LLM **CONDENSE, il n'AJOUTE JAMAIS**.
  Interdictions explicites : n'invente pas, n'extrapole pas, ne déduis aucune cause /
  diagnostic / action / solution absente du fil, ne propose aucune recommandation de ton cru ;
  reste factuel ; attribue les propos à leur auteur (demandeur / technicien) ; réponds en
  français ; **température 0** (déterministe). **Validé empiriquement** : 2 mesures + test à
  l'écran (fil SMB/Excel — 6 messages → 3 phrases fidèles, attribution Sarah/Karim correcte,
  **fusion des 2 décisions du technicien** = vraie synthèse, zéro invention).
- **Assemblage du fil (Node)** : `description + commentaires` **chronologiques**, **SANS les
  événements de statut** (métadonnées, pas de conversation). Auteur annoté **(demandeur) /
  (technicien)** selon qu'il est le demandeur du ticket — exactement le format attendu par le
  prompt.
- **Déclencheur** : **bouton « Résumer le fil »** (à la demande, pas d'auto). **Technicien
  assigné ou admin**, **n'importe quel statut** (un résumé sert dès qu'il y a un échange :
  admin qui supervise, technicien qui reprend un ticket en attente), **dès ≥ 2 commentaires**
  (en dessous, la description suffit — garde-fou anti-résumé-inutile).
- **Affichage** : encart **« Résumé du fil (IA) »** en tête de la carte Conversation (le
  résumé résume le fil → juste au-dessus). Support uniquement. 4 états : rien (bouton) /
  EN_COURS (spinner) / PRETE (résumé + Régénérer) / ECHEC (indisponible + Réessayer).
  **Polling généralisé** : la clé passe de « SOLUTION EN_COURS » à « **une quelconque
  suggestion EN_COURS** » → **un seul mécanisme** couvre le RAG (SOLUTION) **et** le résumé
  (RESUME).
- **Persistance** : `SuggestionIA` type `RESUME` · `contenu`=résumé · `scoreConfiance`=null ·
  `statut`=EN_COURS→PRETE/ECHEC · `details`={latenceMs}. Une seule ligne RESUME par ticket
  (deleteMany+create → « Régénérer » repart propre, le fil ayant grandi).
- **Dégradation** : identique Greffe 2 — `genererResume` ne rejette jamais ; service/Ollama
  down/timeout → **ECHEC** (+ Réessayer). Ticket intact.
- **Dimensionnement** : latence **21-55 s** (Ollama qwen2.5:14b ; timeout async 60 s). Un fil
  très long + modèle froid peut frôler 60 s → ECHEC, re-clic. Dépendance runtime : **Ollama
  qwen2.5:14b** uniquement (ni DB ni bge-m3 — le résumé n'utilise ni la KB ni les embeddings).
  Warm-up Ollama identique aux autres greffes.
- **Livrables** : `summarize.py`, `service/app.py` (`/summarize`), `ia.service.ts` (`resumer` +
  `demarrerResume`/`genererResume`), `ticket.service.ts` (`demanderResume` + assemblage du
  fil), controller + route `POST /:id/resume` (202), `ticketsApi.ts`, encart + polling
  généralisé (`TicketDetailPage.tsx`).
- **Suite** : **J8bis** — OCR pièces jointes (exigence encadrant). En attente d'une
  clarification de l'encadrant : extraire le **TEXTE** (Tesseract, simple) vs analyser
  l'**IMAGE** (modèle de vision, complexe).

### J8bis — Pièces jointes dans le pipeline IA (extension validée par l'encadrant)
- **Date** : 17/07/2026. `[établi en séance]`
- **Contexte / nouvelle exigence** : l'encadrant demande d'**intégrer les pièces
  jointes** (PDF, captures d'écran) au pipeline IA — l'information utile d'un ticket
  réel est souvent dans la pièce jointe (log PDF, capture d'erreur), pas seulement
  dans le texte saisi. Nouveau jalon **J8bis**, inséré **après J8, avant J9**.
- **Ce qui est décidé** :
  - **PDF texte** → extraction directe (**pdfplumber**), sans OCR.
  - **PDF scanné / images** → **OCR Tesseract** local, langue `fra`.
  - Le texte extrait est **AJOUTÉ à la description** avant classification et RAG —
    il **complète** la description, ne la **remplace** pas.
  - **Seuil de confiance OCR** : sous le seuil, le texte n'est **pas injecté**
    (éviter d'introduire du bruit d'OCR dans les embeddings / la classification).
- **Décisions + justification** :
  1. **Tesseract local vs OCR cloud (Azure/Google Vision)** → **local retenu**.
     Open-source, gratuit, hors-ligne → **conforme CDC §10** (« outils open-source
     ou offre gratuite ») et aucune donnée Metavoria ne sort de la machine (même
     logique que le choix Ollama en J1).
  2. **Ajout vs substitution** → **ajout**. Substituer effacerait ce qu'a écrit le
     demandeur ; l'OCR est un signal *complémentaire*, bruité, à traiter comme tel.
  3. **Seuil de confiance** → garde-fou contre l'OCR dégradé (captures floues) qui
     polluerait le classifieur — mieux vaut ne rien injecter que du bruit.
- **Dépendance à lever** : l'upload/stockage des pièces jointes avait été **reporté**
  en Epic 2 (modèle `PieceJointe` présent au schéma, mais bouton d'upload retiré de
  l'UI). J8bis se décompose donc en **deux lots** : **A. upload + stockage** (le lot
  reporté), **B. OCR** qui traite ces pièces.
- **Décisions arrêtées (30/07/2026)** :
  - **Extraction de TEXTE (Tesseract + pdfplumber), pas la vision** — confirmé après
    clarification de l'encadrant. Tesseract tourne sur **CPU** (zéro charge VRAM, tient sur
    la machine de dev — cf. choix frugal Phase 7), et couvre le besoin principal (lire les
    messages d'erreur des captures / PDF). La **vision** (modèle multimodal GPU) reste une
    **perspective de production** si le serveur a un GPU.
  - **Stockage = Cloudinary** (niveau gratuit) plutôt que disque local : résout le dev→prod
    (fichiers accessibles depuis la machine de dev ET le serveur, sans volume Docker à
    gérer), URLs directes, pas d'endpoint de download à coder. `PieceJointe.url` = l'URL
    Cloudinary. **⚠️ Confidentialité (§10)** : les fichiers partent sur un **cloud tiers**
    → **à valider avec l'encadrant** ; en production, un **stockage interne** reste
    envisageable si la confidentialité l'exige (l'interface d'upload isole ce choix).
- **Lot A — upload + stockage (LIVRÉ, 03/08/2026)** :
  - **Upload routé par Node** (multer en mémoire → Cloudinary), validé côté backend
    (whitelist MIME **PDF/PNG/JPG**, **≤ 10 Mo**, **≤ 5/ticket**), permission **demandeur ou
    support**. Migration `pieces_jointes` : `cloudinary_id`, `type_mime`, `taille`,
    `texte_extrait` (ce dernier vide jusqu'au Lot B). Upload à la **création** (nourrit l'OCR
    dès le départ) **et** sur le **détail**.
  - **La livraison des PDF — itération honnête** : Cloudinary a résisté sur deux fronts.
    `resource_type: image/auto` produit une URL `.pdf` mais la **livraison est bloquée par
    défaut** (401 ; réglage compte « Allow delivery of PDF » à activer — non fiable en
    séance). Passer en `raw` **livre en 200 mais sans extension** (octet-stream → « le
    fichier n'est pas un PDF »). Et le timeout d'upload (499) réglé par un `timeout` explicite.
  - **Décision finale — PROXY backend** : le fichier n'est **jamais** servi directement par
    Cloudinary au navigateur. Un endpoint `GET /tickets/:id/pieces-jointes/:pjId/download?token=`
    (**auth par token en query**, même patron que le flux SSE) **récupère le fichier côté
    serveur** (PDF en `raw` → 200 **sans aucun réglage compte**) et le **re-sert avec le bon
    `Content-Type` + le vrai nom** → PDF et image corrects. **Deux bénéfices** : (1) robustesse
    **dev ET prod** (aucun réglage Cloudinary requis) ; (2) **confidentialité §10 renforcée** —
    l'URL publique Cloudinary **n'est plus exposée**, le téléchargement est **authentifié**
    (accès au ticket vérifié). C'est la réponse concrète au point §10 soulevé (stockage tiers
    + URL publique) : l'abstraction d'upload/livraison **isole** le stockage, une bascule prod
    (URLs signées / stockage interne) ne toucherait pas le reste.
  - **Durcissement** : un échec Cloudinary renvoie un **502 lisible** (plus de 500 opaque).
  - **Enseignement** : ne pas dépendre d'un **réglage de service tiers** pour une fonction
    cœur — proxifier rend le comportement déterministe et portable.
- **Lot B — OCR `/extract` (serving, LIVRÉ, 03/08/2026)** :
  - **Endpoint `POST /extract`** (`ml/.../service/ocr.py` + `app.py`) : **octets in (base64)
    / JSON out**, frontière tenue — **ni Cloudinary ni DB** (Node récupère les octets, comme
    pour le proxy de download, et persistera `texte_extrait`). Le service reste **sans état**.
  - **Trois branches, auto-détectées par *magic bytes*** (pas le Content-Type du client) :
    `texte_pdf` (pdfplumber, couche texte directe) · `ocr_image` (pytesseract) ·
    `ocr_pdf_scanne` (rasterisation pypdfium2 via pdfplumber, puis pytesseract). Langue `fra`.
  - **« Pas d'OCR quand le texte est là »** : un PDF à couche texte sort en **~11 ms**
    (extraction directe) contre **~490 ms** pour un scan OCRisé → l'OCR n'est déclenché que
    si l'extraction directe rend moins de `PDF_MIN_CHARS_TEXTE` (20) caractères.
  - **Seuil de confiance anti-bruit à DEUX étages** : étage **mot** (on écarte tout mot dont
    la confiance Tesseract < 40 → charabia isolé) ; étage **document** (`fiable=False` si
    confiance moyenne < 55 **ou** < 3 mots retenus). Node ne persistera pas un OCR douteux.
    Le texte d'une couche PDF est **fiable par construction** (confiance 100, aucun OCR).
  - **Dégradation** : Tesseract/pytesseract absent → **503** (Node dégrade) ; type inconnu /
    base64 invalide / fichier illisible → **422** ; > 10 Mo → **413**. `/sante` expose l'état OCR.
  - **Tesseract = binaire SYSTÈME** (pack `fra` ; v5.5.3 en dév) : chemin **auto-détecté**
    (`C:\Program Files\Tesseract-OCR` hors PATH en dév Windows) ou PATH (prod Docker),
    surchargeable via `TESSERACT_CMD`. Libs Python isolées dans l'extra `[ocr]` du `pyproject`.
  - **Preuve (serving figé avant le pont)** : 3 fixtures (image PNG, PDF scanné, PDF texte)
    validées **en direct ET en HTTP** — méthodes correctes, texte fidèle (VPN/erreur 691 ;
    Active Directory), confiances 92.8 / 92.5 / 100 ; cas d'erreur (type non supporté) → **422**.
- **Pont Node — intégration (LIVRÉ, 06/08/2026)** :
  - **Déclencheur fire-and-forget** dans `ajouterPieceJointe` : Node a **déjà les octets**
    (`fichier.buffer` du multer en mémoire) → `demarrerExtraction` **sans re-télécharger**
    Cloudinary. La réponse d'upload part **immédiatement** ; l'OCR (0,5-2 s) + la
    re-classification vivent dans le fire-and-forget. Timeout dédié `IA_EXTRACT_TIMEOUT_MS` (60 s).
  - **`texte_extrait` écrit UNIQUEMENT si `fiable`** (jamais dans `description` : augmentation
    à l'usage). OCR non fiable / service down / 422 / 503 → journalisé, **upload intact**.
  - **Re-classification « après OCR »** : `enrichir` refactoré en `classerEtPrioriser(ticket,
    {texteSupplementaire, origine})`. L'astuce `classify(titre, description\ntexteOCR)` produit
    l'embedding enrichi `titre\ndescription\ntexte_extrait` **sans toucher au service** ni à
    `tickets.description`. L'embedding du ticket est **écrasé** par le vecteur enrichi (meilleure
    représentation RAG). Nouvelle paire `SuggestionIA` marquée `details.origine='apres_ocr'`
    (+ `pieceJointeIds`), la paire `creation` **conservée** → démonstration « avant / après OCR ».
  - **Uploads multiples** : la paire `apres_ocr` est **remplacée** (deleteMany filtre JSON
    `origine` puis recréée sur la concat des textes fiables) → toujours 1 « avant » + 1 « après »
    cohérente. **Zéro migration** (marqueur dans `details` JSON ; colonne dédiée = flywheel J9).
  - **Validé à l'écran** (06/08) : upload image « erreur VPN » → `texte_extrait` peuplé + 2ᵉ
    suggestion `apres_ocr`, 1ʳᵉ intacte ; fichier illisible → aucun effet, upload OK. `tsc` + ESLint verts.
- **UI — affichage (LIVRÉ, 06/08/2026)** :
  - **Pièces jointes** : badge « texte extrait » + dépliant « Voir le texte extrait (OCR) ». Le
    texte OCR est exposé aux personnes ayant accès au ticket (contenu d'un fichier **déjà
    téléchargeable** via le proxy) ; l'URL Cloudinary, elle, reste cachée (§10).
  - **Panneau Assistant IA** : split des suggestions par `details.origine` (corrige un `.find()`
    qui prenait la plus récente et **masquait** la création) → bloc « Révisé grâce à la pièce
    jointe » avec la révision **`avant → après`** surlignée (ex. `Autre → Réseau`).
  - **Seuil d'AFFICHAGE de confiance (50 %, réglable admin §6.5)** — **distinct** du seuil
    d'ABSTENTION du modèle (non figé, flywheel J9). Sous le seuil, la catégorie est présentée
    **grisée + « à préciser »** au lieu d'être donnée comme sûre. Point de fond : le modèle
    exprime son doute par une **confiance basse**, PAS en sortant `Autre` — `Autre` est une vraie
    classe (fourre-tout), pas le « je ne sais pas » (cf. `classifier.py`, « abstenir ≠ prédire autre »).
  - **Rafraîchissement** : l'extraction async n'ayant pas de ligne EN_COURS, un **polling court**
    (~16 s) après upload fait apparaître le texte extrait + la suggestion après-OCR. Zéro migration.
- **Statut** : **Lot B TERMINÉ** (serving + pont Node + UI), validé à l'écran. Prochaine étape
  roadmap : **Greffe 3** (flywheel — capture de la validation technicien). Détail de conception :
  `docs/epic-4-module-ia-conception.md` §7 bis.

---

### Greffe 3 (flywheel, boucle complète) — Brique A : capture des labels validés (LIVRÉ, 07/08/2026)
- **Objet** : capturer proprement « suggéré X / choisi Y » pour, à terme, **réentraîner le
  classifieur sur les corrections RÉELLES des techniciens** — la voie durable pour combler
  l'écart synthétique→réel (0,506 à J5).
- **L'argument central (retourne le J5+ négatif)** : J5+ avait montré qu'ajouter du réel
  **auto-étiqueté bruité** à l'entraînement **dégrade** le réel (−0,043) — *« la qualité de
  l'étiquetage prime sur la proximité du domaine »*. Le flywheel apporte des étiquettes
  **validées par le technicien = propres par construction** : c'est **exactement la condition
  qui manquait** à J5+. Le résultat négatif devient la **motivation** du flywheel.
- **Inventaire** : matière première présente (SuggestionIA, catégorie finale, événements) mais
  **aucune paire propre requêtable** ; `valideeParTechnicien` déclaré mais **jamais écrit** ;
  `origine` seulement dans `details` (JSON).
- **Livré (Brique A)** :
  - **Migration** `SuggestionIA.origine` (colonne dédiée + backfill depuis `details.origine`),
    appliquée en **`migrate deploy`** — jamais `migrate dev`, qui **resetterait** la base à cause
    du drift des index HNSW/full-text créés en SQL brut (invisibles à Prisma).
  - **Réconciliation** `iaService.reconcilierSuggestions(ticketId, catégorieFinale)` : marque
    chaque suggestion CLASSIFICATION `valideeParTechnicien = (contenu == catégorie finale)`.
    Idempotente, best-effort (ne bloque jamais le workflow). Accrochée à **4 points** :
    `resoudre` (label validé), `changerCategorie` (correction explicite), `cloturer` +
    `evaluerSatisfaction` (filets).
  - **Export** `ticketRepository.labelsValides()` : tickets **réels** (`synthetique=false`)
    RESOLU/CLOTURE avec catégorie → `{titre, description, texteExtrait, catégorie}` (texte =
    titre+description+texte_extrait OCR si présent ; jamais les synthétiques).
  - **Compteur** `nbLabelsValidesDepuis(date)` (via événement RESOLU, dédup par ticket).
- **Preuve (porte A — headless non destructif, ticket jetable)** : création=Matériel(0,48) /
  après-OCR=Réseau(0,82), choix final Réseau → `apres_ocr` validée=**true**, `creation`
  validée=**false** (« l'OCR a corrigé ») ; NOUVEAU exclu de `labelsValides`, RESOLU inclus avec
  sa catégorie ; 7 labels réels en base. `tsc` vert.
- **Suite** : **D1** (jeu de labels propres) → **B** (réentraînement manuel, glass-box) → **C**
  (preuve : courbe d'apprentissage + règle d'interprétation pré-enregistrée).

### Greffe 3 (flywheel) — D1 : lot d'entraînement propre + verrou d'étanchéité (LIVRÉ, 19/08/2026)
- **Correction d'hypothèse (constat data)** : les « ~60 spot-checks Kaggle **déjà relus** » supposés
  à l'architecture étaient en fait des **gabarits VIDES** (le J5+ n'avait gardé que les % agrégés).
  État réel vérifié : **242** tickets Kaggle FR-IT dispo hors test (déjà exclus par exact + Jaccard
  ≥ 0,5), **46** au test gelé, captures production **inexploitables** (~1 vraie correction #875, le
  reste = tickets de test / junk). → une **relecture fraîche à l'aveugle** était nécessaire.
- **D1.1 — porte dure `porte_etancheite(candidats, test, seuil=0.5)`** (`eval/dataset.py`) : lève sur
  exact **OU** Jaccard ≥ 0,5 (0 toléré des deux). `assert_disjoint` **laissée intacte** (Jaccard =
  simple avertissement) pour ne PAS casser le réentraînement J5. **Test versionné**
  `tests/test_porte_etancheite.py` (4/4) : prouve, **relançable**, que copie exacte ET quasi-doublon
  échouent DUR — l'intégrité méthodologique est *vérifiée*, pas promise.
- **D1.2 — `flywheel/exporter_lot.py`** : 50 tickets (17 Réseau / 17 Logiciel / 16 Matériel selon
  l'auto, seed 42) exportés **à l'aveugle** (`real/lot_v2/a_relire.csv` : catégorie vide, sans
  auto-label ni signaux) ; auto-label isolé (`auto_labels.csv`). Porte jouée avant export
  (Jaccard max **0,44** < 0,5).
- **D1.3 — `flywheel/reconcilier_relecture.py`** : validation dure des libellés + comparaison relu
  vs auto. **Taux de désaccord = 16/50 = 32 %** (auto-mapper juste à **68 %** sur échantillon
  PROPRE — *plus* bruité que le 87 % optimiste du spot-check J5+ → renforce « labels propres > auto »).
  Motif **systématique** : AWS/cloud reclassé **Réseau → Logiciel** (+ facturation AWS → Autre).
- **Observation pour la Brique C** : le TEST gelé étiquette AWS de façon **incohérente**
  (Accès/Réseau/Logiciel) → frontière **intrinsèquement ambiguë** du dataset qui **plafonne** les
  gains mesurables sur AWS (limite de données, PAS échec du flywheel). À énoncer honnêtement au mémoire.
- **D1.4 — `flywheel/construire_train_v2.py`** : `train_v2` = **852 synthétiques + 50 relus = 902** ;
  porte re-jouée sur les 50 ajouts (fail dur) ; snapshot `artifacts/flywheel/train_v2_*.jsonl`
  (dérivé → **gitignoré**) + **manifeste versionné** (`real/lot_v2/train_v2_manifest.json` : corpus
  source + sha256, 50 ids + labels, distributions, sha256 du snapshot) → **reproductible**.
- **Versionnement** : labels humains + manifestes + rapport → **versionnés** (`real/lot_v2/`) ;
  snapshot dérivé **ignoré** (régénérable).

### Greffe 3 (flywheel) — Brique B : réentraînement manuel glass-box (LIVRÉ, 20/08/2026)
- **Objet** : le MOTEUR — réentraîner un CANDIDAT, le comparer à l'actif sur le **test gelé**,
  déployer **seulement si meilleur** (acte admin). B prouve le **mécanisme + la sécurité**, pas un gain.
- **B.1 — `flywheel/reentrainer.py`** : assemble `train_v2` + captures (passées par Node) →
  **porte d'étanchéité RE-JOUÉE** (fail dur, `verifier_etancheite`) sur les ajouts réels vs
  réel + gold → entraîne un `EmbeddingLogReg` candidat (embeddings en cache `.npy`) → évalue
  candidat ET actif sur le test gelé → rapport + **verdict PRÉ-ENREGISTRÉ**. Candidat écrit dans
  `artifacts/models/candidates/` (**sous-dossier non récursif** → jamais servi par accident).
  **Test versionné** `tests/test_reentrainer_etancheite.py` : une capture contaminée fait ABORT.
- **Comparatif honnête (50 relus, captures=[])** : ACTIF (synth seul) macro-F1 réel **0,438** vs
  CANDIDAT (synth + 50) **0,4212** → **Δ −0,0168 → verdict NUL → candidat NON déployable**.
  Résultat PRÉ-ACCEPTÉ : 50 labels (~5 %) trop peu + **plafond AWS** (test ambigu) + n=46 bruité.
  Ce que B prouve : le moteur tourne, et la sécurité glass-box **refuse un modèle non meilleur**.
  *(Confond noté : candidat 852 synth vs actif J5 724 après split → C FIXERA la base pour isoler
  l'effet des labels.)*
- **B.2 — endpoints Python** : `POST /reentrainer` (async, thread de fond, 202) · `GET
  /reentrainer/etat` (polling) · `POST /deployer` (**REFUSE 409 si non meilleur** + copie +
  `predictors.recharger_classifieur()`) · `/sante` enrichi (date + macro-F1 actif). Preuve HTTP :
  /deployer → **409 REFUSÉ**, /sante confirme le modèle actif **INCHANGÉ**.
- **B.3 — proxy Node ADMIN** (`/api/ia`, `requireRole('ADMINISTRATEUR')`) : `POST /reentrainer`
  (passe `labelsValides()` — **Node seul touche la DB**), `GET /flywheel` (compteur
  `nbLabelsValidesDepuis(dateActif)` + état), `POST /deployer`. `proxyIA` **relaie** le statut
  (202/409/404) ; service injoignable → 503. Preuve : proxy relaie **200/202/409** contre le vrai
  Python. `IA_REENTRAINEMENT_TIMEOUT_MS`.
- **Chemin heureux de déploiement** (copie + reload) : **même code**, simplement débloqué par la
  garde — démontrable en Brique C dès qu'un candidat passe la barre. La GARDE, elle, est prouvée.
- **Suite : Brique C** — courbe d'apprentissage macro-F1 réel vs nb labels (0→10→…→50), **base
  synthétique FIXÉE** pour isoler l'effet des labels du confond ; + admin UI (comparatif + déployer).

### Greffe 3 (flywheel) — Brique C1 : courbe d'apprentissage (LIVRÉ, 21/08/2026)
- **Objet** : mesurer PROPREMENT l'effet marginal des labels réels, **isolé du confond de B**.
  `flywheel/courbe_apprentissage.py` : **base synthétique FIXE (852)** pour tous les points ;
  seul varie le nb de relus réels **k ∈ {0,10,20,30,40,50}**. k=0 = baseline pur-synthétique.
  **Porte d'étanchéité re-jouée** (fail dur) sur chaque sous-ensemble ; **test GELÉ** gold(102) +
  externe réel(46) ; métrique de tête = **macro-F1 réel**. **Lissage 5 seeds** pour k intermédiaires
  (moyenne + bande min/max). **Règle PRÉ-ENREGISTRÉE** (pente k0→k50, seuils de B) fixée avant les chiffres.
- **Résultat en 3 phases (honnête, non maquillé)** :
  1. **Bosse** k=10–20 : **+0,033** au-dessus de la baseline (0,4554 → 0,4888). Une petite dose de
     labels propres **aide** — le flywheel fonctionne. *Non sur-vendu* : bande *ambiguë* (+0,02..+0,05),
     min–max **0,409–0,536** à k=20 → **bruit n=46** (un tirage unique aurait menti : lissage justifié).
  2. **Redescente** k=30→50 sous la baseline (0,4212 à k=50). Au volume actuel, ajouter *plus* de ces
     relus nuit sur le test complet.
  3. **Pente pré-enregistrée** k0→k50 = **−0,0342 → verdict DESCENDANT** (`< −0,02`). Rapportée telle quelle.
- **Diagnostic hors-AWS (étiqueté, PAS le résultat de tête)** : le test réel a **8/46 items AWS/cloud**
  aux labels gold **incohérents** (Accès/Réseau/Logiciel pour un même sujet). En les retirant (mots-clés
  fixes, transparents), la pente **s'inverse : −0,034 → +0,011**. **Le bruit est dans le TEST, pas dans le
  flywheel** — l'écart bleu↔vert après k=20 EST le plafond d'étiquetage AWS.
- **Sanity check** : score **synthétique figé à 0,944** sur toute la courbe (base inchangée) → la mécanique
  isole bien l'effet des labels réels. **Confond de B réglé** (base 852 constante, plus 852-vs-724).
- **Leviers d'un gain réel (énoncés au mémoire)** : (a) **plus de labels propres** (50 ≈ 5 %, trop peu) ;
  (b) **nettoyer l'ambiguïté AWS du test** (le plafond est un défaut de données, pas du modèle) ;
  (c) test réel plus grand que n=46 (réduire les bandes). Le flywheel apporte le canal ; le volume viendra.
- **Livrables VERSIONNÉS** : `eval/reports/j9_flywheel/` — `courbe.md`, `courbe.json`,
  `courbe_apprentissage.png` (courbe complète + diagnostic hors-AWS, bandes min/max, réf. actif J5).
- **Suite : Brique C2** — admin UI `/administration/ia` (compteur, réentraîner, comparatif candidat vs
  actif, **déployer conditionnel**). Au volume actuel le bouton reste **désactivé** → démontre le refus glass-box.

### Greffe 3 (flywheel) — Brique C2 : admin UI + garde de déploiement alignée (LIVRÉ, 27/08/2026)
- **Objet** : le flywheel **piloté à l'écran** par un admin (glass-box), et un correctif de rigueur
  révélé par le test live.
- **UI** (`/administration/ia`, `RequireRole('ADMINISTRATEUR')`) : `features/ia/iaApi.ts` (client typé
  calqué sur le contrat B.3) + `pages/FlywheelPage.tsx` (4 blocs) + route (`App.tsx`) + nav « Modèle IA »
  (`Sidebar.tsx`). Blocs : **compteur** (labels réels depuis le modèle actif) · **réentraîner** (POST →
  **polling** `/flywheel` 2 s) · **comparatif** candidat vs actif (macro-F1 réel+synth, Δ, verdict, **F1
  par classe**) · **déployer** activé **seulement si `candidat_meilleur`**, sinon **grisé + motif**.
- **Test écran RÉEL** (Postgres + Node + service Python, JWT admin) : compteur DB `nbLabelsDepuis=1`,
  réentraînement avec **6 captures réelles** (`labelsValides`), comparatif rendu, refus de déploiement
  affiché. Le F1 par classe rend **littérale** l'histoire de la courbe C1 : candidat **↑ Logiciel +0,21 /
  Matériel +0,17** (labels propres) mais **↓ Accès −0,22 / Autre −0,17** (petit support + ambiguïté AWS)
  → macro noyée → **Δ +0,0042 = NUL**.
- **Correctif de rigueur (garde de déploiement)** : le test live a montré que l'ancienne garde
  `candidat_meilleur = (delta > 0)` **déployait dans le bruit** (Δ+0,0042 accepté alors qu'il est NUL, et
  le candidat **régressait sur le synth** 0,944→0,919). C'est **incohérent** avec la règle pré-enregistrée
  qui sert à LIRE la courbe. **Garde alignée** → `candidat_meilleur = (delta ≥ SEUIL_AMBIGU = +0,02)` :
  on ne déploie **jamais** un gain NUL. Re-testé en direct : même candidat → `candidat_meilleur=False`,
  `/deployer` → **409 REFUSÉ**, modèle servi **inchangé** (0718). Tests anti-triche : 6 passed.
- **Chemin heureux prouvé** : avant le correctif, le déploiement a **réussi** (200, copie + reload) — la
  mécanique de déploiement fonctionne de bout en bout ; le correctif règle seulement **le SEUIL**, pas le
  chemin. Un candidat ≥ +0,02 se déploiera honnêtement.
- **Note UI** : Δ coloré selon la **décision** (vert si déployable / ambre si positif-NUL / rouge si
  négatif), pas selon le seul signe — la couleur ne ment pas sur le refus.

### KB réelle du RAG — capture de la solution + ingestion (K1+K2, LIVRÉ 27/08/2026)
- **Trou identifié par audit** : le RAG ne cherchait QUE dans le synthétique (`_FILTRE_KB = t.synthetique`),
  jamais l'historique RÉEL — contraire à la lettre du CDC §6.3. Cause profonde : **`resoudre()`
  n'enregistrait AUCUN texte de solution** (juste un événement de statut) → pour un vrai ticket, la
  solution n'existait **nulle part**. Lever le filtre sans capturer d'abord aurait fait citer le
  **1er commentaire** comme « solution » (faux pour un vrai fil). Le flywheel ne comble pas ça
  (canaux séparés : il nourrit la CLASSIFICATION, pas la KB).
- **K1 — capturer la solution** : nouveau champ **`Ticket.resolution` (+ `resolutionDate`)**, migration
  via **`migrate deploy`** (règle drift HNSW/fulltext). `resoudre(acteur, id, solution?)` capture la
  solution **FACULTATIVE** (zod `resolutionSchema`, ≤5000) ; sans solution → `resolution` NULL → **hors
  KB** (zéro pollution, on ne force pas le technicien). **UI** : l'action « Marquer résolu » ouvre un
  **dialog « Solution appliquée »**. *Alternatives écartées* : dernier commentaire (fragile, conversation
  multi-auteurs), texte de l'événement (l'événement ne porte pas de texte) → **champ dédié** non ambigu.
- **K2 — ingérer le réel dans la KB** (`retrieval/hybrid.py`) : filtre **`(t.synthetique OR t.resolution
  IS NOT NULL) AND statut∈KB`** → **mix** bootstrap synthétique + vraies résolutions ; `resolution IS
  NOT NULL` **exclut naturellement le bruit de dev** (pas de solution). Résolution du doc =
  **`COALESCE(t.resolution, 1er commentaire)`** (le réel cite la vraie solution, le synthétique garde la
  sienne). **Embeddings réels déjà utilisables** (Node les écrit à la création, titre+desc, cohérent avec
  le synthétique — pas de ré-embed ; la résolution sert au texte du doc, pas à la recherche). Drapeau
  **`DocKB.synthetique`** ajouté (provenance, pour K3).
- **Preuves** : K1 → résoudre #865 **avec** solution → DB `resolution` peuplée + `resolutionDate` ; #866
  **sans** → NULL (via l'API réelle, token du tech assigné). *(Bonus : #868 résolu par l'utilisateur via
  le dialog navigateur → chemin UI validé de bout en bout.)* K2 → sur « VPN coupé… », **#865 ressort #1**
  des candidats RRF, `synthetique=False`, résolution citée = la solution saisie (pas un commentaire).
- **Note éval** : la KB grandit avec l'usage réel (intention CDC) ; à l'instant 2 vraies résolutions →
  `run_retrieval` quasi inchangé. Étanchéité intacte (gold/test = JSONL séparés ; `garde_anti_fuite` OK).
- **K3 — provenance dans l'UI (LIVRÉ 27/08/2026)** : le drapeau `DocKB.synthetique` remonte
  jusqu'à l'UI — `suggestion.suggerer` l'ajoute aux `similaires` ; `app.py` l'expose sur `DocSimilaire`
  ET `SourceCitee` (map `{id→synthetique}` depuis les similaires, sources ⊆ similaires) ; Node relaie
  les tableaux bruts (le drapeau traverse `SuggestionIA.details`) ; le frontend affiche un **badge
  « réel » vert** sur les tickets **non synthétiques**, dans « Tickets similaires » **et** sur les chips
  de **sources citées** (rien sur le synthétique → pas de bruit visuel). Le technicien voit que la réponse
  s'ancre sur une **vraie résolution d'entreprise**. Preuve (génération stubbée, sans Ollama) : sur « VPN
  coupé… », `similaires` et `sources` portent #865 `synthetique=False` → badge affiché ; synthétiques sans
  badge. tsc backend+frontend + lint verts. **KB RÉELLE DU RAG COMPLÈTE** (K1 capture → K2 ingestion → K3
  provenance) : le RAG s'appuie sur l'historique réel, honore la lettre du CDC §6.3, et le montre.

---

# Phase 6 — Intégration & tests

### Tests unitaires du module IA (LIVRÉ 27/08/2026)
- **Contexte** : audit → **0 test** hors anti-triche flywheel. Comblé par une suite **ciblée**,
  **déterministe** et **offline** (pas de modèle/DB/Ollama pour la suite rapide) — `pytest` +
  **FastAPI TestClient** + `monkeypatch`. Placement `ml/tests/` ; config `pyproject.toml`
  (`testpaths=["tests"]`, marker `slow`). **`pytest -m "not slow"` = CI rapide.**
- **Stratégie** : *fonctions PURES + I/O stubbée + validation HTTP*. Les chemins lourds (modèle
  bge-m3, Tesseract) = tests `slow` **skippables** (`skipif`) → prouvent le chemin RÉEL quand la
  dépendance est là, se skippent proprement sinon.
- **Fichiers (5)** : `test_priority.py` (scorecard pur : 4 niveaux, bornes de seuils, escalade /
  désescalade / négation, **invariant : sortie ∈ 4 niveaux**) · `test_suggestion.py` (abstention RAG
  stubbée : aucun candidat / rien d'ancré / suggestion citée `sources ⊆ similaires` + drapeau K3 /
  porte de seuil) · `test_ocr.py` (`_sniff` magic bytes, `_fiabilite` anti-bruit ; +OCR réel `slow`) ·
  `test_classifier.py` (abstention pure : sentinelle ≠ classe ; +`/classify` réel `slow`) ·
  `test_service_contracts.py` (TestClient : `/sante` 200 ; `/classify` `/priority` `/suggest` `/summarize`
  vides → **422** ; `/extract` requis/invalide/type inconnu → **422**, trop volumineux → **413**).
- **Résultat** : **suite rapide 51 passed / 2 deselected (5,7 s)** ; **complète 53 passed (25,6 s)** —
  les 2 `slow` (OCR Tesseract réel + `/classify` chargeant bge-m3) inclus.
- **Mise à jour (03/09/2026)** : ces chiffres restent ceux du **27/08/2026**. La Phase A
  (gestion des catégories) a depuis ajouté `test_modele_endpoint.py` : la suite compte
  aujourd'hui **54 passed / 2 deselected** (rapide) et **56 passed** (complète). Chiffres
  vérifiés **à l'identique sur l'hôte et dans le conteneur** lors de la dockerisation.
- **Dépendance implicite révélée par le conteneur** : deux tests de `test_modele_endpoint.py`
  assertent `infos["present"] is True` — ils lisent donc le **vrai manifeste** sous
  `artifacts/models/`. Sans ce dossier monté, ils **échouent** (ils ne skippent pas). La suite
  « offline » ne l'est donc pas tout à fait. `[à traiter en amélioration Phase 6]`
- **Hors périmètre (assumé)** : le harnais d'**évaluation** (`eval/`, métriques sur datasets) existe
  déjà ; la **génération LLM réelle** (Ollama) et le **pont Node** (tsc + preuves écran) ne sont pas
  re-testés unitairement ici. Tests fonctionnels backend/frontend : `[À COMPLÉTER PAR FEDI]`

---

# Phase 7 — Déploiement & documentation

### Choix de conception — architecture frugale, scalable sans réécriture
- **Date** : 30/07/2026. `[établi en séance]`
- **Décision** : le module IA est **développé et validé sur du matériel modeste** (RTX
  3050 Ti Laptop, **4 Go de VRAM**), l'**upgrade de puissance étant reporté à la
  production**. Rendu possible par l'**architecture découplée** : les LLM et modèles
  vivent **derrière une interface HTTP** (microservice FastAPI ; Ollama), le backend Node
  ne les appelle que par contrat. Passer à un serveur GPU en prod **ne change aucune ligne
  de code applicatif** — seuls l'hôte et le device (`EMBED_DEVICE=cuda`, GPU Ollama)
  changent, par variables d'environnement.
- **Ce que ça démontre (à valoriser au rapport / soutenance)** : un **système frugal**,
  fonctionnel de bout en bout sur une machine grand public, **scalable en production sans
  réécriture**. Les latences mesurées (embed ~100-400 ms CPU ; génération 21-55 s en
  offload CPU/GPU partiel) sont des **bornes hautes** : un GPU dédié les réduit fortement
  (perspective GPU/torch-CUDA ~30-50 ms/paire notée en J6) sans toucher au code.
- **Corollaire OCR (J8bis)** : le choix **Tesseract (extraction de texte, CPU)** plutôt que
  la **vision (GPU)** suit la même logique — zéro charge VRAM, tient sur la machine de dev,
  couvre le besoin principal (lire les messages d'erreur des captures/PDF). La **vision
  reste une perspective de production** (si le serveur a un GPU), documentée comme évolution
  possible.

- **Ce qui existait avant ce jalon** `[reconstitué depuis Git]` : `docker-compose.yml`
  couvrant postgres+pgvector, backend, frontend nginx et un service **ollama** ; migrations
  appliquées au démarrage (`prisma migrate deploy`). **Le module IA n'était pas dockerisé**
  (ni `ml/Dockerfile`, ni service `ml`).

### Dockerisation du service IA (LIVRÉ 03/09/2026)

- **Objectif** : rendre le module IA déployable au même titre que le reste de la pile,
  sans dégrader la reproductibilité des mesures ni la promesse §10 (« aucune donnée ne
  sort de la machine »). Conduit **par étapes, chacune fermée par une porte de preuve**
  (une commande, une sortie attendue) avant de passer à la suivante.
- **Image** (`ml/Dockerfile`, 115 l.) : `python:3.12-slim` + **Tesseract avec le pack `fra`**
  (OCR J8bis), **torch en build CPU** (`--index-url .../whl/cpu` — évite ~3 Go de wheels
  `nvidia-*` inutiles), utilisateur **non-root**, healthcheck sur `/sante`, `WORKDIR /app`
  (impératif : `predictors` et `reentrainer` résolvent `artifacts/…` et `gold/…` en relatif).
  **1,92 Go** après purge de `torch/include` + `torch/test` (121 Mo, inutiles en inférence ;
  les `.pyc` sont conservés, `PYTHONDONTWRITEBYTECODE=1` les empêcherait d'être régénérés).
  Un **garde-fou de build** fait échouer l'image si `sklearn != 1.4.0`, si `torch` n'est pas
  `+cpu`, ou si le pack `fra` manque.
- **Décision — `requirements.lock` (55 paquets) plutôt que les bornes `>=`.** Motif **dur**,
  découvert en vérifiant : le classifieur figé J5 est **picklé en scikit-learn 1.4.0**, or
  `pyproject.toml` déclare `>=1.4` — une résolution libre installerait 1.7.x et le dépicklage
  échouerait, `/classify` répondant 503. Le lock a dû aller **au-delà** des 7 paquets ML :
  une résolution libre remontait `starlette` 0.36 → **1.6** (majeure) et `huggingface-hub`
  0.23 → **0.36**, deux sauts qui changent le comportement de FastAPI et le chargement de
  bge-m3. Résolu **en miroir de l'environnement de développement validé** (17/17 paquets
  identiques, wheels Linux, `pip check` sans conflit). **Conséquence à retenir : monter
  scikit-learn imposera un RÉENTRAÎNEMENT, pas un rebuild.**
- **Preuve de reproductibilité** : le macro-F1 réel du modèle actif rejoué **dans le
  conteneur** donne **0,4380**, contre 0,438 au manifeste J5. Le lock ne protège pas une
  intention, il protège un nombre.
- **Décision — chargement des modèles hors-ligne** (`config.source_modele`). Constat : réseau
  coupé, bge-m3 ne chargeait **pas**, alors que tous ses poids étaient en cache. Cause lue
  dans le code de la bibliothèque : `transformers` 4.40.2 (`utils/hub.py`, `has_file`) émet un
  `requests.head` **brut** vers huggingface.co pour tester la présence de `model.safetensors` —
  appel qui **ignore** `HF_HUB_OFFLINE`/`TRANSFORMERS_OFFLINE` (il ne passe pas par
  `hf_hub_download`) et dont l'échec DNS n'est **pas** rattrapé (le `head()` est hors du `try`,
  contrairement à ce que promet sa docstring). Compléter le cache était impossible :
  **`BAAI/bge-m3` ne publie aucun safetensors** (404 sur le Hub) — le sondage est
  structurellement sans réponse. Correctif : `has_file` court-circuite le réseau quand on lui
  passe un **répertoire**, on résout donc le dossier du cache local et on le passe au chargeur.
  **L'identifiant `BAAI/bge-m3` reste la provenance enregistrée en base**
  (`tickets.embedding_modele`) : le backfill et sa détection « modèle changé » sont préservés.
  *Vérifié* : `--network none`, DNS impossible, `/embed` `/classify` `/rerank` en 200 et suite
  complète **56 passed**. Le §10 est désormais vrai **sans exception, démarrage compris**.
- **Décision — préchauffage au démarrage** (`IA_WARMUP`). Le chargement paresseux faisait payer
  au **premier** appel le coût du modèle. Mesuré : premier `/suggest` **71,1 s** (le reranker se
  chargeait dans la requête) contre **25,6 s** et **21,2 s** ensuite — au-delà du budget de 60 s
  du backend, qui l'aurait abandonné. Le préchauffage couvre donc bge-m3, le classifieur **et**
  le reranker. *Note d'honnêteté : le raisonnement initial (« /suggest a 60 s, inutile de
  préchauffer le reranker ») a été **invalidé par la mesure**.*

  > ⚠️ **RECTIFIÉ LE 19/09/2026 — l'attribution ci-dessus est FAUSSE, le chiffre est juste.**
  > Les 71,1 s ont bien été mesurées ; ce n'est pas le reranker qui les causait. Il ne pouvait
  > pas les causer : la garde `if seuil is not None` de `suggestion.py` existe **depuis J6**
  > (`631c36c`), soit **avant** cette mesure, et avec `SEUIL_ABSTENTION_DEFAUT = None` le chemin
  > `/suggest` n'appelle jamais le reranker. L'entrée attribuait le coût au seul modèle qu'elle
  > venait d'ajouter au préchauffage, sans l'isoler.
  >
  > **Ce que la mesure de contrôle a montré** (19/09/2026, cf. la section « Correctif — le
  > reranker retiré du préchauffage » en fin de journal) : avec **tout** préchauffé — bge-m3,
  > classifieur **et** reranker — le premier `/suggest` coûtait **encore 40,9 s** contre 15,1 s
  > et 13,7 s ensuite. Le surcoût de premier appel survivait donc au préchauffage : il ne venait
  > pas d'un modèle du service `ml`.
  >
  > **Cause réelle, isolée par expérience à variable unique** : le chargement de `qwen2.5:7b`
  > par **Ollama** à la première génération. Service `ml` laissé intact (bge-m3 chargé, reranker
  > **non** chargé), seul le LLM déchargé puis rechargé — `/suggest` : **13,0 s** (LLM résident)
  > → **39,8 s** (LLM déchargé) → **11,3 s** (LLM rechargé). Le surcoût suit l'état d'Ollama,
  > pas celui du reranker. `OLLAMA_KEEP_ALIVE=-1` est ce qui le rend non récurrent ensuite.
  >
  > **Conséquence** : le préchauffage du reranker ne protégeait rien. Retiré — les ~2,3 Go de RAM
  > qu'il immobilisait sont rendus. Le préchauffage de bge-m3 et du classifieur, lui, reste
  > justifié : il protège le budget de 4 s de `/classify` à la création d'un ticket.
- **Compose** : services **`ml`** et **`ml-prefetch`** (one-shot qui **charge** les deux modèles
  — un cache corrompu échoue au démarrage de la pile, pas en pleine démonstration), volume
  `hf-cache`, bind-mount `./ml/artifacts` (le candidat de `/reentrainer` apparaît côté hôte).
  **12 variables manquaient au service `backend`** (14/26 fournies) : sans `SERVICE_IA_URL`, le
  backend dockerisé retombait sur `http://127.0.0.1:8000` — **il s'appelait lui-même**, et toute
  la greffe IA était morte *silencieusement* (l'IA étant non bloquante, aucune erreur visible).
- **Piège Ollama** `[établi en séance]` : un Ollama **natif** sur l'hôte **masque silencieusement**
  la publication du port du conteneur — Docker ne signale aucun conflit. On obtenait alors un
  `curl localhost:11434` rassurant (les modèles de l'hôte) pendant que `ml → http://ollama:11434`
  tombait en **404 model not found** sur un conteneur vide. Un healthcheck ne peut pas l'attraper :
  `ollama list` prouve qu'un serveur répond, **pas qu'il a des modèles**. Décisions : publication
  du port **retirée**, service `ollama` placé derrière un **profil** (voie de déploiement pur, avec
  son healthcheck), et **`ML_OLLAMA_HOST` pointé par défaut sur l'Ollama de l'hôte**.
- **Bout-en-bout vérifié en conteneur** : ticket créé → `/classify` + `/priority` 200 →
  `SuggestionIA` (`Réseau` 0,727 / `HAUTE`) — l'IA **suggère**, le technicien accepte
  (`categorie_id` reste nul, conforme au §8) ; upload → Cloudinary 201 → `/extract` 200 → texte
  OCR restitué **exactement** (accents compris) → **reclassification `apres_ocr`** ; `/suggest`
  ancré sur des sources citées dont une **réelle** (drapeau K3) ; `down`/`up` en **16 s** sans
  retéléchargement des 4,3 Go.
- **Effet de bord utile** : le build de production a révélé une **erreur TypeScript** dormante
  du frontend (`TicketDetailPage.tsx`, `<Field>` sans `htmlFor` — label non associé à son
  contrôle, TS2741). Invisible au serveur de développement, elle faisait échouer
  `docker compose up --build`. Corrigée.
- **Documentation technique / guide d'installation** : `README.md` (prérequis, procédure de
  déploiement complète, vérification, arrêt) et `ml/README.md` (contenu de l'image, montages,
  hors-ligne, préchauffage).

### Autonomie de la pile — Ollama conteneurisé (LIVRÉ 06/09/2026)

- **Exigence** `[établi en séance]` : la partie DevOps du PFE impose une pile **livrable**,
  fonctionnant sur un serveur nu **sans installation préalable**. La configuration précédente
  s'adressait à un Ollama de la **machine hôte** — pratique en développement, mais
  `host.docker.internal` **ne résout pas** sur un serveur Linux sans `extra_hosts: host-gateway` :
  ce défaut aurait échoué précisément là où la pile est censée être déployée.
- **Provisionnement des modèles LLM** : service one-shot `ollama-prefetch`, symétrique de
  `ml-prefetch`. Un conteneur client jetable appelle `/api/pull` sur le serveur, qui télécharge
  dans **son** volume (`OLLAMA_HOST` honoré — vérifié sur un modèle de 397 Mo AVANT d'amorcer le
  volume, pour que la porte prouve quelque chose plutôt que de constater un no-op). Progression
  journalisée tous les 10 %.
- **Décision — la garantie ne vient pas du healthcheck.** `ollama list` prouve qu'un serveur
  répond, **pas qu'il détient les modèles** : un serveur sain mais vide rend **404 « model not
  found »**. La vraie garantie est la **sortie en code 0** du provisionnement, dont `ml` dépend par
  `service_completed_successfully`. Le seeder vérifie donc en deux étages : `/api/show` par modèle,
  puis une **génération réelle** sur le principal. Les trois chemins ont été éprouvés : cache chaud
  (exit 0), modèle inexistant au registre (exit 1), vérification seule contre un serveur vide
  (exit 1). Bâti sur l'image du service IA — l'image `ollama/ollama` ne contient **ni python ni
  curl**, la vérification par l'API y était donc impossible.
- **Piège du port, démasqué en séance** : un Ollama **natif** sur l'hôte **masque silencieusement**
  la publication du port du conteneur — Docker ne signale **aucun conflit**. On obtenait un
  `curl localhost:11434` rassurant (les modèles de l'hôte) pendant que `ml` vers
  `http://ollama:11434` tombait en 404 sur un conteneur vide. Publication **retirée** : seul `ml` a
  besoin d'Ollama, par le réseau interne.

### Choix du modèle de génération — `qwen2.5:7b` (LIVRÉ 06/09/2026)

- **Méthode** : mesures de `/suggest` et `/summarize` en conteneur, budget de référence
  `IA_SUGGESTION_TIMEOUT_MS` = 60 s.
- **Deux biais de mesure identifiés et corrigés** avant toute conclusion. (1) **Contention
  mémoire** : les premières mesures avaient **deux modèles résidents** (14b 9 Go + 7b 4,7 Go) sur
  une machine de 15,5 Gio, ce qui triplait les latences. (2) **Effet du premier appel** :
  systématique sur les deux modèles, la première génération après un chargement coûte ~3× les
  suivantes, alors même que `/api/ps` déclare le modèle résident — un `num_predict:1` charge les
  poids mais ne réchauffe pas le chemin d'inférence.
- **Matrice corrigée** (CPU, un seul modèle résident, mesures répétées) :

  | | `qwen2.5:7b` | `qwen2.5:14b` |
  |---|---|---|
  | 1er appel après chargement | 32,3 s | **70,2 s** (hors budget) |
  | régime établi | **9,5 s** | 32,4 s |
  | coût par mot généré | 525 ms | 810 ms |

- **Décision : `7b` par défaut.** Motif retenu — **la garantie, pas la moyenne** : le 7b ne dépasse
  **jamais** le budget, y compris au premier appel, là où le 14b le dépasse à chaque chargement.
- **Comparaison de QUALITÉ sur les mêmes entrées** (n=1 par tâche, indicatif) : sur la suggestion
  RAG, le 7b s'est révélé **plus concret** (« réinitialiser le mot de passe du profil VPN via la
  console d'administration Active Directory », ancré sur 2 sources) que le 14b, resté vague et
  conseillant de « contacter le service IT » — conseil circulaire pour un ticket IT — sans jamais
  mentionner le certificat. Sur le résumé, égalité, le 7b retenant même la date précise omise par
  le 14b. **Explication plausible** : les deux tâches du produit sont de la **synthèse cadrée**, le
  RAG faisant le travail de recherche — régime où l'écart entre tailles de modèles se resserre.
  `[à confirmer par le juge J6 sur échantillon — non fait, jalon d'évaluation]`
- **`OLLAMA_KEEP_ALIVE=-1`** : le chargement n'est payé qu'une fois, au démarrage.
- **`docker-compose.gpu.yml`** en surcouche séparée : un bloc `deploy.resources.devices` **ne se
  dégrade pas** sur une machine sans GPU, il empêche le conteneur de démarrer. Le compose de base
  doit rester portable. `[chiffres GPU de la séance entachés par la contention mémoire — à
  re-mesurer proprement s'ils vont au rapport]`

### Test « serveur vierge » et trou de livraison comblé (LIVRÉ 06/09/2026)

- **Protocole** : projet Compose distinct (`-p livraison-test`), **volumes neufs**, ports décalés —
  téléchargement **réel** de 17 Go sans rien emprunter à la machine. Durées mesurées : `7b`
  1 361 s, `14b` 2 549 s, `bge-m3` 4 223 s, reranker 611 s. **Premier démarrage ≈ 80 min**
  (dominé par les modèles, dépend de la bande passante) ; **démarrages suivants ≈ 30 s**.
- **Ce que le test a trouvé** — et c'est sa vraie valeur : la pile démarrait avec **sept services
  `healthy` et ZÉRO catégorie en base**. Donc aucun ticket catégorisable, une administration vide,
  et `fetch_categories()` en échec côté IA. **Aucune alerte nulle part** — exactement la panne
  silencieuse que cette phase traque.
- **Cause racine : l'EMPLACEMENT du fichier**, pas la commande de démarrage. `tsconfig.json` ne
  compile que `src/**/*.ts` ; sous `prisma/`, le seed n'existait qu'en TypeScript et exigeait
  `tsx`, une **devDependency absente de l'image de production** (vérifié : seul `prisma` figure
  dans `node_modules/.bin`, et `dist/` ne contenait aucun seed). `npx prisma db seed` aurait donc
  échoué sur le serveur.
- **Correctif** : `prisma/seed.ts` devient `src/seed.ts` (il entre ainsi dans le build existant et
  produit `dist/seed.js`, exécutable par `node` seul) ; la commande du backend enchaîne
  **migrations → seed → serveur**. Le `&&` est délibéré : un seed en échec **empêche le serveur de
  démarrer** plutôt que de servir une base incomplète.
- **Amorçage de l'administrateur** par `ADMIN_EMAIL`/`ADMIN_PASSWORD`, avec trois garde-fous :
  **aucun identifiant par défaut** livré avec le produit ; **amorçage et non réinitialisation** —
  dès qu'un administrateur existe, ces variables sont sans effet, elles ne peuvent donc pas servir
  à reprendre la main sur une instance en service (vérifié : un `ADMIN_EMAIL` différent au
  redémarrage ne crée rien) ; **12 caractères minimum**.
- **Vérifié sur la pile neuve** : 5 catégories, administrateur créé **et connecté** (200 + jeton,
  donc hachage exploitable), `fetch_categories` opérationnel, `/classify` servi par le classifieur
  **désormais versionné** (43 Ko committés — sans lui, `artifacts/` étant gitignoré, un dépôt
  fraîchement cloné donnait un 503), et un premier ticket enrichi de bout en bout
  (`CLASSIFICATION « Matériel » 0,479` et `PRIORISATION`).
- **Dette assumée et documentée** : `container_name` fixé en dur empêche deux instances de la pile
  de coexister sur une machine ; le préchauffage du seeder ne couvre pas le contexte long, le tout
  premier `/suggest` reste à 26,2 s contre 9,5 s ensuite — dans le budget, donc non traité.
- **Reste** : environnement de démonstration final, doc API (Swagger), préparation soutenance.
  `[À COMPLÉTER PAR FEDI]`

---

# Chantier 1 — Affectation automatique et absences (§6.2)

> Exigence du CDC §6.2 identifiée **manquante** à l'inventaire : « Affectation automatique
> ou manuelle du ticket à un technicien selon la charge de travail et la catégorie ».
> Livré en 8 étapes, chacune fermée par une porte de preuve avant de passer à la suivante.
> Branche `docker`, commits `837d74b` → `3332478`.

## Inventaire de départ — ce qui existait vraiment

- **Date** : 07/09/2026. `[établi en séance]`
- **Affectation** : 100 % manuelle, administrateur seul (`affecter()`, `PATCH
  /api/tickets/:id/affectation`, un `<select>` sur le détail de ticket). **Aucun appel
  automatique nulle part** : un ticket naissait `NOUVEAU` non assigné et y restait.
- **Charge des techniciens** : déjà calculée et affichée (« Charge par technicien »), mais
  **enfouie** dans `statistiques()` — un `Promise.all` de 8 requêtes dont on ne pouvait pas
  extraire la charge seule —, renvoyant des **noms et non des ids**, filtrée par le
  périmètre du tableau de bord, et **omettant les techniciens à 0** (un `groupBy` ne rend
  pas de ligne vide) : précisément ceux qu'une affectation doit préférer.
- **Notion de spécialité** : **inexistante**. `Utilisateur` n'avait que `service` et
  `poste`, deux champs de **texte libre**, non éditables après l'invitation, et jamais
  reliés aux catégories.

## Deux découvertes faites en préparant la migration (Étape 1)

### Les index de recherche du module IA avaient disparu de la base

- **Date** : 09/09/2026. `[établi en séance]`
- **Constat** : les migrations J4 (HNSW sur l'embedding) et J6 (GIN sur le tsvector) sont
  marquées **appliquées** — `finished_at` renseigné, aucun rollback — et leurs colonnes
  existent, mais **les deux index étaient absents**. Un `EXPLAIN` sur une requête
  plein-texte donnait `Seq Scan` : la recherche dense du RAG et l'arm lexical J6 tournaient
  **sans leurs index**.
- **Cause** : non prouvable a posteriori. La seule mécanique connue capable de cela est
  exactement celle que la migration J6 documentait déjà — un outil qui aligne la base sur
  `schema.prisma` supprime les objets SQL bruts qu'il ne voit pas.
  > **Mise à jour du 10/09/2026 — la cause est désormais ÉTABLIE.** Voir la note
  > rétrospective en fin de « Chantier 2 » : restaurer les index a réactivé le piège et
  > l'a rendu visible. Ces lignes n'apparaissaient pas ici pour la seule raison qu'il n'y
  > avait alors plus rien à supprimer.
- **Impact** : nul et invisible à 869 tickets, bloquant à l'échelle visée (§7 : réponse IA
  < 5 s, montée en charge sans refonte). C'est pour cela que personne ne l'avait vu.
- **Traitement** : recréés en `IF NOT EXISTS` dans la migration du chantier, donc
  rejouables. **Vérifié après application que le planificateur les utilise réellement**
  (`Bitmap Index Scan` sur le GIN, `Index Scan` sur le HNSW) — il ne suffisait pas qu'ils
  soient présents.

### Le piège Prisma est permanent sur ce projet

- **Constat** : `prisma migrate diff` produit systématiquement
  `ALTER TABLE "tickets" ALTER COLUMN "recherche_texte" DROP DEFAULT`, en croyant voir un
  DEFAULT sur une colonne `GENERATED ALWAYS STORED`.
- **Vérifié empiriquement** sur la base, en transaction annulée : PostgreSQL répond
  `ERROR: column ... is a generated column / HINT: Use ... DROP EXPRESSION instead`.
  Appliquée telle quelle, **la migration entière aurait avorté**.
- **Règle** : toute migration générée sur ce projet ressortira cette ligne et devra être
  relue à la main. Consigné en tête du fichier de migration, pas seulement ici.

## Les décisions, et leurs raisons

### La spécialité est un FILTRE DUR, pas un bonus

- **Décision** : le pool se réduit d'abord aux spécialistes disponibles de la catégorie ;
  la charge n'arbitre qu'**à l'intérieur** de ce pool. Conséquence assumée et **figée par
  un test** : un spécialiste à 12 tickets l'emporte sur un généraliste à 0.
- **Pourquoi** : le §6.2 demande d'affecter « selon la charge **et** la catégorie ». La
  catégorie est lue comme une **contrainte de compétence**, la charge comme l'arbitre entre
  compétents. Router un ticket réseau vers un généraliste disponible mais non formé serait
  un faux gain. Un score mêlant les deux exigerait d'inventer une pondération que **rien
  dans les données ne justifie** — même refus que pour la pondération par priorité.

### Le mode par défaut est MANUEL, et tous les replis y ramènent

- **Décision** : ligne absente en base, valeur illisible, base injoignable → **MANUEL**.
- **Pourquoi** : l'absence de configuration doit reproduire le **comportement actuel** de
  l'application, jamais provoquer une bascule silencieuse. Le sens du repli est **testé**,
  pas seulement le repli : huit entrées illisibles sont balayées pour vérifier qu'aucune ne
  peut produire `AUTO`. Un repli du mauvais côté activerait l'affectation automatique sur
  une simple valeur corrompue.

### La confidentialité du motif tient par construction, à trois barrières

- **Décision** : le motif d'absence n'existe **ni** dans le type de retour de
  `chargeCourante()`, **ni** dans la liste des utilisateurs, **ni** dans la réponse des
  statistiques. Il n'apparaît que sur la page Absences, réservée à l'administrateur.
- **Pourquoi** : le graphique « Charge par technicien » est gardé par `estSupport` — donc
  **visible par tous les techniciens**, pas seulement par l'administrateur. Afficher le
  motif y exposerait les arrêts `MALADIE` à toute l'équipe, une donnée de santé. La fuite
  est rendue **impossible sans modifier d'abord le dépôt**, plutôt qu'évitée par
  discipline. Vérifié en sérialisant la réponse complète vue par un compte technicien.

### Deux fuseaux horaires, pour deux questions différentes

- **Décision** : « quel jour sommes-nous ? » se calcule en **fuseau métier**
  (`Africa/Tunis`) ; « quel jour représente cette valeur de la base ? » se lit en **UTC**.
- **Pourquoi** : vérifié contre PostgreSQL **avant** d'écrire le code — Prisma matérialise
  une colonne `DATE` à **minuit UTC** (`DATE '2026-08-20'` revient en
  `2026-08-20T00:00:00.000Z`). La relire dans le fuseau métier fonctionnerait *par chance*
  à Tunis (décalage positif) et renverrait **la veille** sur un décalage négatif
  (`America/New_York` → `2026-08-19`). Le coût métier de l'erreur inverse est chiffré par
  un test : à 23h30 UTC il est déjà le lendemain à Tunis, donc sans le fuseau métier **un
  technicien rentrant de congé resterait exclu de l'affectation une heure chaque nuit**.
- **Corollaire** : les dates d'absence sont en `@db.Date` et non en timestamp — une absence
  est un **intervalle de calendrier**, pas un intervalle d'instants. « Fin le 20 » à 00h00
  ne couvrirait pas le 20 du tout. Bornes **incluses** des deux côtés.

### `dernierTicketAssigne` est une approximation, et le restera

- **Décision** : le départage à charge égale utilise la **date de création du dernier
  ticket assigné**, et non la date d'affectation.
- **Pourquoi** : les événements `AFFECTATION` stockent le **nom** du technicien
  (`nomComplet(technicien)`) et **non son id**. Le nom n'est pas une clé de jointure fiable
  (homonymes, changement de nom) : la requête exacte **ne peut pas exister** en l'état.
  Consigné dans le code pour éviter qu'on le « corrige » plus tard vers une jointure
  impossible. **À traiter au Chantier 2**, dont la page d'audit rencontrera le même mur.

### Le départage est un ordre TOTAL, sinon il est intestable

- **Décision** : charge croissante → dernier ticket assigné le plus ancien (`null`, jamais
  servi, devant) → **id croissant**.
- **Pourquoi** : sans le troisième rang, deux techniciens strictement identiques donneraient
  un résultat dépendant de l'ordre de la base — non reproductible, donc non testable. Sans
  le deuxième, le troisième favoriserait éternellement le même technicien. L'indépendance à
  l'ordre de la liste est vérifiée sur trois permutations.

### « Tous les spécialistes absents » ne coûte aucune branche

- **Décision** : l'absence est filtrée **avant** la spécialité.
- **Pourquoi** : le pool de spécialistes disponibles devient simplement vide et l'on retombe
  sur le repli déjà écrit. Seul le **motif** distingue la situation
  (`REPLI_SPECIALISTES_ABSENTS` / `REPLI_AUCUN_SPECIALISTE` / `REPLI_CHARGE`), calculé après
  coup et **sans effet sur la décision** : il sert le diagnostic de l'administrateur.

### Le cœur d'affectation est partagé, la garde ne l'est pas

- **Décision** : `appliquerAffectation()` extrait de `affecter()` — événement, mise à jour,
  journal, notification. `affecter()` garde sa garde administrateur et passe de 41 à 12
  lignes ; le chemin automatique appelle le même cœur.
- **Pourquoi** : `affecter()` exigeait un administrateur, ce qui le rendait **inutilisable
  depuis la création** où l'acteur est le demandeur, un employé. L'affectation automatique
  hérite ainsi gratuitement de la trace et de la notification. Effet de bord heureux : la
  condition « ne pas se notifier soi-même » (`technicien.id !== auteurId`) est **toujours
  vraie** quand l'auteur est `null`, donc un technicien auto-affecté est toujours notifié —
  le bon comportement, sans code supplémentaire.

### `auteur_id` nullable en `ON DELETE RESTRICT`, et non `SET NULL`

- **Décision** : `NULL` signifie « Système » et **rien d'autre**.
- **Pourquoi** : Prisma générait un `ON DELETE SET NULL` pour la relation devenue
  optionnelle. Sans la garde `Restrict`, supprimer un compte **relabelliserait ses actions
  passées en actions système** — une trace d'audit qui ment. Effet de bord : le diff a cessé
  de vouloir détruire et recréer la clé étrangère, soit une opération risquée en moins.

### `AFFECTATION_AUTO` est un type distinct

- **Pourquoi** : un auteur `null` seul ne suffirait pas — tout événement système n'est pas
  une affectation automatique. Un type dédié rend la fonctionnalité **dénombrable et
  filtrable**, ce dont le Chantier 2 aura besoin.

### Le contrat non négociable, tenu à deux niveaux

- **Décision** : la création d'un ticket ne doit **jamais** échouer à cause de l'affectation
  automatique. `affecterAutomatiquement()` absorbe le choix et l'écriture ; `creer()`
  enveloppe **en plus la lecture du mode**.
- **Pourquoi** : sans ce second filet, une base de paramètres injoignable ferait échouer une
  création de ticket. Le ticket est déjà committé et la réponse est déjà due au demandeur :
  une affectation qui n'aboutit pas est un travail pour l'administrateur, pas une erreur
  pour l'utilisateur. Vérifié : avec zéro technicien actif, la création réussit, le ticket
  reste `NOUVEAU`, et la raison est journalisée.

### Les absences sont un mécanisme distinct de `actif`

- **Pourquoi** : désactiver un compte **coupe la connexion** — c'est fait pour un départ,
  pas pour un congé. Un technicien absent garde son accès complet, ses tickets déjà
  assignés ne bougent pas, et il **redevient disponible tout seul** à la date de fin : c'est
  l'argument décisif d'une table datée sur un simple booléen, qu'il faudrait penser à
  remettre à zéro. Le statut et la durée sont **calculés**, jamais stockés — un statut
  stocké deviendrait faux tout seul au passage de minuit.
- **Chevauchements interdits** (409) : deux absences qui se recouvrent n'apportent aucune
  information — « absent » est un état booléen sur un jour donné — mais rendraient ambigus
  le motif du jour commun, la date de fin affichée, et l'effet d'une suppression.
  L'interdiction garantit **au plus une absence en cours par technicien**, ce dont dépendent
  la règle d'affectation et le marqueur de charge. Les périodes **contiguës** restent
  autorisées.
- **Absences passées acceptées** : c'est le cas le plus courant (« il était malade lundi, on
  l'apprend mardi ») et elles n'ont aucun effet sur l'affectation, qui ne regarde que le
  jour courant. L'interdire serait une contrainte sans bénéfice.

### Le motif est une énumération, pas du texte libre

- **Pourquoi** : le projet a **déjà fait l'erreur inverse** avec `service`, impossible à
  joindre de façon fiable aux catégories — c'est précisément pourquoi les spécialités
  passent par une table de liaison. Du texte libre produirait « congé », « Congés »,
  « vacances », « CP » : quatre motifs distincts, non filtrables. Le `commentaire`
  optionnel récupère l'expressivité perdue.

## Ce qui a été prouvé, et comment

- **80 tests purs** (`node:test`, zéro I/O) : registre de paramètres 18, disponibilité 23,
  règle d'affectation 34, statut de catégorie 5. Chaque étape est **verte avant tout
  branchement**.
- **Non-régression du chemin manuel** vérifiée contre l'API HTTP réelle, chaque assertion
  doublée d'une lecture en base, plus un test vérifiant que **zéro** événement
  `AFFECTATION_AUTO` est produit par le chemin manuel.
- **Six scénarios d'affectation** contre la base et le service IA réels, dont deux construits
  **pour détecter, pas pour passer** : le cas « catégorie choisie par le demandeur » oppose
  une catégorie déclarée `Matériel` à une suggestion IA `Réseau` **à 0,813 de confiance** —
  et le ticket part au spécialiste Matériel ; le cas « IA coupée » déclare exprès un
  spécialiste Réseau, dont la sélection aurait prouvé une fuite de catégorie.
- **Bout en bout sur la pile reconstruite**, avec redémarrage : mode, absences et spécialités
  survivent. Toutes les vérifications sont **non destructives**, base rendue à l'identique
  (869 tickets) — y compris celle qui a dû déplacer temporairement un ticket vers
  l'administrateur pour exercer une branche que les données ne couvraient pas.
- **Note d'outillage** : `npm run build` (`tsc -b`) est plus strict que `tsc --noEmit` et a
  rattrapé une variante d'`Alert` inexistante. C'est lui la porte côté frontend.

## Dettes assumées et documentées

- **§6.5 — seuils IA non réglables** : le seuil de confiance (0,5) est une **constante en
  dur, dupliquée** entre le frontend (`SEUIL_CONFIANCE_AFFICHAGE`) et le backend
  (`SEUIL_CONFIANCE_AFFECTATION`). La table `parametres` est **prête à les accueillir** —
  un nouveau réglage y coûte une ligne, pas une migration — mais **rien n'est livré**.
  ⚠️ Ne pas l'affirmer en soutenance.
  > ✅ **DETTE LEVÉE LE 24/09/2026** — partiellement, et la nuance compte. Le seuil
  > d'**affichage** est réglable (registre, §6.5), la **porte d'abstention** du RAG aussi.
  > En revanche `SEUIL_CONFIANCE_AFFECTATION` **reste en dur** : les deux sont désormais
  > **découplés**, ce qui est assumé et énoncé dans l'aide de l'écran. La prédiction « une
  > ligne, pas une migration » s'est vérifiée. Cf. « Seuils de confiance IA réglables ».
- **Stock existant non traité à la bascule** : passer en AUTO n'affecte que les tickets
  **créés ensuite**. Les tickets déjà en attente restent non assignés. Le trou est **nommé à
  l'écran** (« N tickets non assignés — ce changement ne les affecte pas ») ; son traitement
  est reporté au **Chantier 2**.
- **Périmètre de la charge** : le graphique respecte les filtres du tableau de bord, donc
  « charge par technicien » filtrée sur août signifie *tickets ouverts créés en août* — un
  mélange entre un **état courant** et une **période**. Pré-existant, **délibérément non
  modifié** : le rendre non filtré aurait changé le comportement du tableau de bord au-delà
  du périmètre validé.
- **`DeprecationWarning` de `pg`** sur le chemin création/notification. Vérifié qu'il ne
  provient **ni** d'un `Promise.all` simple **ni** de `chargeCourante()` : pré-existant,
  invisible jusqu'ici parce que les journaux partaient dans le conteneur. Non traité.
- **`container_name` en dur** : déjà consigné en Phase 7, toujours valable — deux instances
  de la pile ne peuvent pas coexister sur une machine.
- **Auto-déclaration des absences par le technicien** : écartée en v1. Toute l'administration
  est `requireRole('ADMINISTRATEUR')` sans exception, et un technicien pourrait s'exclure
  unilatéralement de l'affectation sans validation. Évolution naturelle : auto-déclaration
  **soumise à validation**.
- **Pondération de la charge par priorité** : écartée, faute de poids justifiables par les
  données. Perspective documentée, non fabriquée.

---

# Chantier 2 — Traçabilité exploitable (§7)

> Exigence non fonctionnelle du CDC §7 : « Journalisation (logs) des actions critiques :
> création, affectation, modification de statut des tickets ». Satisfaite sur le papier
> depuis juillet — et pourtant inexploitable, pour des raisons mesurées ci-dessous.
> Livré en 8 étapes (lots A, B, C, E), branche `docker`, commits `2be7c32` → `2c2a780`.

## Le chiffre qui justifie le chantier

- **Date** : 10/09/2026. `[établi en séance]`
- **Mesuré au démarrage** : il restait **21 lignes `[AUDIT]`** dans les journaux du
  conteneur, pour un projet qui trace **depuis le 11 juillet**. Non par rotation — aucune
  n'était configurée — mais parce que **chaque `docker compose build` recrée le conteneur
  et emporte ses journaux**. Le conteneur avait été créé la veille.
- **Autrement dit** : l'exigence §7 était tenue littéralement, et avait retenu **moins
  d'une journée d'historique**. C'est l'argument à donner tel quel : la conformité de façade
  se mesure, elle ne se discute pas.

## L'inventaire, avant tout plan

| Point | État constaté |
| --- | --- |
| `EvenementTicket` | Lisible **ticket par ticket** uniquement — aucune route transversale, 4 chemins de lecture tous internes |
| Hors tickets | **22 actions sensibles, 1 tracée** : `auth.service` 0/12, `categorie.service` 0/4, `utilisateur.service` 1/6, déploiement IA 0 |
| Cible des affectations | Stockée en **NOM**, jamais en id — et cette base compte **35 comptes pour 31 noms distincts** |
| Stock non assigné | **53 tickets** en attente d'affectation |
| `logAudit` | 17 appels, tous en console volatile |

## Les décisions, et leurs raisons

### Table SÉPARÉE, et non une extension de `EvenementTicket`

- **Décision** : `JournalAudit`, sans relation cascade.
- **Pourquoi, et c'est l'argument qui tranche** : `evenements_ticket.ticket_id` est en
  `ON DELETE CASCADE` — **supprimer un ticket efface sa trace**. Constaté malgré moi au
  Chantier 1 : chaque script de test supprimait son ticket, et le compteur d'événements
  revenait à son point de départ au lieu d'augmenter. **Une trace qui disparaît avec
  l'objet audité n'est pas une trace.** S'y ajoutent deux raisons : une connexion ou un
  déploiement de modèle n'ont aucun ticket à rattacher, et les deux tables ont des publics
  et des durées de vie différents. Le doublonnage des actions ticket est assumé.

### `acteurId` en `SET NULL`, avec `acteurNom` dénormalisé

- **Pourquoi** : la trace doit **survivre à la suppression du compte**. En `RESTRICT`, on
  interdirait toute suppression ; en `SET NULL` seul, l'entrée deviendrait anonyme — et
  pire, `null` signifierait à la fois « action du système » et « compte disparu ».
  **C'est le NOM qui désambiguïse**, jamais le `null` : « Système » est écrit en toutes
  lettres, le nom réel sinon. Transposition directe de la leçon du Chantier 1 sur
  `AFFECTATION` (id **et** nom, deux questions différentes).

### `AsyncLocalStorage` — et le renversement qu'a produit la mesure

- **Problème** : `logAudit` est appelé à dix-sept endroits **enfouis dans la couche
  service**, et les services ne voient jamais `req` — `connecter(input)` reçoit un DTO.
  Les alternatives étaient de contaminer dix-sept signatures et tous leurs appelants, ou
  de tracer au niveau HTTP en perdant les noms d'action.
- **LE RENVERSEMENT** : le plan anticipait une **perte** du contexte sur les traitements
  lancés sans être attendus, et prévoyait d'assumer `ip = null`. Mesure faite sur un
  serveur Express réel, avec le patron exact du code (`void genererSuggestion(...)`),
  lecture **120 ms après le départ de la réponse** : **le contexte SURVIT**.
  `AsyncLocalStorage` suit la chaîne asynchrone, pas le cycle de vie HTTP.
- **Conséquence** : le risque n'est pas de perdre le contexte, c'est de **l'hériter**.
  Sans barrière, un traitement système écrirait au journal l'IP et le nom de l'utilisateur
  dont la requête l'a déclenché — **et lui attribuerait une action qu'il n'a pas faite**.
  Un journal qui **ment** est pire qu'un journal incomplet. `executerSansContexte` change
  donc de nature : pas un utilitaire de confort, une **barrière obligatoire**.

### Le bug que la porte de preuve a attrapé

- **Constat, en base, au premier passage de l'étape A3** :
  `TICKET_AFFECTATION | Demandeur Production`. L'affectation **automatique** attribuée au
  **demandeur du ticket** — un employé qui n'a ni le droit d'affecter ni fait cette action.
- **Correction** : barrière posée **à l'intérieur** de `affecterAutomatiquement`,
  conditionnée à `auteurId === null`, et non au site d'appel. Ce paramètre encode déjà
  « décidé par le système » ; la règle devient *« pas d'auteur humain, donc pas de contexte
  humain »* — et elle tiendra pour l'affectation en lot, où l'administrateur **est**
  l'acteur et doit conserver son contexte. Une barrière, deux usages couverts.
- **Barrières préventives** ensuite posées sur les trois chemins différés
  (`genererSuggestion`, `genererResume`, `genererExtraction`). Aucun n'écrit au journal
  aujourd'hui — mais la ré-classification après OCR passe par là, et faire dépendre la
  correction d'une vigilance future serait rejouer ce bug.

### L'anti-énumération, préservée et prouvée mécaniquement

- **Contrainte** : `connecter()` masque délibérément l'existence d'un e-mail — comparaison
  bcrypt systématique contre un hash factice (anti-timing), message identique pour
  « compte inconnu » et « mot de passe faux ».
- **Preuve** : l'empreinte des cinq réponses a été capturée **avant** toute modification,
  puis **après**, et les deux fichiers ont le **même MD5** (`e47f8c47…`). Vérification
  mécanique, pas une inspection.
- **Les trois modes d'échec sont distingués DANS LE JOURNAL, et seulement là.**
  L'administrateur voit la différence, l'attaquant ne la voit pas. `options.acteur` était
  nécessaire : à la connexion, aucun jeton n'a encore été vérifié, donc le contexte ne
  porte aucune identité — sans cette surcharge, une tentative aurait été attribuée à
  « Système », ce qui aurait été faux. Distinction retenue : `id` = identité **confirmée**,
  `nom` = identité **présentée**.

### Le mur des noms, cassé — et sa part irréductible assumée

- **Problème** : « toutes les affectations vers X » était sans réponse fiable. Le nom n'est
  pas une clé de jointure : **deux comptes affectables** partagent « Fadi Zaghdoud ».
- **Décision** : colonne `cibleId` **à côté** du nom, pas à sa place. L'id répond à « vers
  quel compte », le nom d'époque à « qu'affichait-on alors ». Subtilité de la
  désaffectation : `nouvelleValeur` y vaut `null` — personne ne reçoit le ticket — et la
  cible se lit dans `ancienneValeur`.
- **Reprise partielle, mesurée à blanc avant écriture : 10 des 14 résolus, 4 non.**
  **Ces quatre restent NULL, délibérément.** Choisir l'un des deux comptes serait deviner,
  et une trace devinée est pire qu'une trace absente : elle attribuerait à quelqu'un une
  action qui n'est peut-être pas la sienne. L'écran **annonce** la limite.
- **Prouvé contre le mécanisme** : un ticket affecté puis désaffecté au **second** des deux
  homonymes donne 2 événements par `cibleId`, là où le nom en rend 5 répartis sur 2 comptes.

### Reprise de l'historique : 51 événements importés

- **Pourquoi** : sans elle, la page d'audit s'ouvrirait **vide** — et surtout, l'historique
  existe déjà, il est simplement dans une autre table. Le journal couvre donc **depuis le
  11 juillet**.
- **Ce qui est honnêtement inconnu reste NULL** : `ip` et `userAgent` n'ont jamais été
  capturés à l'époque. Chaque ligne porte `importeDeLHistorique: true`, pour que l'écran
  dise « contexte de requête inconnu » au lieu de laisser croire à une trace complète.

### Rétention 12 mois, et la limite écrite plutôt que cachée

- **Cadre** : finalité **sécurité et redevabilité** — détecter les accès anormaux, répondre
  à « qui a changé ce rôle, et quand ». **Pas** un outil de mesure de l'activité des
  employés. Accès **administrateur uniquement**. Durée **12 mois** : un cycle annuel
  complet, sans conserver indéfiniment des adresses IP, qui sont des données personnelles.
- **Purge lancée après `listen` et non attendue** : l'API sert déjà quand elle s'exécute,
  donc ni sa lenteur ni son échec ne peuvent retarder le démarrage. *Un journal trop long
  est un problème d'hygiène, une API qui ne démarre pas est une panne.*
- **LIMITE ASSUMÉE** : le projet n'a **aucun planificateur**. La purge est déclenchée au
  démarrage, et nulle part ailleurs. **Une instance qui tournerait plus de douze mois sans
  redémarrer ne purgerait pas.** En pratique la pile redémarre à chaque déploiement, mais
  la limite est réelle — elle est écrite en tête du service, pas laissée à découvrir.
- Le 29 février reculé de douze mois tombe sur une année non bissextile : `Date` reporte au
  1er mars. Le **sens** du décalage est testé — un jour de trop conservé est anodin, un jour
  de trop supprimé effacerait une trace prématurément.

### La page : tri, curseur, et ce qu'elle refuse de laisser deviner

- **L'ordre est `dateCreation DESC, id DESC`, jamais `id DESC` seul.** Les entrées importées
  ont les identifiants les plus élevés et les dates les plus anciennes : **mesuré, les 94
  lignes d'alors occupaient un rang différent selon l'un ou l'autre tri.** Un tri par id
  aurait remonté les plus anciennes en tête.
- **Le détail est traduit, pas affiché en JSON** : couples avant/après regroupés en un
  énoncé titré (« Priorité : Moyenne → Haute »), codes devenus phrases
  (`MOT_DE_PASSE_INVALIDE` → « Mot de passe incorrect »).
- **Trois natures d'acteur jamais confondues** : compte confirmé · Système · **non
  authentifié**. Sans la troisième, un échec de connexion sur une adresse d'administrateur
  afficherait ce nom comme acteur et se lirait comme si l'administrateur avait agi.
- **Panneau latéral obtenu en ajoutant une variante au `Dialog` existant**, pas en créant
  un composant : échappement, piège de focus, fermeture au clic sur le fond et animation
  sont le code déjà en place. Additif — les quatre usages actuels sont inchangés.

## Ce qui a été prouvé, et comment

- **103 tests purs** (`node:test`, zéro I/O), dont **16** sur le contexte de requête :
  survie à `await`, aux `await` imbriqués et à `setTimeout`, **isolation entre requêtes
  concurrentes** (la plus lente ne doit pas lire l'IP de la plus rapide — le mode de
  défaillance qui rendrait le journal activement trompeur), coupure effective de
  l'héritage ; et **7** sur le calcul de rétention.
- **Contrat vérifié en rendant la table injoignable** : la création de ticket répond 201, le
  ticket est en base, le filet écrit « l'action n'est pas interrompue », et la table est
  restaurée. Une base d'audit en panne ne bloque pas le métier. Même vérification au
  démarrage : purge impossible, `/api/health` répond 200.
- **Pagination éprouvée sur la zone piégeuse** : parcours complet par pas de dix, séquence
  comparée à la vérité terrain SQL — aucun doublon, aucun trou, ordre identique, première
  entrée importée au rang 46 et non en tête.
- **Index vérifiés par EXPLAIN**, pas supposés présents (leçon du Chantier 1).
- **Toutes les vérifications non destructives**, base rendue à l'identique à chaque fois.

## Dettes assumées et documentées

- **Lot D non livré** — le **bouton d'affectation du stock** (53 tickets non assignés au
  moment de l'inventaire) reste à décider. La bascule en mode AUTO ne concerne toujours que
  les tickets créés ensuite ; l'écran le dit.
- **4 événements d'affectation antérieurs** restent non rattachables à un compte. Affiché.
- **Purge au démarrage uniquement** (voir ci-dessus).
- **`logAudit` n'est pas transactionnel** avec l'action tracée : une coupure juste après
  peut perdre la ligne. L'alternative — attendre l'écriture — ajouterait de la latence à
  chaque action et laisserait une base d'audit indisponible bloquer le métier. Mauvais
  échange, documenté en tête du module.
- **`TICKET_PIECE_JOINTE` et `TICKET_AFFECTATION_AUTO_SANS_SUITE`** n'ont pas été déclenchés
  lors de la vérification (envoi multipart ; zéro technicien actif) — non comptés comme
  vérifiés.
- **Hors périmètre, volontairement** : pagination infinie · export CSV/PDF · recherche
  plein-texte · filtre par cible · alertes automatiques sur échecs répétés · rétention
  configurable depuis l'interface · traçage des **lectures** (qui a consulté quel ticket),
  dont le volume serait disproportionné.

## Note rétrospective sur le Chantier 1

La cause de la disparition des index HNSW et GIN, notée alors comme **« non prouvable a
posteriori »**, **est établie**. En préparant la migration de ce chantier, `prisma migrate
diff` a produit **trois** lignes destructrices au lieu d'une : les deux `DROP INDEX` en plus
du `DROP DEFAULT` déjà connu. Ces `DROP INDEX` n'apparaissaient pas au Chantier 1 **pour la
seule raison que les index étaient alors déjà absents** — il n'y avait rien à supprimer.
Les avoir restaurés a réactivé le piège et l'a rendu visible : Prisma voit ces index en
base, ne les trouve pas dans `schema.prisma` (SQL brut qu'il ne sait pas exprimer) et
propose systématiquement de les effacer.

Un **filet** est désormais posé : les deux `CREATE INDEX IF NOT EXISTS` sont rejoués à
chaque application de la migration du Chantier 2. Cette migration ne peut plus laisser la
base dans l'état où le Chantier 1 l'a trouvée.

---

# Passe interface — photo de profil, et le mode sombre chiffré puis écarté

> Trois demandes d'interface traitées le **16/09/2026**, branche `audit-et-HR`. Deux
> suppressions d'affichage trompeur, une fonctionnalité livrée, et **un chantier chiffré
> puis refusé en connaissance de cause** — c'est ce dernier point qui a le plus de valeur
> pour la soutenance : une estimation sert aussi à décider de ne pas faire.

## Ce que l'interface annonçait, et qui était faux

Inventaire au départ : l'application présentait comme **« à venir »** des modules
**déjà livrés**.

| Emplacement | Ce qui était affiché | Réalité |
| --- | --- | --- |
| Sidebar, section « À venir » | « Statistiques — Phase 4 » (grisé) | `features/statistiques/` livré, rendu dans le tableau de bord |
| Sidebar, section « À venir » | « Base de connaissances — Phase 5 » (grisé) | Hors périmètre assumé, mais annoncé comme imminent |
| Tableau de bord, « Feuille de route du projet » | Carte « Assistant IA — Phase 5 » | Module IA livré : `features/ia/`, page `/administration/ia`, suggestions dans le détail ticket |
| Tableau de bord, « Feuille de route du projet » | Carte « Statistiques & SLA — Phase 4 » | Affichée **directement sous** `<TableauDeBord />`, qui rend ces statistiques |

Le cas du tableau de bord est le plus coûteux : c'est la **page d'accueil**, donc le
premier écran d'une démonstration, et la carte contredisait le composant situé juste
au-dessus d'elle. `[établi en séance]`

- **Sidebar** : section supprimée, avec le tableau `NAV_A_VENIR` et les imports devenus
  inutiles (`BarChart3`, `BookOpen`).
- **Tableau de bord** : section « Feuille de route » supprimée, `214 → 168 lignes`.
  `ShieldCheck` conservé — il sert au `StatCard` « Administrateurs ».

## Mode sombre — le chiffrage qui a fondé le refus

Demande initiale : un mode sombre. Réponse : **mesurer d'abord**. Relevé sur le frontend
avant toute décision.

| Mesure | Valeur relevée |
| --- | --- |
| Occurrences de couleurs Tailwind en dur | **549** |
| Fichiers concernés | **42 sur 62** |
| Occurrences de la variante `dark:` déjà présentes | **0** |
| Tokens **sémantiques** (`--color-surface`, `--color-text`, `--color-border`) | **aucun** — `@theme` ne définit que les rampes de marque `primary` / `accent` |
| Répartition | pages 258 · composants `ui` 139 · `layout` 80 · `features` 54 · `lib` 16 |
| Fichier le plus chargé | `TicketDetailPage.tsx`, **89 occurrences** — 16 % du total à lui seul |

**Sur la configuration** : le projet est en **Tailwind v4** (configuration *CSS-first*,
`@tailwindcss/vite`) — il n'existe donc aucune clé `darkMode` dans un fichier de config,
et son absence n'est pas un manque. La variante `dark:` est disponible nativement mais
suit `prefers-color-scheme` (réglage du système). Un **bouton** dans l'interface aurait
demandé une ligne : `@custom-variant dark (&:where(.dark, .dark *));`.

**Deux zones redoutées qui n'en étaient pas** — vérifiées avant de les inscrire au coût :

- **Les graphiques** : aucune librairie de *charts*. `CarteBarres` dessine des `div` CSS
  (rail `bg-slate-100`, remplissage en dégradé). Rien à re-thémer au-delà de deux classes.
- **Les exports PDF / Excel** : `exportRapport.ts` porte **sa propre palette**
  (`#4f46e5`, `setTextColor(30, 41, 59)`), sans aucun lien avec le CSS de l'application.
  Un document exporté reste clair par nature. **Coût nul.**

**Les vraies zones à risque** : `TicketDetailPage` (89), les badges de statut — les
teintes `-50` / `-100` sont conçues pour du blanc et disparaissent sur fond sombre, chacune
demandant sa contrepartie —, le panneau d'audit et sa page (21 + 20), `StatCard` (26) dont
les dégradés et auras floutées sont calibrés pour le clair, et la couche `base` de
`index.css` (fond `#f6f7fb`, halos radiaux, `ring-offset-white`, couleurs de barre de
défilement).

**Chiffrage** : voie propre (tokens sémantiques puis migration des 549 sites) **2,5 à 3,5
jours** ; voie rapide (`dark:` posés en place) 1,5 à 2 jours, au prix d'un doublement des
chaînes de classes sur 42 fichiers.

## Les décisions, et leurs raisons

### Mode sombre : NON, et la raison est une probabilité, pas un goût `[établi en séance]`

- **Décision** : écarté. **Alternative écartée** : la voie rapide en `dark:`, qui aurait
  tenu en 1,5 jour — refusée avec la voie propre, pour le même motif de fond.
- **Raisons données** : le chantier représentait **le temps restant en totalité**, sans
  faire avancer le rapport ; et **un mode sombre à moitié fait est pire que pas de mode
  sombre** — un panneau resté blanc en pleine démonstration se voit immédiatement. Avec
  **549 sites**, la probabilité d'en oublier au moins un a été jugée trop élevée.
- **Ce que cette décision vaut pour la soutenance** : c'est un arbitrage **chiffré**. La
  question « pourquoi pas de mode sombre ? » a une réponse en nombres, pas en préférence.
- **Contrainte d'ordonnancement notée** : si le chantier devait être repris un jour, il
  faudrait le faire **avant** toute passe de polissage page par page — sinon les mêmes
  écrans seraient rouverts deux fois.

### Photo de profil : URL directe, sans proxy `[établi en séance]`

- **Décision** : `photoUrl` est la `secure_url` Cloudinary, **servie directement au
  navigateur**.
- **C'est un choix différent de celui des pièces jointes**, qui sont **proxifiées** par le
  backend (`telechargerPieceJointe`) pour qu'aucun fichier ne soit lisible sans
  authentification. L'écart est assumé et pour deux raisons : l'identifiant public
  Cloudinary est aléatoire, donc l'URL n'est pas devinable ; et proxifier chaque avatar
  ajouterait **un aller-retour backend par ligne** dans les listes de tickets.
- **Conséquence inscrite au cadre des données personnelles** : les photos de profil sont
  servies par URL directe à identifiant aléatoire — une URL divulguée reste lisible sans
  session. Écrit ici pour que le choix soit visible, pas découvert.

### Photo de profil : hors journal d'audit `[établi en séance]`

- **Décision** : aucun événement d'audit sur le changement ou le retrait de photo.
- **Raison** : le journal vise les actions **d'administration et de sécurité**. Changer sa
  propre photo est du self-service anodin ; l'y verser **diluerait le signal** que le
  Chantier 2 a précisément cherché à rendre exploitable.

### `photoCloudinaryId` conservé, et détruit dans le bon ordre

- Le `public_id` est stocké à part du `photoUrl`. **Sans lui, chaque changement de photo
  laisserait un fichier orphelin** sur le compte Cloudinary — la colonne `cloudinary_id`
  des pièces jointes existait déjà « pour une suppression ultérieure » depuis J8bis, sans
  qu'aucune fonction de suppression n'ait jamais été écrite. Elle l'est maintenant.
- **L'ancienne image n'est détruite qu'APRÈS l'enregistrement de la nouvelle** : si la
  mise à jour échouait, la photo encore référencée en base existerait toujours.
- La suppression est **best-effort et silencieuse** : l'utilisateur a demandé à changer sa
  photo, pas à faire le ménage. Son échec ne doit pas faire échouer l'opération.
- **Champ retiré de la réponse** : `photoCloudinaryId` est ajouté à la liste noire de
  `toPublicUser`. Sans être un secret, c'est une référence interne au stockage ; le client
  n'a besoin que de `photoUrl`.

### Normalisation à l'upload plutôt qu'à l'affichage

- Transformation Cloudinary appliquée **au moment de l'envoi** : carré de 256 px,
  `gravity: face`, `quality: auto`. L'image est **stockée déjà recadrée**, ce qui borne le
  poids servi quelle que soit la taille du fichier d'origine.
- **Alternative écartée** : transformer à la volée dans l'URL d'affichage — même rendu,
  mais l'original lourd resterait stocké et servi tant que l'URL n'est pas réécrite.

## Ce qui a été prouvé, et comment

- **Deux points de sérialisation vérifiés avant d'écrire la moindre ligne** :
  `toPublicUser` fonctionne en **liste noire** (retire les secrets, propage le reste) — le
  champ remonte donc seul dans `/auth/moi`, la connexion et les endpoints utilisateurs ;
  `utilisateurPublicSelect` de `ticket.repository` est une **liste blanche**, et a demandé
  **une ligne** pour que demandeur, technicien et auteur portent la photo.
- **Les trois autres sélections d'utilisateur ont été inspectées et volontairement laissées
  telles quelles** : `absence.repository` (2), `affectation.repository` (2) et
  `findManyByIds` ne servent que des libellés de noms — aucun avatar n'y est rendu.
- **Les 9 points d'appel d'`<Avatar>`** ont été recensés puis câblés : sidebar, tableau de
  bord, profil, détail ticket (×3), liste des tickets (×2), gestion des utilisateurs.
- **Migration additive et idempotente** (`ADD COLUMN IF NOT EXISTS` ×2), écrite à la main —
  `prisma migrate diff` **n'a pas été sollicité**, conformément à la leçon des Chantiers 1
  et 2. Aucune ligne destructrice ne peut s'y trouver.
- **Appliquée et vérifiée en base** : les deux colonnes existent, `nullable`, sur les
  **35 comptes** ; **0 porte une photo**, ce qui correspond exactement au comportement
  antérieur (retour aux initiales sur fond coloré).
- **69 tests sur 69 au vert**, `tsc --noEmit` propre des deux côtés, `eslint` et `oxlint`
  sans nouvelle remarque, build frontend réussi.

## Dettes assumées et documentées

- **Mode sombre non livré**, chiffré à 2,5–3,5 jours par la voie propre. L'interface
  utilise des couleurs directes ; une **tokenisation sémantique**
  (`--color-surface` / `--color-text` / `--color-border`) en est le préalable. Évolution
  **identifiée et chiffrée**, non engagée.
- **Photos servies par URL directe** — voir la décision ci-dessus. Une URL divulguée reste
  lisible sans session.
- **Aucune trace d'audit sur les photos** — choix, pas oubli.
- **L'administrateur ne peut pas changer la photo d'un autre compte.** Les routes sont
  strictement self-service : la cible vient du jeton, jamais du corps de la requête.
- **Vérification de bout en bout non faite** : l'upload réel vers Cloudinary n'a pas été
  déclenché dans cette séance. Le chemin est typé, contrôlé à la compilation et calqué sur
  celui des pièces jointes — il n'est pas pour autant *exécuté*. À faire avant la
  démonstration, comme pour `TICKET_PIECE_JOINTE` au Chantier 2.
- **Trou d'affichage dans la grille de graphiques** : un employé voit 3 cartes dans une
  grille à 2 colonnes, la troisième occupe donc seule sa rangée. Le trou préexistait ; il
  est devenu la fin de page depuis le retrait de la feuille de route. Non traité.

---

# Correctif — le reranker retiré du préchauffage (mémoire rendue, attribution corrigée)

> Séance du **19/09/2026**, branche `audit-et-HR`. Point de départ : une vérification
> d'annexe avant rédaction du rapport — « le reranker est-il vraiment désactivé par
> défaut ? ». La lecture du code a montré autre chose qu'un composant désactivé : un
> composant **jamais câblé**, dont on préchauffait quand même les **~2,3 Go** à chaque
> démarrage. La séance a mesuré, corrigé, remesuré — et au passage **réfuté une
> attribution de cause inscrite en Phase 7**. C'est ce second point qui compte le plus
> pour la soutenance : une mesure qui corrige une mesure antérieure.

## Le constat, établi par lecture puis confirmé à l'exécution

Trois faits, chacun vérifiable indépendamment :

| Fait | Preuve |
| --- | --- |
| `RERANK_ACTIF_DEFAUT` n'était lue par aucune ligne de code | `grep` sur le dépôt : sa définition, plus quatre mentions en documentation. Zéro lecture. |
| La porte qui seule appellerait le reranker ne s'ouvre jamais | `if seuil is not None` avec `SEUIL_ABSTENTION_DEFAUT = None`, que rien ne règle (aucune variable d'environnement ; `SEUIL_CONFIANCE_IA` absent du registre backend, §6.5) |
| `POST /rerank` n'a aucun appelant dans le projet | le backend n'appelle que `/classify` et `/suggest` ; aucune occurrence de `rerank` dans `backend/src` ni `frontend/src` |

Confirmation à l'exécution, et c'est elle qui tranche : **`confiance = None` sur les trois
appels `/suggest` de la mesure de référence**, puis sur les six de la mesure d'après. Le
champ `confiance` n'est renseigné que si la porte s'ouvre. Elle ne s'est jamais ouverte.

## Les mesures — avant, après

Protocole identique de part et d'autre : `docker compose down`, puis `up -d`, attente de
`/sante`, attente de la fin du préchauffage, relevés `docker stats` au repos, série de
`POST /suggest` sur une requête unique. Cache HF déjà peuplé dans les deux cas.

| Mesure | Avant | Après |
| --- | --- | --- |
| Lignes `[warmup]` | 3 — `embeddings 4,9 s` · `classifieur 0,0 s` · `reranker 2,3 s` | 2 — `embeddings 4,7 s` · `classifieur 0,0 s` |
| **RAM du conteneur `ml` au repos** | **5,104 GiB** (32,95 %) | **2,737 GiB** (17,67 %) |
| RAM, conteneur recréé (contrôle) | — | 2,799 GiB (18,07 %) |
| `/sante` → `reranker.modele_charge` | `true` | `false` (clé conservée) |
| `/suggest` #1 | **40,9 s** | **33,3 s** |
| `/suggest` suivants | 15,1 · 13,7 s | 10,7 · 11,2 · 10,9 · 10,7 · 10,8 s |
| `confiance` rapportée | `None` ×3 | `None` ×6 |
| `/rerank` à chaud | 0,53 s | 0,45 · 0,42 s |
| `/rerank` premier appel | 0,53 s (préchauffé) | **3,45 s** (chargement paresseux) |
| Suite de tests ML | — | **56 passed** |

**Gain net : −2,3 Go de RAM résidente** (5,104 → 2,799 GiB sur conteneur neuf).

Deux contrôles d'équivalence, parce qu'une baisse de RAM ne vaut rien si le comportement
change :

- `/rerank` rend des scores **identiques au bit près** avant et après —
  `[0.0007941364892758429, 1.6183814295800403e-05, 0.4577465355396271]`.
- `modele_charge` bascule `false → true` au premier `/rerank`, la RAM passant de 2,82 à
  **5,27 GiB**. Ce **+2,45 GiB** mesure l'empreinte du reranker par une seconde voie,
  indépendante de la première, et confirme que c'est bien lui qu'on a cessé de charger.

**Ce que l'on ne prétend PAS.** Le gain de latence sur `/suggest` (40,9 → 33,3 s, puis
~14 → ~11 s) **n'est pas attribué au correctif** : le reranker n'a jamais été dans ce
chemin, en retirer le préchauffage ne peut pas l'accélérer directement. L'explication
plausible est indirecte — 2,3 Go rendus sur un hôte de 15,49 GiB qui fait aussi tourner
Ollama. À retenir comme « aucune dégradation », pas comme une accélération.

> ⚠️ **RECTIFIÉ LE 21/09/2026 — les lignes `/suggest` de ce tableau comparent deux
> régimes différents et ne doivent pas être lues comme un avant/après.** Les appels
> « suivants » à ~10,8 s étaient des **abstentions** (`abstenu=True`), dont la réponse
> générée est courte ; l'appel #1, lui, produisait une suggestion citée. Or la génération
> coûte ~135 ms par jeton de sortie : un chemin court et un chemin long ne se comparent
> pas. Mesuré ensuite à requêtes toutes non abstenues, le régime réel est de **19 à 27 s**
> sur CPU, jamais ~11 s. **La prudence affichée ci-dessus (« aucune dégradation, pas une
> accélération ») reste donc juste, mais pour une raison plus forte que celle écrite :
> les deux séries n'étaient pas comparables.**
>
> **Le correctif lui-même n'est en rien remis en cause** — il ne portait pas sur la
> latence : RAM 5,104 → 2,799 GiB, `/rerank` identique au bit près, `/classify` dans son
> budget, 56 tests au vert. Ces lignes-là sont mesurées à protocole constant.
>
> Leçon de méthode, à retenir pour le mémoire : **une médiane n'a de sens que sur une
> population homogène.** Il fallait séparer les appels abstenus des autres avant de
> comparer quoi que ce soit. Cf. la section « Latence de la suggestion » en fin de journal.

## Le coût du reranker, enfin mesuré — la mesure qui manquait au dossier

Jusqu'ici, la décision de ne pas câbler le reranker s'appuyait sur **un bénéfice mesuré**
(l'ablation) et **un coût de prose** : le « ~8 s/requête » inscrit au journal ne venait
d'aucun artefact — le JSON d'ablation ne contient aucun champ de latence, et les deux
chiffres par paire en circulation (368 ms dans la docstring du module, 410 ms au
dimensionnement J6) ne concordaient pas. Mesure faite le 19/09/2026 pour clore ce trou.

**Protocole.** `POST /rerank` sur **20 documents réels de la base de connaissances**
(K = `K_CANDIDATS` livré), extraits par la requête exacte du harnais — `_FILTRE_KB` plus
le `COALESCE(t.resolution, 1er commentaire)` de `_charger_docs`, au format reranké
`titre / description / résolution`. Longueur des documents : min 228, médiane 330, max 426
caractères. Requête = un ticket VPN entrant de 255 caractères. `max_length = 512`, le
défaut **réellement livré** (et non le 256 du dimensionnement annoncé). Trois mesures à
froid, chacune sur un conteneur `ml` recréé.

| Série | Médiane | Étendue |
| --- | --- | --- |
| **À froid, K=20** (chargement du modèle inclus) | **9,98 s** | 9,24 – 10,04 |
| **À chaud, K=20** | **6,86 s** | 6,63 – 7,08 → **343 ms/paire** |
| **À chaud, K=1** (coût qu'aurait la porte d'abstention) | **0,379 s** | 0,349 – 0,405 |

**Ce que le chiffre change, et ce qu'il ne change pas.**

- **L'argument de latence tient, et devient vérifiable.** 6,86 s à chaud dépasse le budget
  CDC de < 5 s. Le « ~8 s » de la prose était donc du bon ordre de grandeur, légèrement
  surestimé ; il est remplacé partout par **6,86 s mesuré**. Les 343 ms/paire mesurés se
  situent entre les deux chiffres qui circulaient, sans les départager rétroactivement —
  ils ont été relevés sur une autre configuration (`max_length=512`, corpus réel).
- **Mais il ne justifie que le non-réordonnancement.** La **porte d'abstention** ne
  rerank qu'une seule paire : **0,379 s**, soit ~3 % d'un `/suggest` qui coûte déjà 11 à
  33 s à cause de la génération. **La latence n'est donc pas ce qui tient la porte
  fermée** — c'est l'absence de seuil calibré (posture J5 : aucun seuil figé sur du
  synthétique). Distinction à tenir en soutenance : un jury qui entend « trop lent »
  demandera pourquoi la porte, elle, n'est pas branchée.

La décision repose désormais sur **un bénéfice mesuré** (nDCG@5 +0,01, MRR −0,06 sur le
réel, n=25) et **un coût mesuré** (6,86 s à K=20), sans rien d'invérifiable.

## L'attribution des 71,1 s, réfutée par expérience

L'entrée de Phase 7 attribuait un premier `/suggest` à 71,1 s au chargement du reranker
dans la requête. La mesure de référence l'a contredite : **tout étant préchauffé,
reranker compris, le premier `/suggest` coûtait encore 40,9 s.** Le surcoût survivait donc
au préchauffage.

Expérience à **variable unique** pour isoler la cause — service `ml` laissé intact,
bge-m3 chargé, reranker **non** chargé (`modele_charge: false` vérifié à chaque étape),
seul le LLM déchargé puis rechargé côté Ollama :

| Étape | État Ollama | `/suggest` |
| --- | --- | --- |
| A — témoin | `qwen2.5:7b` résident | **13,0 s** |
| B — `ollama stop qwen2.5:7b` | vide | **39,8 s** |
| C — rechargé par l'appel B | `qwen2.5:7b` résident | **11,3 s** |

Le surcoût suit l'état d'Ollama, pas celui du reranker, et l'étape B reproduit les 40,9 s
du premier appel. **Cause réelle : le chargement de `qwen2.5:7b` par Ollama à la première
génération** — non récurrent ensuite grâce à `OLLAMA_KEEP_ALIVE=-1`.

*Enseignement de méthode, à réutiliser :* l'entrée de Phase 7 a attribué un coût au seul
composant qu'elle venait d'ajouter au préchauffage, sans l'isoler. Le correctif n'a pas
consisté à mieux raisonner, mais à **ne changer qu'une variable à la fois**.

## Ce qui a été livré

| Fichier | Changement |
| --- | --- |
| `service/app.py` | `reranker.charger_modele` retiré de `_prechauffer()` — **suppression sèche, pas de drapeau**. Un `IA_WARMUP_RERANKER` aurait recréé la confusion de `RERANK_ACTIF_DEFAUT` : il aurait laissé croire qu'on *active* le reranker alors qu'on ne ferait que le *charger en RAM*. Commentaire remplacé par l'état réel, avec la consigne de **remettre le préchauffage ici** si `suggestion.py` est recâblé. *(24/09/2026 : la porte est devenue réglable et le préchauffage n'a PAS été remis — ce service est sans état, il ignore si la porte est ouverte ; le chargement paresseux coûte ~3,5 s hors temps de réponse.)* |
| `retrieval/config.py` | `RERANK_ACTIF_DEFAUT` **supprimée**. Un drapeau qui ne commande rien est pire qu'une absence de drapeau. Remplacée par un commentaire disant les trois vérités : constante morte, porte fermée, ordre `"rrf"` en dur. |
| `eval/run_retrieval.py` | Le harnais **imprimait `RERANK_ACTIF_DEFAUT=False` dans le pied de chaque rapport d'ablation généré**. Sans retouche, toute régénération future aurait cité une constante disparue. |

Les deux rapports d'ablation archivés (`ml/eval/reports/j6/` et `ml/artifacts/eval/`)
**n'ont pas été touchés** : artefacts datés du 27/07/2026, les réécrire falsifierait la
trace de ce qui avait été décidé alors. La rectification vit ici, pas dans l'archive.

## Ce qui a été prouvé, et comment

- **Le reranker ne s'exécutait pas** — `confiance = None` sur neuf appels `/suggest` au
  total, avant comme après.
- **Il coûtait ~2,3 Go** — deux mesures indépendantes : la différence avant/après au repos
  (5,104 → 2,799 GiB) et le saut au chargement paresseux (2,82 → 5,27 GiB).
- **Le correctif ne casse rien** — scores `/rerank` identiques au bit près, `/classify`
  dans son budget (3,55 s au premier appel, puis 0,19 et 0,25 s), **56 tests au vert**.
- **Les 71,1 s ne venaient pas du reranker** — expérience à variable unique, trois points.

## Dettes assumées et documentées

- **Le dimensionnement annoncé n'est pas celui qui tourne.** Le journal J6 inscrit comme
  décision NFR `K_prod=10, max_length=256` (mesuré : 4,08 s, sous le budget CDC < 5 s,
  contre 10,6 s à K=20). Le code livré porte `K_CANDIDATS = 20` (`retrieval/config.py`) et
  `RERANK_MAX_LENGTH` par défaut **512** (`service/config.py`) ; ni le `docker-compose.yml`
  ni `.env.example` ne les surchargent. Vérifié à l'exécution : `/sante` rapporte
  `"max_length": 512`. **Écart signalé, délibérément non corrigé dans cette séance** — il
  ne change rien tant que le reranker reste hors du chemin, mais il devra être tranché
  *avant* tout recâblage, sinon le premier usage réel partirait sur un dimensionnement
  explicitement écarté à la mesure. ⚠️ **Renforcé le 24/09/2026** : ce recâblage n'exige
  plus de toucher au code — **un administrateur peut ouvrir la porte depuis l'écran
  Paramètres**. L'écart de dimensionnement devient donc atteignable en exploitation, et
  non plus seulement par un développeur averti. Le coût reste modeste (la porte ne rerank
  qu'UNE paire, 0,379 s mesurés) mais l'arbitrage `max_length` n'est toujours pas tranché. À ne pas présenter en soutenance comme « dimensionné
  pour la production » : le dimensionnement a été *mesuré*, pas *appliqué*.
- **`POST /rerank` reste un endpoint sans appelant.** Conservé volontairement : il est le
  point d'entrée qui rend le composant démontrable en soutenance, et le seul moyen de
  l'exercer sans modifier le code. Son premier appel paie désormais 3,45 s de chargement.
- **La porte d'abstention reste un mécanisme sans réglage.** `SEUIL_ABSTENTION_DEFAUT =
  None` est cohérent avec la posture J5 (aucun seuil figé sur du synthétique), mais tant
  que `SEUIL_CONFIANCE_IA` n'entre pas au registre des paramètres (§6.5), le mécanisme
  n'est pas atteignable en exploitation.
  > ✅ **RÉSOLU LE 24/09/2026** : la porte est réglable depuis l'écran Paramètres
  > (`IA_SEUIL_ABSTENTION`, bornes 0,05–0,95, fermée par défaut). Le mécanisme est donc
  > atteignable — mais **aucune valeur n'est recommandée**, faute de calibration
  > transférable : l'écran le dit, et le réglage reste un choix d'exploitation.
- **La comparaison de latence est bruitée.** À requête identique, le premier appel a rendu
  une suggestion citée et les suivants se sont abstenus par grounding, dans les deux
  séries. Les écarts de quelques secondes entre séries ne sont pas interprétables.

---

# Latence de la suggestion — où passe réellement le temps, et ce que la mesure a corrigé

> Séance des **20–21/09/2026**, branche `audit-et-HR`. Point de départ : un premier
> `/suggest` à 33 s, qu'on croyait dû au chargement du LLM. La séance a **réfuté
> successivement trois hypothèses** — le cache d'invite, le chargement du modèle, le
> préchauffage du chemin de génération — avant d'établir la vraie cause dominante :
> **l'inférence tourne à 100 % sur processeur**. Elle a aussi invalidé une comparaison
> antérieure et mis au jour une limite de la garde d'ancrage. Plusieurs des résultats
> ci-dessous sont des *réfutations* : c'est leur intérêt.

## Ce qui a été réfuté, et par quoi

| Hypothèse | Verdict | Ce qui l'a tranchée |
| --- | --- | --- |
| Le cache d'invite gonflait nos mesures « à chaud » | **Réfutée** | Série de 6 tickets **différents** (médiane 23,85 s) contre le **même** ticket ×6 (25,36 s) : répéter ne va pas plus vite |
| Le premier appel paie le chargement de `qwen2.5:7b` | **Réfutée** | Journal Ollama : **1 seul** chargement depuis le boot, celui d'`ollama-prefetch`, et **0 éviction** ; le modèle était résident |
| Le surcoût vient du chemin de génération non préchauffé | **Réfutée** | Un `/api/chat` de production joué *avant* le premier `/suggest` ne change rien : 43,55 s → 44,28 s |

## L'inférence tourne à 100 % sur processeur — **deux causes distinctes**

C'est le facteur dominant de **toutes** nos latences, et il faut nommer les deux causes
séparément, car on les confond volontiers :

1. **Le compose de base ne passe pas le GPU au conteneur.** `docker inspect` →
   `DeviceRequests: []` ; le journal Ollama annonce `inference compute id=cpu library=cpu`
   et `vram-based default context total_vram="0 B"`. Ollama **ignore jusqu'à l'existence**
   de la carte. C'est un choix documenté : `deploy.resources.devices` ne dégrade pas sur
   une machine sans GPU, il **empêche le conteneur de démarrer** — le compose de base est
   la voie de livraison, il doit rester portable.
2. **Et même avec le GPU passé, les 4 Go de VRAM ne suffisent pas.** `qwen2.5:7b` pèse
   ~5 Go chargé : le déport ne peut être que **partiel**.

La première cause est une décision d'architecture, la seconde une contrainte matérielle.
La lever ne suffit pas à lever l'autre.

## Où passe le temps — plan 2×2 (CPU)

Sonde directe sur `/api/chat`, compteurs internes d'Ollama (qui séparent le traitement de
l'invite de la génération), **12 invites distinctes, une par appel**, variantes
entrelacées. *Un premier jet rejouait les mêmes invites d'une variante à l'autre et
mesurait en réalité le cache de préfixe (`prompt_eval` tombait à 0,16 s) — refait.*

| Variante | Invite | `prompt_eval` | Sortie | **ms/jeton** | Mur |
| --- | --- | --- | --- | --- | --- |
| RAG longue + schéma *(production)* | 509 j | 9,64 s | 71 j | **138,3** | 22,75 s |
| RAG longue, sans schéma | 522 j | 8,18 s | 64 j | **133,2** | 16,80 s |
| Courte + schéma | 269 j | 1,97 s | 86 j | **136,8** | 12,47 s |
| Courte, sans schéma *(témoin)* | 256 j | 2,51 s | 74 j | **136,7** | 13,23 s |

Trois lectures, de la plus solide à la plus fragile :

1. **La vitesse de génération est constante : ~135 ms/jeton (~7,4 jetons/s) dans les
   quatre cases.** C'est la signature d'une inférence CPU, et le signal le plus net.
2. **Le traitement de l'invite croît fortement avec sa longueur** — ~260 jetons → ~2,0–2,5 s,
   ~510 jetons → ~8,2–9,6 s. Le coût *par jeton* double aussi (7–10 → 16–19 ms), cohérent
   avec une attention quadratique.
3. **L'effet du décodage contraint (`format=schema`) est dans le bruit.** Il n'est pas le
   coupable. Prudence assumée : les valeurs individuelles sont dispersées.

Le chemin de production se décompose donc en **~9,6 s d'invite + ~9,8 s de génération**,
moitié-moitié, le reste étant de l'enveloppe.

## Le GPU — le levier principal, déjà présent au dépôt

Surcouche `docker-compose.gpu.yml`, qui ne vise que le service `ollama` : **`ml` n'a pas
accès au GPU**, bge-m3 et le classifieur restent sur CPU et ne disputent pas les 4 Go.
Déport mesuré : `load_tensors: offloaded 12/29 layers to GPU`, `ollama ps` →
`55%/45% CPU/GPU`, **~2,3 Go de VRAM occupés sur 4**.

| Mesure | CPU seul | Avec la surcouche | Facteur |
| --- | --- | --- | --- |
| `/suggest`, médiane (6 tickets, hors 1ᵉʳ) | **23,85 s** | **8,54 s** | **2,8×** |
| Traitement de l'invite (509 jetons) | 18,9 ms/jeton | **1,4 ms/jeton** | **13,8×** |
| Génération | 138,3 ms/jeton | **91,5 ms/jeton** | 1,5× |
| Mur, chemin de production | 22,75 s | **6,15 s** | 3,7× |

L'écart se loge presque entièrement dans le **traitement de l'invite**, parallélisable donc
porté par les couches déportées. La génération ne gagne que 1,5×, limitée par la bande
passante mémoire et par les **17 couches sur 29 restées au processeur**.

> ⚠️ **Réserve à ne jamais omettre en soutenance : ce gain est propre à CETTE machine.**
> Il ne se transpose pas à un serveur de livraison sans GPU, où les latences CPU
> ci-dessus restent la référence. Le compose de base demeure le défaut portable ; la
> surcouche est la **configuration de démonstration**, documentée comme telle au README.

## Le surcoût du premier appel — reproductible, **non attribué**

| Configuration | 1ᵉʳ `/suggest` | Régime du même boot | Excédent |
| --- | --- | --- | --- |
| CPU | 43,55 s | 26,55 / 25,60 s | **+17,5 s** |
| CPU, avec préchauffage du chemin de production | 44,28 s | 30,15 / 29,47 s | **+14,5 s** |
| GPU | 16,18 s | 8,54 s | **+7,6 s** |

Reproductible (42,73 puis 43,55 s sur deux boots), payé **une fois par redémarrage du
service `ml`**, donc **sans effet en exploitation** : un service qui tourne ne le paie
plus. Recherche de cause **arrêtée** par décision.

**Hypothèse testée et réfutée** : le préchauffage d'`ollama-prefetch` n'emprunte pas le
chemin de production (`/api/generate`, invite courte, sans schéma) alors que `/suggest`
utilise `/api/chat` avec ~510 jetons et `format=schema`. Un appel manuel reproduisant
exactement le chemin de production, joué **avant** le premier `/suggest`, n'a rien changé
(43,55 → 44,28 s, excédent +17,5 → +14,5 s, écart noyé dans la variance entre boots).

**Observation ouverte, non expliquée** : l'excédent **diminue nettement en configuration
GPU** (+17,5 → +7,6 s) alors que `ml` — bge-m3, classifieur, Postgres — reste intégralement
sur CPU dans les deux cas. C'est ce qui avait motivé l'hypothèse « le surcoût est dans
Ollama », laquelle a pourtant été réfutée. La contradiction est consignée telle quelle,
sans explication de complaisance.

## Variance entre démarrages — règle de lecture

Deux boots CPU, même protocole, ont donné des régimes de **~26 s** et **~30 s**. Soit
~15 % d'écart imputable à la machine (thermique, charge de fond) et non au code.

> **Règle : aucune mesure de latence prise sur un seul démarrage ne doit être lue à mieux
> que ~15 % près.** Les comparaisons de cette séance qui portent sur moins que cela — le
> +17,5 contre +14,5 s ci-dessus — ne concluent rien, et c'est écrit.

## Déterminisme — pourquoi deux clics peuvent différer

Constat de départ : la même requête a rendu `abstenu=False` puis `abstenu=True`. Deux
explications ont été écartées **par le code** :

- **Effet d'état** (le ticket deviendrait son propre candidat) : impossible. Aucun
  `INSERT`/`UPDATE`/`DELETE` dans `retrieval/` ni `service/app.py` — `/suggest` lit, Node
  reste seul écrivain — et le filtre KB n'admet que `RESOLU`/`CLOTURE`.
- **Température** : `generation.py` passe explicitement `temperature=0.0`, écrasant le
  défaut 0,8 du client. Le décodage est **glouton**, il n'y a pas de tirage aléatoire.

Le mécanisme réel est ailleurs. L'abstention observée est celle **d'ANCRAGE**, décidée
**après** génération (`if not sources`), selon que le modèle a cité ou non des `#id`
valides. Or un décodage glouton n'est reproductible que si le **chemin numérique** est
identique ; il ne l'est pas nécessairement d'un appel à l'autre (état du cache KV,
découpage des lots). Près d'une frontière de décision, un quasi-ex æquo bascule.

**Corroboration** : à invites et température identiques, la passe GPU a produit des
citations différentes de la passe CPU (#168 : 3 sources → 2 ; #170 : 2 → 3).

> **Conséquence pour l'interprétation de TOUTES nos mesures de qualité** : elles ont été
> prises **sur CPU**. La configuration GPU **diffère sur les citations limites**. Les
> chiffres d'ablation, de κ et de macro-F1 du journal restent ceux du CPU ; ne pas les
> présenter comme valables à l'identique en configuration de démonstration.

Ce n'est pas systématique : six appels sur un même ticket ont donné 6/6 le même résultat.
Seuls les cas limites basculent.

## Tickets de démonstration — critère 5/5

22 tickets réels testés, **5 appels consécutifs chacun**, en configuration GPU. Critère de
sélection : **même décision d'abstention ET mêmes sources citées sur les 5 appels**.

| Ticket | Catégorie | Cas | Sources | Médiane |
| --- | --- | --- | --- | --- |
| **#282** Provisionnement VPN prestataire | Accès | multi-sources (3) | `[38, 124, 644]` | 9,54 s |
| **#151** Station d'accueil ne charge pas | Matériel | multi-sources (2) | `[28, 678]` | 6,36 s |
| **#323** DNS ne résout plus les internes | Réseau | **source unique** | `[606]` | 6,63 s |
| **#108** Élévation droits admin | Accès | multi-sources (3) | `[70, 691, 760]` | 8,71 s |
| *(réserve)* **#330** Besoin logiciel notes | Autre | source unique | `[209]` | 7,76 s |

**Exclus** : #289, #290, #154, #267, #339 — **instables**, la variation portant toujours
sur **une** source à la marge, jamais sur la décision d'abstention. Exclu aussi **#168**,
stable mais à 23,41 s de médiane contre 6–13 s pour les autres.

**Abstention : aucune dans les 22 tickets réels.** La KB de 723 documents couvre tout ce
vivier. Pour la démontrer, il faut un ticket **hors périmètre**, créé en direct et annoncé
comme tel. Retenus, 5/5 en version **accentuée** (celle qui sera tapée — les accents
déplacent les valeurs : 0,77 → 0,7496) :

- **Écran Dell qui clignote** — classifieur `Matériel` **0,7496**, abstention 5/5, 17,26 s.
  Cas principal : le classifieur a raison **et** le RAG reconnaît qu'aucun ticket passé ne
  couvre le problème. Deux briques indépendantes, deux formes d'honnêteté.
- **Fuite d'eau dans les sanitaires** — classifieur `Matériel` **0,4296**, abstention 5/5,
  7,31 s. En secours.

Fidélité vérifiée : Node envoie `{titre, description}` **bruts**, sans prétraitement ni
ajout du texte OCR — l'appel direct est identique au chemin de l'interface. *Contrainte de
mise en scène : `demanderSuggestion` exige un ticket **`EN_COURS`** et un demandeur
**technicien assigné ou administrateur**.*

## Le classifieur n'est pas calibré — et cela se verra

Il attribue **toujours** l'une des cinq catégories : il n'a pas de classe « hors
périmètre ». Sur nos candidats hors domaine, la confiance tombe à **0,29–0,49** contre
**0,7496** pour un cas du domaine — le modèle exprime son doute par une confiance basse,
pas en changeant de classe. À dire au jury plutôt qu'à masquer.

L'interface le traduit par un **seuil d'affichage** : `SEUIL_CONFIANCE_AFFICHAGE = 0.5`
(`frontend/src/pages/TicketDetailPage.tsx`). Sous ce seuil la catégorie **n'est pas
masquée** — elle est grisée (`opacity-60`) et accompagnée de « ⚠ Faible confiance — à
préciser ». Le pourcentage est toujours affiché. Écran Dell → « confiance 75 % », sans
avertissement ; plomberie → « confiance 43 % » **avec** l'avertissement.

> **Dette** : c'est une **constante en dur dans le frontend**, distincte du seuil
> d'abstention du modèle. Elle rejoint la liste des seuils à rendre réglables par
> l'Administration (§6.5), aux côtés de `SEUIL_CONFIANCE_IA`, absent du registre backend.
>
> ✅ **FAIT LE 24/09/2026** : la constante est devenue le simple REPLI du frontend, la
> valeur venant du registre (`IA_SEUIL_AFFICHAGE`). `SEUIL_CONFIANCE_IA` n'a jamais été
> retenu comme nom : les clés livrées sont `IA_SEUIL_AFFICHAGE` et `IA_SEUIL_ABSTENTION`.

## La garde d'ancrage ne vérifie pas la pertinence — le résultat le plus important

L'entrée **J6b** rapportait deux abstentions de démonstration : « imprimante HP » et
« écran Dell ». **Une seule tient encore** avec la KB actuelle de 723 documents.

Le cas imprimante (stries d'impression) cite désormais le **ticket #735**. Lecture faite :
#735 s'intitule **« Imprimante HP bourrage papier »**, sa résolution est « un morceau de
papier coincé… retiré les débris du mécanisme d'alimentation ». **Aucun rapport de fond
avec des stries — un défaut de toner ou de tambour.** Le seul point commun est
« imprimante HP », et le ticket est par surcroît `synthetique`.

**Ce n'est donc pas une amélioration par croissance de la base : c'est un FAUX ANCRAGE.**

La limite, énoncée sans ménagement : le contrôle dit « anti-hallucination » de
`generation.py` **ne vérifie que la validité des identifiants cités** — que le `#id`
figure parmi les documents fournis. **Il ne vérifie pas la pertinence.** Un modèle qui
cite un document fourni mais hors sujet passe le contrôle sans être inquiété. La garde
protège contre l'**invention** d'une source, pas contre un **mauvais appariement**.

### Le reranker aurait-il séparé ce cas ? Non.

Le composant conçu pour juger la pertinence d'un couple requête-document existe — c'est le
reranker, et la porte d'abstention fermée ferait exactement ce contrôle. Mesure faite sur
16 couples, aux formats exacts de `score_abstention` :

| Score | Couple |
| --- | --- |
| 0,99723 | #151 → #28 *(légitime)* |
| 0,99640 | #323 → #606 *(légitime)* |
| 0,99555 | #151 → #678 *(légitime)* |
| 0,98917 | #108 → #760 *(légitime)* |
| 0,98305 | #108 → #70 *(légitime)* |
| **0,95973** | **imprimante → #735 — FAUX ANCRAGE** |
| 0,92328 | #282 → #38 *(légitime)* |
| 0,91168 | #282 → #124 *(légitime)* |
| 0,89262 | #282 → #644 *(légitime)* |
| 0,82486 | #108 → #691 *(légitime)* |
| 0,09502 | écran Dell → #465 *(abstention)* |
| ≤ 0,00506 | 5 autres candidats des cas d'abstention |

**Le faux ancrage obtient 0,96 — au-dessus des trois couples VPN du #282, pourtant
parfaitement pertinents. Aucun seuil ne peut l'écarter sans détruire des suggestions
légitimes.** Le reranker juge une **parenté thématique** (« deux pannes d'imprimante HP
avec résolution »), pas si la résolution traite le **symptôme**. La limite est donc plus
profonde qu'un réglage : elle ne se corrige pas en ouvrant la porte d'abstention.

Ce que la mesure montre en revanche, c'est que cette porte remplirait bien **sa fonction
d'origine** : les six candidats des cas d'abstention plafonnent à **0,095**, deux ordres de
grandeur sous les couples légitimes. Elle sépare « aucun document pertinent » de « un
document pertinent » ; elle ne sépare pas « pertinent » de « thématiquement voisin ».

> **Illustration, PAS calibration.** Seize couples ne fixent pas un seuil. Ce tableau
> montre une propriété qualitative, il ne fonde aucune valeur opérationnelle.

### Ce que ferait la porte d'abstention si on l'ouvrait

Vérifié dans `retrieval/suggestion.py` : la porte est évaluée **avant** la génération —
elle retourne (ligne 65) en amont de l'appel à `generation.generer` (ligne 69). L'ouvrir
aurait donc un effet réel, mais pas celui qu'on pourrait espérer :

- **Elle écarterait tôt les absences nettes de correspondance.** Sur ces seize couples,
  les candidats des cas d'abstention plafonnent à **0,095** quand les couples légitimes
  démarrent à **0,82** : un seuil intermédiaire les trancherait sans hésitation, et
  **économiserait la génération** — 10 à 25 s selon la configuration.
- **Mais elle ne changerait RIEN au faux ancrage**, qui score 0,96 et passerait toute
  porte laissant vivre les suggestions légitimes.
- **Et ces cas sont déjà rattrapés** en aval par l'abstention d'ancrage : le résultat
  rendu à l'utilisateur serait identique, seulement obtenu plus vite.

**Conclusion : l'intérêt d'ouvrir la porte est la LATENCE, pas la PERTINENCE.** C'est un
argument honnête pour le flywheel J9, et il ne faut pas le présenter comme un gain de
qualité. *Illustration sur seize couples, pas une calibration.*

### Pourquoi la décision finale reste au technicien — la raison est désormais mesurée

Le faux ancrage du #735 relie ce chapitre au choix d'architecture le plus structurant du
module : **la validation humaine**.

**Aucune garde automatique de la chaîne ne distingue une résolution thématiquement proche
mais fausse.** Ni le contrôle des identifiants cités — il vérifie qu'un `#id` figure parmi
les documents fournis, rien de plus. Ni le cross-encoder — il note 0,96 un couple jugé
faux à la lecture, au-dessus de couples parfaitement pertinents. Les deux gardes sont
efficaces contre ce pour quoi elles ont été conçues, l'invention d'une source et l'absence
de correspondance ; **aucune ne couvre le mauvais appariement**.

Le système est donc structurellement capable de produire une suggestion **bien formée,
correctement citée, traçable jusqu'à un ticket réel de la base — et fausse**. Un
technicien qui lirait #735 verrait immédiatement qu'un bourrage papier ne répond pas à des
stries d'impression ; aucun composant de la chaîne ne le voit.

**C'est ce qui fait passer la validation humaine du statut de principe de conception à
celui de garde-fou mesuré.** Elle n'est pas dans l'architecture par prudence de façade ni
par conformité : elle y est parce qu'**il existe une classe d'erreurs que rien d'autre,
dans cette chaîne, ne peut attraper** — et nous en tenons un exemple reproductible. Le
module *suggère* ; il ne décide pas. À présenter en soutenance avec ce cas à l'appui,
plutôt qu'avec une déclaration d'intention.

## Dettes assumées et documentées

- **Surcoût du premier appel non attribué** (~15–18 s sur CPU), recherche arrêtée par
  décision. Sans effet en exploitation, mais visible lors d'une démonstration juste après
  un redémarrage : **lancer un `/suggest` à blanc avant de présenter**.
- **Faux ancrage possible, et non détectable par les gardes en place** — ni le contrôle
  d'identifiants, ni le reranker. C'est la limite de fond du module de suggestion.
- **L'entrée J6b n'est plus reproductible** sur le cas imprimante. Conservée, rectifiée
  ci-dessus.
- ~~**`SEUIL_CONFIANCE_AFFICHAGE = 0.5` en dur dans le frontend**~~ — **réglable depuis le
  24/09/2026** ; la constante ne sert plus que de repli si le point d'entrée est indisponible.
- **Mesures de qualité prises sur CPU** ; la configuration GPU diffère sur les citations
  limites. Aucune n'a été rejouée sur GPU.

---

# Seuils de confiance IA réglables (§6.5) — et le découplage qu'il fallait dire

> Séance du **24/09/2026**, branche `8-seuils-confiance-ia-reglables`. Dernière
> fonctionnalité du §6.5 restée en dette : les seuils de confiance passent du code à
> l'écran d'administration. Deux clés, pas plus. Le fait marquant n'est pas la mécanique —
> le registre avait été conçu pour ça — mais ce que la tâche **oblige à dire** : un
> troisième seuil existe, il reste en dur, et le taire aurait créé une divergence
> silencieuse.

## Ce qui est livré

| Clé | Domaine | Défaut | Effet |
| --- | --- | --- | --- |
| `IA_SEUIL_AFFICHAGE` | nombre [0 ; 1] | **0,5** | sous ce seuil, la catégorie suggérée est grisée et marquée « à préciser » — **affichage seul** |
| `IA_SEUIL_ABSTENTION` | `DESACTIVE` ou [0,05 ; 0,95] | **`DESACTIVE`** | le RAG s'abstient **avant de générer** quand le meilleur candidat est sous le seuil |

Le défaut de chaque clé **reproduit exactement le comportement livré jusqu'ici** : 0,5 était
la valeur en dur du frontend, la porte était fermée. Une base non configurée ne bascule
donc rien — même règle que `AFFECTATION_MODE` avec `MANUEL`.

## Les décisions, et leurs raisons

### `DESACTIVE` est un état du domaine, pas un nombre magique

La porte fermée aurait pu se coder par un `null`, une chaîne vide, ou un `0`. Les trois ont
été écartés. `null` et la chaîne vide se confondent avec « valeur illisible », que le
registre traite déjà comme un repli ; et `0` serait un **piège** : avec `confiance < seuil`,
un seuil de 0 n'abstient jamais **tout en payant un rerank** — indiscernable de « fermée »
à l'écran, mais plus lent. D'où un type métier `number | 'DESACTIVE'` et un état explicite,
réversible d'un clic.

### Bornes 0,05–0,95 : les extrémités sont des pannes déguisées

À 0, on n'abstient jamais en payant le coût ; à 1, on abstient **toujours** et le module ne
sert plus à rien. Deux réglages qu'un administrateur prendrait pour un dysfonctionnement.
Ils sont refusés **en écriture** (400) et, en lecture, une valeur hors bornes retombe sur
la porte fermée — jamais sur un comportement ouvert. Test dédié : *« AUCUNE entrée illisible
ne peut OUVRIR la porte »*, pendant exact du fail-safe « jamais AUTO » du Chantier 1.

### Aucune valeur n'est recommandée, et l'écran le dit

Nous n'avons **pas de calibration transférable** : la posture J5 vaut toujours, et
l'illustration sur seize couples (cf. « Latence de la suggestion ») ne fonde aucun seuil.
Conséquence dans l'interface : activer la porte **ne pré-remplit rien**. Le curseur naît
sans valeur, affiche « — », et l'enregistrement reste refusé tant que l'administrateur n'a
pas tranché. Pré-remplir un chiffre, fût-ce la borne basse, aurait été le recommander.

### Le service IA reste sans état

Le seuil **voyage dans la charge utile** de `POST /suggest`. Node lit le registre au moment
où le technicien clique — et non dans le traitement différé, pour que le réglage appliqué
soit celui en vigueur à la demande — puis le transmet. Le service Python ne lit jamais le
registre, ne le met jamais en cache : il reçoit. Les bornes sont **revalidées côté Python**
(Pydantic `ge=0.05, le=0.95`), pas seulement côté Node : une charge utile forgée ne doit pas
pouvoir ouvrir la porte sur un réglage dégénéré.

### Pas de préchauffage du reranker, et c'est un choix

Ouvrir la porte fait charger le cross-encoder au premier usage : **~3,5 s une fois**, puis
**+2,4 Gio** sur le service IA **jusqu'à son prochain redémarrage** — il n'existe pas de
mécanisme de déchargement. On ne le préchauffe pas pour autant : le service est sans état et
**ignore si la porte est ouverte**. Le préchauffer « au cas où » rendrait ces 2,3 Go
inconditionnels — précisément ce que le correctif du 19/09 avait supprimé. Le chemin
`/suggest` étant asynchrone côté Node (budget 60 s), ces 3,5 s ne sont payées par **aucune
réponse HTTP**. Le coût est écrit sous l'interrupteur, avant la bascule, plutôt que
découvert après.

### Un point d'entrée étroit plutôt qu'un élargissement de droits

Le panneau de suggestion est visible du **technicien assigné**, qui a besoin du seuil
d'affichage — or `/api/parametres` est réservé à l'administrateur. Plutôt que d'ouvrir le
registre entier, `GET /api/parametres/affichage` expose **la seule valeur nécessaire au
rendu**, à tout utilisateur authentifié. Déclaré avant la garde d'administration, qu'il
n'atteint donc jamais.

## Le découplage qu'il fallait dire

Un **troisième** seuil à 0,5 existe : `SEUIL_CONFIANCE_AFFECTATION`
(`services/affectation.regle.ts`), qui décide si la catégorie suggérée sert à choisir un
technicien spécialisé. Son commentaire disait « **aligné sur** le seuil d'affichage du
frontend » — vrai tant que les deux étaient la même constante écrite deux fois.

Rendre l'un réglable et laisser l'autre en dur **les fait diverger**. Un administrateur
abaissant l'affichage à 30 % verrait des catégories présentées comme sûres que l'affectation
continuerait d'ignorer sous 50 %, sans qu'aucun écran ne l'explique.

**Décision : périmètre strict à deux clés, et découplage ÉNONCÉ plutôt que subi.** Le
commentaire du backend est corrigé, et surtout l'aide de l'écran Paramètres le dit noir sur
blanc : « Ce réglage ne change que l'affichage. L'affectation automatique décide avec son
propre seuil, fixé à 50 % dans le code : abaisser celui-ci ne fera pas affecter davantage de
tickets. »

> **Perspective identifiée** : rendre `SEUIL_CONFIANCE_AFFECTATION` réglable à son tour, en
> troisième clé du registre. Hors périmètre de ce lot — c'est une décision **métier**
> (qui reçoit le ticket) et non cosmétique, elle mérite son propre arbitrage.

## Ce qui a été prouvé, et comment

- **118 tests backend** (`node:test`, purs), dont **15 nouveaux** sur les deux clés :
  défauts, bornes, tolérance en lecture, refus en écriture, et le fail-safe « aucune entrée
  illisible n'ouvre la porte ».
- **64 tests ML** (pytest), dont **8 nouveaux** : bornes du champ `seuil` revalidées côté
  Python (0, 1, −0,5, 1,5, 0,04, 0,96 → 422), champ absent et `null` acceptés.
- **Typecheck** backend et frontend au vert.
- **Journal d'audit** : aucune ligne à écrire — `parametreService.ecrire` journalisait déjà
  `PARAMETRE_MODIFIE` avec auteur, ancienne et nouvelle valeur. Ajouter une clé au registre
  suffit à la faire tracer. La prédiction du Chantier 1 (« un réglage coûte une ligne, pas
  une migration ») se vérifie.

## Ce que cette tâche rend caduc ailleurs

Sept affirmations disaient que recâbler le reranker « suppose de modifier `suggestion.py` ».
C'est désormais faux pour le **score** de la porte, et toujours vrai pour le
**réordonnancement** (l'ordre reste `"rrf"` en dur). Toutes rectifiées en place, sans
effacer l'original : `retrieval/config.py`, `service/app.py`, `eval/run_retrieval.py` (qui
l'imprimait dans chaque rapport généré), l'annexe B, et trois entrées de ce journal.

⚠️ Conséquence à ne pas manquer : **l'écart de dimensionnement** (`K=10, max_length=256`
décidés au J6, `K=20, 512` livrés) devient atteignable **en exploitation** et non plus
seulement par un développeur. Il reste non tranché.

## La porte juge sur UN candidat, la rédaction en lit TROIS

Limite **découverte à l'usage**, pendant la recette à l'écran du 24/09/2026 — pas à la
lecture du code, alors qu'elle y était visible.

`hybrid.score_abstention` ne rerank que **`docs[0]`**, le mieux classé par RRF
(`hybrid.py`). Or `suggestion.py` passe à la génération les **`K_SUGGESTION = 3`**
documents. La porte décide donc sur une information **strictement plus pauvre** que celle
dont dispose l'étape qu'elle autorise ou bloque.

**Cas observé**, requête « Écran Dell qui clignote par intermittence ». Candidats RRF dans
l'ordre :

| Rang | Ticket |
| --- | --- |
| 1 | #582 « Demande second écran » |
| 2 | #431 « Écran secondaire non détecté » |
| 3 | #730 « Second écran non reconnu » |

- **Porte ouverte à 20 %** → **abstention**. Le premier candidat est une *demande
  d'équipement*, sans rapport avec une panne : son score est bas, et la porte ferme.
- **Porte fermée** → la génération va au bout et **s'ancre sur #730**, le troisième.

**Conséquence : si le ticket utile n'est pas en première position, la porte bloque une
suggestion qui aurait abouti.** Le coût n'est donc pas seulement la latence économisée ;
c'est aussi un risque de faux négatif que le réglage du seuil aggrave à mesure qu'il monte.

> ⚠️ **Portée exacte de ce constat.** Nous **n'avons pas vérifié** si la résolution de #730
> règle réellement un clignotement d'écran. Le constat porte sur le **mécanisme** — la porte
> et la rédaction ne voient pas la même chose — **pas sur la qualité de la réponse
> produite**. Affirmer que la suggestion bloquée était bonne dépasserait ce qui a été
> mesuré.

C'est aussi un rappel de méthode : trois séances de mesure n'avaient pas fait apparaître
cette asymétrie, une recette manuelle l'a montrée en quelques clics. L'asymétrie est
désormais **écrite dans l'aide de l'écran** — un administrateur ne doit pas avoir à la
déduire.

### Piste, en perspective seulement

Noter les **trois** premiers candidats et retenir le **meilleur score** alignerait la porte
sur ce que lit la rédaction. Coût estimé à partir des mesures du 19/09 (343 ms/paire sur
CPU) : environ **1,1 s** au lieu de **0,4 s** — négligeable devant les 11 à 33 s d'un
`/suggest`.

**Non implémenté, et délibérément.** Cela change la sémantique de la porte (« le meilleur
candidat est-il pertinent ? » devient « au moins un des trois l'est-il ? »), donc la
signification du seuil que l'administrateur règle — et nous n'avons toujours aucune
calibration pour l'un ni pour l'autre. À arbitrer avec le flywheel J9, pas en passant.

## Dettes assumées et documentées

- **La porte juge sur un seul candidat** quand la génération en lit trois — voir ci-dessus.
  Piste chiffrée, non implémentée. L'asymétrie est énoncée dans l'aide de l'écran.
- **`SEUIL_CONFIANCE_AFFECTATION` reste en dur** — découplage assumé, énoncé à l'écran.
  Perspective ci-dessus.
- **Aucune valeur de porte n'est recommandée** : le mécanisme est livré, son réglage reste
  un choix d'exploitation sans appui chiffré. Ce n'est pas une omission, c'est la posture J5
  tenue jusqu'au bout.
- **Le coût mémoire de la porte n'est pas réversible sans redémarrage** du service IA :
  fermer la porte ne décharge pas le modèle.
- **Écart conception / implémentation** : le §6.3 prévoyait `/api/ia/parametres` ; les
  seuils vivent sur le registre générique (`/api/parametres`). Noté dans le document de
  conception, implémentation inchangée — réutiliser le registre a évité une table, une
  migration et un second mécanisme d'audit.

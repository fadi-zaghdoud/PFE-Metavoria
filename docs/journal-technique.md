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
- **Statut** : **Lot A + Lot B serving livrés** ; **pont Node** (upload → `/extract` async
  fire-and-forget → écrit `texte_extrait` si `fiable` → **nouvelle** `SuggestionIA` « après OCR »,
  sans écraser la 1ʳᵉ) à suivre. Détail de conception : `docs/epic-4-module-ia-conception.md` §7 bis.

---

# Phase 6 — Intégration & tests
- **Statut** : non commencée. `[reconstitué depuis Git — aucun harnais de test versionné à ce jour]`
- **Prévu** : le **harnais d'évaluation du module IA (J3)** est un livrable de premier
  ordre (macro-F1, kappa pondéré, Recall@k/nDCG, latence p95, coût). Tests unitaires /
  fonctionnels backend/frontend : `[À COMPLÉTER PAR FEDI]`

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

- **Ce qui existe déjà** `[reconstitué depuis Git]` : **conteneurisation Docker**
  opérationnelle (`docker-compose.yml` : postgres+pgvector, backend, frontend nginx ;
  service **ollama** ajouté pour le module IA). Migrations appliquées au démarrage
  (`prisma migrate deploy`).
- **Documentation technique / guide d'installation / doc API (Swagger)** : `[À COMPLÉTER PAR FEDI]`
- **Reste** : environnement de démonstration final, préparation soutenance. `[À COMPLÉTER PAR FEDI]`

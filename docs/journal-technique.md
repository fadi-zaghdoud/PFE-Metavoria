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
  l'UI). J8bis **suppose ce lot réactivé** — à cadrer avant de coder J8bis.
- **Statut** : **planifié** (non codé). Détail de conception : `docs/epic-4-module-ia-conception.md` §7 bis.

---

# Phase 6 — Intégration & tests
- **Statut** : non commencée. `[reconstitué depuis Git — aucun harnais de test versionné à ce jour]`
- **Prévu** : le **harnais d'évaluation du module IA (J3)** est un livrable de premier
  ordre (macro-F1, kappa pondéré, Recall@k/nDCG, latence p95, coût). Tests unitaires /
  fonctionnels backend/frontend : `[À COMPLÉTER PAR FEDI]`

---

# Phase 7 — Déploiement & documentation
- **Ce qui existe déjà** `[reconstitué depuis Git]` : **conteneurisation Docker**
  opérationnelle (`docker-compose.yml` : postgres+pgvector, backend, frontend nginx ;
  service **ollama** ajouté pour le module IA). Migrations appliquées au démarrage
  (`prisma migrate deploy`).
- **Documentation technique / guide d'installation / doc API (Swagger)** : `[À COMPLÉTER PAR FEDI]`
- **Reste** : environnement de démonstration final, préparation soutenance. `[À COMPLÉTER PAR FEDI]`

# Epic 4 — Module d'Intelligence Artificielle — Document de conception

> **Statut :** périmètre et ordre **confirmés** (14/07/2026). Reste à présenter à l'encadrant pour information. **Rien n'est encore codé.**
> **Périmètre :** §6.3 du cahier des charges — classification, priorisation, suggestion de solutions (RAG), résumé, tableau de confiance.
> Ce document fixe l'architecture, le modèle de données, la stratégie ML et le plan par jalons.

### Périmètre confirmé

- **Inclus :** microservice Python (FastAPI + bge-m3), reranker cross-encoder, data flywheel, recherche hybride, calibration, harnais d'évaluation, résumé automatique.
- **Exclu :** support **arabizi** (arabe latinisé). La langue de travail est **français + termes techniques anglais uniquement**. → à documenter comme **limite assumée** dans le rapport (extension possible en travaux futurs).

---

## 1. Thèse directrice

Le jury attend une **ingénierie ML réelle**, pas un simple appel d'API LLM. Toute la conception découle d'un seul principe :

> **Un seul pipeline d'embeddings sert à la fois la classification et la recherche.
> Le LLM est un *professeur* et un *extracteur de features*, jamais le décideur final.
> Les décisions sont explicables (glass-box) et *calibrées*.
> La validation du technicien est réinjectée comme donnée d'apprentissage.**

Conséquences concrètes :
- On **entraîne** un vrai classifieur (distillation depuis le LLM), on ne se contente pas d'interroger Claude.
- La **priorité** est un score additif auditable, pas une boîte noire.
- La **confiance** est calibrée (elle *signifie* réellement quelque chose), avec abstention.
- Le système **apprend en exploitation** via `SuggestionIA.valideeParTechnicien` (déjà présent au schéma).

---

## 2. Stratégie de données (démarrage à froid)

Zéro historique de tickets. Décision : **corpus synthétique généré par LLM, traité comme un vrai jeu de données.**

| Élément | Rôle | Règle d'or |
|---|---|---|
| **Corpus d'entraînement synthétique** (~1 000–3 000 tickets) | entraîner le classifieur, peupler la base de connaissances RAG | diversité forte (longueur, ton, complétude), distribution **déséquilibrée réaliste** (matériel/logiciel dominent) |
| **Gold set de test** (~150 tickets) | mesurer les performances | **relu et corrigé à la main ; jamais utilisé à l'entraînement** |
| **Paires problème → résolution** | base de connaissances RAG | indispensables : sans elles, RAG n'a rien à retrouver le jour 1 |

**Points de vigilance (non négociables) :**
- Le gold set est le joyau. Si train et test viennent du même générateur, on ne mesure que « le LLM sait-il se reproduire ». → relecture humaine obligatoire, étanchéité totale train/test.
- **Registre linguistique** : français + termes techniques anglais (« reboot », « VPN », « timeout »…), tel qu'écrit réellement dans une DSI tunisienne. Le corpus *et* le gold set doivent contenir ce mélange FR/EN, sinon les modèles paraîtront naïfs. **L'arabizi est hors périmètre** (limite assumée, documentée au rapport).
- Les tickets synthétiques sont **matérialisés en base** (vrais `Ticket`, marqués `synthetique = true`), ce qui peuple directement la base RAG et permet de démontrer le module. Ils sont **exclus des KPI réels** (§6.4) par ce drapeau.

---

## 3. Architecture

### 3.1 Frontière de service

Le back Node/TS reste l'**orchestrateur métier**. Toute la mécanique ML lourde (embeddings, reranking, entraînement, calibration) vit dans un **microservice Python** dédié — c'est ce qui démontre la maîtrise, pas la plomberie d'API.

```
┌────────────────────────┐        HTTP interne         ┌──────────────────────────────┐
│  Backend Node/Express  │  ───────────────────────▶   │  Service IA (Python/FastAPI) │
│  (orchestration métier)│                             │  • /embed   (bge-m3, 1024d)  │
│  • cycle de vie ticket │  ◀───────────────────────   │  • /rerank  (bge-reranker)   │
│  • appelle Claude API  │                             │  • /classify (embeddings+LR) │
│  • pgvector (retrieval)│                             │  • calibration / abstention  │
└───────────┬────────────┘                             └──────────────────────────────┘
            │
            ▼
   PostgreSQL + pgvector
   (tickets, embeddings, SuggestionIA)
```

- **Node** : détient la logique métier, la génération RAG (synthèse par Claude avec citations), la recherche pgvector, l'écriture des `SuggestionIA`.
- **Python** : embeddings, reranking cross-encoder, classifieur entraîné + calibration. Open-source, auto-hébergé → aligné avec la contrainte « outils open-source » du CDC et bien plus impressionnant qu'un appel d'API.
- **Claude API** (depuis Node) : professeur (étiquetage du corpus), extracteur de features (priorité), synthèse RAG, résumé, juge d'évaluation.

### 3.2 Arborescence proposée

```
/ml                    (Python — nouveau)
  /data                génération du corpus synthétique + gold set + paires problème/résolution
  /service             FastAPI : /embed, /rerank, /classify, /sante
  /training            entraînement du classifieur, calibration (Platt/isotonic), sérialisation
  /eval                harnais d'évaluation + rapports (Markdown/JSON) + figures
  pyproject.toml
backend/                (existant — ajouts)
  src/services/ia/     client du service Python, orchestration RAG, scorecard priorité
  src/routes/ia.routes.ts
```

---

## 4. Modèle de données (deltas Prisma)

Le schéma est déjà bien préparé (`pgvector`, `Ticket.embedding`, `SuggestionIA`). Deltas :

### 4.1 `Ticket`
```prisma
// AVANT : embedding Unsupported("vector(1536)")?
embedding        Unsupported("vector(1024)")?   // ⚠️ 1536 était un placeholder ; bge-m3 = 1024 dims
embeddingModele  String?  @map("embedding_modele")   // reproductibilité : quel modèle/version a produit le vecteur
synthetique      Boolean  @default(false)             // corpus de bootstrap ; exclu des KPI réels §6.4
```
> **Migration dédiée** pour l'index vectoriel — Prisma ne sait pas exprimer un index HNSW ; à créer en SQL brut :
> `CREATE INDEX ON tickets USING hnsw (embedding vector_cosine_ops);`
> Le changement de dimension 1536→1024 impose de recréer la colonne (aucune donnée réelle → sans risque).

### 4.2 `SuggestionIA` (enrichissement)
```prisma
modele        String?  @map("modele")        // modèle/prompt/version ayant produit la suggestion
metadonnees   Json?    @map("metadonnees")   // pour PRIORISATION : décomposition du scorecard ;
                                             // pour SOLUTION : ids des tickets retrouvés + scores
latenceMs     Int?     @map("latence_ms")    // NFR : mesurer la latence IA (< 5 s)
// existants : typeSuggestion, contenu, scoreConfiance, valideeParTechnicien, dateCreation
```
Décision : **tout ce qui est « suggestion » reste dans `SuggestionIA`** (une ligne par type CLASSIFICATION / PRIORISATION / SOLUTION / RESUME). On évite de disperser des champs IA sur `Ticket`. `metadonnees` (JSON) porte le détail explicable.

### 4.3 Paramètres IA (§6.5 — seuils tunables par l'admin)
```prisma
model ParametreIA {
  id        Int      @id @default(autoincrement())
  cle       String   @unique         // ex. SEUIL_CONFIANCE_CLASSIFICATION, SEUIL_SUGGESTION
  valeur    Float
  majLe     DateTime @updatedAt @map("maj_le")
  @@map("parametres_ia")
}
```

---

## 5. Classification

- **Choix : embeddings multilingues → Régression Logistique**, entraîné sur le corpus synthétique. Claude = professeur (étiquetage) + repli sur cas peu confiants.
- **Pourquoi** : vrai modèle entraîné (défendable), **réutilise les embeddings du RAG** (un seul pipeline), rapide/pas cher/explicable, distillation LLM→petit modèle.
- **Échelle de baselines à publier** :
  1. classe majoritaire (plancher)
  2. TF-IDF + SVM linéaire
  3. embeddings + LogReg *(le choix)*
  4. Claude few-shot (plafond démarrage à froid)
- **Métriques** : **macro-F1** (pas l'accuracy), P/R par classe, matrice de confusion.
- **Piège `autre`** : bac sémantique fourre-tout → gérer par abstention (sous le seuil → `autre`) plutôt que forcer une prédiction.

---

## 6. Priorisation (explicable)

- **Choix : scorecard additif glass-box.** Claude *extrait des features structurées* (urgence, impact, périmètre affecté) depuis le texte ; un modèle additif pondéré **décide** ; l'UI **montre la décomposition** facteur par facteur.
- **Signaux** : lexique de mots-clés urgence/impact (FR + EN technique), a priori par catégorie, indices de périmètre (« toute l'équipe », « production », « serveur down »), vieillissement/SLA.
- **Pourquoi** : déterministe, auditable, **tunable par l'admin** (→ §6.5), chaque décision justifiable. Le CoT d'un LLM est une rationalisation *a posteriori*, non déterministe, indéfendable comme « modèle ».
- **Vigilance** : pas de vérité terrain objective (les humains ne s'accordent pas). → cadrer en **aide à la décision** avec override humain (traçabilité déjà via `EvenementTicket`), évaluer en **kappa pondéré** (buckets ordinaux), ne pas surpromettre.

---

## 7. RAG — suggestion de solutions

| Étape | Choix | Pourquoi |
|---|---|---|
| **Embeddings** | `bge-m3` auto-hébergé (1024d) | meilleur que OpenAI sur le français, open-source, hybride dense+sparse ; auto-héberger prouve la maîtrise |
| **Recherche** | **hybride** : pgvector (dense) + full-text Postgres (lexical), fusion RRF, pré-filtre statut ∈ {RESOLU, CLOTURE} | le dense rate les tokens exacts (`ORA-12154`, « VPN AnyConnect ») ; les deux vivent dans le même Postgres |
| **Reranking** | cross-encoder `bge-reranker-v2-m3` sur top-K=20 → top 3–5 | le retrieve-then-rerank distingue un vrai RAG d'un `ORDER BY embedding <=> query` |
| **Seuil** | **calibré** sur le gold set pour viser précision ~0,8 ; sous le seuil → **abstention** | un cosinus « magique » codé en dur n'a pas de sens ; exposé comme seuil admin (§6.5) |
| **Génération** | Claude synthétise la résolution **ancrée dans les tickets retrouvés, avec citations (#id)** ; validation humaine avant usage | pas d'hallucination libre ; conforme « validation humaine obligatoire » |

**Vigilance :** (1) la *solution* est souvent dans le **fil de commentaires**, pas la description → choisir délibérément l'unité indexée (côté requête = titre+description ; côté réponse = commentaire(s) résolvant). (2) RAG n'a **rien à retrouver le jour 1** → les paires problème/résolution synthétiques (§2) sont obligatoires.

---

## 8. Confiance & calibration

- **Choix : probabilités *calibrées* par tâche, prouvées par un diagramme de fiabilité + ECE.**
- **Méthode** : **Platt scaling / régression isotonique** sur held-out → « 0,8 » signifie « juste ~80 % du temps ». Pour la suggestion : fusion (score reranker + marge top-1/top-2 + nombre de voisins au-dessus du seuil + accord de catégorie), puis calibration.
- **Politique d'action à 3 niveaux** : haut → suggérer en évidence ; moyen → « à vérifier » ; bas → **abstention**. *La confiance pilote le comportement* — c'est ce qui la rend significative.
- **Pourquoi ça compte pour le jury** : le CDC exige un « tableau de confiance » + « validation humaine obligatoire » ; la calibration *est* la substance technique derrière cette exigence. Le diagramme de fiabilité + ECE est une planche qui distingue nettement.

---

## 9. Contrats d'API (esquisse)

| Méthode | Route | Rôle | Déclenchement |
|---|---|---|---|
| (interne) | service Python `/embed`, `/rerank`, `/classify` | primitives ML | appelé par Node |
| `POST` | `/api/ia/tickets/:id/analyser` | classification + priorité + embedding à la création | auto au `create` ticket |
| `GET` | `/api/tickets/:id/suggestions` | lister les `SuggestionIA` d'un ticket (technicien) | ouverture du ticket |
| `POST` | `/api/tickets/:id/suggestions/:sid/validation` | technicien valide/rejette → **flywheel** | action technicien |
| `POST` | `/api/ia/tickets/:id/resume` | résumé du fil long | à la demande |
| `GET`/`PUT` | `/api/ia/parametres` | seuils de confiance (admin, §6.5) | administration |
| `GET` | `/api/ia/sante` | état du service Python | supervision |

Toutes les écritures IA journalisées (`utils/logger.ts`) ; latence enregistrée dans `SuggestionIA.latenceMs`.

---

## 10. Harnais d'évaluation (livrable de premier ordre)

`ml/eval` — charge le gold set versionné, exécute chaque pipeline, produit un rapport + figures.

| Module | Métriques |
|---|---|
| Classification | macro-F1, P/R par classe, matrice de confusion, **ECE**, l'échelle complète de baselines en un tableau |
| Priorité | **kappa pondéré** vs gold humain, accuracy à ±1 (ordinal) |
| RAG (retrieval) | Recall@k, MRR, nDCG@k sur paires (requête, ticket pertinent) |
| RAG (suggestion) | LLM-as-judge (groundedness / pertinence / actionnabilité) **validé contre notes humaines**, taux d'hallucination, taux d'abstention vs précision-sur-répondus |
| Bout-en-bout | **latence p50/p95** (NFR < 5 s), **coût par ticket** |

**Vigilance :** latence et coût sont des NFR explicites du CDC, souvent oubliés — d'autant que le reranker ajoute de la latence. Le LLM-juge doit être validé contre des notes humaines sinon c'est circulaire. Tout est *seedé/versionné* (données, prompts, versions de modèles) → reproductibilité.

---

## 11. La différence (ce que peu de PFE font)

**Data flywheel + active learning**, bâti sur `SuggestionIA.valideeParTechnicien` (déjà au schéma) :
- chaque validation/rejet du technicien devient un exemple étiqueté,
- ré-évaluation + ré-entraînement du classifieur + re-calibration des seuils,
- **uncertainty sampling** : on remonte les tickets les plus incertains pour étiquetage humain,
- **démontrer un cycle** dans le rapport : « après N tickets validés, macro-F1 X → Y ».

C'est la frontière entre une démo statique et un produit ML. Cela unifie l'infra existante (audit/`EvenementTicket`, UI de confiance, harnais d'éval) en un récit MLOps cohérent.

---

## 12. Plan par jalons

**Règle non négociable : le harnais d'éval (J3) arrive AVANT tout modèle — tout ce qui suit se mesure avec.**

| Jalon | Contenu | Sortie mesurable |
|---|---|---|
| **J1** | Corpus synthétique (train) + paires problème/résolution, marqués `synthetique = true` | jeu de données versionné en base + fichiers |
| **J2** | Gold set de test relu et corrigé à la main, **étanche** (jamais à l'entraînement) | ~150 tickets gold versionnés |
| **J3** | **Harnais d'éval** + baselines sans modèle appris (majoritaire, TF-IDF+SVM) | 1er tableau de métriques (macro-F1) |
| **J4** | Microservice Python : `/embed` (bge-m3), pipeline d'embeddings partagé, migration `vector(1024)` + index HNSW | embeddings en base, service `/sante` OK |
| **J5** | Classification (embeddings+LogReg) + **calibration** (Platt/isotonique) + repli Claude | macro-F1 + diagramme de fiabilité + ECE |
| **J6** | RAG : recherche hybride (pgvector + full-text, RRF) + reranker cross-encoder + seuil calibré + génération citée | Recall@k / nDCG@k + qualité suggestion |
| **J7** | Scorecard priorité (features via Claude, décision glass-box) + UI de décomposition | kappa pondéré vs gold |
| **J8** | Politique de confiance 3 niveaux + **abstention** + **résumé** automatique + « tableau de confiance » (remplace le placeholder « Assistant IA ») | UX technicien complète |
| **J9** | Flywheel : capture des validations → 1 cycle de ré-entraînement + §6.5 seuils admin | courbe macro-F1 X → Y |

---

## 13. Décisions

**Tranchées (14/07/2026) :**
- ✅ **Modèle d'embeddings** : `bge-m3` auto-hébergé (1024d).
- ✅ **Microservice Python séparé** (FastAPI).
- ✅ **Registre linguistique** : FR + termes techniques EN ; **arabizi exclu** (limite documentée au rapport).
- ✅ **Ordre de build** : J1→J9 (§12), harnais d'éval avant tout modèle.

**Restant à caler avant/pendant J1 :**
1. **Volume du corpus synthétique** (cible ~1 000–3 000) et budget de relecture humaine du gold set (~150).
2. **Périmètre du flywheel** : 1 cycle démontré manuellement (réaliste) vs automatisé.
3. **Priorité** : figer la définition opérationnelle de CRITIQUE/HAUTE/… *avant* de scorer (J7).

---

## 14. Flags — points sous-estimés (rappel)

1. Le gold set est le joyau : relu à la main, jamais à l'entraînement.
2. `autre` + déséquilibre de classes → macro-F1, abstention explicite.
3. Le démarrage à froid touche le RAG le plus fort → paires problème/résolution obligatoires.
4. `vector(1536)` est un placeholder → aligner sur le modèle (bge-m3 = 1024) + migration.
5. Latence/coût sont des NFR → mesurer p95 ; le reranker ajoute de la latence.
6. La solution vit dans le fil de commentaires, pas la description.
7. La priorité n'a pas de vérité terrain objective → aide à la décision, kappa, override humain.
8. Registre FR + termes techniques EN → tester sur ce mélange. **Arabizi hors périmètre** (limite assumée au rapport).

-- Chantier 2 (tracabilite exploitable, CDC §7) — migration UNIQUE des lots A, B et C.
-- Meme discipline qu'au Chantier 1 : chaque `migrate deploy` sur cette base est une
-- operation delicate (objets pgvector / tsvector invisibles de Prisma), on n'en fait
-- donc qu'un seul pour tout le chantier.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- RELECTURE OBLIGATOIRE — `prisma migrate diff` a produit ici TROIS lignes
-- destructrices, TOUTES RETIREES A LA MAIN :
--
--   1. DROP INDEX "tickets_embedding_hnsw_idx";
--   2. DROP INDEX "tickets_recherche_texte_idx";
--   3. ALTER TABLE "tickets" ALTER COLUMN "recherche_texte" DROP DEFAULT;
--
-- Les deux premieres DETRUIRAIENT les index de recherche du module IA, restaures au
-- Chantier 1. La troisieme FERAIT AVORTER la migration entiere (`recherche_texte` est
-- une colonne GENERATED ALWAYS, PostgreSQL repond « is a generated column / HINT: Use
-- ... DROP EXPRESSION instead »).
--
-- ⚠️ CECI EST LA PREUVE DE LA CAUSE cherchee au Chantier 1. Les index HNSW et GIN
-- avaient disparu de la base alors que leurs migrations etaient marquees appliquees, et
-- la cause etait restee « non prouvable a posteriori ». Elle ne l'est plus : Prisma voit
-- ces index en base, ne les trouve pas dans `schema.prisma` (ils sont crees en SQL brut,
-- qu'il ne sait pas exprimer) et propose donc systematiquement de les supprimer pour
-- « aligner » la base. Ces lignes n'apparaissaient PAS dans le diff du Chantier 1 — pour
-- la seule raison que les index etaient alors deja absents : il n'y avait rien a
-- supprimer. Les avoir restaures a rendu le piege a nouveau actif.
--
-- REGLE PERMANENTE : toute migration generee sur ce projet doit etre relue et purgee de
-- ces trois lignes avant application. Voir aussi la migration J6 (20260720225847).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Resultat d'une action tracee.
--    Un ECHEC est au moins aussi interessant qu'un SUCCES : cinq connexions refusees
--    depuis la meme IP en une minute est le signal que la journalisation actuelle
--    (console, perdue au rebuild) ne peut pas produire.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE "ResultatAudit" AS ENUM ('SUCCES', 'ECHEC');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Journal d'audit applicatif — « qui a fait quoi, quand, depuis ou, avec quel
--    resultat ». Table SEPAREE de `evenements_ticket`, pour trois raisons etablies a
--    l'inventaire :
--      a. `evenements_ticket.ticket_id` est en ON DELETE CASCADE : supprimer un ticket
--         EFFACE sa trace. Une trace qui disparait avec l'objet audite n'en est pas une.
--      b. une connexion, une invitation ou un deploiement de modele n'ont aucun ticket
--         a rattacher — il faudrait rendre `ticket_id` nullable et melanger deux cycles
--         de vie incompatibles.
--      c. les deux ont des publics et des durees de vie differents.
--    Le doublonnage des actions ticket entre les deux tables est ASSUME pour ces raisons.
--
--    `acteur_id` en ON DELETE SET NULL, et non RESTRICT : la trace doit SURVIVRE a la
--    suppression du compte. `acteur_nom` conserve le nom AU MOMENT DE L'ACTION et reste
--    toujours rempli — c'est LUI qui desambiguise, pas le NULL, qui signifierait sinon a
--    la fois « action du systeme » et « compte depuis supprime ».
--
--    `cible_type` / `cible_id` sont volontairement POLYMORPHES et SANS cle etrangere :
--    la cible peut etre un ticket, un compte, une categorie ou un modele IA. Une
--    contrainte referentielle supposerait une table unique, et une cascade y ramenerait
--    le probleme que cette table existe precisement pour eviter.
--
--    ⚠️ DONNEES PERSONNELLES : `ip` est une donnee personnelle. Finalite SECURITE,
--    acces administrateur uniquement, conservation limitee (purge de retention a venir).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "journal_audit" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "acteur_id" INTEGER,
    "acteur_nom" TEXT NOT NULL,
    "cible_type" TEXT,
    "cible_id" INTEGER,
    "resultat" "ResultatAudit" NOT NULL DEFAULT 'SUCCES',
    "ip" VARCHAR(45),
    "user_agent" TEXT,
    "details" JSONB,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_audit_pkey" PRIMARY KEY ("id")
);

-- Les quatre lectures de la page d'audit : liste antechronologique, filtre par acteur,
-- filtre par action, et « tout ce qui concerne cet objet ». Poses des maintenant : la
-- lecon du Chantier 1 est qu'un index manquant ne se voit pas a petite echelle.
CREATE INDEX "journal_audit_date_creation_idx" ON "journal_audit"("date_creation");
CREATE INDEX "journal_audit_acteur_id_date_creation_idx" ON "journal_audit"("acteur_id", "date_creation");
CREATE INDEX "journal_audit_action_date_creation_idx" ON "journal_audit"("action", "date_creation");
CREATE INDEX "journal_audit_cible_type_cible_id_idx" ON "journal_audit"("cible_type", "cible_id");

ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_acteur_id_fkey"
  FOREIGN KEY ("acteur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Cible d'un evenement de ticket.
--    Les evenements AFFECTATION / DESAFFECTATION stockent le NOM du technicien vise
--    (`nouvelle_valeur`) et non son id : la question « toutes les affectations vers X »
--    etait donc sans reponse fiable. Le nom n'est pas une cle de jointure — 35 comptes
--    portent 31 noms distincts, deux comptes AFFECTABLES partagent « Fadi Zaghdoud ».
--    Le nom reste conserve : c'est le nom D'EPOQUE, celui qu'il faut continuer
--    d'afficher. L'id et le nom repondent a deux questions differentes.
--    ON DELETE SET NULL : la suppression d'un compte fait perdre le lien, pas la trace.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "evenements_ticket" ADD COLUMN "cible_id" INTEGER;

ALTER TABLE "evenements_ticket" ADD CONSTRAINT "evenements_ticket_cible_id_fkey"
  FOREIGN KEY ("cible_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Filet de securite des index de recherche.
--    Ils avaient deja disparu une fois (constate au Chantier 1, EXPLAIN en Seq Scan).
--    IF NOT EXISTS : sans effet s'ils sont presents, les retablit sinon. Cette migration
--    ne peut donc pas laisser la base dans l'etat ou le Chantier 1 l'avait trouvee.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "tickets_embedding_hnsw_idx" ON "tickets"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS "tickets_recherche_texte_idx" ON "tickets" USING gin ("recherche_texte");

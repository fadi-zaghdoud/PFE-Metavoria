-- Chantier 1 (affectation automatique des tickets, CDC §6.2) — migration UNIQUE.
-- Regroupe volontairement les 4 objets du chantier + la restauration de 2 index perdus :
-- chaque `migrate deploy` sur cette base est une operation delicate (objets pgvector /
-- tsvector invisibles de Prisma), on n'en fait donc qu'un seul.
--
-- ATTENTION — RELECTURE OBLIGATOIRE DE TOUTE MIGRATION GENEREE (discipline J4/J6) :
-- `prisma migrate diff` a produit ici, comme il le fera pour toute migration future :
--     ALTER TABLE "tickets" ALTER COLUMN "recherche_texte" DROP DEFAULT;
-- Cette ligne a ete RETIREE A LA MAIN. `recherche_texte` est une colonne GENERATED ALWAYS
-- STORED ; Prisma la voit comme portant un DEFAULT, ce qui est faux. Verifie empiriquement
-- sur cette base (transaction annulee) : PostgreSQL repond
--     ERROR: column "..." of relation "..." is a generated column
--     HINT:  Use ALTER TABLE ... ALTER COLUMN ... DROP EXPRESSION instead.
-- => appliquee telle quelle, la migration ENTIERE aurait avorte.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Motif d'absence : enumeration (et non texte libre) -> filtrable, agregeable,
--    sans variantes orthographiques.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE "MotifAbsence" AS ENUM ('CONGE', 'MALADIE', 'FORMATION', 'AUTRE');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Auteur d'evenement nullable : NULL = « Systeme ».
--    Une affectation decidee par le systeme (mode AUTO, a la creation du ticket) n'a
--    pas d'auteur humain — l'acteur de la creation est le DEMANDEUR (un employe), lui
--    attribuer l'affectation serait faux.
--    Elargissement pur : les lignes existantes conservent leur auteur.
--    La contrainte de cle etrangere reste en ON DELETE RESTRICT (inchangee) pour que
--    NULL signifie « Systeme » et RIEN d'autre : sans cette garde, supprimer un compte
--    relabelliserait ses actions passees en actions systeme — une trace qui ment.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "evenements_ticket" ALTER COLUMN "auteur_id" DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Configuration applicative persistante (cle-valeur).
--    Accueille le mode d'affectation (MANUEL | AUTO) et, plus tard, les seuils IA
--    reglables (§6.5) : un nouveau reglage coutera UNE LIGNE, pas une migration.
--    Absence de ligne = valeur par defaut cote service (repli sur MANUEL).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "parametres" (
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "description" TEXT,
    "date_maj" TIMESTAMP(3) NOT NULL,
    "maj_par_id" INTEGER,

    CONSTRAINT "parametres_pkey" PRIMARY KEY ("cle")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Specialites technicien <-> categorie (N-N), table de liaison EXPLICITE.
--    Cascade des deux cotes : un lien de specialite n'a aucun sens sans son technicien
--    ni sans sa categorie (la suppression de categorie est exposee cote admin).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "technicien_categories" (
    "technicien_id" INTEGER NOT NULL,
    "categorie_id" INTEGER NOT NULL,
    "date_ajout" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technicien_categories_pkey" PRIMARY KEY ("technicien_id","categorie_id")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Absences des techniciens.
--    date_debut / date_fin en DATE et non TIMESTAMP : une absence est un INTERVALLE
--    DE CALENDRIER, pas un instant. En timestamp, « fin le 20 » vaudrait 20 a 00h00 et
--    ne couvrirait donc PAS le 20. Bornes INCLUSES des deux cotes.
--    Distinct de `utilisateurs.actif`, qui coupe la connexion (depart, pas conge) :
--    un technicien absent garde son acces complet et ses tickets deja assignes.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "absences" (
    "id" SERIAL NOT NULL,
    "technicien_id" INTEGER NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "motif" "MotifAbsence" NOT NULL,
    "commentaire" TEXT,
    "cree_par_id" INTEGER NOT NULL,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "absences_pkey" PRIMARY KEY ("id")
);

-- Sert la recherche « absent aujourd'hui » ET le controle de chevauchement.
CREATE INDEX "technicien_categories_categorie_id_idx" ON "technicien_categories"("categorie_id");
CREATE INDEX "absences_technicien_id_date_debut_date_fin_idx" ON "absences"("technicien_id", "date_debut", "date_fin");

ALTER TABLE "parametres" ADD CONSTRAINT "parametres_maj_par_id_fkey" FOREIGN KEY ("maj_par_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "technicien_categories" ADD CONSTRAINT "technicien_categories_technicien_id_fkey" FOREIGN KEY ("technicien_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "technicien_categories" ADD CONSTRAINT "technicien_categories_categorie_id_fkey" FOREIGN KEY ("categorie_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "absences" ADD CONSTRAINT "absences_technicien_id_fkey" FOREIGN KEY ("technicien_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "absences" ADD CONSTRAINT "absences_cree_par_id_fkey" FOREIGN KEY ("cree_par_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RESTAURATION des deux index de recherche du module IA.
--    Constat fait au demarrage du Chantier 1 : les migrations J4 (HNSW) et J6 (GIN)
--    sont bien marquees appliquees (17/07 et 20/07, finished_at renseigne), leurs
--    colonnes existent — mais les DEUX INDEX AVAIENT DISPARU de la base. Un
--    EXPLAIN sur une requete plein-texte donnait « Seq Scan ».
--    Cause non prouvable a posteriori ; la seule mecanique connue capable de faire
--    cela est exactement celle que la migration J6 documente : un outil qui aligne la
--    base sur schema.prisma supprime les objets SQL bruts qu'il ne voit pas.
--    Consequence a l'echelle actuelle (869 tickets) : nulle et invisible. A l'echelle
--    visee (§7 : reponse IA < 5 s, montee en charge sans refonte) : bloquante.
--    IF NOT EXISTS -> rejouable, et sans effet sur une base ou ils sont deja presents.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "tickets_embedding_hnsw_idx" ON "tickets"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS "tickets_recherche_texte_idx" ON "tickets" USING gin ("recherche_texte");

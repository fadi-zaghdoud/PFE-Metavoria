-- Module IA (Epic 4, J6) : arm lexical de la recherche hybride (pgvector dense + full-text, fusion RRF).
--
-- NOTE Prisma (a lire avant toute migration future) : `prisma migrate dev` avait genere ici un
--   "DROP INDEX tickets_embedding_hnsw_idx"
-- parce que l'index HNSW (J4) est cree en SQL brut et reste invisible au schema Prisma. Ce DROP est
-- ERRONE (il detruirait l'index de recherche dense) et a ete RETIRE a la main. Discipline heritee du
-- J4 : les objets pgvector/tsvector vivent en SQL brut -> chaque migration generee doit etre relue
-- pour ne pas supprimer un index "invisible".

-- 1. Colonne de recherche plein-texte : tsvector GENERE STORED a partir de (titre + description).
--    Config 'french' passee en litteral -> to_tsvector immutable (requis pour une colonne generee) ;
--    stemming FR, les tokens techniques EN et les codes type ORA-12154 passent en l'etat.
--    GENERATED STORED = toujours en phase, aucune maintenance applicative, jamais ecrite par Node.
ALTER TABLE "tickets" ADD COLUMN "recherche_texte" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('french', coalesce("titre", '') || ' ' || coalesce("description", ''))
  ) STORED;

-- 2. Index GIN sur le tsvector : recherche full-text rapide (scoring BM25-like via ts_rank_cd).
CREATE INDEX "tickets_recherche_texte_idx" ON "tickets" USING gin ("recherche_texte");

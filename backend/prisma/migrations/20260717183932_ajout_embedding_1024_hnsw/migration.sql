-- Module IA (Epic 4, J4) : alignement de l'embedding sur bge-m3 (1024 dims) + index HNSW.
-- La colonne vector(1536) etait un placeholder ; bge-m3 produit des vecteurs 1024d.
-- Aucune donnee reelle (0/861 ligne peuplee au moment de la migration) -> recreation sans perte.

-- 1. Reproductibilite : tracer quel modele/version a produit chaque vecteur.
ALTER TABLE "tickets" ADD COLUMN     "embedding_modele" TEXT;

-- 2. Recreer la colonne d'embedding a la bonne dimension (1536 -> 1024).
--    DROP + ADD car pgvector ne permet pas de changer le typmod d'une colonne vector par ALTER TYPE.
ALTER TABLE "tickets" DROP COLUMN "embedding";
ALTER TABLE "tickets" ADD COLUMN "embedding" vector(1024);

-- 3. Index de similarite cosinus (bge-m3 -> vecteurs L2-normalises).
--    Prisma ne sait pas exprimer un index HNSW -> SQL brut. Parametres explicites (documentation + echelle) :
--      m               = 16 : nb de liens par noeud dans le graphe (plus haut -> meilleur rappel, + de memoire).
--      ef_construction = 64 : taille de la liste candidats a la construction (plus haut -> index de meilleure
--                             qualite/rappel, construction plus lente). Le rappel a la requete se regle ensuite
--                             via `hnsw.ef_search` (defaut 40), sans reconstruire l'index.
CREATE INDEX "tickets_embedding_hnsw_idx" ON "tickets"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

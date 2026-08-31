-- Epic 4, J8bis (Lot A) : pièces jointes réactivées + stockage Cloudinary.
-- La table pieces_jointes existait (nom_fichier, url) mais restait inutilisée. On l'enrichit :
--  - cloudinary_id : public_id Cloudinary (permet la suppression) ;
--  - type_mime / taille : validation & affichage ;
--  - texte_extrait : résultat OCR (Lot B) — colonne ajoutée maintenant pour éviter une 2e
--    migration ; reste NULL jusqu'au Lot B. Non destructif.
ALTER TABLE "pieces_jointes" ADD COLUMN "cloudinary_id" TEXT;
ALTER TABLE "pieces_jointes" ADD COLUMN "type_mime" TEXT;
ALTER TABLE "pieces_jointes" ADD COLUMN "taille" INTEGER;
ALTER TABLE "pieces_jointes" ADD COLUMN "texte_extrait" TEXT;

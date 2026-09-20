-- Photo de profil — ajout de deux colonnes NULLABLES sur `utilisateurs`.
--
-- Ecrite a la main. Aucune colonne existante n'est touchee, aucune donnee deplacee :
-- les deux colonnes naissent a NULL sur tous les comptes, ce qui correspond exactement
-- a l'etat « pas de photo » (l'interface retombe alors sur les initiales sur fond
-- colore, comportement actuel inchange).
--
-- IDEMPOTENTE : `IF NOT EXISTS` sur les deux ajouts, une reapplication ne fait rien.
--
-- photo_url           : secure_url Cloudinary, servie DIRECTEMENT au navigateur. Choix
--                       assume et distinct de celui des pieces jointes, qui sont
--                       proxifiees par le backend : ici la protection repose sur
--                       l'identifiant public aleatoire, et proxifier chaque avatar
--                       ajouterait un aller-retour backend par ligne de liste.
-- photo_cloudinary_id : public_id, conserve pour DETRUIRE l'image precedente a chaque
--                       remplacement. Sans lui, chaque changement de photo laisserait
--                       un fichier orphelin sur le compte Cloudinary.

ALTER TABLE "utilisateurs" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;
ALTER TABLE "utilisateurs" ADD COLUMN IF NOT EXISTS "photo_cloudinary_id" TEXT;

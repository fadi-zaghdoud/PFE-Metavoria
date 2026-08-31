-- Phase A (cycle de vie des categories) : horodatage de creation des categories.
-- Sert a afficher « en apprentissage depuis … » cote admin. Colonne NOT NULL avec
-- DEFAULT CURRENT_TIMESTAMP → les categories DEJA seedees (Reseau, Materiel, Logiciel,
-- Acces, Autre) recoivent un horodatage a l'application de la migration : aucune valeur
-- manquante. Le STATUT (en apprentissage / apprenable / active) reste CALCULE (classes du
-- modele IA vs base + compteur de labels valides), jamais stocke.
ALTER TABLE "categories" ADD COLUMN "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

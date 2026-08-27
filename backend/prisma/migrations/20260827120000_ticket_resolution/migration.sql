-- Module IA (K1) : capture de la SOLUTION appliquee a la resolution d'un ticket reel.
-- Jusqu'ici `resoudre` n'enregistrait qu'un evenement de statut, sans texte de solution :
-- aucune solution reelle n'etait capturee. Ces deux colonnes stockent la solution saisie
-- par le technicien (facultative) + son horodatage. Leur presence (resolution IS NOT NULL)
-- fait entrer le ticket REEL dans la base de connaissances du RAG (K2).
ALTER TABLE "tickets" ADD COLUMN "resolution" TEXT;
ALTER TABLE "tickets" ADD COLUMN "resolution_date" TIMESTAMP(3);

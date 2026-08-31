-- Module IA (Epic 4, Greffe 2 : suggestion RAG asynchrone).
-- La suggestion SOLUTION est generee en 15-30 s (Ollama) hors du chemin de reponse :
-- on cree la ligne en EN_COURS (reponse 202 immediate), puis un job fire-and-forget la
-- passe a PRETE (texte + sources) ou ECHEC. Les suggestions synchrones de la Greffe 1
-- (CLASSIFICATION/PRIORISATION) sont pretes d'emblee -> defaut PRETE (non destructif).
ALTER TABLE "suggestions_ia" ADD COLUMN "statut" TEXT NOT NULL DEFAULT 'PRETE';

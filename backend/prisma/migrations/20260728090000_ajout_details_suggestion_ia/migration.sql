-- Module IA (Epic 4, Greffe 1 : classification + priorite a la creation).
-- La table suggestions_ia existait au schema mais restait inutilisee ; on l'ajuste
-- pour accueillir les deux premieres suggestions (posture SUGGERE, glass-box).
--
-- 1. score_confiance NULLABLE : la classification a une proba top-1 (0..1), mais la
--    scorecard de priorite est DETERMINISTE (regle gelee) et n'a pas de probabilite ->
--    on n'ecrit pas de fausse confiance, on met NULL. Non destructif (table vide).
ALTER TABLE "suggestions_ia" ALTER COLUMN "score_confiance" DROP NOT NULL;

-- 2. details JSONB : foyer du detail structure -> probabilites par classe (classification)
--    OU decomposition glass-box de la scorecard (priorite : niveau + score + contributions
--    « HAUTE car : production +2 · Reseau +1.5 »). Preserve l'explicabilite (§6.5).
ALTER TABLE "suggestions_ia" ADD COLUMN "details" JSONB;

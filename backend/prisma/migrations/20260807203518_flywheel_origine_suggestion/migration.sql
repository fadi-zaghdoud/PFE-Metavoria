-- Greffe 3 (flywheel) : colonne `origine` dediee sur les suggestions IA.
-- Auparavant stockee dans `details.origine` (JSON) ; promue en colonne pour requeter
-- proprement les metriques "suggere vs choisi" par origine (creation / apres_ocr).
ALTER TABLE "suggestions_ia" ADD COLUMN "origine" TEXT;

-- Backfill : recuperer l'origine deja presente dans le JSON `details` (Greffe 2 / OCR),
-- pour que les suggestions existantes soient correctement etiquetees.
UPDATE "suggestions_ia"
SET "origine" = "details" ->> 'origine'
WHERE "details" IS NOT NULL AND "origine" IS NULL;

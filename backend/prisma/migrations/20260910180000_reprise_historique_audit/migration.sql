-- Chantier 2, lot B — REPRISE DE L'HISTORIQUE. Migration de DONNEES, pas de schema :
-- elle ne cree, ne supprime ni ne modifie aucun objet. Ecrite entierement a la main —
-- `prisma migrate diff` n'a pas ete sollicite, donc aucune des trois lignes destructrices
-- documentees dans la migration precedente ne peut s'y trouver.
--
-- IDEMPOTENTE : chaque instruction est gardee, une reapplication ne fait rien. Sur une
-- base fraiche, elle ne trouve simplement rien a reprendre.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. RATTACHEMENT DES EVENEMENTS D'AFFECTATION A UN COMPTE
--
-- Ces evenements ne stockent que le NOM du technicien vise. La question « toutes les
-- affectations vers X » etait donc sans reponse fiable : cette base compte 35 comptes
-- pour 31 noms distincts.
--
-- La resolution n'est tentee QUE si le nom designe UN SEUL compte affectable — d'ou le
-- `= 1`. Mesure faite avant ecriture, sur les 14 evenements d'affectation existants :
-- 10 se resolvent, 4 non (tous « Fadi Zaghdoud », porte par DEUX comptes affectables).
--
-- CES 4 LA RESTENT NULL, DELIBEREMENT. Choisir l'un des deux comptes serait deviner, et
-- une trace devinee est pire qu'une trace absente : elle attribuerait a quelqu'un une
-- action qui n'est peut-etre pas la sienne. L'interface annoncera la limite plutot que
-- de la masquer. Le nom d'epoque reste lisible dans `nouvelle_valeur` : rien n'est perdu,
-- seul le lien machine manque.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Affectations : la cible est le technicien qui RECOIT le ticket (nouvelle_valeur).
UPDATE "evenements_ticket" e
SET "cible_id" = u.id
FROM "utilisateurs" u
WHERE e."cible_id" IS NULL
  AND e."type" IN ('AFFECTATION', 'AFFECTATION_AUTO')
  AND e."nouvelle_valeur" IS NOT NULL
  AND u."prenom" || ' ' || u."nom" = e."nouvelle_valeur"
  AND u."role" IN ('TECHNICIEN', 'ADMINISTRATEUR')
  AND (
    SELECT COUNT(*) FROM "utilisateurs" u2
    WHERE u2."prenom" || ' ' || u2."nom" = e."nouvelle_valeur"
      AND u2."role" IN ('TECHNICIEN', 'ADMINISTRATEUR')
  ) = 1;

-- Desaffectations : la cible est le technicien a qui on RETIRE le ticket
-- (ancienne_valeur ; `nouvelle_valeur` y vaut NULL, personne ne recoit rien).
-- Aucune ligne de ce type dans la base au moment de l'ecriture — l'instruction est posee
-- pour que la reprise reste complete si l'historique en contient ailleurs.
UPDATE "evenements_ticket" e
SET "cible_id" = u.id
FROM "utilisateurs" u
WHERE e."cible_id" IS NULL
  AND e."type" = 'DESAFFECTATION'
  AND e."ancienne_valeur" IS NOT NULL
  AND u."prenom" || ' ' || u."nom" = e."ancienne_valeur"
  AND u."role" IN ('TECHNICIEN', 'ADMINISTRATEUR')
  AND (
    SELECT COUNT(*) FROM "utilisateurs" u2
    WHERE u2."prenom" || ' ' || u2."nom" = e."ancienne_valeur"
      AND u2."role" IN ('TECHNICIEN', 'ADMINISTRATEUR')
  ) = 1;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. IMPORT DE L'HISTORIQUE DES EVENEMENTS DANS LE JOURNAL D'AUDIT
--
-- Le journal ne contient que ce qui s'est produit depuis sa mise en service. Sans cette
-- reprise, la page d'audit s'ouvrirait VIDE — mauvais argument, et surtout une perte :
-- l'historique des tickets existe deja, il est simplement dans une autre table.
--
-- Ce qui est HONNETEMENT INCONNU reste NULL : `ip` et `user_agent` n'ont jamais ete
-- captures a l'epoque, on ne les invente pas. Chaque ligne importee porte
-- `importeDeLHistorique: true` et l'identifiant de l'evenement d'origine, pour que
-- l'interface puisse dire « repris de l'historique, contexte de requete inconnu » plutot
-- que de laisser croire a une trace complete.
--
-- `acteur_nom` reprend le nom de l'auteur, ou « Systeme » quand il n'y en a pas — c'est
-- exactement la convention du journal.
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO "journal_audit" (
  "action", "acteur_id", "acteur_nom", "cible_type", "cible_id",
  "resultat", "ip", "user_agent", "details", "date_creation"
)
SELECT
  CASE e."type"
    WHEN 'CHANGEMENT_STATUT'    THEN 'TICKET_STATUT'
    WHEN 'CHANGEMENT_PRIORITE'  THEN 'TICKET_PRIORITE'
    WHEN 'CHANGEMENT_CATEGORIE' THEN 'TICKET_CATEGORIE'
    WHEN 'AFFECTATION'          THEN 'TICKET_AFFECTATION'
    WHEN 'AFFECTATION_AUTO'     THEN 'TICKET_AFFECTATION'
    WHEN 'DESAFFECTATION'       THEN 'TICKET_DESAFFECTATION'
    WHEN 'PRISE_EN_CHARGE'      THEN 'TICKET_PRISE_EN_CHARGE'
    WHEN 'EVALUATION'           THEN 'TICKET_SATISFACTION'
    ELSE 'TICKET_' || e."type"
  END,
  e."auteur_id",
  COALESCE(a."prenom" || ' ' || a."nom", 'Système'),
  'TICKET',
  e."ticket_id",
  'SUCCES',
  NULL,  -- jamais capture a l'epoque : inconnu, pas invente
  NULL,
  jsonb_strip_nulls(jsonb_build_object(
    'importeDeLHistorique', true,
    'evenementTicketId',    e."id",
    'typeEvenement',        e."type",
    'ticketId',             e."ticket_id",
    'de',                   e."ancienne_valeur",
    'vers',                 e."nouvelle_valeur",
    'cibleTechnicienId',    e."cible_id"
  )),
  e."date_creation"
FROM "evenements_ticket" e
LEFT JOIN "utilisateurs" a ON a."id" = e."auteur_id"
-- Garde d'idempotence : ne reimporte pas un evenement deja repris.
WHERE NOT EXISTS (
  SELECT 1 FROM "journal_audit" j
  WHERE j."details" ->> 'evenementTicketId' = e."id"::text
);

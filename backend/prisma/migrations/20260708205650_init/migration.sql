-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYE', 'TECHNICIEN', 'ADMINISTRATEUR');

-- CreateEnum
CREATE TYPE "StatutTicket" AS ENUM ('NOUVEAU', 'EN_COURS', 'EN_ATTENTE', 'RESOLU', 'CLOTURE');

-- CreateEnum
CREATE TYPE "Priorite" AS ENUM ('FAIBLE', 'MOYENNE', 'HAUTE', 'CRITIQUE');

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mot_de_passe" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYE',
    "service" TEXT,
    "poste" TEXT,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "statut" "StatutTicket" NOT NULL DEFAULT 'NOUVEAU',
    "priorite" "Priorite" NOT NULL DEFAULT 'MOYENNE',
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_cloture" TIMESTAMP(3),
    "satisfaction_note" INTEGER,
    "embedding" vector(1536),
    "categorie_id" INTEGER,
    "demandeur_id" INTEGER NOT NULL,
    "technicien_id" INTEGER,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commentaires" (
    "id" SERIAL NOT NULL,
    "contenu" TEXT NOT NULL,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticket_id" INTEGER NOT NULL,
    "auteur_id" INTEGER NOT NULL,

    CONSTRAINT "commentaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pieces_jointes" (
    "id" SERIAL NOT NULL,
    "nom_fichier" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "date_upload" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticket_id" INTEGER NOT NULL,

    CONSTRAINT "pieces_jointes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "date_envoi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utilisateur_id" INTEGER NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestions_ia" (
    "id" SERIAL NOT NULL,
    "type_suggestion" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "score_confiance" DOUBLE PRECISION NOT NULL,
    "validee_par_technicien" BOOLEAN,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticket_id" INTEGER NOT NULL,

    CONSTRAINT "suggestions_ia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_nom_key" ON "categories"("nom");

-- CreateIndex
CREATE INDEX "tickets_statut_idx" ON "tickets"("statut");

-- CreateIndex
CREATE INDEX "tickets_priorite_idx" ON "tickets"("priorite");

-- CreateIndex
CREATE INDEX "tickets_demandeur_id_idx" ON "tickets"("demandeur_id");

-- CreateIndex
CREATE INDEX "tickets_technicien_id_idx" ON "tickets"("technicien_id");

-- CreateIndex
CREATE INDEX "tickets_categorie_id_idx" ON "tickets"("categorie_id");

-- CreateIndex
CREATE INDEX "commentaires_ticket_id_idx" ON "commentaires"("ticket_id");

-- CreateIndex
CREATE INDEX "pieces_jointes_ticket_id_idx" ON "pieces_jointes"("ticket_id");

-- CreateIndex
CREATE INDEX "notifications_utilisateur_id_lu_idx" ON "notifications"("utilisateur_id", "lu");

-- CreateIndex
CREATE INDEX "suggestions_ia_ticket_id_idx" ON "suggestions_ia"("ticket_id");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_categorie_id_fkey" FOREIGN KEY ("categorie_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_demandeur_id_fkey" FOREIGN KEY ("demandeur_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_technicien_id_fkey" FOREIGN KEY ("technicien_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commentaires" ADD CONSTRAINT "commentaires_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commentaires" ADD CONSTRAINT "commentaires_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_jointes" ADD CONSTRAINT "pieces_jointes_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions_ia" ADD CONSTRAINT "suggestions_ia_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

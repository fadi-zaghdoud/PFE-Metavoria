-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "ticket_id" INTEGER;

-- CreateTable
CREATE TABLE "evenements_ticket" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "ancienne_valeur" TEXT,
    "nouvelle_valeur" TEXT,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticket_id" INTEGER NOT NULL,
    "auteur_id" INTEGER NOT NULL,

    CONSTRAINT "evenements_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evenements_ticket_ticket_id_idx" ON "evenements_ticket"("ticket_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evenements_ticket" ADD CONSTRAINT "evenements_ticket_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evenements_ticket" ADD CONSTRAINT "evenements_ticket_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

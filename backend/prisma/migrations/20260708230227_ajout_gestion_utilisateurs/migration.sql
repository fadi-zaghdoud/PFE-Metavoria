-- AlterTable
ALTER TABLE "utilisateurs" ADD COLUMN     "actif" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "token_reinitialisation" TEXT,
ADD COLUMN     "token_reinitialisation_expire" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_token_reinitialisation_key" ON "utilisateurs"("token_reinitialisation");

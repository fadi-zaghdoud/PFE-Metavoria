-- AlterTable
ALTER TABLE "utilisateurs" ADD COLUMN     "token_invitation" TEXT,
ADD COLUMN     "token_invitation_expire" TIMESTAMP(3),
ALTER COLUMN "mot_de_passe" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_token_invitation_key" ON "utilisateurs"("token_invitation");

-- DropIndex
DROP INDEX "utilisateurs_token_reinitialisation_key";

-- AlterTable
ALTER TABLE "utilisateurs" DROP COLUMN "token_reinitialisation",
DROP COLUMN "token_reinitialisation_expire",
ADD COLUMN     "code_reinitialisation" TEXT,
ADD COLUMN     "code_reinitialisation_emis" TIMESTAMP(3),
ADD COLUMN     "code_reinitialisation_expire" TIMESTAMP(3),
ADD COLUMN     "code_reinitialisation_tentatives" INTEGER NOT NULL DEFAULT 0;

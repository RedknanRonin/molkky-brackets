-- AlterEnum
ALTER TYPE "TournamentFormat" ADD VALUE 'DOUBLE_ELIM';

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "bracketSection" TEXT,
ADD COLUMN     "loserMatchId" TEXT,
ADD COLUMN     "loserSlot" INTEGER;

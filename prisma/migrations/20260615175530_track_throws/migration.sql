-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "trackThrows" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Throw" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "throwNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Throw_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Throw_matchId_idx" ON "Throw"("matchId");

-- AddForeignKey
ALTER TABLE "Throw" ADD CONSTRAINT "Throw_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Throw" ADD CONSTRAINT "Throw_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

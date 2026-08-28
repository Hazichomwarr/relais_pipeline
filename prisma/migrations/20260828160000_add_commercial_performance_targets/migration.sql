-- Ticket 25H.2A — additive only. No modification to any existing table.
-- No backfill: pre-existing evaluation periods simply have no target row,
-- which is the truthful, intentional absence this domain represents.

-- CreateTable
CREATE TABLE "CommercialPerformanceTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "targetWins" INTEGER NOT NULL,
    "roleAtAssignment" "UserRole" NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdByRoleAtEvent" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialPerformanceTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommercialPerformanceTarget_userId_periodStart_periodEnd_key" ON "CommercialPerformanceTarget"("userId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "CommercialPerformanceTarget_userId_periodStart_idx" ON "CommercialPerformanceTarget"("userId", "periodStart");

-- CreateIndex
CREATE INDEX "CommercialPerformanceTarget_createdByUserId_idx" ON "CommercialPerformanceTarget"("createdByUserId");

-- AddForeignKey
ALTER TABLE "CommercialPerformanceTarget" ADD CONSTRAINT "CommercialPerformanceTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialPerformanceTarget" ADD CONSTRAINT "CommercialPerformanceTarget_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ticket 27D — schema-only foundation for "Tâches du jour". Purely
-- additive: one new enum, one new table, its constraints/indexes. No
-- existing table or type is touched. No data is inserted or backfilled,
-- because the DailyTask domain does not exist yet — there is nothing to
-- backfill for a brand-new table.

-- CreateEnum
CREATE TYPE "DailyTaskStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "DailyTask" (
    "id" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "assignedToUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL,
    "status" "DailyTaskStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyTask_assignedToUserId_workDate_idx" ON "DailyTask"("assignedToUserId", "workDate");

-- CreateIndex
CREATE INDEX "DailyTask_workDate_idx" ON "DailyTask"("workDate");

-- CreateIndex
CREATE INDEX "DailyTask_assignedByUserId_idx" ON "DailyTask"("assignedByUserId");

-- AddForeignKey
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

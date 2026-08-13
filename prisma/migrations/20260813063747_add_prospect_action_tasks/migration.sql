-- CreateEnum
CREATE TYPE "ProspectActionStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELED');

-- CreateTable
CREATE TABLE "ProspectAction" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "assignedToUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "ProspectActionStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "canceledAt" TIMESTAMP(3),
    "canceledByUserId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProspectAction_prospectId_status_dueAt_idx" ON "ProspectAction"("prospectId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "ProspectAction_assignedToUserId_status_dueAt_idx" ON "ProspectAction"("assignedToUserId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "ProspectAction_createdByUserId_createdAt_idx" ON "ProspectAction"("createdByUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProspectAction" ADD CONSTRAINT "ProspectAction_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectAction" ADD CONSTRAINT "ProspectAction_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectAction" ADD CONSTRAINT "ProspectAction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectAction" ADD CONSTRAINT "ProspectAction_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectAction" ADD CONSTRAINT "ProspectAction_canceledByUserId_fkey" FOREIGN KEY ("canceledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

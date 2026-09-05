-- Ticket 28B is prospective-only: this creates the table with zero rows
-- and does not touch any existing Prospect.assignedUserId value. No
-- transfer-history backfill is performed for a prospect's pre-28B
-- assignment history (see notes/ticket-28b-prospect-assignment-transfer-persistence-domain.md).

-- CreateTable
CREATE TABLE "ProspectAssignmentTransfer" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectAssignmentTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProspectAssignmentTransfer_prospectId_occurredAt_idx" ON "ProspectAssignmentTransfer"("prospectId", "occurredAt");

-- CreateIndex
CREATE INDEX "ProspectAssignmentTransfer_fromUserId_idx" ON "ProspectAssignmentTransfer"("fromUserId");

-- CreateIndex
CREATE INDEX "ProspectAssignmentTransfer_toUserId_idx" ON "ProspectAssignmentTransfer"("toUserId");

-- CreateIndex
CREATE INDEX "ProspectAssignmentTransfer_changedByUserId_idx" ON "ProspectAssignmentTransfer"("changedByUserId");

-- AddForeignKey
ALTER TABLE "ProspectAssignmentTransfer" ADD CONSTRAINT "ProspectAssignmentTransfer_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectAssignmentTransfer" ADD CONSTRAINT "ProspectAssignmentTransfer_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectAssignmentTransfer" ADD CONSTRAINT "ProspectAssignmentTransfer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectAssignmentTransfer" ADD CONSTRAINT "ProspectAssignmentTransfer_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

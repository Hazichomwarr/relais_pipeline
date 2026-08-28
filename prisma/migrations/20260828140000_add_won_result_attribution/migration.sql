-- Ticket 25H.1 is forward-only: pre-existing WON_TRANSITION rows keep
-- creditedUserId = NULL ("unknown attribution") rather than being
-- backfilled from unreliable evidence — neither agentName (the closing
-- actor, proven not equivalent to credit) nor Prospect.assignedUserId's
-- current value (ownership may have changed since the win) is truthful
-- historical evidence of who was credited at that moment.

-- AlterTable
ALTER TABLE "ProspectActivity" ADD COLUMN     "creditedUserId" TEXT,
ADD COLUMN     "creditedUserNameAtEvent" TEXT,
ADD COLUMN     "creditedUserRoleAtEvent" "UserRole";

-- CreateIndex
CREATE INDEX "ProspectActivity_creditedUserId_occurredAt_idx" ON "ProspectActivity"("creditedUserId", "occurredAt");

-- AddForeignKey
ALTER TABLE "ProspectActivity" ADD CONSTRAINT "ProspectActivity_creditedUserId_fkey" FOREIGN KEY ("creditedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

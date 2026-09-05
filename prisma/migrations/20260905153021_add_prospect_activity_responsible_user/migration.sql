-- Ticket 28A.1 is forward-only, same convention as
-- 20260828140000_add_won_result_attribution: pre-existing ProspectActivity
-- rows keep responsibleUserIdAtEvent = NULL ("not recorded") rather than
-- being backfilled from Prospect's current assignedUserId, which is not
-- truthful evidence of who was responsible at the time each row was
-- written (see notes/ticket-28a1-historical-sales-analytics-attribution-fix.md).

-- AlterTable
ALTER TABLE "ProspectActivity" ADD COLUMN     "responsibleUserIdAtEvent" TEXT;

-- CreateIndex
CREATE INDEX "ProspectActivity_responsibleUserIdAtEvent_occurredAt_idx" ON "ProspectActivity"("responsibleUserIdAtEvent", "occurredAt");

-- AddForeignKey
ALTER TABLE "ProspectActivity" ADD CONSTRAINT "ProspectActivity_responsibleUserIdAtEvent_fkey" FOREIGN KEY ("responsibleUserIdAtEvent") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

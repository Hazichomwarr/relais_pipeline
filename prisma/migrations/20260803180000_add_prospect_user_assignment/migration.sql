-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN "assignedUserId" TEXT;

-- CreateIndex
CREATE INDEX "Prospect_assignedUserId_idx" ON "Prospect"("assignedUserId");

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

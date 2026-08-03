-- CreateEnum
CREATE TYPE "ProspectActivityType" AS ENUM ('FIELD_VISIT', 'PHONE_CALL', 'WHATSAPP', 'MEETING', 'DEMO', 'DOCUMENT_SENT', 'FOLLOW_UP', 'INTERNAL_NOTE');

-- CreateTable
CREATE TABLE "ProspectActivity" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "type" "ProspectActivityType" NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "agentName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProspectActivity_prospectId_idx" ON "ProspectActivity"("prospectId");

-- CreateIndex
CREATE INDEX "ProspectActivity_prospectId_occurredAt_idx" ON "ProspectActivity"("prospectId", "occurredAt");

-- CreateIndex
CREATE INDEX "ProspectActivity_type_idx" ON "ProspectActivity"("type");

-- AddForeignKey
ALTER TABLE "ProspectActivity" ADD CONSTRAINT "ProspectActivity_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

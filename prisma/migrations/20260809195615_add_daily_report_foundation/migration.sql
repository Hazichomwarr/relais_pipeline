-- CreateEnum
CREATE TYPE "DailyReportTemplateType" AS ENUM ('ASSISTANT', 'OPERATIONS_COORDINATOR');

-- CreateEnum
CREATE TYPE "DailyReportStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyReportTemplateType" "DailyReportTemplateType";

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "templateType" "DailyReportTemplateType" NOT NULL,
    "status" "DailyReportStatus" NOT NULL DEFAULT 'DRAFT',
    "accomplishedToday" TEXT NOT NULL,
    "plannedTomorrow" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyReport_reportDate_idx" ON "DailyReport"("reportDate");

-- CreateIndex
CREATE INDEX "DailyReport_ownerUserId_reportDate_idx" ON "DailyReport"("ownerUserId", "reportDate");

-- CreateIndex
CREATE INDEX "DailyReport_status_reportDate_idx" ON "DailyReport"("status", "reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_ownerUserId_reportDate_key" ON "DailyReport"("ownerUserId", "reportDate");

-- CreateIndex
CREATE INDEX "User_dailyReportTemplateType_idx" ON "User"("dailyReportTemplateType");

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

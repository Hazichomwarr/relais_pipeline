-- CreateEnum
CREATE TYPE "RelaisProduct" AS ENUM ('KARMDA', 'LOKARI', 'NIA', 'DIGITAL_SERVICES');

-- CreateEnum
CREATE TYPE "InterestLevel" AS ENUM ('NOT_INTERESTED', 'MAYBE', 'NEEDS_INFORMATION', 'INTERESTED', 'READY_TO_DISCUSS');

-- CreateEnum
CREATE TYPE "FollowUpAction" AS ENUM ('CALL_BACK', 'VISIT_AGAIN', 'SEND_DEMO', 'SCHEDULE_MEETING', 'NO_ACTION');

-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('NEW', 'TO_FOLLOW_UP', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "OnlinePresence" AS ENUM ('NONE', 'WHATSAPP', 'SOCIAL_MEDIA', 'WEBSITE', 'MULTIPLE');

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "product" "RelaisProduct" NOT NULL,
    "name" TEXT NOT NULL,
    "prospectType" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT NOT NULL,
    "location" TEXT,
    "interest" "InterestLevel" NOT NULL,
    "status" "ProspectStatus" NOT NULL DEFAULT 'NEW',
    "nextAction" "FollowUpAction",
    "followUpDate" TIMESTAMP(3),
    "notes" TEXT NOT NULL,
    "onlinePresence" "OnlinePresence",
    "agentName" TEXT NOT NULL,
    "schoolType" TEXT,
    "estimatedStudentCount" INTEGER,
    "currentSchoolSystem" TEXT,
    "contactRole" TEXT,
    "propertyOwnerType" TEXT,
    "estimatedPropertyCount" INTEGER,
    "propertyCountries" TEXT,
    "currentPropertySystem" TEXT,
    "savingsGroupType" TEXT,
    "estimatedMemberCount" INTEGER,
    "contributionFrequency" TEXT,
    "currentSavingsSystem" TEXT,
    "businessCategory" TEXT,
    "requestedService" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prospect_product_idx" ON "Prospect"("product");

-- CreateIndex
CREATE INDEX "Prospect_interest_idx" ON "Prospect"("interest");

-- CreateIndex
CREATE INDEX "Prospect_status_idx" ON "Prospect"("status");

-- CreateIndex
CREATE INDEX "Prospect_agentName_idx" ON "Prospect"("agentName");

-- CreateIndex
CREATE INDEX "Prospect_createdAt_idx" ON "Prospect"("createdAt");

-- CreateIndex
CREATE INDEX "Prospect_followUpDate_idx" ON "Prospect"("followUpDate");

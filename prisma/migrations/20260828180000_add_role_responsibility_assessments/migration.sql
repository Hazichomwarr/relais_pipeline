-- Ticket 25I is forward-only: no historical periods are backfilled with
-- an assessment. If a past period was never formally assessed, that
-- remains the truthful, intentional absence — not something this
-- migration reconstructs from manager memory.

-- CreateEnum
CREATE TYPE "RoleResponsibilityAssessmentStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "RoleResponsibilityAssessmentLevel" AS ENUM ('NOT_MET', 'PARTIALLY_MET', 'MET', 'EXCEEDED');

-- CreateEnum
CREATE TYPE "RoleResponsibilityEvidenceType" AS ENUM ('MANAGER_ASSESSED', 'MACHINE_EVIDENCED');

-- CreateTable
CREATE TABLE "RoleResponsibilityAssessment" (
    "id" TEXT NOT NULL,
    "employeeUserId" TEXT NOT NULL,
    "roleAtEvaluation" "UserRole" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "evaluatorUserId" TEXT NOT NULL,
    "evaluatorRoleAtEvent" "UserRole" NOT NULL,
    "status" "RoleResponsibilityAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "score" INTEGER,
    "maxScore" INTEGER NOT NULL DEFAULT 20,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleResponsibilityAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleResponsibilityAssessmentItem" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "responsibilityKey" TEXT NOT NULL,
    "labelAtEvaluation" TEXT NOT NULL,
    "descriptionAtEvaluation" TEXT NOT NULL,
    "maxPoints" INTEGER NOT NULL,
    "evidenceType" "RoleResponsibilityEvidenceType" NOT NULL,
    "anchorsSnapshot" JSONB NOT NULL,
    "assessmentLevel" "RoleResponsibilityAssessmentLevel",
    "awardedPoints" INTEGER,
    "observation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleResponsibilityAssessmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleResponsibilityAssessment_employeeUserId_periodStart_p_key" ON "RoleResponsibilityAssessment"("employeeUserId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "RoleResponsibilityAssessment_employeeUserId_periodStart_idx" ON "RoleResponsibilityAssessment"("employeeUserId", "periodStart");

-- CreateIndex
CREATE INDEX "RoleResponsibilityAssessment_evaluatorUserId_idx" ON "RoleResponsibilityAssessment"("evaluatorUserId");

-- CreateIndex
CREATE INDEX "RoleResponsibilityAssessment_status_idx" ON "RoleResponsibilityAssessment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RoleResponsibilityAssessmentItem_assessmentId_responsibil_key" ON "RoleResponsibilityAssessmentItem"("assessmentId", "responsibilityKey");

-- CreateIndex
CREATE INDEX "RoleResponsibilityAssessmentItem_assessmentId_idx" ON "RoleResponsibilityAssessmentItem"("assessmentId");

-- AddForeignKey
ALTER TABLE "RoleResponsibilityAssessment" ADD CONSTRAINT "RoleResponsibilityAssessment_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleResponsibilityAssessment" ADD CONSTRAINT "RoleResponsibilityAssessment_evaluatorUserId_fkey" FOREIGN KEY ("evaluatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleResponsibilityAssessmentItem" ADD CONSTRAINT "RoleResponsibilityAssessmentItem_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "RoleResponsibilityAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

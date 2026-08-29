-- Ticket 25J is forward-only: no historical periods are backfilled with
-- an assessment. If a past period was never formally assessed for
-- Professional Contribution, that remains the truthful, intentional
-- absence — not something this migration reconstructs from memory.

-- CreateEnum
CREATE TYPE "ProfessionalContributionAssessmentStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateTable
CREATE TABLE "ProfessionalContributionAssessment" (
    "id" TEXT NOT NULL,
    "employeeUserId" TEXT NOT NULL,
    "roleAtEvaluation" "UserRole" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "evaluatorUserId" TEXT NOT NULL,
    "evaluatorRoleAtEvent" "UserRole" NOT NULL,
    "status" "ProfessionalContributionAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "score" INTEGER,
    "maxScore" INTEGER NOT NULL DEFAULT 10,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalContributionAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalContributionAssessmentItem" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "traitKey" TEXT NOT NULL,
    "labelAtEvaluation" TEXT NOT NULL,
    "descriptionAtEvaluation" TEXT NOT NULL,
    "maxPoints" INTEGER NOT NULL,
    "anchorsSnapshot" JSONB NOT NULL,
    "selectedLevel" INTEGER,
    "awardedPoints" DOUBLE PRECISION,
    "observation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalContributionAssessmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalContributionAssessment_employeeUserId_periodSt_key" ON "ProfessionalContributionAssessment"("employeeUserId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "ProfessionalContributionAssessment_employeeUserId_periodSt_idx" ON "ProfessionalContributionAssessment"("employeeUserId", "periodStart");

-- CreateIndex
CREATE INDEX "ProfessionalContributionAssessment_evaluatorUserId_idx" ON "ProfessionalContributionAssessment"("evaluatorUserId");

-- CreateIndex
CREATE INDEX "ProfessionalContributionAssessment_status_idx" ON "ProfessionalContributionAssessment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalContributionAssessmentItem_assessmentId_traitK_key" ON "ProfessionalContributionAssessmentItem"("assessmentId", "traitKey");

-- CreateIndex
CREATE INDEX "ProfessionalContributionAssessmentItem_assessmentId_idx" ON "ProfessionalContributionAssessmentItem"("assessmentId");

-- AddForeignKey
ALTER TABLE "ProfessionalContributionAssessment" ADD CONSTRAINT "ProfessionalContributionAssessment_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalContributionAssessment" ADD CONSTRAINT "ProfessionalContributionAssessment_evaluatorUserId_fkey" FOREIGN KEY ("evaluatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalContributionAssessmentItem" ADD CONSTRAINT "ProfessionalContributionAssessmentItem_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ProfessionalContributionAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

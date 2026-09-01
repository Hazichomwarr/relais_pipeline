-- Ticket 27B — schema-only foundation for "Ma journée". Purely additive:
-- one new table, its constraints/indexes. No existing table is touched.
-- No data is inserted or backfilled, because the Workday domain does not
-- exist yet and no historically-truthful row could be fabricated for a
-- day nobody declared (see the model's own schema comment). This is
-- deliberately unlike Ticket 26B's migration, which backfilled real
-- existing rows — there is nothing to backfill here.

-- CreateTable
CREATE TABLE "Workday" (
    "id" TEXT NOT NULL,
    "employeeUserId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "expectedStartTime" INTEGER NOT NULL,
    "expectedEndTime" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Workday_workDate_idx" ON "Workday"("workDate");

-- CreateIndex
CREATE INDEX "Workday_confirmedByUserId_idx" ON "Workday"("confirmedByUserId");

-- One employee, one RELAIS business date, at most one Workday (Ticket
-- 27A §10) — the database invariant, not merely an application
-- convention. Also the future race-safety backstop for double-start
-- requests (27C).
-- CreateIndex
CREATE UNIQUE INDEX "Workday_employeeUserId_workDate_key" ON "Workday"("employeeUserId", "workDate");

-- AddForeignKey
ALTER TABLE "Workday" ADD CONSTRAINT "Workday_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workday" ADD CONSTRAINT "Workday_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ticket 25C is forward-only: existing users are deliberately not backfilled
-- because neither their authenticated creator nor creation-time role is known.

-- CreateTable
CREATE TABLE "UserCreationActivity" (
    "id" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "roleAtEvent" "UserRole" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCreationActivity_pkey" PRIMARY KEY ("id")
);

-- One durable CREATED fact per subject user.
CREATE UNIQUE INDEX "UserCreationActivity_subjectUserId_key" ON "UserCreationActivity"("subjectUserId");

-- CreateIndex
CREATE INDEX "UserCreationActivity_actorUserId_idx" ON "UserCreationActivity"("actorUserId");

-- CreateIndex
CREATE INDEX "UserCreationActivity_occurredAt_idx" ON "UserCreationActivity"("occurredAt");

-- AddForeignKey
ALTER TABLE "UserCreationActivity" ADD CONSTRAINT "UserCreationActivity_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCreationActivity" ADD CONSTRAINT "UserCreationActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

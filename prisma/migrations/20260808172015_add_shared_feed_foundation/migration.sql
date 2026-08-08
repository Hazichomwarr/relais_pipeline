-- CreateEnum
CREATE TYPE "UserStatusActivityType" AS ENUM ('ACTIVATED', 'DEACTIVATED');

-- AlterEnum
ALTER TYPE "ProspectActivityType" ADD VALUE 'WON_TRANSITION';

-- CreateTable
CREATE TABLE "UserStatusActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserStatusActivityType" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserStatusActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserStatusActivity_userId_occurredAt_idx" ON "UserStatusActivity"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "UserStatusActivity_actorUserId_idx" ON "UserStatusActivity"("actorUserId");

-- AddForeignKey
ALTER TABLE "UserStatusActivity" ADD CONSTRAINT "UserStatusActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStatusActivity" ADD CONSTRAINT "UserStatusActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

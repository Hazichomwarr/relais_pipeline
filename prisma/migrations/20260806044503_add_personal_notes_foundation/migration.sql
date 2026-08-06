-- CreateEnum
CREATE TYPE "PersonalNoteCategory" AS ENUM ('URGENT_TODO', 'COMMERCIAL_DEBRIEF', 'RELAIS_IDEA', 'SCHOOL_DOCUMENTS', 'OTHER');

-- CreateTable
CREATE TABLE "PersonalNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "PersonalNoteCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalNote_userId_idx" ON "PersonalNote"("userId");

-- CreateIndex
CREATE INDEX "PersonalNote_userId_updatedAt_idx" ON "PersonalNote"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "PersonalNote_userId_pinned_updatedAt_idx" ON "PersonalNote"("userId", "pinned", "updatedAt");

-- CreateIndex
CREATE INDEX "PersonalNote_userId_category_idx" ON "PersonalNote"("userId", "category");

-- AddForeignKey
ALTER TABLE "PersonalNote" ADD CONSTRAINT "PersonalNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "LedgerEntryStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "LedgerEntryCategory" AS ENUM ('CLIENT_PAYMENT', 'CAPITAL_CONTRIBUTION', 'LOAN_RECEIVED', 'REFUND_RECEIVED', 'OTHER_INFLOW', 'SALARY', 'TRANSPORT', 'FUEL', 'PRINTING', 'INTERNET', 'OFFICE_SUPPLIES', 'EQUIPMENT', 'TAXES_AND_FEES', 'CLIENT_REFUND', 'OTHER_OUTFLOW');

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "category" "LedgerEntryCategory" NOT NULL,
    "status" "LedgerEntryStatus" NOT NULL DEFAULT 'POSTED',
    "amount" DECIMAL(18,2) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'XOF',
    "product" "RelaisProduct",
    "counterpartyName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_reversalOfId_key" ON "LedgerEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "LedgerEntry_type_idx" ON "LedgerEntry"("type");

-- CreateIndex
CREATE INDEX "LedgerEntry_category_idx" ON "LedgerEntry"("category");

-- CreateIndex
CREATE INDEX "LedgerEntry_status_idx" ON "LedgerEntry"("status");

-- CreateIndex
CREATE INDEX "LedgerEntry_product_idx" ON "LedgerEntry"("product");

-- CreateIndex
CREATE INDEX "LedgerEntry_occurredAt_idx" ON "LedgerEntry"("occurredAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_createdByUserId_idx" ON "LedgerEntry"("createdByUserId");

-- CreateIndex
CREATE INDEX "LedgerEntry_currencyCode_occurredAt_idx" ON "LedgerEntry"("currencyCode", "occurredAt");

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

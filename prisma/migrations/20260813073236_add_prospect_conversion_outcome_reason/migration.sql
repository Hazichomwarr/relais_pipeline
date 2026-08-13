-- CreateEnum
CREATE TYPE "ProspectConversionOutcome" AS ENUM ('ADVANCED', 'STALLED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "ProspectConversionReason" AS ENUM ('PROMOTIONAL_OFFER', 'DEMO_CONVINCED', 'GOOD_PRODUCT_FIT', 'URGENT_NEED', 'PRICE_ACCEPTABLE', 'DECISION_MAKER_APPROVAL', 'NO_BUDGET', 'PRICE_TOO_HIGH', 'DECISION_MAKER_UNAVAILABLE', 'ALREADY_EQUIPPED', 'NO_RESPONSE', 'NEEDS_MORE_TIME', 'BAD_FIT', 'COMPETITOR', 'OTHER');

-- AlterTable
ALTER TABLE "ProspectActivity" ADD COLUMN     "conversionOutcome" "ProspectConversionOutcome",
ADD COLUMN     "conversionReason" "ProspectConversionReason",
ADD COLUMN     "conversionReasonNote" TEXT;

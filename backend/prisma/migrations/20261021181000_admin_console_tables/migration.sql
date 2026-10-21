-- CreateEnum
CREATE TYPE "PaymentReviewStatus" AS ENUM ('pending', 'approved', 'rejected', 'asked_rest');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "address" TEXT,
ADD COLUMN     "businessType" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "exemptFromRules" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "exemptReason" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "locationSetAt" TIMESTAMP(3),
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "note" TEXT,
ADD COLUMN     "paymentMethod" TEXT;

-- CreateTable
CREATE TABLE "AdminNote" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReview" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "period" "BillingPeriod" NOT NULL,
    "expectedEtb" INTEGER NOT NULL,
    "bankCode" TEXT NOT NULL,
    "receiptKey" TEXT NOT NULL,
    "reference" TEXT,
    "paidEtb" INTEGER,
    "payerName" TEXT,
    "receiptDate" TIMESTAMP(3),
    "reasons" TEXT[],
    "status" "PaymentReviewStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "trialEnabled" BOOLEAN NOT NULL DEFAULT true,
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "reminderDays" INTEGER[] DEFAULT ARRAY[7, 3, 1]::INTEGER[],
    "graceDays" INTEGER NOT NULL DEFAULT 3,
    "restrictedDays" INTEGER NOT NULL DEFAULT 7,
    "restrictedBlocks" TEXT[] DEFAULT ARRAY['receipt_checks', 'orders', 'reports', 'staff']::TEXT[],
    "priceNormalMonthly" INTEGER NOT NULL DEFAULT 700,
    "priceNormalQuarterly" INTEGER NOT NULL DEFAULT 1500,
    "priceRestaurantMonthly" INTEGER NOT NULL DEFAULT 4000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "cause" TEXT NOT NULL,
    "route" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCounter" (
    "day" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyCounter_pkey" PRIMARY KEY ("day","key")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "bodyAm" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'all',
    "plan" "Plan",
    "city" TEXT,
    "showFrom" TIMESTAMP(3) NOT NULL,
    "hideOn" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminNote_businessId_createdAt_idx" ON "AdminNote"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentReview_status_createdAt_idx" ON "PaymentReview"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReview_businessId_receiptKey_key" ON "PaymentReview"("businessId", "receiptKey");

-- CreateIndex
CREATE UNIQUE INDEX "ErrorLog_key_key" ON "ErrorLog"("key");

-- CreateIndex
CREATE INDEX "Announcement_showFrom_hideOn_idx" ON "Announcement"("showFrom", "hideOn");

-- AddForeignKey
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReview" ADD CONSTRAINT "PaymentReview_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReview" ADD CONSTRAINT "PaymentReview_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


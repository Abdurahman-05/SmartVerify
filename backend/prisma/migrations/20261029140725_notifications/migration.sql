-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "bigPaymentEtb" INTEGER NOT NULL DEFAULT 5000;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "onceKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_memberId_createdAt_idx" ON "Notification"("memberId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_memberId_onceKey_key" ON "Notification"("memberId", "onceKey");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "BusinessMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

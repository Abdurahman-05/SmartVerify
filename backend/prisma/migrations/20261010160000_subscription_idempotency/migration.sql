-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_businessId_idempotencyKey_key" ON "Subscription"("businessId", "idempotencyKey");

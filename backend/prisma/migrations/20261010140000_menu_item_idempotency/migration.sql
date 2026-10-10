-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_businessId_idempotencyKey_key" ON "MenuItem"("businessId", "idempotencyKey");

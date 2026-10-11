-- CreateTable
CREATE TABLE "BillPaymentScan" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amountEtb" INTEGER NOT NULL,
    "cashEtb" INTEGER NOT NULL DEFAULT 0,
    "reference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillPaymentScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillPaymentScan_billId_idx" ON "BillPaymentScan"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "BillPaymentScan_businessId_idempotencyKey_key" ON "BillPaymentScan"("businessId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "BillPaymentScan" ADD CONSTRAINT "BillPaymentScan_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillPaymentScan" ADD CONSTRAINT "BillPaymentScan_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillPaymentScan" ADD CONSTRAINT "BillPaymentScan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "BusinessMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Money is non-negative integer ETB
ALTER TABLE "BillPaymentScan" ADD CONSTRAINT "BillPaymentScan_money_nonneg" CHECK ("amountEtb" >= 0 AND "cashEtb" >= 0);

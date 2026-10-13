-- Failed bank receipt checks, kept for history.
-- CreateEnum
CREATE TYPE "ReceiptCheckStatus" AS ENUM ('not_matching', 'unable_to_verify');

-- CreateTable
CREATE TABLE "ReceiptCheck" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "checkedById" TEXT NOT NULL,
    "billId" TEXT,
    "bankCode" TEXT NOT NULL,
    "status" "ReceiptCheckStatus" NOT NULL,
    "reasons" TEXT[],
    "reference" TEXT,
    "receiptAmountEtb" INTEGER,
    "expectedAmountEtb" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReceiptCheck_businessId_createdAt_idx" ON "ReceiptCheck"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReceiptCheck" ADD CONSTRAINT "ReceiptCheck_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptCheck" ADD CONSTRAINT "ReceiptCheck_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "BusinessMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptCheck" ADD CONSTRAINT "ReceiptCheck_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Amounts are integer ETB; a failed check always has a reason.
ALTER TABLE "ReceiptCheck" ADD CONSTRAINT "ReceiptCheck_amounts" CHECK ("expectedAmountEtb" > 0 AND ("receiptAmountEtb" IS NULL OR "receiptAmountEtb" >= 0));
ALTER TABLE "ReceiptCheck" ADD CONSTRAINT "ReceiptCheck_has_reason" CHECK (cardinality("reasons") > 0);

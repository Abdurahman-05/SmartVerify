-- CBE Birr receipts carry two IDs: the DKJ receipt number (the reference) and the CBE core FT
-- reference. The FT reference is kept here so the same payment is refused through CBE too.
ALTER TABLE "Transaction" ADD COLUMN "altReference" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_altReference_idx" ON "Transaction"("altReference");

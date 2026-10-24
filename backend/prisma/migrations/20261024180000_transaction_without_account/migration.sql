-- Receipts checked by link or number are saved without a known receiving account.
ALTER TABLE "Transaction" ALTER COLUMN "bankAccountId" DROP NOT NULL;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SpendingCategory" ADD VALUE 'DRINKS';
ALTER TYPE "SpendingCategory" ADD VALUE 'GAS';
ALTER TYPE "SpendingCategory" ADD VALUE 'RENT';
ALTER TYPE "SpendingCategory" ADD VALUE 'SALARY';
ALTER TYPE "SpendingCategory" ADD VALUE 'REPAIRS';

-- AlterTable
ALTER TABLE "Spending" ADD COLUMN     "changedAt" TIMESTAMP(3),
ADD COLUMN     "changedBy" TEXT,
ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "oldAmount" INTEGER,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);

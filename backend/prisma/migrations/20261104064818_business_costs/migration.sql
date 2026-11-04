-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "costKinds" "SpendingCategory"[] DEFAULT ARRAY['RENT', 'SALARY', 'GAS', 'REPAIRS', 'TRANSPORT', 'BILLS']::"SpendingCategory"[];

-- AlterTable
ALTER TABLE "Spending" ADD COLUMN     "forBusiness" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hasReceipt" BOOLEAN NOT NULL DEFAULT true;

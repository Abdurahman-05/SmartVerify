-- CreateEnum
CREATE TYPE "BuyWhen" AS ENUM ('TODAY', 'WEEK');

-- CreateEnum
CREATE TYPE "BuyStatus" AS ENUM ('OPEN', 'BOUGHT');

-- CreateEnum
CREATE TYPE "PaidFrom" AS ENUM ('CASH', 'BANK');

-- CreateEnum
CREATE TYPE "SpendingCategory" AS ENUM ('FOOD', 'TRANSPORT', 'BILLS', 'OTHER');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "featureBuyList" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "featureMoneyOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BuyItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" TEXT,
    "when" "BuyWhen" NOT NULL,
    "status" "BuyStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "boughtById" TEXT,
    "price" INTEGER,
    "paidFrom" "PaidFrom",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "boughtAt" TIMESTAMP(3),

    CONSTRAINT "BuyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spending" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" "SpendingCategory" NOT NULL,
    "paidFrom" "PaidFrom" NOT NULL,
    "buyItemId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Spending_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuyItem_businessId_status_createdAt_idx" ON "BuyItem"("businessId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Spending_buyItemId_key" ON "Spending"("buyItemId");

-- CreateIndex
CREATE INDEX "Spending_businessId_createdAt_idx" ON "Spending"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "BuyItem" ADD CONSTRAINT "BuyItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyItem" ADD CONSTRAINT "BuyItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "BusinessMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyItem" ADD CONSTRAINT "BuyItem_boughtById_fkey" FOREIGN KEY ("boughtById") REFERENCES "BusinessMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spending" ADD CONSTRAINT "Spending_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spending" ADD CONSTRAINT "Spending_buyItemId_fkey" FOREIGN KEY ("buyItemId") REFERENCES "BuyItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spending" ADD CONSTRAINT "Spending_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "BusinessMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

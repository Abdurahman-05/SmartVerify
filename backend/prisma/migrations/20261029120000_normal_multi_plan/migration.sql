-- AlterEnum
ALTER TYPE "Plan" ADD VALUE 'normal_multi';

-- AlterTable
ALTER TABLE "PlatformSettings" ALTER COLUMN "priceNormalMonthly" SET DEFAULT 1000,
ADD COLUMN     "priceNormalMultiMonthly" INTEGER NOT NULL DEFAULT 1500;

-- New prices: Normal (2 devices) 1,000 ETB, Normal Multi 1,500 ETB a month.
UPDATE "PlatformSettings" SET "priceNormalMonthly" = 1000 WHERE "priceNormalMonthly" = 700;

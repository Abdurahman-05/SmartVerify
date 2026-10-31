-- AlterEnum
ALTER TYPE "Plan" ADD VALUE 'restaurant_normal';

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "priceRestaurantNormalMonthly" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "priceRestaurantNormalQuarterly" INTEGER NOT NULL DEFAULT 1500;

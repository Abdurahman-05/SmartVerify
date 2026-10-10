-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "catalogKey" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "nameAm" TEXT;

-- A catalog entry can be added once per business (deleted items do not count).
CREATE UNIQUE INDEX "MenuItem_catalogKey_active_unique" ON "MenuItem"("businessId", "catalogKey") WHERE "catalogKey" IS NOT NULL AND "deletedAt" IS NULL;

-- One item per name per business, ignoring case and spaces (deleted items do not count).
CREATE UNIQUE INDEX "MenuItem_name_active_unique" ON "MenuItem"("businessId", lower(regexp_replace("name", '\s', '', 'g'))) WHERE "deletedAt" IS NULL;

-- A deleted item is never available for new orders.
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_deleted_not_active" CHECK ("deletedAt" IS NULL OR "active" = false);
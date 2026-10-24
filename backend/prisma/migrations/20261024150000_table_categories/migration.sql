-- Table categories made by the owner or manager ("Main floor", "VIP", "Garden"...).

-- CreateTable
CREATE TABLE "TableCategory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAm" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TableCategory_businessId_idx" ON "TableCategory"("businessId");

-- AddForeignKey
ALTER TABLE "TableCategory" ADD CONSTRAINT "TableCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One category per name per business, ignoring case and spaces (deleted ones do not count).
CREATE UNIQUE INDEX "TableCategory_name_active_unique" ON "TableCategory"("businessId", lower(regexp_replace("name", '\s', '', 'g'))) WHERE "deletedAt" IS NULL;

-- Every business starts with the three areas the app always had.
INSERT INTO "TableCategory" ("id", "businessId", "name", "nameAm", "sortOrder")
SELECT 'tcat_' || md5(b."id" || k."area"), b."id", k."name", k."nameAm", k."sortOrder"
FROM "Business" b
CROSS JOIN (VALUES
  ('main', 'Main Floor', 'ዋናው ወለል', 0),
  ('upstairs', 'Upstairs', 'ፎቅ ላይ', 1),
  ('outside', 'Outside', 'ውጪ', 2)
) AS k("area", "name", "nameAm", "sortOrder");

-- Existing tables move into the category of their old area.
ALTER TABLE "RestaurantTable" ADD COLUMN "categoryId" TEXT;
UPDATE "RestaurantTable" SET "categoryId" = 'tcat_' || md5("businessId" || "area"::text);
ALTER TABLE "RestaurantTable" ALTER COLUMN "categoryId" SET NOT NULL;

-- Table numbers are now unique inside a category.
DROP INDEX "RestaurantTable_businessId_area_number_key";
CREATE UNIQUE INDEX "RestaurantTable_businessId_categoryId_number_key" ON "RestaurantTable"("businessId", "categoryId", "number");
CREATE INDEX "RestaurantTable_categoryId_idx" ON "RestaurantTable"("categoryId");

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TableCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The fixed list of areas is replaced by categories.
ALTER TABLE "RestaurantTable" DROP COLUMN "area";
DROP TYPE "TableArea";

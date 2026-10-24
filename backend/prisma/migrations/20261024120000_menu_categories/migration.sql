-- Menu categories made by the owner or manager ("Hot drinks", "Fast food"...).

-- CreateTable
CREATE TABLE "ItemCategory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAm" TEXT,
    "kind" "MenuCategory" NOT NULL DEFAULT 'food',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemCategory_businessId_idx" ON "ItemCategory"("businessId");

-- AddForeignKey
ALTER TABLE "ItemCategory" ADD CONSTRAINT "ItemCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One category per name per business, ignoring case and spaces (deleted ones do not count).
CREATE UNIQUE INDEX "ItemCategory_name_active_unique" ON "ItemCategory"("businessId", lower(regexp_replace("name", '\s', '', 'g'))) WHERE "deletedAt" IS NULL;

-- Every business starts with the three categories the app always had.
INSERT INTO "ItemCategory" ("id", "businessId", "name", "nameAm", "kind", "sortOrder")
SELECT 'cat_' || md5(b."id" || k."kind"), b."id", k."name", k."nameAm", k."kind"::"MenuCategory", k."sortOrder"
FROM "Business" b
CROSS JOIN (VALUES
  ('food', 'Food', 'ምግብ', 0),
  ('drinks', 'Drinks', 'መጠጥ', 1),
  ('combos', 'Combos', 'ጥምር', 2)
) AS k("kind", "name", "nameAm", "sortOrder");

-- Existing items move into the category of their kind.
ALTER TABLE "MenuItem" ADD COLUMN "categoryId" TEXT;
UPDATE "MenuItem" m SET "categoryId" = c."id"
FROM "ItemCategory" c
WHERE c."businessId" = m."businessId" AND c."kind" = m."category";
ALTER TABLE "MenuItem" ALTER COLUMN "categoryId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ItemCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

-- The on/off switch is gone from the Menu screen: nothing may stay hidden because of it.
UPDATE "MenuItem" SET "active" = true WHERE "deletedAt" IS NULL AND "active" = false;

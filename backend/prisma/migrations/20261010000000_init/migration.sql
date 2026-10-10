-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'manager', 'waiter', 'chef');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('normal', 'restaurant');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('monthly', 'quarterly');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('verified', 'pending', 'mismatch', 'duplicate');

-- CreateEnum
CREATE TYPE "TransactionReason" AS ENUM ('nameMismatch', 'amountMismatch', 'duplicate');

-- CreateEnum
CREATE TYPE "MenuCategory" AS ENUM ('food', 'drinks', 'combos');

-- CreateEnum
CREATE TYPE "TableArea" AS ENUM ('main', 'upstairs', 'outside');

-- CreateEnum
CREATE TYPE "BillType" AS ENUM ('dine', 'takeaway', 'delivery');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('open', 'paid');

-- CreateEnum
CREATE TYPE "ServedStatus" AS ENUM ('kitchen', 'served');

-- CreateEnum
CREATE TYPE "OrderNote" AS ENUM ('noOnion', 'lessSpicy', 'rush', 'takeaway');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('bank', 'cash+bank', 'cash');

-- CreateEnum
CREATE TYPE "TipSource" AS ENUM ('bank', 'cash');

-- CreateEnum
CREATE TYPE "KitchenStatus" AS ENUM ('new', 'cooking', 'ready');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "pinIsTemporary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "plan" "Plan",
    "packingFeeEtb" INTEGER NOT NULL DEFAULT 30,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Addis_Ababa',
    "nextOrderNumber" INTEGER NOT NULL DEFAULT 1001,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessMember" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "canChangeDeliveryFee" BOOLEAN NOT NULL DEFAULT false,
    "canSeeReports" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "period" "BillingPeriod" NOT NULL,
    "priceEtb" INTEGER NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bank" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "holderName" TEXT,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "billId" TEXT,
    "reference" TEXT,
    "payerName" TEXT,
    "registeredName" TEXT,
    "expectedAmount" INTEGER NOT NULL,
    "receivedAmount" INTEGER NOT NULL DEFAULT 0,
    "status" "TransactionStatus" NOT NULL,
    "reason" "TransactionReason",
    "duplicateOfId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceEtb" INTEGER NOT NULL,
    "category" "MenuCategory" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantTable" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "area" "TableArea" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryArea" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "usualFeeEtb" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DeliveryArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" "BillType" NOT NULL,
    "tableId" TEXT,
    "guests" INTEGER,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "deliveryAreaId" TEXT,
    "address" TEXT,
    "usualDeliveryFeeEtb" INTEGER,
    "deliveryFeeChangedById" TEXT,
    "foodTotalEtb" INTEGER NOT NULL,
    "packingFeeEtb" INTEGER NOT NULL DEFAULT 0,
    "deliveryFeeEtb" INTEGER NOT NULL DEFAULT 0,
    "totalEtb" INTEGER NOT NULL,
    "bankReceivedEtb" INTEGER NOT NULL DEFAULT 0,
    "waiterId" TEXT NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'open',
    "servedStatus" "ServedStatus" NOT NULL DEFAULT 'kitchen',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "notes" "OrderNote"[],
    "waiterId" TEXT NOT NULL,
    "foodTotalEtb" INTEGER NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "priceEtb" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenOrder" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "KitchenStatus" NOT NULL DEFAULT 'new',
    "startedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitchenOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "cashEtb" INTEGER NOT NULL DEFAULT 0,
    "bankEtb" INTEGER NOT NULL DEFAULT 0,
    "tipEtb" INTEGER NOT NULL DEFAULT 0,
    "changeEtb" INTEGER NOT NULL DEFAULT 0,
    "recordedById" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tip" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountEtb" INTEGER NOT NULL,
    "source" "TipSource" NOT NULL,
    "waiterId" TEXT NOT NULL,
    "paidOut" BOOLEAN NOT NULL DEFAULT false,
    "paidOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Business_ownerId_key" ON "Business"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessMember_userId_key" ON "BusinessMember"("userId");

-- CreateIndex
CREATE INDEX "BusinessMember_businessId_idx" ON "BusinessMember"("businessId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Subscription_businessId_status_idx" ON "Subscription"("businessId", "status");

-- CreateIndex
CREATE INDEX "BankAccount_businessId_idx" ON "BankAccount"("businessId");

-- CreateIndex
CREATE INDEX "Transaction_businessId_createdAt_idx" ON "Transaction"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_businessId_bankAccountId_createdAt_idx" ON "Transaction"("businessId", "bankAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_billId_idx" ON "Transaction"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_businessId_idempotencyKey_key" ON "Transaction"("businessId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MenuItem_businessId_active_idx" ON "MenuItem"("businessId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantTable_businessId_area_number_key" ON "RestaurantTable"("businessId", "area", "number");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryArea_businessId_name_key" ON "DeliveryArea"("businessId", "name");

-- CreateIndex
CREATE INDEX "Bill_businessId_status_createdAt_idx" ON "Bill"("businessId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Bill_businessId_waiterId_status_idx" ON "Bill"("businessId", "waiterId", "status");

-- CreateIndex
CREATE INDEX "Order_billId_idx" ON "Order"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_businessId_number_key" ON "Order"("businessId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_businessId_idempotencyKey_key" ON "Order"("businessId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenOrder_orderId_key" ON "KitchenOrder"("orderId");

-- CreateIndex
CREATE INDEX "KitchenOrder_businessId_status_createdAt_idx" ON "KitchenOrder"("businessId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_billId_key" ON "Payment"("billId");

-- CreateIndex
CREATE INDEX "Payment_businessId_createdAt_idx" ON "Payment"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_businessId_idempotencyKey_key" ON "Payment"("businessId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Tip_paymentId_key" ON "Tip"("paymentId");

-- CreateIndex
CREATE INDEX "Tip_businessId_waiterId_createdAt_idx" ON "Tip"("businessId", "waiterId", "createdAt");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessMember" ADD CONSTRAINT "BusinessMember_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessMember" ADD CONSTRAINT "BusinessMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessMember" ADD CONSTRAINT "BusinessMember_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "BusinessMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "BusinessMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_bankCode_fkey" FOREIGN KEY ("bankCode") REFERENCES "Bank"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "BusinessMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryArea" ADD CONSTRAINT "DeliveryArea_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_deliveryAreaId_fkey" FOREIGN KEY ("deliveryAreaId") REFERENCES "DeliveryArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_deliveryFeeChangedById_fkey" FOREIGN KEY ("deliveryFeeChangedById") REFERENCES "BusinessMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "BusinessMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "BusinessMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenOrder" ADD CONSTRAINT "KitchenOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenOrder" ADD CONSTRAINT "KitchenOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "BusinessMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "BusinessMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Constraints Prisma cannot express ──────────────────────────────────────

-- Formats
ALTER TABLE "User" ADD CONSTRAINT "User_phone_format" CHECK ("phone" ~ '^[79][0-9]{8}$');
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_number_format" CHECK ("accountNumber" ~ '^[0-9]{10,13}$');
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_last4_format" CHECK ("last4" ~ '^[0-9]{4}$' AND "last4" = right("accountNumber", 4));
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_customerPhone_format" CHECK ("customerPhone" IS NULL OR "customerPhone" ~ '^0[79][0-9]{8}$');

-- One owner per business
CREATE UNIQUE INDEX "BusinessMember_one_owner" ON "BusinessMember"("businessId") WHERE "role" = 'owner';

-- A bank account can be connected once per business (removed accounts do not count)
CREATE UNIQUE INDEX "BankAccount_active_unique" ON "BankAccount"("businessId", "bankCode", "accountNumber") WHERE "removedAt" IS NULL;

-- A bank reference can be verified only once (duplicate protection, across all businesses)
CREATE UNIQUE INDEX "Transaction_verified_reference_unique" ON "Transaction"("bankCode", "reference") WHERE "status" = 'verified';
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_verified_has_reference" CHECK ("status" <> 'verified' OR "reference" IS NOT NULL);

-- One open dine-in bill per table (a busy table cannot get a second bill)
CREATE UNIQUE INDEX "Bill_one_open_per_table" ON "Bill"("tableId") WHERE "status" = 'open' AND "type" = 'dine';

-- Bill shape and totals
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_dine_has_table" CHECK ("type" <> 'dine' OR "tableId" IS NOT NULL);
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_fees_by_type" CHECK (
  ("type" = 'dine' AND "packingFeeEtb" = 0 AND "deliveryFeeEtb" = 0) OR
  ("type" = 'takeaway' AND "deliveryFeeEtb" = 0) OR
  ("type" = 'delivery'));
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_total" CHECK ("totalEtb" = "foodTotalEtb" + "packingFeeEtb" + "deliveryFeeEtb");
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_paid_has_paidAt" CHECK (("status" = 'paid') = ("paidAt" IS NOT NULL));
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_guests_positive" CHECK ("guests" IS NULL OR "guests" > 0);

-- Money is non-negative integer ETB
ALTER TABLE "Business" ADD CONSTRAINT "Business_money_nonneg" CHECK ("packingFeeEtb" >= 0);
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_money_nonneg" CHECK ("priceEtb" >= 0);
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_dates" CHECK ("endsAt" > "startedAt");
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_money_nonneg" CHECK ("expectedAmount" >= 0 AND "receivedAmount" >= 0);
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_money_nonneg" CHECK ("priceEtb" >= 0);
ALTER TABLE "DeliveryArea" ADD CONSTRAINT "DeliveryArea_money_nonneg" CHECK ("usualFeeEtb" >= 0);
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_money_nonneg" CHECK ("foodTotalEtb" >= 0 AND "packingFeeEtb" >= 0 AND "deliveryFeeEtb" >= 0 AND "bankReceivedEtb" >= 0 AND ("usualDeliveryFeeEtb" IS NULL OR "usualDeliveryFeeEtb" >= 0));
ALTER TABLE "Order" ADD CONSTRAINT "Order_money_nonneg" CHECK ("foodTotalEtb" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_values" CHECK ("priceEtb" >= 0 AND "quantity" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_money_nonneg" CHECK ("cashEtb" >= 0 AND "bankEtb" >= 0 AND "tipEtb" >= 0 AND "changeEtb" >= 0);
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_amount_positive" CHECK ("amountEtb" > 0);

-- ─── Reference data: supported banks (same list as the app; update when the real list is confirmed) ─

INSERT INTO "Bank" ("code", "name", "shortName", "sortOrder") VALUES
  ('CBE', 'Commercial Bank of Ethiopia', 'CBE', 1),
  ('TEL', 'Telebirr', 'Telebirr', 2),
  ('AWA', 'Awash Bank', 'Awash', 3),
  ('DAS', 'Dashen Bank', 'Dashen', 4),
  ('BOA', 'Bank of Abyssinia', 'BOA', 5),
  ('ABY', 'Abay Bank', 'Abay', 6),
  ('WEG', 'Wegagen Bank', 'Wegagen', 7),
  ('HIB', 'Hibret Bank', 'Hibret', 8),
  ('NIB', 'Nib International Bank', 'Nib', 9),
  ('COO', 'Cooperative Bank of Oromia', 'Coop', 10),
  ('ZEM', 'Zemen Bank', 'Zemen', 11);

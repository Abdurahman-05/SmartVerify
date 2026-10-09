-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'manager', 'waiter', 'chef');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('normal', 'restaurant');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('monthly', 'quarterly');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "VerificationInputType" AS ENUM ('qr', 'ocr', 'sms');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('verified', 'mismatch', 'duplicate', 'pending', 'unable_to_verify');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('verified', 'pending', 'mismatch', 'duplicate');

-- CreateEnum
CREATE TYPE "MenuCategory" AS ENUM ('food', 'drinks', 'combos');

-- CreateEnum
CREATE TYPE "TableArea" AS ENUM ('main', 'upstairs', 'outside');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('dine', 'takeaway', 'delivery');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('open', 'paid');

-- CreateEnum
CREATE TYPE "ServedStatus" AS ENUM ('kitchen', 'served');

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
CREATE TABLE "VerificationAttempt" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "inputType" "VerificationInputType" NOT NULL,
    "expectedAmount" INTEGER NOT NULL,
    "accountHintId" TEXT,
    "status" "VerificationStatus" NOT NULL,
    "reason" TEXT,
    "providerId" TEXT,
    "transactionId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "payerName" TEXT NOT NULL,
    "expectedAmount" INTEGER NOT NULL,
    "receivedAmount" INTEGER NOT NULL,
    "status" "TransactionStatus" NOT NULL,
    "occurredAt" TIMESTAMP(3),
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
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "type" "OrderType" NOT NULL,
    "tableId" TEXT,
    "guests" INTEGER,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "deliveryAreaId" TEXT,
    "address" TEXT,
    "deliveryFeeEtb" INTEGER,
    "usualDeliveryFeeEtb" INTEGER,
    "notes" TEXT[],
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
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderNo" INTEGER NOT NULL,
    "type" "OrderType" NOT NULL,
    "tableId" TEXT,
    "guests" INTEGER,
    "customerName" TEXT,
    "phone" TEXT,
    "area" TEXT,
    "address" TEXT,
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

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillItem" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "priceEtb" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "BillItem_pkey" PRIMARY KEY ("id")
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
    "waiterId" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenOrder" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "status" "KitchenStatus" NOT NULL DEFAULT 'new',
    "startedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitchenOrder_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "VerificationAttempt_transactionId_key" ON "VerificationAttempt"("transactionId");

-- CreateIndex
CREATE INDEX "VerificationAttempt_businessId_createdAt_idx" ON "VerificationAttempt"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationAttempt_businessId_idempotencyKey_key" ON "VerificationAttempt"("businessId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Transaction_businessId_createdAt_idx" ON "Transaction"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_businessId_bankAccountId_createdAt_idx" ON "Transaction"("businessId", "bankAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "MenuItem_businessId_active_idx" ON "MenuItem"("businessId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantTable_businessId_area_number_key" ON "RestaurantTable"("businessId", "area", "number");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryArea_businessId_name_key" ON "DeliveryArea"("businessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Order_businessId_number_key" ON "Order"("businessId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_businessId_idempotencyKey_key" ON "Order"("businessId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_orderId_key" ON "Bill"("orderId");

-- CreateIndex
CREATE INDEX "Bill_businessId_status_createdAt_idx" ON "Bill"("businessId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BillItem_billId_idx" ON "BillItem"("billId");

-- CreateIndex
CREATE INDEX "Payment_businessId_createdAt_idx" ON "Payment"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_businessId_idempotencyKey_key" ON "Payment"("businessId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Tip_paymentId_key" ON "Tip"("paymentId");

-- CreateIndex
CREATE INDEX "Tip_businessId_waiterId_createdAt_idx" ON "Tip"("businessId", "waiterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenOrder_orderId_key" ON "KitchenOrder"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenOrder_billId_key" ON "KitchenOrder"("billId");

-- CreateIndex
CREATE INDEX "KitchenOrder_businessId_status_createdAt_idx" ON "KitchenOrder"("businessId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessMember" ADD CONSTRAINT "BusinessMember_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessMember" ADD CONSTRAINT "BusinessMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "BusinessMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationAttempt" ADD CONSTRAINT "VerificationAttempt_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationAttempt" ADD CONSTRAINT "VerificationAttempt_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "BusinessMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationAttempt" ADD CONSTRAINT "VerificationAttempt_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryArea" ADD CONSTRAINT "DeliveryArea_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryAreaId_fkey" FOREIGN KEY ("deliveryAreaId") REFERENCES "DeliveryArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "BusinessMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "BusinessMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "BusinessMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "KitchenOrder" ADD CONSTRAINT "KitchenOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenOrder" ADD CONSTRAINT "KitchenOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenOrder" ADD CONSTRAINT "KitchenOrder_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Constraints Prisma cannot express ──────────────────────────────────────

-- A bank account can be connected once per business (removed accounts do not count).
CREATE UNIQUE INDEX "BankAccount_active_unique"
  ON "BankAccount" ("businessId", "bankCode", "accountNumber")
  WHERE "removedAt" IS NULL;

-- Duplicate protection: a bank reference can be verified only once per business.
CREATE UNIQUE INDEX "Transaction_verified_reference_unique"
  ON "Transaction" ("businessId", "bankCode", "reference")
  WHERE "status" = 'verified';

-- One open dine-in bill per table.
CREATE UNIQUE INDEX "Bill_open_table_unique"
  ON "Bill" ("tableId")
  WHERE "status" = 'open' AND "type" = 'dine' AND "tableId" IS NOT NULL;

-- Money is integer ETB and never negative; bill total is always food + packing + delivery.
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_total_check"
  CHECK ("totalEtb" = "foodTotalEtb" + "packingFeeEtb" + "deliveryFeeEtb");
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_amounts_nonnegative"
  CHECK ("foodTotalEtb" >= 0 AND "packingFeeEtb" >= 0 AND "deliveryFeeEtb" >= 0 AND "bankReceivedEtb" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amounts_nonnegative"
  CHECK ("cashEtb" >= 0 AND "bankEtb" >= 0 AND "tipEtb" >= 0 AND "changeEtb" >= 0);
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_amount_positive" CHECK ("amountEtb" > 0);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_amounts_nonnegative"
  CHECK ("expectedAmount" >= 0 AND "receivedAmount" >= 0);
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_price_nonnegative" CHECK ("priceEtb" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0 AND "priceEtb" >= 0);
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_quantity_positive" CHECK ("quantity" > 0 AND "priceEtb" >= 0);
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_price_nonnegative" CHECK ("priceEtb" >= 0);
ALTER TABLE "DeliveryArea" ADD CONSTRAINT "DeliveryArea_fee_nonnegative" CHECK ("usualFeeEtb" >= 0);
ALTER TABLE "Business" ADD CONSTRAINT "Business_packing_fee_nonnegative" CHECK ("packingFeeEtb" >= 0);

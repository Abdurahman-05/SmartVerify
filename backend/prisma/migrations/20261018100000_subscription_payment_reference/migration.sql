-- The CBE receipt that paid for a subscription; one receipt pays once.
ALTER TABLE "Subscription" ADD COLUMN "paymentReference" TEXT;
CREATE UNIQUE INDEX "Subscription_paymentReference_key" ON "Subscription"("paymentReference");
